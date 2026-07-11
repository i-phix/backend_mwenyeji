const payservedb = require('payservedb')
const delete_staff = async (request, reply) => {
    try {
        const { customerId, staffId } = request.params
       
        const customer = await payservedb.Customer.findById(customerId);
        if (customer) {
             const staff  = customer.staff;
            
             const filter = staff.filter((x)=>{
                console.log(x._id.toString(),staffId)
                return x._id.toString() !== staffId
             })
             let query = {
                _id:customerId
             };
             let data = {};
             data.staff = filter;
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
module.exports = delete_staff