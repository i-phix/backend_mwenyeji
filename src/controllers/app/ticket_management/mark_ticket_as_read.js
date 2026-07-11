const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
// const { sendSms } = require('../../../utils/send_new_sms');

const markTicketAsRead = async (request, reply) => {
  try {
    const { facilityId, ticketId } = request.params;
    const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

    // Find the ticket and check if it's already read
    const ticket = await ticketModel.findById(ticketId);
    if (!ticket) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }

    const ticketNumber = ticket.ticketNumber;
    const ticketSubject = ticket.subject;

    // If ticket is not read, mark it as read and send notification
    if (!ticket.isRead) {
      const updatedTicket = await ticketModel.findByIdAndUpdate(
        ticketId,
        {
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );

      let ticketRaiser = null;
      let isStaff = false;

      // Check if ticket was raised by staff (User) or resident (Customer)
      if (ticket.customerId) {
        // Try customer first
        ticketRaiser = await payservedb.Customer.findById(ticket.customerId);
        phoneNumber = ticketRaiser.phoneNumber
        if (!ticketRaiser) {
          // If not found in customers, try users (staff)
          ticketRaiser = await payservedb.User.findById(ticket.userId);
          phoneNumber = ticketRaiser.phoneNumber
          isStaff = true;
        }
      }

      // const message = `Your ticket, Ticket Number: ${ticketNumber}, has been read by management. We'll respond to your "${ticket.subject}" request shortly.`;

      // sendSms(facilityId, phoneNumber, message);

      return reply.code(200).send({
        message: 'Ticket marked as read',
        ticket: updatedTicket
      });
    }

    return reply.code(200).send({
      message: 'Ticket already read',
      ticket: ticket
    });

  } catch (err) {
    console.error('Error marking ticket as read:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = markTicketAsRead