const payservedb = require('payservedb');

const add_default_account = async (request, reply) => {
    try {
        const { accountId } = request.params; 
        const {facilityId} = request.body;

        // 1. Reset all other accounts' `isDefault` to `false` for this facility/user
        // await payservedb.BankDetails.updateMany({ facilityId }, { isDefault: false });
        const result = await payservedb.BankDetails.updateMany({ facilityId }, { isDefault: false });
        console.log(`Updated ${result.nModified} accounts to isDefault: false`);

        // 2. Set the selected account's `isDefault` to `true`
        const updatedAccount = await payservedb.BankDetails.findByIdAndUpdate(
            accountId, 
            { isDefault: true }, 
            { new: true } // Return the updated document
        );
        console.log("ACCOUNTID", accountId);
        console.log('Updated account:', updatedAccount);

        if (!updatedAccount) {
            return reply.code(404).send({ error: 'Account not found' });
        }

        return reply.code(200).send({
            success: true,
            message: 'Default account updated successfully',
            data: updatedAccount
        });

    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_default_account;
