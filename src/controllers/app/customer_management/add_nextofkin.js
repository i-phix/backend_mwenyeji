const payservedb = require('payservedb');

const add_nextofkin = async (request, reply) => {
    try {
        const { customerId } = request.params;
        const newKin = request.body;

        const customer = await payservedb.Customer.findById(customerId);

        // Add the new next of kin to the array
        customer.nextOfKin.push(newKin);

        // Save the updated customer
        const result = await customer.save();

        return reply.code(200).send({
            success: true,
            message: 'Customer next of kin added successfully',
            result
        });
    } catch (err) {
        console.error('Error adding customer next of kin:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_nextofkin;
