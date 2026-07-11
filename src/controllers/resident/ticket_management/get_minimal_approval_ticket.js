const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetApprovalTicket = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Fetch the specific ticket based on facilityId, customerId, and ticketId
        const ticket = await ticketModel.findOne({ _id: ticketId, facilityId});

        if (!ticket) {
            return reply.code(404).send({ error: 'Ticket not found or not ongoing for tenant.' });
        }

        return reply.code(200).send(ticket);
    } catch (err) {
        console.error('Error in getting ticket:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetApprovalTicket;
