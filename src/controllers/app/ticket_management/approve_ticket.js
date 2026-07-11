const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { sendSms } = require('../../../utils/send_new_sms');
const { sendEmail } = require('../../../utils/send_new_email');

const ApproveTicket = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;
        const { approvedBy } = request.body;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
        const ticket = await ticketModel.findById(ticketId);

        if (!ticket) {
            return reply.code(404).send({ error: 'Ticket not found' });
        }

        // Send SMS notifications
        if (ticket.payerType === 'tenant') {
            const customer = await payservedb.Customer.findById(ticket.payer);
            if (customer && customer.phoneNumber) {
                // const baseUrl = "https://resident.sandbox.payserve.co.ke/resident/approvals/minimalApproval";
                const baseUrl = "https://resident.payserve.co.ke/resident/approvals/minimalApproval";
                const actionLink = `${baseUrl}/${facilityId}/${ticket._id}`;
                const message = `Your maintenance ticket has been reviewed. The total amount for services is ${ticket.totalAmount}, and it has been determined that this amount is to be covered by you. Click on the link to accept or deny: ${actionLink}`;
                sendSms(facilityId, customer.phoneNumber, message);
                sendEmail(facilityId, customer.email, 'Ticket Review', message);
            }
        }

        if (ticket.payerType === 'propertyManager' && ticket.propertyManagerPhoneNumber) {
            const filteredPropertyManagerPhoneNumber = ticket.propertyManagerPhoneNumber.trim().slice(-9);
            const message = `The ticket review is complete. The total amount for services is ${ticket.totalAmount}. Please review and proceed.`;
            sendSms(facilityId, filteredPropertyManagerPhoneNumber, message);
        }

        if (ticket.payerType === 'landlord') {
            const landlordCustomer = await payservedb.Customer.findById(ticket.payer);
            if (landlordCustomer && landlordCustomer.phoneNumber) {
                const landlordPhoneNumber = landlordCustomer.phoneNumber.trim().slice(-9);
                const message = `Your property has a pending maintenance charge of ${ticket.totalAmount}. Please review your tickets and approve the payment.`;
                sendSms(facilityId, landlordPhoneNumber, message);
                sendEmail(facilityId, landlordCustomer.email, 'Ticket Review', message);
            }
        }

        // Mark notifications as sent
        await ticketModel.findByIdAndUpdate(
            ticketId,
            {
                approvedBy: approvedBy,
                approvedAt: new Date(),
                approved: true,
            }
        );

        return reply.code(200).send({
            message: 'Ticket approved and notifications sent successfully',
            ticketId: ticketId
        });

    } catch (err) {
        console.error('Error approving ticket:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = ApproveTicket;