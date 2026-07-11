const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const addGlAccount = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            accountCode,
            accountName,
            accountType,
            accountBalance,
            parentAccountId,
            accountLevel,
            isFinal,
            isActive,
        } = request.body;

        createdAt = new Date();
        updatedAt = new Date();

        // find if an account code already exists
        const existingAccount = await payservedb.GLAccount.findOne({ accountCode });
        if (existingAccount) {
            return reply.status(400).send({
                message: 'Account code already exists',
            });
        }
        // find if an account name already exists
        const existingAccountName = await payservedb.GLAccount.findOne({ accountName });
        if (existingAccountName) {
            return reply.status(400).send({
                message: 'Account name already exists',
            });
        }

        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId,);

        const newGlAccount = await glAccountModel.create({
            accountCode,
            accountName,
            accountType,
            accountBalance,
            facilityId,
            parentAccountId,
            accountLevel,
            isFinal,
            isActive,
            createdAt,
            updatedAt
        });
        return reply.status(201).send({
            message: 'GL Account created successfully',
            data: newGlAccount,
        });
    } catch (error) {
        return reply.status(500).send({ error: error.message });
    }
};

const getAccountByCode = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { accountCode } = request.body;
        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId,);
        const account = await glAccountModel.findOne({ accountCode });
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        return reply.status(200).send({ data: account });
    } catch (error) {
        return reply.status(500).send({ error: error.message });
    }
};

const getAccountById = async (request, reply) => {
    try {
        const { facilityId, accountId } = request.params;
        // const {  } = request.body;
        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId,);
        const account = await glAccountModel.findById(accountId);
        if (!account) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        return reply.status(200).send({ data: account });
    } catch (error) {
        return reply.status(500).send({ error: error.message });
    }
}


module.exports = { addGlAccount, getAccountByCode, getAccountById };
