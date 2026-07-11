const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_bank_details = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            accountName,
            accountNumber,
            bankName,
            branchName,
            branchCode,
            bankCode,
            swiftCode,
            isDefault
        } = request.body;

        // Input validation
        if (!accountName || !accountNumber || !bankName || !branchName) {
            return reply.code(400).send({
                success: false,
                error: 'Required fields missing: accountName, accountNumber, bankName, and branchName are required'
            });
        }

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Get the facility-specific BankDetails model
        const bankDetailsModel = await getModel("BankDetails", payservedb.BankDetails.schema, facilityId);

        // Check if account number already exists for this facility
        const existingAccount = await bankDetailsModel.findOne({
            facilityId,
            accountNumber: accountNumber.trim()
        });

        if (existingAccount) {
            return reply.code(400).send({
                success: false,
                error: 'An account with this account number already exists'
            });
        }

        // If this is being set as default, unset any existing default
        if (isDefault) {
            await bankDetailsModel.updateMany(
                { facilityId },
                { $set: { isDefault: false } }
            );
        }

        const bankDetailsData = {
            accountName: accountName.trim(),
            accountNumber: accountNumber.trim(),
            bankName: bankName.trim(),
            branchName: branchName.trim(),
            branchCode: branchCode?.trim() || '',
            bankCode: bankCode?.trim() || '',
            swiftCode: swiftCode?.trim() || '',
            isDefault: isDefault || false,
            facilityId: facilityId,
            createdBy: request.user ? request.user._id : null
        };

        const savedData = await bankDetailsModel.create(bankDetailsData);

        return reply.code(200).send({
            success: true,
            message: 'Bank details added successfully',
            data: savedData
        });

    } catch (err) {
        console.error('Error in add_bank_details:', err);

        // Handle mongoose validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => error.message);
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Handle duplicate key errors
        if (err.code === 11000) {
            return reply.code(400).send({
                success: false,
                error: 'Bank details with this account number already exist'
            });
        }

        return reply.code(500).send({
            success: false,
            error: 'Failed to add bank details',
            details: err.message
        });
    }
}

module.exports = add_bank_details;