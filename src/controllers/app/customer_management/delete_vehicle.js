const payservedb = require('payservedb')
const delete_vehicle = async (request, reply) => {
    try {
        const { customerId, vehicleId } = request.params
       
        const customer = await payservedb.Customer.findById(customerId);
        if (customer) {
             const vehicles  = customer.vehicles;
            
             const filter = vehicles.filter((x)=>{
            
                return x._id.toString() !== vehicleId
             })
             let query = {
                _id:customerId
             };
             let data = {};
             data.vehicles = filter;
             await payservedb.Customer.updateOne(query,data);
             return reply.code(200).send('Successfully deleted')

        }
        else {
            throw new Error('Customer not found')
        }
    }
    catch (err) {
        return reply.code(502).send({error:err.message})
    }
}
module.exports = delete_vehicle