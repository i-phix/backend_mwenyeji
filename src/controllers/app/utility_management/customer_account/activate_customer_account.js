const utilityDb = require('../../../../middlewares/utilityDb');
const logger = require('../../../../../config/winston');

const activateCustomerAccount = async (request, reply) => {
    try {
        const { facilityId, meterId } = request.params;
        const { account_no } = request.body;

        // Validate required parameters
        if (!facilityId) {
            throw new Error('Facility ID is required');
        }

        if (!meterId) {
            throw new Error('Meter ID is required');
        }

        if (!account_no) {
            throw new Error('Account number is required');
        }

        // Get models from utility database
        const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
        const WaterMeterModel = await utilityDb.getModel('WaterMeter');

        // First, find the account we want to activate to get its meter number
        const accountToActivate = await WaterMeterAccountModel.findOne({
            meter_id: meterId,
            facilityId: facilityId,
            account_no: account_no
        });

        if (!accountToActivate) {
            throw new Error(`Account with number ${account_no} not found for this meter and facility`);
        }

        // Check if the account is already active
        if (accountToActivate.status === 'Active') {
            logger.info('Account is already active', {
                accountId: accountToActivate._id,
                account_no,
                facilityId,
                meterId
            });
            return reply.code(200).send({
                success: true,
                message: 'Account is already active',
                data: accountToActivate
            });
        }

        // Check if there's already another active account for this meter number
        const existingActiveAccount = await WaterMeterAccountModel.findOne({
            meterNumber: accountToActivate.meterNumber,
            facilityId: facilityId,
            status: 'Active',
            _id: { $ne: accountToActivate._id } // Exclude the current account
        });

        if (existingActiveAccount) {
            logger.warn('Attempt to activate account when another active account exists for the same meter', {
                meterNumber: accountToActivate.meterNumber,
                facilityId,
                accountToActivateId: accountToActivate._id,
                existingActiveAccountId: existingActiveAccount._id,
                existingActiveCustomerId: existingActiveAccount.customerId
            });
            throw new Error(`Cannot activate account. An active account already exists for meter number ${accountToActivate.meterNumber}. Only one active account per meter is allowed.`);
        }

        // Proceed with activation since no conflicts exist
        const updatedAccount = await WaterMeterAccountModel.findOneAndUpdate(
            {
                _id: accountToActivate._id
            },
            {
                status: 'Active',
                activatedAt: new Date(),
                activatedBy: request.user?.id || 'system'
            },
            { 
                new: true, // Return the updated document
                runValidators: true 
            }
        );

        // Update the associated meter with customer information
        try {
            const updatedMeter = await WaterMeterModel.findByIdAndUpdate(
                meterId,
                {
                    customerId: updatedAccount.customerId,
                    customerName: updatedAccount.customerName,
                    customerType: updatedAccount.payment_type === 'Postpaid' ? 'postpaid' : 'prepaid'
                },
                {
                    new: true,
                    runValidators: true
                }
            );

            if (updatedMeter) {
                logger.info('Successfully updated meter with customer information', {
                    meterId,
                    customerId: updatedAccount.customerId,
                    customerName: updatedAccount.customerName,
                    facilityId,
                    operation: 'activateCustomerAccount'
                });
            } else {
                logger.warn('Meter not found when trying to update customer information', {
                    meterId,
                    facilityId,
                    operation: 'activateCustomerAccount'
                });
            }
        } catch (meterUpdateError) {
            logger.error('Error updating meter after account activation', {
                error: meterUpdateError.message,
                meterId,
                facilityId,
                customerId: updatedAccount.customerId,
                operation: 'activateCustomerAccount'
            });
            // Don't throw here as the account was successfully activated
            // We'll log the error but continue with successful response
        }

        logger.info('Account activated successfully in utility database', {
            accountId: updatedAccount._id,
            account_no,
            facilityId,
            meterId,
            meterNumber: updatedAccount.meterNumber,
            customerId: updatedAccount.customerId
        });

        return reply.code(200).send({
            success: true,
            message: 'User account activated successfully and meter updated with customer information',
            data: updatedAccount
        });

    } catch (err) {
        logger.error('Error in activateCustomerAccount:', {
            error: err.message,
            stack: err.stack,
            params: {
                facilityId: request.params.facilityId,
                meterId: request.params.meterId,
                account_no: request.body.account_no
            }
        });

        return reply.code(400).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = activateCustomerAccount;