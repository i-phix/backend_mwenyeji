const payservedb = require('payservedb')
const delete_family = async (request, reply) => {
    try {
        const { customerId, familyId } = request.params

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
                        if (filterUser.customerData.length === 1) {
                            await payservedb.User.findByIdAndDelete(filterUser._id)
                        }
                        else if (filterUser.customerData.length > 1) {
                            let customerDataArray = filterUser.customerData
                            customerDataArray.map((x) => {
                                if (x.customerId.toString() === customerId) {
                                    x.isEnabled = false
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
            }


            const filter = familyMembers.filter((x) => {
                return x._id.toString() !== familyId
            });

            let query = {
                _id: customerId
            };
            let data = {};
            data.familyMembers = filter;
            await payservedb.Customer.updateOne(query, data);
            return reply.code(200).send('Successfully deleted')

        }
        else {
            throw new Error('Customer not found')
        }

    }
    catch (err) {
        return reply.code(502).send({ error: err.message })
    }
}
module.exports = delete_family