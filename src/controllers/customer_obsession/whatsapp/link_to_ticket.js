const mongoose = require('mongoose');
const payservedb = require('payservedb');

async function resolveTicket(ticketIdOrNumber) {
  if (mongoose.Types.ObjectId.isValid(ticketIdOrNumber)) {
    const byId = await payservedb.CustomerTicket.findById(ticketIdOrNumber).lean();
    if (byId) return byId;
  }

  return payservedb.CustomerTicket.findOne({ ticket_number: ticketIdOrNumber }).lean();
}

async function link_to_ticket(request, reply) {
  try {
    const { chat_id, ticket_id_or_number } = request.body;

    if (!chat_id || !ticket_id_or_number) {
      return reply.code(400).send({
        success: false,
        error: 'chat_id and ticket_id_or_number are required'
      });
    }

    const ticket = await resolveTicket(ticket_id_or_number);
    if (!ticket) {
      return reply.code(404).send({
        success: false,
        error: 'Ticket not found'
      });
    }

    await payservedb.WhatsappConversation.updateMany(
      { chat_id },
      {
        $set: {
          linked_ticket_id: ticket._id,
          linked_by: request.user.userId,
          linked_at: new Date()
        }
      }
    );

    await payservedb.CustomerTicket.findByIdAndUpdate(ticket._id, {
      $push: {
        interactions: {
          agent_id: request.user.userId,
          message: `WhatsApp chat linked: ${chat_id}||ref:whatsapp:${chat_id}`,
          is_internal_note: true,
          created_at: new Date()
        }
      }
    });

    return reply.code(200).send({
      success: true,
      message: 'WhatsApp chat linked to ticket successfully',
      data: {
        chat_id,
        ticket_id: ticket._id,
        ticket_number: ticket.ticket_number
      }
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to link WhatsApp chat to ticket',
      details: error.message
    });
  }
}

module.exports = link_to_ticket;
