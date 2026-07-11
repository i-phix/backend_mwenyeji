const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const CreateWorkOrder = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            workDescription,
            assignedTo,
            payment,
        } = request.body;

        const orderNumber = Math.floor(10000 + Math.random() * 90000); // Random number between 10000 and 99999


        const workOrderModel = await getModel('WorkOrder', payservedb.WorkOrder.schema, facilityId);

        const newOrder = await workOrderModel.create({
            orderNumber,
            workDescription,
            assignedTo,
            payment,
            facilityId: facilityId
        });

        return reply.code(200).send({message: 'Work Order created successfully', workOrder: newOrder});
    } catch (err) {
        console.error('Error in creating work order:', err);
        return reply.code(400).send({ error: err.message });
    }
}

module.exports = CreateWorkOrder