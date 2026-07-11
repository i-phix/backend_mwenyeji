const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const createDebitEntry = require('./add_gl_entry').createDebitEntry;
const createCreditEntry = require('./add_gl_entry').createCreditEntry;

const getFacilityAccountsDoubleEntryById = async (facilityId, doubleEntryId) => {
    try {
        const glAccountDoubleEntriesModel = await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId);
        const account = await glAccountDoubleEntriesModel.findOne({ _id: doubleEntryId });
        if (!account) {
            throw new Error('GL Account Double Entry not found');
        }
        return account;
    } catch (error) {
        console.error('Error fetching GL Account Double Entries:', error);
        throw new Error('Failed to fetch GL Account Double Entries');
    }
}

const addAccountsDoubleEntry = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { accountdebited, accountcredited, } = request.body;
        const createdAt = new Date();

        const glAccountDoubleEntriesModel = await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId);
        const entry = await glAccountDoubleEntriesModel.create({
            accountdebited,
            accountcredited,
            facilityId,
            createdAt,
        });
        // Return the entry 
        return reply.status(201).send({
            message: 'GL Account Double Entry created successfully',
            data: entry,
        });
    }
    catch (error) {
        console.error('Error creating GL Account Double Entry:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to create GL Account Double Entry',
        });
    }
}

const addDoubleEntryRecord = async (request, reply) => {
    try {
        let facilityId = request.params.facilityId;
        let doubleEntryId = request.params.doubleEntryId;
        // accountdebitedData and accountcreditedData should be in the format:
        // {
        // amount, //needed
        // description, // needed
        // isActive, // needed
        // entryType, // needed
        // }
        const { accountdebitedData, accountcreditedData } = request.body;
        const glAccountDoubleEntriesModel = await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId);

        const doubleEntries = await getFacilityAccountsDoubleEntryById(facilityId, doubleEntryId);
        if (doubleEntries.length === 0) {
            console.log("No Double Entry Instance found")
            return reply.status(404).send({
                success: false,
                message: 'No Double Entry Instance found',
            });
        }
        const { accountdebited, accountcredited } = doubleEntries;

        // create the credit entry
        accountcreditedData.accountId = accountcredited;
        accountcreditedData.entryType = 'credit';
        const creditEntry = await createCreditEntry(facilityId, accountcreditedData);

        // create the debit entry
        accountdebitedData.accountId = accountdebited;
        accountdebitedData.entryType = 'debit';
        accountdebitedData.creditAccountId = creditEntry._id;
        const debitEntry = await createDebitEntry(facilityId, accountdebitedData);

        return reply.status(201).send({
            message: 'GL Account Double Entry created successfully',
            data: {
                debitEntry,
                creditEntry,
            },
        });
    }
    catch (error) {
        console.error('Error creating GL Account Double Entry:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to create GL Account Double Entry',
        });
    }
}

const getDoubleEntryRecords = async (request, reply) => {
    try {
        const { facilityId, accountId } = request.params;

        // Verify the account exists
        const glAccountModel = await getModel('GlAccount', payservedb.GLAccount.schema, facilityId);
        const account = await glAccountModel.findById(accountId);
        if (!account) {
            return reply.status(404).send({
                success: false,
                message: 'Account not found',
            });
        }

        // Get all entries for this account
        const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);
        const entries = await glEntryModel.find({ accountId });
        if (!entries || entries.length === 0) {
            return reply.status(404).send({
                success: false,
                message: 'No entries found for this account',
            });
        }

        // Create an array to store the paired entries
        let doubleEntries = [];

        // Get credit entries for this account
        const creditEntries = entries.filter(entry => entry.entryType === 'credit');

        // For each credit entry, find debit entries that reference it
        for (const creditEntry of creditEntries) {
            const matchingDebitEntries = await glEntryModel.find({
                creditAccountId: creditEntry._id,
                entryType: 'debit'
            });

            if (matchingDebitEntries && matchingDebitEntries.length > 0) {
                for (const debitEntry of matchingDebitEntries) {
                    doubleEntries.push({
                        creditEntry,
                        debitEntry
                    });
                }
            }
        }

        // Get debit entries for this account
        const debitEntries = entries.filter(entry => entry.entryType === 'debit');

        // For each debit entry, find the referenced credit entry
        for (const debitEntry of debitEntries) {
            // Skip entries that we've already included above
            const alreadyIncluded = doubleEntries.some(
                pair => pair.debitEntry._id.toString() === debitEntry._id.toString()
            );

            if (!alreadyIncluded && debitEntry.creditAccountId) {
                const matchingCreditEntry = await glEntryModel.findOne({
                    _id: debitEntry.creditAccountId,
                    entryType: 'credit'
                });

                if (matchingCreditEntry) {
                    doubleEntries.push({
                        creditEntry: matchingCreditEntry,
                        debitEntry
                    });
                }
            }
        }

        return reply.status(200).send({
            success: true,
            message: 'Double entries retrieved successfully',
            count: doubleEntries.length,
            data: doubleEntries,
        });
    }
    catch (error) {
        console.error('Error fetching GL Account Double Entries:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL Account Double Entries',
        });
    }
}

const getAllDoubleEntryRecords = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { startDate, endDate } = request.query;

        const glEntryModel = await getModel('GLEntry', payservedb.GLEntry.schema, facilityId);

        // Build query object
        let query = {};

        // Add date range filtering if provided
        if (startDate || endDate) {
            query.entryDate = {};

            if (startDate) {
                // Parse start date and set to beginning of day
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.entryDate.$gte = start;
            }

            if (endDate) {
                // Parse end date and set to end of day
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.entryDate.$lte = end;
            }
        }

        console.log('Query with date filter:', query);

        const entries = await glEntryModel.find(query).sort({ entryDate: -1 });

        return reply.status(200).send({
            success: true,  
            message: 'Double entries retrieved successfully',
            count: entries.length,
            data: entries,
            filters: {
                startDate: startDate || null,
                endDate: endDate || null,
                facilityId
            }
        });
    }
    catch (error) {
        console.error('Error fetching GL Account Double Entries:', error);
        return reply.status(500).send({
            success: false,
            error: error.message || 'Failed to fetch GL Account Double Entries',
        });
    }
}

module.exports = { addAccountsDoubleEntry, addDoubleEntryRecord, getDoubleEntryRecords, getAllDoubleEntryRecords };