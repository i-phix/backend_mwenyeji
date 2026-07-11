const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const update_bank_details = async (request, reply) => {
    try {
        const { facilityId, bankDetailsId } = request.params;
        const {
            accountName,
            accountNumber,
            bankName,
            branchName,
            branchCode,
            bankCode,
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

        // Check if the bank details exist and belong to this facility
        const existingBankDetails = await bankDetailsModel.findOne({
            _id: bankDetailsId,
            facilityId
        });

        if (!existingBankDetails) {
            return reply.code(404).send({
                success: false,
                error: 'Bank details not found or do not belong to this facility'
            });
        }

        // Check if account number already exists for another record in this facility
        const duplicateAccount = await bankDetailsModel.findOne({
            facilityId,
            accountNumber: accountNumber.trim(),
            _id: { $ne: bankDetailsId }
        });

        if (duplicateAccount) {
            return reply.code(400).send({
                success: false,
                error: 'An account with this account number already exists'
            });
        }

        // If this is being set as default, unset any existing default
        if (isDefault) {
            await bankDetailsModel.updateMany(
                { facilityId, _id: { $ne: bankDetailsId } },
                { $set: { isDefault: false } }
            );
        }

        const updateData = {
            accountName: accountName.trim(),
            accountNumber: accountNumber.trim(),
            bankName: bankName.trim(),
            branchName: branchName.trim(),
            branchCode: branchCode?.trim() || '',
            bankCode: bankCode?.trim() || '',
            isDefault: isDefault || false,
            updatedBy: request.user ? request.user._id : null,
            updatedAt: new Date()
        };

        const updatedBankDetails = await bankDetailsModel.findByIdAndUpdate(
            bankDetailsId,
            updateData,
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            success: true,
            message: 'Bank details updated successfully',
            data: updatedBankDetails
        });

    } catch (err) {
        console.error('Error in update_bank_details:', err);

        // Handle mongoose validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => error.message);
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        return reply.code(500).send({
            success: false,
            error: 'Failed to update bank details',
            details: err.message
        });
    }
};

module.exports = update_bank_details;