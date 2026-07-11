const payservedb = require('payservedb')
const handle_vehicle_status = async (request, reply) => {
    try {
        const { customerId, vehicleId } = request.params
        const { status } = request.body
        console.log(status)

        const customer = await payservedb.Customer.findById(customerId);
        if (customer) {

            
            const vehicles = customer.vehicles;
            vehicles.filter((x) => {
                if (x._id.toString() === vehicleId) {
                    x.disabled = status
                }
            })
            let query = {
                _id: customerId
            };
            let data = {};
            data.vehicles = vehicles;
            await payservedb.Customer.updateOne(query, data);
            return reply.code(200).send('Successfully updated')

        }
        else {
            throw new Error('Customer not found')
        }
    }
    catch (err) {
        return reply.code(502).send({error:err.message})
    }
}
module.exports = handle_vehicle_status