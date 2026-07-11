const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_work_orders = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Dynamically get the WorkOrder model for the specified facility
        const WorkOrder = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

        // Find all work orders for the facility
        const workOrders = await WorkOrder.find({
            facilityId: new mongoose.Types.ObjectId(facilityId)
        }).sort({ createdAt: -1 });

        // Return success response with empty array if no orders found
        return reply.code(200).send({
            message: workOrders.length ? 'Work orders retrieved successfully' : 'No work orders found',
            workOrders: workOrders
        });

    } catch (err) {
        console.error('Error in retrieving WorkOrders:', err);
        return reply.code(500).send({
            error: 'Internal server error while retrieving work orders'
        });
    }
};

module.exports = get_work_orders;