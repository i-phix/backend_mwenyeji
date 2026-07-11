const utilityDb = require('../../../../middlewares/utilityDb');
const logger = require('../../../../../config/winston');

const deactivateCustomerAccount = async (request, reply) => {
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
        
        // Get models from utility database
        const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');
        const WaterMeterModel = await utilityDb.getModel('WaterMeter');
        
        // Construct query to find active accounts for this meter and account number
        const query = {
            meter_id: meterId,
            status: 'Active',
            facilityId // Ensure we're only looking at accounts for this facility
        };
        
        // If account number is provided, add it to the query
        if (account_no) {
            query.account_no = account_no;
        }
        
        // Find and update the active account in utility database
        const updatedAccount = await WaterMeterAccountModel.findOneAndUpdate(
            query,
            {
                status: 'Inactive',
                deactivatedAt: new Date(),
                deactivatedBy: request.user?.id // Add the user who deactivated if available
            },
            {
                new: true,
                runValidators: true
            }
        );
        
        // Check if an account was found and updated
        if (!updatedAccount) {
            logger.warn('No active account found to deactivate', {
                meterId,
                facilityId,
                account_no,
                operation: 'deactivateCustomerAccount'
            });
            throw new Error('No active account found for the given meter in this facility');
        }
        
        // Update the associated meter to remove customer information
        try {
            const updatedMeter = await WaterMeterModel.findByIdAndUpdate(
                meterId,
                {
                    customerId: null,
                    customerName: null,
                    // Optionally reset customerType if desired
                    // customerType: null
                },
                {
                    new: true,
                    runValidators: true
                }
            );
            
            if (updatedMeter) {
                logger.info('Successfully removed customer from meter', {
                    meterId,
                    facilityId,
                    operation: 'deactivateCustomerAccount'
                });
            } else {
                logger.warn('Meter not found when trying to remove customer', {
                    meterId,
                    facilityId,
                    operation: 'deactivateCustomerAccount'
                });
            }
        } catch (meterUpdateError) {
            logger.error('Error updating meter after account deactivation', {
                error: meterUpdateError.message,
                meterId,
                facilityId,
                operation: 'deactivateCustomerAccount'
            });
            // Don't throw here as the account was successfully deactivated
            // We'll log the error but continue with successful response
        }
        
        logger.info('Successfully deactivated account in utility database', {
            accountId: updatedAccount._id,
            meterId,
            facilityId,
            account_no
        });
        
        return reply.code(200).send({
            success: true,
            message: 'User account deactivated successfully and customer removed from meter',
            data: updatedAccount
        });
        
    } catch (err) {
        logger.error('Error in deactivateCustomerAccount:', {
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

module.exports = deactivateCustomerAccount;