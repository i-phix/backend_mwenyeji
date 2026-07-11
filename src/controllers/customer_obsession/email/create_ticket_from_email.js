const payservedb = require('payservedb');
const EmailThread = require('../../../models/email_thread');
const logger = require('../../../../config/winston');
const { logAuditAction } = require('../../../utils/ticket_audit');

// POST /api/customer_obsession/emails/:email_id/create-ticket
// Creates a new ticket directly from an email thread and links the email to it
async function create_ticket_from_email(request, reply) {
    try {
        const agent = request.user;
        const { email_id } = request.params;
        const { category_id, facility_id, title, description, unit_id } = request.body;

        if (!category_id || !facility_id) {
            return reply.code(400).send({ success: false, error: 'category_id and facility_id are required' });
        }

        const emailThread = await EmailThread.findById(email_id).lean();
        if (!emailThread) {
            return reply.code(404).send({ success: false, error: 'Email not found' });
        }

        if (emailThread.linked_ticket_id) {
            return reply.code(409).send({ success: false, error: 'This email is already linked to a ticket' });
        }

        // Try to find customer by email address
        const senderEmail = emailThread.from_email;
        const customer = await payservedb.Customer.findOne({
            $or: [{ email: senderEmail }, { 'contactInfo.email': senderEmail }]
        }).lean();

        if (!customer) {
            return reply.code(404).send({
                success: false,
                error: `No customer found with email ${senderEmail}. Please create the customer first.`
            });
        }

        const category = await payservedb.TicketCategory.findById(category_id).lean();
        if (!category || !category.is_active) {
            return reply.code(404).send({ success: false, error: 'Category not found or inactive' });
        }

        const ticketCount = await payservedb.CustomerTicket.countDocuments();
        const ticketNumber = `TK${new Date().getFullYear()}${String(ticketCount + 1).padStart(6, '0')}`;
        const sla_due_date = new Date(Date.now() + (category.sla_minutes * 60 * 1000));

        const ticketTitle = title || emailThread.subject || 'Email Support Request';
        const ticketDescription = description || emailThread.body_text?.slice(0, 500) || 'Created from email';

        const newTicket = new payservedb.CustomerTicket({
            ticket_number: ticketNumber,
            customer_id: customer._id,
            facility_id,
            unit_id: unit_id || null,
            title: ticketTitle,
            description: ticketDescription,
            category_id,
            status: 'in_progress',
            source: 'email',
            sla_due_date,
            created_by_agent_id: agent.userId,
            assigned_agent_id: agent.userId,
        });

        await newTicket.save();

        // Add initial interaction
        await payservedb.CustomerTicket.findByIdAndUpdate(newTicket._id, {
            $push: {
                interactions: {
                    agent_id: agent.userId,
                    message: `Ticket created from email sent by ${emailThread.from_name || senderEmail}. Subject: ${emailThread.subject}`,
                    is_internal_note: false,
                    created_at: new Date(),
                }
            }
        });

        // Link the email to the ticket
        await EmailThread.findByIdAndUpdate(email_id, {
            linked_ticket_id: newTicket._id,
            linked_by: agent.userId,
            linked_at: new Date(),
        });

        await logAuditAction(newTicket._id, agent, 'created', {
            source: 'email',
            description: `Ticket created from email (${senderEmail}) by agent`,
            metadata: { email_id, ticket_number: ticketNumber }
        }, request);

        logger.info(`[email→ticket] Ticket ${ticketNumber} created from email ${email_id} by agent ${agent.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Ticket created and email linked successfully',
            data: { ticket_id: newTicket._id, ticket_number: ticketNumber },
        });
    } catch (error) {
        logger.error(`[create_ticket_from_email] ${error.message}`);
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = create_ticket_from_email;
