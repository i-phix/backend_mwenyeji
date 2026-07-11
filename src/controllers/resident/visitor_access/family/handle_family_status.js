const payservedb = require('payservedb')
const handle_family_status = async (request, reply) => {
    try {
        const { customerId, familyId } = request.params
        const { disabled } = request.body

        const customer = await payservedb.Customer.findById(customerId);
        if (customer) {
            const familyMembers = customer.familyMembers;
            let f = familyMembers.filter((x) => {
                return x._id.toString() === familyId && x.addVisitor === true
            })
            if (f.length > 0) {
                let email = f[0].email;
                if (email !== undefined) {
                    const filterUser = await payservedb.User.findOne({ email });
                    if (filterUser) {
                        let customerDataArray = filterUser.customerData
                        customerDataArray.map((x) => {
                            if (x.customerId.toString() === customerId) {
                                x.isEnabled = !disabled
                            }
                        });
                        const query = {
                            _id: filterUser._id
                        }
                        let data = {};
                        data.customerData = customerDataArray
                        await payservedb.User.updateOne(query, data)


                    }
                }
            }
          
            familyMembers.filter((x) => {
                if (x._id.toString() === familyId) {
                    x.disabled = disabled
                }
            })

            let query = {
                _id: customerId
            };
            let data = {};
            data.familyMembers = familyMembers;
            await payservedb.Customer.updateOne(query, data);
            return reply.code(200).send('Successfully updated')

        }
        else {
            throw new Error('Customer not found')
        }
    }
    catch (err) {
        return reply.code(502).send({ error: err.message })
    }
}
  
module.exports = handle_family_status