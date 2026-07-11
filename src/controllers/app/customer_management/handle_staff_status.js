const payservedb = require('payservedb')
const handle_staff_status = async (request,reply)=>{
    try {
        const { customerId, staffId } = request.params
        const {status} = request.body
       
        const customer = await payservedb.Customer.findById(customerId);
        if (customer) {
             const staff  = customer.staff;
             staff.filter((x)=>{
                if(x._id.toString() === staffId)
                {
                    x.disabled = status
                }
             })
             let query = {
                _id:customerId
             };
             let data = {};
             data.staff = staff;
             await payservedb.Customer.updateOne(query,data);
             return reply.code(200).send('Successfully updated')

        }
        else {
            throw new Error('Customer not found')
        }
    }
    catch(err){
        return reply.code(502).send({error:err.message})
    }
}
module.exports = handle_staff_status