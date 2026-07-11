const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetTickets = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
        const tickets = await ticketModel.find({});

        const ticketsWithAdditionalInfo = await Promise.all(tickets.map(async (ticket) => {
            // Fetch Customer Info
            const customer = await payservedb.Customer.findById(ticket.customerId);
            const customerInfo = customer ? {
                fullName: `${customer.firstName} ${customer.lastName}`,
                phoneNumber: customer.phoneNumber,
                email: customer.email
            } : null;

            // Fetch User Info
            const user = await payservedb.User.findById(ticket.userId);
            const userInfo = user ? {
                fullName: `${user.fullName}`,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role
            } : null;


            return {
                ...ticket.toObject(),
                CustomerInfo: customerInfo,
                UserInfo: userInfo
            };
        }));

        if (!ticketsWithAdditionalInfo || ticketsWithAdditionalInfo.length === 0) {
            return reply.code(404).send({ message: 'No tickets found for this facility.' });
        }

        return reply.code(200).send({ message: 'Tickets retrieved successfully', tickets: ticketsWithAdditionalInfo });
    } catch (err) {
        console.error('Error in retrieving tickets:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetTickets;


