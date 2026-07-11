const mongoose = require('mongoose');
const payservedb = require('payservedb');
const EmailThread = require('../../../models/email_thread');

async function resolveTicket(ticketIdOrNumber) {
  if (mongoose.Types.ObjectId.isValid(ticketIdOrNumber)) {
    const byId = await payservedb.CustomerTicket.findById(ticketIdOrNumber).lean();
    if (byId) return byId;
  }

  return payservedb.CustomerTicket.findOne({ ticket_number: ticketIdOrNumber }).lean();
}

async function link_email_to_ticket(request, reply) {
  try {
    const { email_id } = request.params;
    const { ticket_id, ticket_number, ticket_id_or_number } = request.body;
    const ticketIdentifier = ticket_id_or_number || ticket_id || ticket_number;

    if (!ticketIdentifier) {
      return reply.code(400).send({
        success: false,
        error: 'ticket_id, ticket_number, or ticket_id_or_number is required'
      });
    }

    const [email, ticket] = await Promise.all([
      EmailThread.findById(email_id).lean(),
      resolveTicket(ticketIdentifier)
    ]);

    if (!email) {
      return reply.code(404).send({
        success: false,
        error: 'Email thread not found'
      });
    }

    if (!ticket) {
      return reply.code(404).send({
        success: false,
        error: 'Ticket not found'
      });
    }

    const updatedEmail = await EmailThread.findByIdAndUpdate(
      email_id,
      {
        linked_ticket_id: ticket._id,
        linked_by: request.user.userId,
        linked_at: new Date()
      },
      { new: true }
    ).lean();

    await payservedb.CustomerTicket.findByIdAndUpdate(ticket._id, {
      $push: {
        interactions: {
          agent_id: request.user.userId,
          message: `Email linked: ${email.subject || 'No subject'} from ${email.from_email || 'Unknown sender'}||ref:email:${email_id}`,
          is_internal_note: true,
          created_at: new Date()
        }
      }
    });

    return reply.code(200).send({
      success: true,
      message: 'Email linked to ticket successfully',
      data: updatedEmail
    });
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Failed to link email to ticket',
      details: error.message
    });
  }
}

module.exports = link_email_to_ticket;
