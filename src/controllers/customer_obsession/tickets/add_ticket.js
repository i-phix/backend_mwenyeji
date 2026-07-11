const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { logAuditAction } = require('../../../utils/ticket_audit');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

async function add_ticket(request, reply) {
    try {
        const agent = request.user;

        const {
            customer_id: rawCustomerId,
            facility_id: rawFacilityId,
            unit_id: rawUnitId,
            title,
            description,
            category_id,
            source = 'phone',
            tags = [],
            attachments = [],
            custom_caller = null
        } = request.body;

        // Normalize empty strings to null so Mongoose doesn't try to cast '' as ObjectId
        const facility_id = rawFacilityId || null;
        const unit_id = rawUnitId || null;

        // Extract and validate agent ID - use userId as the database ID
        const agentId = agent.userId;

        if (!agentId) {
            return reply.code(401).send({
                success: false,
                error: 'Valid agent authentication required'
            });
        }

        // Resolve customer_id: normalize empty string to null, then try to resolve via custom_caller
        let customer_id = rawCustomerId || null;
        if (!customer_id && custom_caller) {
            const searchQuery = [];
            if (custom_caller.email) searchQuery.push({ email: custom_caller.email });
            if (custom_caller.phone) {
                searchQuery.push({ phoneNumber: custom_caller.phone });
                searchQuery.push({ phone: custom_caller.phone });
            }
            if (searchQuery.length > 0) {
                const found = await payservedb.Customer.findOne({ $or: searchQuery }).select('_id').lean();
                if (found) customer_id = found._id;
            }
        }

        // Validate required fields
        // - customer_id is optional when a custom_caller with name/phone is provided
        // - facility_id is optional for general enquiries (no specific unit)
        const hasCallerInfo = custom_caller && (custom_caller.name || custom_caller.phone || custom_caller.email);
        if ((!customer_id && !hasCallerInfo) || !title || !description || !category_id) {
            const missing = [];
            if (!customer_id && !hasCallerInfo) missing.push('customer (provide customer_id or custom_caller details)');
            if (!title) missing.push('title');
            if (!description) missing.push('description');
            if (!category_id) missing.push('category');
            return reply.code(400).send({
                success: false,
                error: `Missing required fields: ${missing.join(', ')}`
            });
        }

        // Validate and fetch category to get priority and SLA
        const category = await payservedb.TicketCategory.findById(category_id);
        if (!category) {
            return reply.code(404).send({
                success: false,
                error: 'Category not found'
            });
        }

        if (!category.is_active) {
            return reply.code(400).send({
                success: false,
                error: 'Selected category is not active'
            });
        }

        // Get SLA minutes from category
        const slaMinutes = category.sla_minutes;

        // Validate customer exists (only when customer_id was provided or resolved)
        let customer = null;
        if (customer_id) {
            customer = await payservedb.Customer.findById(customer_id);
            if (!customer) {
                return reply.code(404).send({
                    success: false,
                    error: 'Customer not found'
                });
            }
        }

        // Validate facility if provided (null = general enquiry)
        if (facility_id) {
            const facility = await payservedb.Facility.findById(facility_id).catch(() => null);
            if (!facility) {
                return reply.code(404).send({
                    success: false,
                    error: 'Facility not found'
                });
            }
        }

        // Generate ticket number
        const ticketCount = await payservedb.CustomerTicket.countDocuments();
        const ticketNumber = `TK${new Date().getFullYear()}${String(ticketCount + 1).padStart(6, '0')}`;

        // Calculate SLA due date based on category's SLA minutes
        const now = new Date();
        const sla_due_date = new Date(now.getTime() + (slaMinutes * 60 * 1000));

        // Create ticket
        const ticketData = {
            ticket_number: ticketNumber,
            customer_id,
            facility_id,
            unit_id,
            title,
            description,
            category_id,
            status: 'open',
            source: source,
            sla_due_date,
            tags,
            attachments,
            custom_caller,
            created_by_agent_id: agentId,
            assigned_agent_id: null
        };

        const newTicket = new payservedb.CustomerTicket(ticketData);
        await newTicket.save();

        // Auto-assign to the creating agent and add initial interaction
        await payservedb.CustomerTicket.findByIdAndUpdate(newTicket._id, {
            assigned_agent_id: agentId,
            status: 'in_progress',
            updated_at: new Date(),
            $push: {
                interactions: {
                    agent_id: agentId,
                    message: `Ticket created via ${source}. Initial issue: ${description}`,
                    is_internal_note: false,
                    created_at: new Date()
                }
            }
        });

        // Fetch the updated ticket with all populated fields
        const updatedTicket = await payservedb.CustomerTicket.findById(newTicket._id)
            .populate('customer_id', 'fullName firstName lastName email phoneNumber phone unitId address preferences')
            .populate('created_by_agent_id', 'fullName firstName lastName email phoneNumber')
            .populate('assigned_agent_id', 'fullName firstName lastName email phoneNumber')
            .populate('facility_id', 'name company_id address')
            .populate('category_id', 'name priority color sla_minutes')
            .lean();

        // Send notifications (placeholder for future implementation)
        // await sendTicketNotifications(newTicket._id, 'created');

        // Log ticket creation
        const createdByName = agent.fullName || `${agent.firstName || ''} ${agent.lastName || ''}`.trim();
        const customerName = customer
            ? (customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim())
            : (custom_caller?.name || 'Unknown Caller');
        logger.info(`Agent ${createdByName} (ID: ${agentId}) created ticket ${ticketNumber} for customer ${customerName}`);

        // Add comprehensive audit log for ticket creation
        await logAuditAction(
            newTicket._id,
            agent,
            'created',
            {
                source: source,
                description: `Ticket created via ${source} and auto-assigned to creator`,
                metadata: {
                    ticket_number: ticketNumber,
                    customer_name: customerName,
                    category: category.name,
                    priority: category.priority,
                    sla_due_date: sla_due_date,
                    initial_status: 'in_progress',
                    facility_id: facility_id,
                    unit_id: unit_id
                }
            },
            request
        );

        // Send notification to customer (or custom caller if no customer record)
        if (customer) {
            await sendCustomerTicketNotification(customer, ticketNumber, category.name, facility_id);
        } else if (custom_caller && (custom_caller.phone || custom_caller.email)) {
            await sendCustomerTicketNotification(
                { fullName: custom_caller.name, phoneNumber: custom_caller.phone, email: custom_caller.email },
                ticketNumber, category.name, facility_id
            );
        }

        return reply.code(200).send({
            success: true,
            message: 'Ticket created successfully and assigned to you',
            data: updatedTicket
        });

    } catch (error) {
        logger.error(`Error creating ticket: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to create ticket',
            details: error.message
        });
    }
}

// Helper function to send customer notification when ticket is created
async function sendCustomerTicketNotification(customer, ticketNumber, categoryName, facility_id) {
    try {
        const customerName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Valued Customer';
        const customerPhone = customer.phoneNumber || customer.phone;
        const customerEmail = customer.email;

        // Smart URL detection based on backend URL
        let customerPortalUrl;
        const backendUrl = process.env.BACKEND_URL || '';

        if (backendUrl.includes('localhost') || backendUrl.includes('127.0.0.1')) {
            customerPortalUrl = process.env.RESIDENT_PORTAL_URL_LOCAL || 'http://localhost:3000';
        } else if (backendUrl.includes('sandbox')) {
            customerPortalUrl = process.env.sandboxResidentFrontEndUrl || 'https://resident.sandbox.payserve.co.ke';
        } else {
            customerPortalUrl = process.env.residentFrontEndUrl || 'https://resident.payserve.co.ke';
        }

        // Brief SMS to reduce costs
        const smsMessage = `Hi ${customerName}, ticket #${ticketNumber} created for ${categoryName}. We're working on it. Track: ${customerPortalUrl} - PayServe`;

        const emailSubject = `Ticket #${ticketNumber} Created - PayServe Support`;
        const emailMessage = `Dear ${customerName},

Thank you for contacting PayServe Support.

Your support ticket has been created successfully:

Ticket Number: #${ticketNumber}
Category: ${categoryName}
Status: In Progress

What happens next?
1. Our support team has been assigned to your ticket
2. We will investigate and resolve your issue
3. You will receive updates via SMS and email
4. Once resolved, we'll send you a survey to rate our service

Track Your Ticket:
You can track the progress of your ticket by logging into the customer portal at:
${customerPortalUrl}

Need Help?
If you have any questions, please contact our support team.

Best regards,
PayServe Support Team

---
This is an automated message from PayServe Customer Support System.`;

        // Send SMS notification
        if (customerPhone) {
            try {
                await sendSms(facility_id, customerPhone, smsMessage);
                logger.info(`Customer notification SMS sent for ticket ${ticketNumber} to ${customerPhone}`);
            } catch (smsError) {
                logger.error(`Failed to send customer SMS for ticket ${ticketNumber}: ${smsError.message}`);
            }
        }

        // Send Email notification
        if (customerEmail) {
            try {
                await sendEmail(facility_id, customerEmail, emailSubject, emailMessage);
                logger.info(`Customer notification email sent for ticket ${ticketNumber} to ${customerEmail}`);
            } catch (emailError) {
                logger.error(`Failed to send customer email for ticket ${ticketNumber}: ${emailError.message}`);
            }
        }

    } catch (error) {
        logger.error(`Error sending customer notification: ${error.message}`);
        // Don't throw - notification failure should not break ticket creation
    }
}

module.exports = add_ticket;