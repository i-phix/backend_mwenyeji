const payservedb = require('payservedb');
const bcrypt = require('bcryptjs');
const { sendUserCredentials } = require('../../../utils/send_credentials');

const resend_credentials = async (request, reply) => {
    try {
        const { customerId, facilityId } = request.params;

        // Find the customer record first
        const customer = await payservedb.Customer.findById(customerId);
        if (!customer) {
            return reply.code(404).send({ success: false, message: 'Customer not found' });
        }

        // Find the linked user record via customerData
        const user = await payservedb.User.findOne({
            customerData: {
                $elemMatch: {
                    customerId: customer._id,
                    facilityId: facilityId
                }
            }
        });

        if (!user) {
            return reply.code(404).send({ success: false, message: 'User account not found for this customer' });
        }

        // Generate and set a new password
        const customerNumber = Math.floor(Math.random() * (1000000 - 10000)) + 10000;
        const newPassword = 'PXDS' + customerNumber;
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await payservedb.User.updateOne({ _id: user._id }, { password: hashedPassword });

        await sendUserCredentials({
            facilityId,
            user,
            password: newPassword,
            userType: user.type
        });

        return reply.code(200).send({ success: true, message: 'Credentials resent successfully' });
    } catch (err) {
        console.error(err);
        return reply.code(502).send({ success: false, message: err.message });
    }
};

module.exports = resend_credentials;