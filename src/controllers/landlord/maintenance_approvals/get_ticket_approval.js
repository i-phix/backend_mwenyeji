const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');


const GetTicket = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
        
        const ticket = await ticketModel.findOne({ _id: ticketId, facilityId });
        
        if (!ticket) {
            return reply.code(404).send({ error: 'Ticket not found' });
        }

        return reply.code(200).send(ticket);
    } catch (err) {
        console.error('Error in getting ticket:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = GetTicket;
