const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const utilityDb = require('../../../middlewares/utilityDb');
const logger = require('../../../../config/winston');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const finish_deactivation = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const { customerId } = request.body;

        // Validate required parameters
        if (!facilityId || !unitId || !customerId) {
            logger.error('Missing required parameters in finish_deactivation', {
                params: request.params,
                body: request.body
            });
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameters: facilityId, unitId, or customerId'
            });
        }

        // Validate ObjectId formats
        if (!mongoose.Types.ObjectId.isValid(facilityId) ||
            !mongoose.Types.ObjectId.isValid(unitId) ||
            !mongoose.Types.ObjectId.isValid(customerId)) {
            logger.error('Invalid ID format in finish_deactivation', {
                facilityId,
                unitId,
                customerId
            });
            return reply.code(400).send({
                success: false,
                error: 'Invalid ID format'
            });
        }

        // Get models
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const customer = await payservedb.Customer.findById(customerId);

        if (!customer) {
            logger.error('Customer not found in finish_deactivation', { customerId });
            return reply.code(404).send({
                success: false,
                error: "Customer not found"
            });
        }

        // Find the unit
        const unit = await unitModel.findById(unitId);
        if (!unit) {
            logger.error('Unit not found in finish_deactivation', { unitId });
            return reply.code(404).send({
                success: false,
                error: `Unit with ID ${unitId} not found`
            });
        }

        // Check customer association with unit
        const isHomeOwner = unit.homeOwnerId && unit.homeOwnerId.toString() === customerId.toString();
        const isTenant = unit.tenantId && unit.tenantId.toString() === customerId.toString();
        const isResident = unit.residentId && unit.residentId.toString() === customerId.toString();

        if (!isHomeOwner && !isTenant && !isResident) {
            logger.error('Customer not associated with unit in finish_deactivation', {
                customerId,
                unitId,
                homeOwnerId: unit.homeOwnerId,
                tenantId: unit.tenantId,
                residentId: unit.residentId
            });
            return reply.code(404).send({
                success: false,
                error: 'Customer is not associated with this unit'
            });
        }

        // Update occupants array with moveOutDate
        const updatedOccupants = (unit.occupants || []).map(occupant => {
            const occupantCustomerId = occupant.customerId?.toString();
            const occupantTenantId = occupant.tenantId?.toString();
            const occupantResidentId = occupant.residentId?.toString();

            const matchesCustomer = (
                occupantCustomerId === customerId.toString() ||
                occupantTenantId === customerId.toString() ||
                occupantResidentId === customerId.toString()
            );

            if (matchesCustomer && !occupant.moveOutDate) {
                const plainOccupant = occupant.toObject ? occupant.toObject() : { ...occupant };
                plainOccupant.moveOutDate = new Date();
                return plainOccupant;
            }
            return occupant;
        });

        // Prepare unit update operation based on customer type
        let updateOperation = {
            $set: { occupants: updatedOccupants }
        };

        if (customer.customerType === 'home owner' || isHomeOwner) {
            updateOperation = {
                $unset: { homeOwnerId: "" },
                $set: {
                    status: "Inactive",
                    occupants: updatedOccupants
                }
            };

            if (isResident) {
                updateOperation.$unset.residentId = "";
            }
        } else if (customer.customerType === 'tenant' || isTenant) {
            updateOperation = {
                $unset: { tenantId: "" },
                $set: {
                    occupants: updatedOccupants
                }
            };

            if (isResident) {
                updateOperation.$unset.residentId = "";
            }
        } else if (isResident) {
            updateOperation = {
                $unset: { residentId: "" },
                $set: {
                    occupants: updatedOccupants
                }
            };
        }

        logger.info('Applying unit update operation in finish_deactivation', {
            unitId,
            updateOperation,
            customerType: customer.customerType
        });

        // Update the unit
        const updateResult = await unitModel.findOneAndUpdate(
            { _id: unitId },
            updateOperation,
            { new: true }
        );

        if (!updateResult) {
            logger.error('Failed to update unit in finish_deactivation', { unitId });
            return reply.code(400).send({
                success: false,
                error: "Failed to update unit"
            });
        }

        // Terminate all levy contracts for this customer in this facility
        let levyContractTerminationResults = [];
        try {
            const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
            const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);

            // Find all active contracts for this customer in this facility
            const activeContracts = await levyContractModel.find({
                customerId: new ObjectId(customerId),
                facilityId: new ObjectId(facilityId),
                status: { $in: ['Active', 'Pending'] }
            }).populate('levyId', 'levyName amount billingType', levyModel);

            logger.info(`Found ${activeContracts.length} active levy contracts to terminate`, {
                customerId,
                facilityId
            });

            for (const contract of activeContracts) {
                try {
                    const terminationDate = new Date();
                    const updateData = {
                        status: 'Terminated',
                        endDate: terminationDate,
                        terminationReason: 'Customer deactivation',
                        updatedBy: request.user ? request.user._id : null
                    };

                    logger.debug('Terminating levy contract', {
                        contractId: contract._id,
                        updateData
                    });

                    const updatedContract = await levyContractModel.findByIdAndUpdate(
                        contract._id,
                        { $set: updateData },
                        { new: true, runValidators: true }
                    );

                    if (updatedContract) {
                        levyContractTerminationResults.push({
                            success: true,
                            contractId: updatedContract._id,
                            contractName: updatedContract.contractName || `Contract for ${contract.levyId?.levyName}`,
                            previousStatus: contract.status,
                            terminationDate: terminationDate.toISOString(),
                            levyName: contract.levyId?.levyName,
                            amount: contract.levyId?.amount
                        });

                        logger.info('Successfully terminated levy contract', {
                            contractId: updatedContract._id,
                            customerId,
                            facilityId
                        });
                    } else {
                        levyContractTerminationResults.push({
                            success: false,
                            contractId: contract._id,
                            error: 'Failed to update contract'
                        });
                        logger.error('Failed to terminate levy contract - no updated contract returned', {
                            contractId: contract._id
                        });
                    }
                } catch (contractError) {
                    logger.error('Error terminating individual levy contract', {
                        error: contractError.message,
                        contractId: contract._id,
                        customerId,
                        facilityId
                    });

                    levyContractTerminationResults.push({
                        success: false,
                        contractId: contract._id,
                        error: contractError.message
                    });
                }
            }
        } catch (levyContractError) {
            logger.error('Error in levy contract termination process', {
                error: levyContractError.message,
                stack: levyContractError.stack,
                customerId,
                facilityId
            });

            levyContractTerminationResults.push({
                success: false,
                error: 'Failed to process levy contracts: ' + levyContractError.message
            });
        }

        // Deactivate customer accounts in utility database
        let accountDeactivationResults = [];
        try {
            const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

            const activeAccounts = await WaterMeterAccountModel.find({
                customerId: new ObjectId(customerId),
                facilityId: new ObjectId(facilityId),
                status: 'Active'
            });

            logger.info(`Found ${activeAccounts.length} active utility accounts to deactivate`, {
                customerId,
                facilityId
            });

            for (const account of activeAccounts) {
                try {
                    const updatedAccount = await WaterMeterAccountModel.findOneAndUpdate(
                        {
                            _id: account._id,
                            status: 'Active'
                        },
                        {
                            status: 'Inactive',
                            deactivatedAt: new Date(),
                            deactivatedBy: request.user ? request.user._id : null
                        },
                        {
                            new: true,
                            runValidators: true
                        }
                    );

                    if (updatedAccount) {
                        accountDeactivationResults.push({
                            success: true,
                            accountId: updatedAccount._id,
                            meterId: updatedAccount.meter_id,
                            accountNo: updatedAccount.account_no,
                            previousStatus: 'Active',
                            newStatus: 'Inactive'
                        });

                        logger.info('Successfully deactivated utility account', {
                            accountId: updatedAccount._id,
                            customerId,
                            facilityId
                        });
                    } else {
                        accountDeactivationResults.push({
                            success: false,
                            accountId: account._id,
                            error: 'Failed to update account'
                        });
                        logger.error('Failed to deactivate utility account - no updated account returned', {
                            accountId: account._id
                        });
                    }
                } catch (accountError) {
                    logger.error('Error deactivating individual utility account', {
                        error: accountError.message,
                        accountId: account._id,
                        customerId,
                        facilityId
                    });

                    accountDeactivationResults.push({
                        success: false,
                        accountId: account._id,
                        error: accountError.message
                    });
                }
            }
        } catch (utilityError) {
            logger.error('Error in utility account deactivation process', {
                error: utilityError.message,
                stack: utilityError.stack,
                customerId,
                facilityId
            });

            accountDeactivationResults.push({
                success: false,
                error: 'Failed to process utility accounts: ' + utilityError.message
            });
        }

        // Deactivate customer wallet
        let walletDeactivationResults = {
            success: false,
            message: 'No wallet found'
        };
        try {
            const walletModel = await getModel('Wallet', payservedb.Wallet.schema, facilityId);

            const customerWallet = await walletModel.findOneAndUpdate(
                {
                    owner: new ObjectId(customerId),
                    ownerType: 'Customer',
                    facilityId: new ObjectId(facilityId),
                    isActive: true
                },
                {
                    isActive: false,
                    deactivatedAt: new Date(),
                    deactivatedBy: request.user ? request.user._id : null
                },
                {
                    new: true
                }
            );

            if (customerWallet) {
                walletDeactivationResults = {
                    success: true,
                    walletId: customerWallet._id,
                    previousBalance: customerWallet.balance,
                    newStatus: 'Inactive',
                    deactivatedAt: customerWallet.deactivatedAt
                };

                logger.info('Successfully deactivated customer wallet', {
                    walletId: customerWallet._id,
                    customerId,
                    facilityId
                });
            } else {
                // Check if wallet exists but is already inactive
                const existingWallet = await walletModel.findOne({
                    owner: new ObjectId(customerId),
                    ownerType: 'Customer',
                    facilityId: new ObjectId(facilityId)
                });

                if (existingWallet) {
                    walletDeactivationResults = {
                        success: true,
                        walletId: existingWallet._id,
                        message: 'Wallet was already inactive',
                        currentStatus: existingWallet.isActive ? 'Active' : 'Inactive'
                    };
                    logger.info('Customer wallet was already inactive', {
                        walletId: existingWallet._id,
                        customerId,
                        facilityId
                    });
                } else {
                    walletDeactivationResults = {
                        success: false,
                        message: 'No wallet found for customer'
                    };
                    logger.info('No wallet found for customer', { customerId, facilityId });
                }
            }
        } catch (walletError) {
            logger.error('Error in wallet deactivation process', {
                error: walletError.message,
                stack: walletError.stack,
                customerId,
                facilityId
            });

            walletDeactivationResults = {
                success: false,
                error: 'Failed to process wallet: ' + walletError.message
            };
        }

        // Check if the customer has any remaining unit associations
        let hasRemainingUnits = false;
        const homeownerCount = await unitModel.countDocuments({ homeOwnerId: new ObjectId(customerId) });
        const tenantCount = await unitModel.countDocuments({ tenantId: new ObjectId(customerId) });
        const residentCount = await unitModel.countDocuments({ residentId: new ObjectId(customerId) });

        hasRemainingUnits = homeownerCount > 0 || tenantCount > 0 || residentCount > 0;

        logger.info('Customer unit association check', {
            customerId,
            homeownerCount,
            tenantCount,
            residentCount,
            hasRemainingUnits
        });

        // Update customer status if no remaining units
        if (!hasRemainingUnits && customer.status !== 'Inactive') {
            customer.status = 'Inactive';
            customer.deactivatedAt = new Date();
            customer.deactivatedBy = request.user ? request.user._id : null;
            await customer.save();
            logger.info('Customer status set to Inactive', { customerId });
        } else if (hasRemainingUnits && customer.status !== 'Active') {
            customer.status = 'Active';
            await customer.save();
            logger.info('Customer status set to Active (has remaining units)', { customerId });
        }

        // Prepare success response
        const response = {
            success: true,
            message: 'Customer deactivation completed successfully',
            customer: {
                id: customer._id,
                name: `${customer.firstName} ${customer.lastName}`,
                status: customer.status,
                type: customer.customerType
            },
            unit: {
                id: unit._id,
                name: unit.name,
                status: updateResult.status,
                homeOwnerId: updateResult.homeOwnerId,
                tenantId: updateResult.tenantId,
                residentId: updateResult.residentId
            },
            operations: {
                levyContractsTerminated: levyContractTerminationResults.filter(r => r.success).length,
                utilityAccountsDeactivated: accountDeactivationResults.filter(r => r.success).length,
                walletDeactivated: walletDeactivationResults.success
            },
            details: {
                levyContractTerminations: levyContractTerminationResults,
                utilityAccountDeactivations: accountDeactivationResults,
                walletDeactivation: walletDeactivationResults
            },
            metadata: {
                processedAt: new Date().toISOString(),
                processedBy: request.user ? request.user._id : null
            }
        };

        logger.info('Customer deactivation completed successfully', {
            customerId,
            facilityId,
            unitId,
            result: {
                levyContracts: levyContractTerminationResults.length,
                utilityAccounts: accountDeactivationResults.length,
                walletDeactivated: walletDeactivationResults.success
            }
        });

        return reply.code(200).send(response);

    } catch (error) {
        logger.error('Critical error in finish_deactivation', {
            error: error.message,
            stack: error.stack,
            params: request.params,
            body: request.body,
            user: request.user ? request.user._id : null
        });

        return reply.code(500).send({
            success: false,
            error: 'Internal server error during customer deactivation',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = finish_deactivation;