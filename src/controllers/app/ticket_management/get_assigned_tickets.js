const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetAssignedTickets = async (request, reply) => {
    try {
        const { facilityId, userId } = request.params;

        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find tickets where this user is assigned as employee
        const assignedTickets = await ticketModel.find({
            facilityId: facilityId,
            selectedEmployee: userId,
            status: 'assigned'
        }).sort({ createdAt: -1 });

        // Populate ticket details with requester info
        const ticketsWithDetails = await Promise.all(
            assignedTickets.map(async (ticket) => {
                let requesterInfo = null;

                if (ticket.customerId) {
                    const customer = await payservedb.Customer.findById(ticket.customerId);
                    if (customer) {
                        requesterInfo = {
                            fullName: `${customer.firstName} ${customer.lastName}`,
                            phoneNumber: customer.phoneNumber,
                            email: customer.email
                        };
                    }
                } else if (ticket.userId) {
                    const user = await payservedb.User.findById(ticket.userId);
                    if (user) {
                        requesterInfo = {
                            fullName: user.fullName,
                            phoneNumber: user.phoneNumber,
                            email: user.email
                        };
                    }
                }

                return {
                    ...ticket.toObject(),
                    requesterInfo: requesterInfo
                };
            })
        );

        return reply.code(200).send({
            success: true,
            message: 'Assigned tickets retrieved successfully',
            data: ticketsWithDetails
        });
    } catch (err) {
        console.error('Error in retrieving assigned tickets:', err);
        return reply.code(400).send({ success: false, error: err.message });
    }
}

module.exports = GetAssignedTickets;