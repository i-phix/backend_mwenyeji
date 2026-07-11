const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { logAuditAction } = require('../../../utils/ticket_audit');

// POST /api/customer_obsession/whatsapp/create-ticket
// Creates a new ticket from a WhatsApp chat and links it
async function create_ticket_from_wa(request, reply) {
    try {
        const agent = request.user;
        const { chat_id, category_id, facility_id, title, description, unit_id } = request.body;

        if (!chat_id || !category_id || !facility_id) {
            return reply.code(400).send({ success: false, error: 'chat_id, category_id, and facility_id are required' });
        }

        // Get recent messages for this chat to extract contact info
        const latestMsg = await payservedb.WhatsappConversation.findOne({ chat_id }).sort({ timestamp: -1 }).lean();
        if (!latestMsg) {
            return reply.code(404).send({ success: false, error: 'No WhatsApp messages found for this chat' });
        }

        const contactPhone = latestMsg.contact_phone || chat_id.replace('@c.us', '').replace(/\D/g, '');
        const contactName = latestMsg.contact_name || contactPhone;

        // Find customer by phone number
        const customer = await payservedb.Customer.findOne({
            $or: [
                { phoneNumber: { $regex: contactPhone.slice(-9) } },
                { phone: { $regex: contactPhone.slice(-9) } }
            ]
        }).lean();

        if (!customer) {
            return reply.code(404).send({
                success: false,
                error: `No customer found with phone ${contactPhone}. Please create the customer first.`
            });
        }

        const category = await payservedb.TicketCategory.findById(category_id).lean();
        if (!category || !category.is_active) {
            return reply.code(404).send({ success: false, error: 'Category not found or inactive' });
        }

        const ticketCount = await payservedb.CustomerTicket.countDocuments();
        const ticketNumber = `TK${new Date().getFullYear()}${String(ticketCount + 1).padStart(6, '0')}`;
        const sla_due_date = new Date(Date.now() + (category.sla_minutes * 60 * 1000));

        const ticketTitle = title || `WhatsApp: ${contactName}`;
        const ticketDescription = description || latestMsg.message_text || 'Created from WhatsApp conversation';

        const newTicket = new payservedb.CustomerTicket({
            ticket_number: ticketNumber,
            customer_id: customer._id,
            facility_id,
            unit_id: unit_id || null,
            title: ticketTitle,
            description: ticketDescription,
            category_id,
            status: 'in_progress',
            source: 'whatsapp',
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
                    message: `Ticket created from WhatsApp chat with ${contactName} (${contactPhone})`,
                    is_internal_note: false,
                    created_at: new Date(),
                }
            }
        });

        // Link all messages in this chat to the new ticket
        await payservedb.WhatsappConversation.updateMany(
            { chat_id, linked_ticket_id: { $exists: false } },
            { $set: { linked_ticket_id: newTicket._id, linked_at: new Date() } }
        );

        await logAuditAction(newTicket._id, agent, 'created', {
            source: 'whatsapp',
            description: `Ticket created from WhatsApp chat with ${contactName}`,
            metadata: { chat_id, ticket_number: ticketNumber }
        }, request);

        logger.info(`[wa→ticket] Ticket ${ticketNumber} created from chat ${chat_id} by agent ${agent.userId}`);

        return reply.code(200).send({
            success: true,
            message: 'Ticket created and WhatsApp chat linked successfully',
            data: { ticket_id: newTicket._id, ticket_number: ticketNumber },
        });
    } catch (error) {
        logger.error(`[create_ticket_from_wa] ${error.message}`);
        return reply.code(500).send({ success: false, error: error.message });
    }
}

module.exports = create_ticket_from_wa;
