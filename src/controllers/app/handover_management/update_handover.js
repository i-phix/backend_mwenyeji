const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const utilityDb = require('../../../middlewares/utilityDb');
const logger = require('../../../../config/winston');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

// Import contract management functions
const disableLevyContract = require('../levy_management/contracts/disable_contract');
const terminatePropertyManagerContract = require('../property_management/contracts/terminate_property_manager_contract');

const update_handover = async (request, reply) => {
    try {
        const { facilityId, handoverId } = request.params;
        const updateData = request.body;

        // Validate required fields
        if (!handoverId) {
            logger.error('Handover ID is required', { params: request.params });
            return reply.code(400).send({
                success: false,
                error: 'Handover ID is required.'
            });
        }

        // Validate ObjectId format
        // if (!mongoose.Types.ObjectId.isValid(handoverId) {
        //     logger.error('Invalid handover ID format', { handoverId });
        //     return reply.code(400).send({
        //         success: false,
        //         error: 'Invalid handover ID format'
        //     });
        // }

        let handoverModel;
        let unitModel;
        let existingHandover;
        let updatedHandover;

        try {
            // Dynamically fetch facility-specific models
            handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
            logger.info('Successfully loaded Handover model', { facilityId });

            // Verify handover exists
            existingHandover = await handoverModel.findById(handoverId);
            if (!existingHandover) {
                logger.error('Handover not found', { handoverId });
                return reply.code(404).send({
                    success: false,
                    error: `Handover with ID ${handoverId} does not exist.`
                });
            }

            logger.info('Found existing handover', {
                handoverId: existingHandover._id,
                handoverType: existingHandover.handoverType,
                status: existingHandover.status
            });

            // Check if this is a status change to 'Completed' for a move-out handover
            const isCompletingMoveOut = (
                updateData.status === 'Completed' &&
                existingHandover.handoverType === 'MoveOut' &&
                existingHandover.status !== 'Completed'
            );

            // Process update data - prevent changing critical fields
            const allowedUpdates = [
                'items', 'meterReadings', 'keysHandedOver', 'notes', 'attachments',
                'signatures', 'status', 'securityDeposit', 'handoverDate'
            ];

            const sanitizedUpdateData = {};

            allowedUpdates.forEach(field => {
                if (updateData[field] !== undefined) {
                    sanitizedUpdateData[field] = updateData[field];
                }
            });

            // Special handling for security deposit
            if (updateData.securityDeposit && existingHandover.handoverType === 'MoveOut') {
                sanitizedUpdateData.securityDeposit = {
                    ...existingHandover.securityDeposit.toObject(),
                    ...updateData.securityDeposit
                };

                // Recalculate refund amount if deductions changed
                if (updateData.securityDeposit.deductions) {
                    const totalDeductions = updateData.securityDeposit.deductions.reduce(
                        (sum, deduction) => sum + (deduction.amount || 0), 0
                    );
                    sanitizedUpdateData.securityDeposit.refundAmount =
                        (updateData.securityDeposit.amount || existingHandover.securityDeposit.amount || 0) - totalDeductions;
                }
            }

            logger.debug('Updating handover with sanitized data', {
                handoverId,
                updateData: sanitizedUpdateData
            });

            // Update the handover
            updatedHandover = await handoverModel.findByIdAndUpdate(
                handoverId,
                sanitizedUpdateData,
                { new: true, runValidators: true }
            );

            logger.info('Handover updated successfully', { handoverId });

            // Initialize results for deactivation operations
            let deactivationResults = {
                leaseTerminations: [],
                propertyManagementContractTerminations: [],
                utilityAccountDeactivations: [],
                levyContractDeactivations: [],
                walletDeactivations: [],
                customerStatusUpdates: []
            };

            // If completing a move-out handover, perform deactivation tasks
            if (isCompletingMoveOut && existingHandover.customerId && existingHandover.unitId) {
                const customerId = existingHandover.customerId;
                const unitId = existingHandover.unitId;

                logger.info('Completing move-out handover - performing deactivation tasks', {
                    customerId,
                    unitId
                });

                // 1. Terminate any active lease agreements for this tenant and unit
                try {
                    const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

                    const activeLeases = await leaseAgreementModel.find({
                        tenant: customerId,
                        unitNumber: unitId,
                        facilityId: facilityId,
                        status: { $in: ['Active', 'Pending'] }
                    });

                    logger.info(`Found ${activeLeases.length} active lease agreements to terminate`, {
                        customerId,
                        unitId
                    });

                    for (const lease of activeLeases) {
                        try {
                            const terminationDate = new Date();
                            const updateResult = await leaseAgreementModel.findByIdAndUpdate(
                                lease._id,
                                {
                                    status: 'Terminated',
                                    endDate: terminationDate,
                                    terminationReason: 'Move-out handover completed',
                                    updatedBy: request.user ? request.user._id : null
                                },
                                { new: true }
                            );

                            if (updateResult) {
                                deactivationResults.leaseTerminations.push({
                                    success: true,
                                    leaseId: lease._id,
                                    leaseName: lease.leaseName,
                                    previousStatus: lease.status,
                                    terminationDate: terminationDate.toISOString()
                                });
                                logger.info('Lease terminated successfully', { leaseId: lease._id });
                            } else {
                                deactivationResults.leaseTerminations.push({
                                    success: false,
                                    leaseId: lease._id,
                                    error: 'Update operation failed'
                                });
                                logger.error('Failed to terminate lease - no document returned', { leaseId: lease._id });
                            }
                        } catch (leaseError) {
                            logger.error('Error terminating lease', {
                                leaseId: lease._id,
                                error: leaseError.message
                            });
                            deactivationResults.leaseTerminations.push({
                                success: false,
                                leaseId: lease._id,
                                error: leaseError.message
                            });
                        }
                    }
                } catch (leaseError) {
                    logger.error('Error accessing lease agreements', {
                        error: leaseError.message
                    });
                    deactivationResults.leaseTerminations.push({
                        success: false,
                        error: 'Failed to access lease agreements: ' + leaseError.message
                    });
                }

                // 2. Terminate Property Management Contracts
                try {
                    const propertyManagerContractModel = await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId);

                    const affectedContracts = await propertyManagerContractModel.find({
                        units: unitId,
                        facilityId: facilityId,
                        status: { $in: ['Active', 'Inactive'] }
                    });

                    logger.info(`Found ${affectedContracts.length} property management contracts to terminate`, {
                        unitId
                    });

                    for (const contract of affectedContracts) {
                        try {
                            // Create a mock request for the termination function
                            const mockRequest = {
                                params: {
                                    facilityId: facilityId,
                                    contractId: contract._id.toString()
                                },
                                body: {
                                    terminationReason: `Move-out handover ${handoverId} completed`,
                                    terminationDate: new Date()
                                },
                                user: request.user
                            };

                            // Create a mock reply to capture the result
                            let terminationResult = null;
                            const mockReply = {
                                code: (statusCode) => ({
                                    send: (data) => {
                                        terminationResult = { statusCode, data };
                                        return { statusCode, data };
                                    }
                                })
                            };

                            // Call the termination function
                            await terminatePropertyManagerContract(mockRequest, mockReply);

                            if (terminationResult && terminationResult.statusCode === 200) {
                                deactivationResults.propertyManagementContractTerminations.push({
                                    success: true,
                                    contractId: contract._id,
                                    contractName: contract.contractName,
                                    previousStatus: contract.status,
                                    newStatus: 'Terminated',
                                    terminationReason: 'Move-out handover completed'
                                });
                                logger.info('Property management contract terminated successfully', {
                                    contractId: contract._id
                                });
                            } else {
                                const errorMessage = terminationResult?.data?.error || 'Termination failed';
                                deactivationResults.propertyManagementContractTerminations.push({
                                    success: false,
                                    contractId: contract._id,
                                    error: errorMessage
                                });
                                logger.error('Failed to terminate property management contract', {
                                    contractId: contract._id,
                                    error: errorMessage
                                });
                            }
                        } catch (contractError) {
                            logger.error('Error terminating property management contract', {
                                contractId: contract._id,
                                error: contractError.message
                            });
                            deactivationResults.propertyManagementContractTerminations.push({
                                success: false,
                                contractId: contract._id,
                                error: contractError.message
                            });
                        }
                    }
                } catch (contractError) {
                    logger.error('Error accessing property management contracts', {
                        error: contractError.message
                    });
                    deactivationResults.propertyManagementContractTerminations.push({
                        success: false,
                        error: 'Failed to access property management contracts: ' + contractError.message
                    });
                }

                // Get unit model for updates
                unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

                // Find the unit and customer
                const unit = await unitModel.findById(unitId);
                if (!unit) {
                    logger.error('Unit not found during move-out completion', { unitId });
                    deactivationResults.unitUpdate = {
                        success: false,
                        error: 'Unit not found'
                    };
                } else {
                    const customer = await payservedb.Customer.findById(customerId);
                    if (!customer) {
                        logger.error('Customer not found during move-out completion', { customerId });
                        deactivationResults.customerUpdate = {
                            success: false,
                            error: 'Customer not found'
                        };
                    } else {
                        // Check customer association with unit
                        const isHomeOwner = unit.homeOwnerId && unit.homeOwnerId.toString() === customerId.toString();
                        const isTenant = unit.tenantId && unit.tenantId.toString() === customerId.toString();
                        const isResident = unit.residentId && unit.residentId.toString() === customerId.toString();

                        if (isHomeOwner || isTenant || isResident) {
                            // Update occupants array with moveOutDate
                            const updatedOccupants = (unit.occupants || []).map(occupant => {
                                const matchesCustomer = (
                                    occupant.customerId?.toString() === customerId.toString() ||
                                    occupant.tenantId?.toString() === customerId.toString() ||
                                    occupant.residentId?.toString() === customerId.toString()
                                );

                                if (matchesCustomer && !occupant.moveOutDate) {
                                    const plainOccupant = occupant.toObject ? occupant.toObject() : { ...occupant };
                                    plainOccupant.moveOutDate = new Date();
                                    return plainOccupant;
                                }
                                return occupant;
                            });

                            // Prepare unit update operation
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
                                if (isResident) updateOperation.$unset.residentId = "";
                            } else if (customer.customerType === 'tenant' || isTenant) {
                                updateOperation = {
                                    $unset: { tenantId: "" },
                                    $set: { occupants: updatedOccupants }
                                };
                                if (isResident) updateOperation.$unset.residentId = "";
                            } else if (isResident) {
                                updateOperation = {
                                    $unset: { residentId: "" },
                                    $set: { occupants: updatedOccupants }
                                };
                            }

                            // Update the unit
                            const unitUpdateResult = await unitModel.findOneAndUpdate(
                                { _id: unitId },
                                updateOperation,
                                { new: true }
                            );

                            if (unitUpdateResult) {
                                deactivationResults.unitUpdate = {
                                    success: true,
                                    unitId: unitUpdateResult._id,
                                    newStatus: unitUpdateResult.status,
                                    occupantsUpdated: updatedOccupants.filter(o => o.moveOutDate).length
                                };
                                logger.info('Unit updated successfully after move-out', {
                                    unitId: unitUpdateResult._id
                                });
                            } else {
                                deactivationResults.unitUpdate = {
                                    success: false,
                                    error: 'Update operation failed'
                                };
                                logger.error('Failed to update unit - no document returned', { unitId });
                            }

                            // 3. Deactivate all levy contracts for the customer in this facility
                            try {
                                const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
                                const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);

                                const activeLevyContracts = await levyContractModel.find({
                                    customerId: customerId,
                                    facilityId: facilityId,
                                    status: { $in: ['Active', 'Pending'] }
                                }).populate('levyId', 'levyName amount billingType', levyModel);

                                logger.info(`Found ${activeLevyContracts.length} active levy contracts to deactivate`, {
                                    customerId,
                                    facilityId
                                });

                                for (const contract of activeLevyContracts) {
                                    try {
                                        // Create a mock request for the disable function
                                        const mockRequest = {
                                            params: {
                                                facilityId: facilityId,
                                                contractId: contract._id.toString()
                                            },
                                            body: {
                                                status: 'Inactive'
                                            },
                                            user: request.user
                                        };

                                        // Create a mock reply to capture the result
                                        let disableResult = null;
                                        const mockReply = {
                                            code: (statusCode) => ({
                                                send: (data) => {
                                                    disableResult = { statusCode, data };
                                                    return { statusCode, data };
                                                }
                                            })
                                        };

                                        // Call the disable function
                                        await disableLevyContract(mockRequest, mockReply);

                                        if (disableResult && disableResult.statusCode === 200) {
                                            deactivationResults.levyContractDeactivations.push({
                                                success: true,
                                                contractId: contract._id,
                                                contractName: contract.contractName || `Contract for ${contract.levyId?.levyName}`,
                                                levyName: contract.levyId?.levyName,
                                                amount: contract.levyId?.amount,
                                                previousStatus: contract.status,
                                                newStatus: 'Inactive',
                                                deactivationDate: new Date().toISOString()
                                            });
                                            logger.info('Levy contract deactivated successfully', {
                                                contractId: contract._id
                                            });
                                        } else {
                                            const errorMessage = disableResult?.data?.error || 'Deactivation failed';
                                            deactivationResults.levyContractDeactivations.push({
                                                success: false,
                                                contractId: contract._id,
                                                error: errorMessage
                                            });
                                            logger.error('Failed to deactivate levy contract', {
                                                contractId: contract._id,
                                                error: errorMessage
                                            });
                                        }
                                    } catch (contractError) {
                                        logger.error('Error deactivating levy contract', {
                                            contractId: contract._id,
                                            error: contractError.message
                                        });
                                        deactivationResults.levyContractDeactivations.push({
                                            success: false,
                                            contractId: contract._id,
                                            error: contractError.message
                                        });
                                    }
                                }
                            } catch (levyError) {
                                logger.error('Error accessing levy contracts', {
                                    error: levyError.message
                                });
                                deactivationResults.levyContractDeactivations.push({
                                    success: false,
                                    error: 'Failed to access levy contracts: ' + levyError.message
                                });
                            }

                            // 4. Deactivate utility accounts
                            try {
                                const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

                                const activeAccounts = await WaterMeterAccountModel.find({
                                    customerId: customerId,
                                    facilityId: facilityId,
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
                                            { new: true }
                                        );

                                        if (updatedAccount) {
                                            deactivationResults.utilityAccountDeactivations.push({
                                                success: true,
                                                accountId: updatedAccount._id,
                                                accountNo: updatedAccount.account_no,
                                                previousStatus: 'Active'
                                            });
                                            logger.info('Utility account deactivated successfully', {
                                                accountId: updatedAccount._id
                                            });
                                        } else {
                                            deactivationResults.utilityAccountDeactivations.push({
                                                success: false,
                                                accountId: account._id,
                                                error: 'Update operation failed'
                                            });
                                            logger.error('Failed to deactivate utility account - no document returned', {
                                                accountId: account._id
                                            });
                                        }
                                    } catch (accountError) {
                                        logger.error('Error deactivating utility account', {
                                            accountId: account._id,
                                            error: accountError.message
                                        });
                                        deactivationResults.utilityAccountDeactivations.push({
                                            success: false,
                                            accountId: account._id,
                                            error: accountError.message
                                        });
                                    }
                                }
                            } catch (utilityError) {
                                logger.error('Error accessing utility accounts', {
                                    error: utilityError.message
                                });
                                deactivationResults.utilityAccountDeactivations.push({
                                    success: false,
                                    error: 'Failed to access utility accounts: ' + utilityError.message
                                });
                            }

                            // 5. Deactivate customer wallet
                            try {
                                const walletModel = await getModel('Wallet', payservedb.Wallet.schema, facilityId);

                                const wallet = await walletModel.findOneAndUpdate(
                                    {
                                        owner: customerId,
                                        ownerType: 'Customer',
                                        facilityId: facilityId,
                                        isActive: true
                                    },
                                    {
                                        isActive: false,
                                        deactivatedAt: new Date(),
                                        deactivatedBy: request.user ? request.user._id : null
                                    },
                                    { new: true }
                                );

                                if (wallet) {
                                    deactivationResults.walletDeactivations.push({
                                        success: true,
                                        walletId: wallet._id,
                                        previousBalance: wallet.balance,
                                        newStatus: 'Inactive'
                                    });
                                    logger.info('Customer wallet deactivated successfully', {
                                        walletId: wallet._id
                                    });
                                } else {
                                    const existingWallet = await walletModel.findOne({
                                        owner: customerId,
                                        ownerType: 'Customer',
                                        facilityId: facilityId
                                    });

                                    if (existingWallet) {
                                        deactivationResults.walletDeactivations.push({
                                            success: true,
                                            walletId: existingWallet._id,
                                            message: 'Wallet was already inactive',
                                            currentStatus: existingWallet.isActive ? 'Active' : 'Inactive'
                                        });
                                    } else {
                                        deactivationResults.walletDeactivations.push({
                                            success: false,
                                            message: 'No wallet found for customer'
                                        });
                                    }
                                }
                            } catch (walletError) {
                                logger.error('Error deactivating wallet', {
                                    error: walletError.message
                                });
                                deactivationResults.walletDeactivations.push({
                                    success: false,
                                    error: 'Failed to deactivate wallet: ' + walletError.message
                                });
                            }

                            // 6. Update customer status if no remaining units
                            try {
                                const homeownerCount = await unitModel.countDocuments({ homeOwnerId: customerId });
                                const tenantCount = await unitModel.countDocuments({ tenantId: customerId });
                                const residentCount = await unitModel.countDocuments({ residentId: customerId });

                                const hasRemainingUnits = homeownerCount > 0 || tenantCount > 0 || residentCount > 0;

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

                                deactivationResults.customerStatusUpdates.push({
                                    success: true,
                                    customerId: customer._id,
                                    previousStatus: customer.status,
                                    newStatus: hasRemainingUnits ? 'Active' : 'Inactive',
                                    hasRemainingUnits
                                });
                            } catch (statusError) {
                                logger.error('Error updating customer status', {
                                    error: statusError.message
                                });
                                deactivationResults.customerStatusUpdates.push({
                                    success: false,
                                    error: 'Failed to update customer status: ' + statusError.message
                                });
                            }
                        } else {
                            logger.info('Customer is not associated with this unit', {
                                customerId,
                                unitId
                            });
                            deactivationResults.unitUpdate = {
                                success: false,
                                error: 'Customer is not associated with this unit'
                            };
                        }
                    }
                }
            }

            // Prepare response data with populated fields
            const responseData = {
                ...updatedHandover.toObject(),
                deactivationResults: isCompletingMoveOut ? deactivationResults : undefined
            };

            // Manually populate related data
            try {
                // Populate unit data
                if (responseData.unitId && !unitModel) {
                    unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                }
                if (responseData.unitId) {
                    const unit = await unitModel.findById(responseData.unitId).lean();
                    if (unit) {
                        responseData.unitId = {
                            _id: unit._id,
                            name: unit.name,
                            floorUnitNo: unit.floorUnitNo,
                            division: unit.division,
                            unitType: unit.unitType,
                            status: unit.status
                        };
                    }
                }

                // Populate customer data
                if (responseData.customerId) {
                    const customer = await payservedb.Customer.findById(responseData.customerId);
                    if (customer) {
                        responseData.customerId = {
                            _id: customer._id,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            email: customer.email,
                            phoneNumber: customer.phoneNumber,
                            customerType: customer.customerType,
                            status: customer.status
                        };
                    }
                }

                // Populate property manager data
                if (responseData.propertyManagerId) {
                    const manager = await payservedb.User.findById(responseData.propertyManagerId);
                    if (manager) {
                        responseData.propertyManagerId = {
                            _id: manager._id,
                            name: manager.name,
                            email: manager.email
                        };
                    }
                }

                // Populate related handover if exists
                if (responseData.relatedHandoverId) {
                    const relatedHandover = await handoverModel.findById(responseData.relatedHandoverId).lean();
                    if (relatedHandover) {
                        responseData.relatedHandoverId = relatedHandover;
                    }
                }
            } catch (populateError) {
                logger.error('Error populating related data', {
                    error: populateError.message
                });
            }

            // Prepare final response
            const response = {
                success: true,
                message: isCompletingMoveOut ?
                    'Move-out handover completed successfully. Customer removed from unit, lease terminated, property management contracts terminated, levy contracts deactivated, utility accounts deactivated, and wallet deactivated.' :
                    'Handover updated successfully',
                data: responseData
            };

            return reply.code(200).send(response);

        } catch (modelError) {
            logger.error('Database error in update_handover', {
                error: modelError.message,
                stack: modelError.stack
            });
            return reply.code(500).send({
                success: false,
                error: `Database error: ${modelError.message}`
            });
        }
    } catch (err) {
        logger.error('Unexpected error in update_handover', {
            error: err.message,
            stack: err.stack
        });
        return reply.code(500).send({
            success: false,
            error: err.message || 'An unexpected error occurred while updating the handover.'
        });
    }
};

module.exports = update_handover;