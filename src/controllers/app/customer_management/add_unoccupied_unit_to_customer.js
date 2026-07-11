const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_unoccupied_unit_to_customer = async (request, reply) => {
    try {
        const { customerId, facilityId } = request.params;
        const { units } = request.body;

        if (!units || units.length === 0) {
            return reply.code(400).send({ error: 'No units provided.' });
        }

        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found.' });
        }

        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const type = customer.customerType;

        // Check if the customer is inactive and has no units, if so set status to "Active"
        if (customer.status === 'Inactive' && units.length > 0) {
            await payservedb.Customer.updateOne({ _id: customerId }, { status: 'Active' });
        }

        // Update all units asynchronously and wait for them to complete
        await Promise.all(units.map(async (unit) => {
            let query = { _id: unit._id };
            let data = {};

            if (type === 'home owner') {
                data.homeOwnerId = customerId;
            } else if (type === 'tenant') {
                data.tenantId = customerId;
                data.residentId = customerId;
            } else if (customer.residentType === 'resident') {
                data.residentId = customerId;
            }

            await unitModel.updateOne(query, data);
        }));

        return reply.code(200).send({success: true, message: 'Units added to customer successfully'});
    } catch (err) {
        console.error('Error adding unit(s) to customer:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_unoccupied_unit_to_customer;
