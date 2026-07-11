const payservedb = require('payservedb');

const unset_default_account = async (request, reply) => {
    try {
        const { accountId } = request.params;
        const { facilityId } = request.body;

        // 1. Find the account to unset the default for
        const account = await payservedb.BankDetails.findOne({
            _id: accountId,
            facilityId,
        });

        if (!account) {
            return reply.code(404).send({ error: 'Account not found' });
        }

        // 2. Check if the account is already not default
        if (!account.isDefault) {
            return reply.code(400).send({ error: 'Account is not currently set as default' });
        }

        // 3. Update the account to unset it as default
        const updatedAccount = await payservedb.BankDetails.findByIdAndUpdate(
            accountId,
            { isDefault: false },
            { new: true } // Return the updated document
        );

        return reply.code(200).send({
            success: true,
            message: 'Default account unset successfully',
            data: updatedAccount
        });

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = unset_default_account;
