const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');



const createDebitEntry = async (facilityId, entryData) => {
    // Extract data from the entry object
    const { accountId, amount, description, isActive, entryType, creditAccountId } = entryData;
    const entryDate = new Date();
    const createdAt = new Date();
    const updatedAt = new Date();

    // Validate entryType
    if (entryType !== 'debit') {
        throw new Error('Invalid entry type. Must be "debit"');
    }

    // Check if the accountId exists
    const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId);
    const account = await glAccountModel.findById(accountId);
    if (!account) {
        throw new Error('Account not found');
    }

    // Create the entry using getModel pattern
    const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);
    const entry = await glEntryModel.create({
        accountId,
        amount, //needed
        description, // needed
        isActive, // needed
        entryType, // needed
        entryDate,
        facilityId,
        creditAccountId,
        createdAt,
        updatedAt,
    });

    return entry;
};

const createCreditEntry = async (facilityId, entryData) => {
    // Extract data from the entry object
    const { accountId, amount, description, isActive, entryType } = entryData;
    const entryDate = new Date();
    const createdAt = new Date();
    const updatedAt = new Date();

    // Validate entryType
    if (entryType !== 'credit') {
        throw new Error('Invalid entry type. Must be "credit"');
    }

    // Check if the accountId exists
    const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId);
    const account = await glAccountModel.findById(accountId);
    if (!account) {
        throw new Error('Account not found');
    }

    // Create the entry using getModel pattern
    const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);
    const entry = await glEntryModel.create({
        accountId,
        amount,
        description,
        isActive,
        entryType,
        entryDate,
        facilityId,
        createdAt,
        updatedAt,
    });

    return entry;
};


const addDebitEntry = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const entryData = request.body;

        const entry = await createDebitEntry(facilityId, entryData);

        // Return the entry
        return reply.status(201).send({
            message: 'GL Entry created successfully',
            data: entry,
        });
    } catch (error) {
        console.error('Error creating GL entry:', error);

        // Handle specific error cases
        if (error.message === 'Invalid entry type. Must be "debit"') {
            return reply.status(400).send({
                success: false,
                error: error.message,
            });
        } else if (error.message === 'Account not found') {
            return reply.status(404).send({
                success: false,
                error: error.message,
            });
        }

        // Generic error response
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to create GL entry',
        });
    }
};

const addCreditEntry = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const entryData = request.body;

        const entry = await createCreditEntry(facilityId, entryData);

        // Return the entry
        return reply.status(201).send({
            message: 'GL Entry created successfully',
            data: entry,
        });
    } catch (error) {
        console.error('Error creating GL entry:', error);

        // Handle specific error cases
        if (error.message === 'Invalid entry type. Must be "credit"') {
            return reply.status(400).send({
                success: false,
                error: error.message,
            });
        } else if (error.message === 'Account not found') {
            return reply.status(404).send({
                success: false,
                error: error.message,
            });
        }

        // Generic error response
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to create GL entry',
        });
    }
};


const getGlEntries = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get the GL Entry model for this facility
        const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);

        // Fetch all GL entries for this facility
        const entries = await glEntryModel.find({ facilityId });

        // Sort by entryDate for consistent ordering
        entries.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

        // Return the entries
        return reply.status(200).send({
            success: true,
            message: 'GL Entries retrieved successfully',
            data: entries,
        });
    } catch (error) {
        console.error('Error fetching GL entries:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL entries',
        });
    }
};

const getGLEntriesForAccount = async (request, reply) => {
    try {
        const { facilityId, accountId } = request.params;
        // Get the GL Entry model for this facility
        const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);
        // Fetch all GL entries for this facility and account
        const entries = await glEntryModel.find({ facilityId, accountId });
        // Sort by entryDate for consistent ordering
        entries.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
        // Return the entries
        return reply.status(200).send({
            success: true,
            message: 'GL Entries retrieved successfully',
            data: entries,
        });
    } catch (error) {
        console.error('Error fetching GL entries for account:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL entries for account',
        });
    }
};

const getGlEntryById = async (request, reply) => {
    try {
        const { facilityId, entryId } = request.params;
        // Get the GL Entry model for this facility
        const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);
        // Fetch the GL entry by ID
        const entry = await glEntryModel.findById(entryId);
        if (!entry) {
            return reply.status(404).send({
                success: false,
                message: 'GL Entry not found',
            });
        }
        // Return the entry
        return reply.status(200).send({
            success: true,
            message: 'GL Entry retrieved successfully',
            data: entry,
        });
    }
    catch (error) {
        console.error('Error fetching GL entry:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL entry',
        });
    }
}
const updateGlEntry = async (request, reply) => {
    try {
        const { facilityId, entryId } = request.params;
        const { accountId, amount, description, isActive, entryType } = request.body;
        const updatedAt = new Date();
        // Validate entryType
        if (!['debit', 'credit'].includes(entryType)) {
            return reply.status(400).send({
                message: 'Invalid entry type. Must be either "debit" or "credit".',
            });
        }
        // Check if the accountId exists
        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId);
        const account = await glAccountModel.findById(accountId);
        if (!account) {
            return reply.status(404).send({
                message: 'Account not found',
            });
        }
        // Update the entry
        const entry = await payservedb.GLEntry.findByIdAndUpdate(
            entryId,
            {
                accountId,
                amount,
                description,
                isActive,
                entryType,
                updatedAt,
            },
            { new: true }
        );
        // Return the entry if updated
        if (entry) {
            return reply.status(200).send({
                message: 'GL Entry updated successfully',
                data: entry,
            });
        }
        // Return 404 if entry not found
        return reply.status(404).send({
            message: 'GL Entry not found',
        });
    } catch (error) {
        console.error('Error updating GL entry:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to update GL entry',
        });
    }
};

module.exports = {
    addDebitEntry,
    addCreditEntry,
    getGlEntries,
    getGlEntryById,
    updateGlEntry,
    getGLEntriesForAccount,
    createDebitEntry,
    createCreditEntry
}
