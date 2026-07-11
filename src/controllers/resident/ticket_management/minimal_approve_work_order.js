const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const ApproveWorkOrder = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;
        const { requester, status } = request.body;

        // Get the work order model
        const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

        // Find the work order associated with the requester and facility
        const workOrder = await workOrderModel.findOne({ facilityId, requester });

        if (!workOrder) {
            return reply.code(404).send({ error: 'Work order not found for the provided facility and requester' });
        }

        // Update the work order status
        workOrder.status = status;  // Use the status sent in the body
        await workOrder.save();

        // Get the ticket model
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find and update the ticket status to 'ongoing'
        const ticket = await ticketModel.findOne({ _id: ticketId });

        if (!ticket) {
            return reply.code(404).send({ error: 'Ticket not found for the provided ID' });
        }

        ticket.status = 'ongoing';
        await ticket.save();

        console.log('Work order and ticket updated successfully:', { workOrder, ticket });

        return reply.code(200).send({
            message: 'Work order and ticket updated successfully',
            workOrder,
            ticket,
        });
    } catch (err) {
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = ApproveWorkOrder;
