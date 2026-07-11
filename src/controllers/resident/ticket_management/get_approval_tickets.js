const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const GetApprovalTickets = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Convert customerId to ObjectId using 'new'
        const customerObjectId = new mongoose.Types.ObjectId(customerId);

        // Fetch tickets where the payer is tenant and the ticket is ongoing
        const tickets = await ticketModel.find({
            facilityId,
            customerId: customerObjectId,
            status: 'under review',
            payerType: 'tenant',
            approvedBy: { $exists: true }
        });
        
        return reply.code(200).send(tickets);
        
    } catch (err) {
        console.error('Error in getting tickets:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetApprovalTickets;
