const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const DenyWorkOrder = async (request, reply) => {
    try {
        const { facilityId, ticketId } = request.params;
        const { status } = request.body;


        const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

        // Find the work order associated with the requester and facility
        const workOrder = await workOrderModel.findOne({ facilityId });

        if (!workOrder) {
            return reply.code(404).send({ error: 'Work order not found for the provided facility' });
        }

        // Update the work order status to 'cancelled'
        workOrder.status = status; // Make sure this updates to 'cancelled'
        await workOrder.save();

        // Get the ticket model
        const ticketModel = await getModel('Ticket', payservedb.Ticket.schema, facilityId);

        // Find and update the ticket status to 'cancelled'
        const ticket = await ticketModel.findOne({ _id: ticketId });

        if (!ticket) {
            return reply.code(404).send({ error: 'Ticket not found for the provided ID' });
        }

        ticket.status = 'cancelled'; // Set ticket status to 'cancelled'
        await ticket.save();

        console.log('Work order and ticket cancelled successfully:', { workOrder, ticket });

        return reply.code(200).send({
            message: 'Work order and ticket cancelled successfully',
            workOrder,
            ticket,
        });
    } catch (err) {
        console.error('Error in denying work order:', err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = DenyWorkOrder;
