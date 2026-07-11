const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getGlAccounts = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get the GL Account model for this facility
        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId);

        // Fetch all GL accounts for this facility
        const accounts = await glAccountModel.find({ facilityId });

        // Sort by accountCode for consistent ordering
        accounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

        // Return the accounts
        return reply.status(200).send({
            success: true,
            message: 'GL Accounts retrieved successfully',
            data: accounts
        });
    } catch (error) {
        console.error('Error fetching GL accounts:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL accounts'
        });
    }
};

const getFinalAccounts = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get the GL Account model for this facility
        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId);

        // Fetch all GL accounts for this facility
        const accounts = await glAccountModel.find({ facilityId, isFinal: true });

        // Sort by accountCode for consistent ordering
        accounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

        // Return the accounts
        return reply.status(200).send({
            success: true,
            message: 'GL Accounts retrieved successfully',
            data: accounts
        });
    } catch (error) {
        console.error('Error fetching GL accounts:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL accounts'
        });
    }
};

module.exports = { getGlAccounts, getFinalAccounts };