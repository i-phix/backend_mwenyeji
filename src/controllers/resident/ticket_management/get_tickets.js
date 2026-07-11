const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetCustomerTickets = async (request, reply) => {
    try{
        const { facilityId, customerId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        const tickets = await ticketModel.find({facilityId, customerId});

        if (!tickets) {
            return reply.code(404).send({ error: 'Tickets not found.' });
        }
        console.log("Tickets",tickets);

        return reply.code(200).send(tickets);
    }catch(err){
        console.error('Error in getting tickets:', err);
        return reply.code(400).send({ error: err.message });
    }
}


module.exports = GetCustomerTickets;