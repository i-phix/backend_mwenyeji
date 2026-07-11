 const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

const updateLevyContract = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;

        // Log the entire request body for debugging
        console.log('Request body:', JSON.stringify(request.body));

        const {
            contractName,
            levyId,
            amount,
            currency,
            startDate,
            endDate,
            paymentFrequency,
            mobilePayment,
            shortCode,
            status,
            balanceBroughtForward,
            enabledTaxes,
            // taxEnabled,
            editHistory // Field for edit history
        } = request.body;

        // Input validation
        if (contractName && !contractName.trim()) {
            return reply.code(400).send({
                success: false,
                error: 'Contract name cannot be empty'
            });
        }

        if (amount && (isNaN(amount) || parseFloat(amount) <= 0)) {
            return reply.code(400).send({
                success: false,
                error: 'Amount must be a positive number'
            });
        }
        
        // Validate edit reason if edit history is provided
        if (editHistory && (!editHistory.reason || !editHistory.reason.trim())) {
            return reply.code(400).send({
                success: false,
                error: 'Edit reason is required'
            });
        }

        if (currency) {
            // Get Currency model to verify currency exists
            const currencyModel = await getModel('Currency', payservedb.Currency.schema, facilityId);
            const currencyExists = await currencyModel.findById(currency);

            if (!currencyExists) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid currency selected'
                });
            }
        }

        // Date validation if either date is provided
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid date format'
                });
            }

            if (start && end && start > end) {
                return reply.code(400).send({
                    success: false,
                    error: 'Start date cannot be later than end date'
                });
            }
        }

        // Get the LevyContract model for the specified facility
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

        // Find the existing contract
        const existingContract = await levyContractModel.findById(contractId);
        if (!existingContract) {
            return reply.code(404).send({
                success: false,
                error: 'Contract not found'
            });
        }

        // Check payment method if mobile payment is enabled
        let paymentMethodId = null;
        if (mobilePayment && shortCode) {
            console.log('Processing mobile payment with shortCode:', shortCode);

            try {
                // Get the FacilityPaymentDetails model using getModel
                const facilityPaymentDetailsModel = await getModel(
                    'FacilityPaymentDetails',
                    payservedb.FacilityPaymentDetails.schema,
                    facilityId
                );

                // Query by shortCode only
                const paymentSetting = await facilityPaymentDetailsModel.findOne({
                    shortCode: shortCode
                });

                console.log('Payment setting found:', paymentSetting ? 'Yes' : 'No');

                if (!paymentSetting) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Invalid payment setting'
                    });
                }

                paymentMethodId = paymentSetting._id;
            } catch (error) {
                console.error('Error finding payment method:', error);
                return reply.code(400).send({
                    success: false,
                    error: 'Error validating payment setting'
                });
            }
        }

        // Check if there are any changes
        const updates = {};
        if (contractName) updates.contractName = contractName.trim();
        if (levyId) updates.levyId = levyId;
        if (amount) updates.amount = parseFloat(amount);
        if (currency) updates.currency = currency;
        if (startDate) updates.startDate = startDate;
        if (endDate) updates.endDate = endDate;
        if (paymentFrequency) updates.paymentFrequency = paymentFrequency;
        if (status !== undefined) updates.status = status;
        if (enabledTaxes) updates.enabledTaxes = enabledTaxes;
        
        // Handle balance brought forward if provided
        if (balanceBroughtForward !== undefined) {
            updates.balanceBroughtForward = parseFloat(balanceBroughtForward);
        }

        // Handle taxEnabled if provided
        // if (taxEnabled !== undefined) {
        //     updates.taxEnabled = Boolean(taxEnabled);
        // }

        // Handle payment method updates
        if (mobilePayment === false) {
            updates.paymentMethodId = null;
        } else if (mobilePayment === true && paymentMethodId) {
            updates.paymentMethodId = paymentMethodId;
        }

        if (Object.keys(updates).length === 0 && !editHistory) {
            return reply.code(400).send({
                success: false,
                error: 'No changes provided for update'
            });
        }

        // Get all the required models
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const customerModel = await payservedb.Customer; // No facilityId needed here as customer is in the main database
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // If levy is being updated, verify the new levy exists and has GL accounts configured
        if (levyId && levyId !== existingContract.levyId.toString()) {
            const newLevy = await levyModel.findById(levyId);
            if (!newLevy) {
                return reply.code(400).send({
                    success: false,
                    error: 'Selected levy does not exist'
                });
            }

            // Verify that the new levy has GL accounts configured
            if (!newLevy.glAccounts || 
                !newLevy.glAccounts.invoice?.debit || !newLevy.glAccounts.invoice?.credit ||
                !newLevy.glAccounts.payment?.debit || !newLevy.glAccounts.payment?.credit) {
                return reply.code(400).send({
                    success: false,
                    error: 'The selected levy does not have GL accounts properly configured. Please update the levy configuration first.'
                });
            }

            console.log('New levy GL accounts configuration verified:', newLevy.glAccounts);
        }

        // Verify that all referenced documents exist (levy, customer, unit, and currency)
        const [levyExists, customerExists, unitExists] = await Promise.all([
            levyModel.findById(existingContract.levyId),
            customerModel.findById(existingContract.customerId),
            unitModel.findById(existingContract.unitId)
        ]);

        if (!levyExists) {
            return reply.code(400).send({
                success: false,
                error: 'Referenced levy does not exist'
            });
        }

        // Verify current levy has GL accounts configured (in case it wasn't checked before)
        // if (!levyExists.glAccounts || 
        //     !levyExists.glAccounts.invoice?.debit || !levyExists.glAccounts.invoice?.credit ||
        //     !levyExists.glAccounts.payment?.debit || !levyExists.glAccounts.payment?.credit) {
        //     return reply.code(400).send({
        //         success: false,
        //         error: 'The current levy does not have GL accounts properly configured. Please update the levy configuration first.'
        //     });
        // }

        if (!customerExists) {
            return reply.code(400).send({
                success: false,
                error: 'Referenced customer does not exist'
            });
        }

        if (!unitExists) {
            return reply.code(400).send({
                success: false,
                error: 'Referenced unit does not exist'
            });
        }
        
        // Handle edit history if provided
        if (editHistory) {
            const newEditHistoryEntry = {
                editedAt: new Date(),
                editedBy: editHistory.editedBy,
                reason: editHistory.reason,
                changes: editHistory.changes || {}
            };
            
            // Add to edit history array using $push
            updates.$push = { 
                editHistory: newEditHistoryEntry 
            };
        }

        console.log('Final updates object:', updates);

        // Update the contract without populate first
        const updatedContract = await levyContractModel.findByIdAndUpdate(
            contractId,
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        // Verify update was successful
        if (!updatedContract) {
            return reply.code(404).send({
                success: false,
                error: 'Failed to update contract'
            });
        }

        // Populate the contract with levy details for response to show GL account info
        // const populatedContract = await levyContractModel.findById(updatedContract._id)
        //     .populate('levyId', 'levyName amount billingType glAccounts mobilePayment bankPayment')
        //     .populate('customerId', 'firstName lastName')
        //     .populate('unitId', 'name');

        // Create a response object
        const responseData = {
            success: true,
            message: 'Contract updated successfully. Note: GL accounts and payment settings are now managed at the levy level.',
            contract: updatedContract
        };

        return reply.code(200).send(responseData);

    } catch (err) {
        console.error('Error in updateLevyContract:', err);

        // Handle mongoose validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => error.message);
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Handle mongoose errors related to model registration
        if (err.name === 'MissingSchemaError') {
            return reply.code(500).send({
                success: false,
                error: 'Internal server error: Schema registration issue',
                details: 'Please contact system administrator'
            });
        }

        // Handle duplicate key errors
        if (err.code === 11000) {
            return reply.code(400).send({
                success: false,
                error: 'A contract with similar details already exists'
            });
        }

        // Handle other errors
        return reply.code(500).send({
            success: false,
                error: 'Failed to update contract',
            details: err.message
        });
    }
};

module.exports = updateLevyContract;