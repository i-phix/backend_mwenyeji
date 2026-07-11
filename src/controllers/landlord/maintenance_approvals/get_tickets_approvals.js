const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const GetLandlordApprovalTickets = async (request, reply) => {
    try {
        const { facilityId, homeOwnerId } = request.params;
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        
        // Convert homeOwnerId to ObjectId
        const homeOwnerObjectId = new mongoose.Types.ObjectId(homeOwnerId);
        
        // First, find all units owned by this landlord
        const units = await unitModel.find({
            facilityId,
            homeOwnerId: homeOwnerObjectId
        });
        
        // Get all tenantIds from these units
        const tenantIds = units.map(unit => unit.tenantId || unit.residentId).filter(id => id);
        
        // Find tickets raised by any tenant of this landlord's units that need to be paid by the landlord
        const tickets = await ticketModel.find({
            facilityId,
            customerId: { $in: tenantIds },
            status: 'on hold',
            payer: 'landlord' // Filter tickets that are to be paid by the landlord
        });
        
        return reply.code(200).send(tickets);
        
    } catch (err) {
        console.error('Error in getting landlord tickets:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetLandlordApprovalTickets;