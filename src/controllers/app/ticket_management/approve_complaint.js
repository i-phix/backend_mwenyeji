const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const sendApprovalNotification = async (request, reply) => {
  try {
    const { facilityId, ticketId } = request.params;
    const { review } = request.body;
    const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
    const ticket = await ticketModel.findById(ticketId);

    // Fetch customer or user info based on who raised the ticket
    let requesterInfo = null;

    if (ticket.customerId) {
      const customer = await payservedb.Customer.findById(ticket.customerId);
      if (customer) {
        requesterInfo = {
          fullName: `${customer.firstName} ${customer.lastName}`,
          phoneNumber: customer.phoneNumber,
          email: customer.email,
        };
      }
    } else if (ticket.userId) {
      const user = await payservedb.User.findById(ticket.userId);
      if (user) {
        requesterInfo = {
          fullName: `${user.fullName}`,
          phoneNumber: user.phoneNumber,
          email: user.email,
        };
      }
    }

    if (!requesterInfo) {
      return reply.code(404).send({ success: false, message: 'Requester not found.' });
    }

    // Update the ticket status to 'resolved'
    ticket.status = 'resolved';
    ticket.reviewed = true; // Mark as reviewed
    await ticket.save();

    // Send notification to the requester
    await sendNotification(facilityId, requesterInfo, ticket, review);

    return reply.code(200).send({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new Error('Failed to send notification');
  }
};

const sendNotification = async (facilityId, requesterInfo, ticket, review) => {
  const message = `Your ticket with subject: "${ticket.subject}" has been reviewed. Here's the review: "${review}". Thank you for your patience!`;
  sendSms(facilityId, requesterInfo.phoneNumber, message);
  sendEmail(facilityId, requesterInfo.email, 'Ticket Review', message);
};

module.exports = sendApprovalNotification;

