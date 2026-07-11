const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const utilityDb = require('../../../middlewares/utilityDb');
const logger = require('../../../../config/winston');

const create_move_out_handover = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            unitId,
            customerId,
            relatedHandoverId, // Now optional - not required if no move-in handover exists
            handoverDate,
            items,
            meterReadings,
            keysHandedOver,
            securityDeposit,
            notes,
            attachments,
            signatures,
            status
        } = request.body;

        // Validate required fields - relatedHandoverId is now optional
        if (!unitId || !customerId) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields. unitId and customerId are required.'
            });
        }

        let handoverModel;
        let unitModel;
        let leaseAgreementModel;
        let invoiceModel;
        let handover;
        let customer;
        let unit;
        let moveInHandover = null;
        let leaseAgreement = null;
        let unpaidInvoices = [];

        try {
            // Dynamically fetch facility-specific models
            handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
            //console.log('Successfully got Handover model');

            try {
                // Also get Unit, LeaseAgreement, and Invoice models
                unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
                invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
                //console.log('Successfully got Unit, LeaseAgreement, and Invoice models');

                // Validate unit exists in facility database
                unit = await unitModel.findById(unitId);
                if (!unit) {
                    return reply.code(404).send({
                        success: false,
                        error: `Unit with ID ${unitId} does not exist.`
                    });
                }

                // Try to find an active lease agreement for this unit/customer to get deposit amount
                leaseAgreement = await leaseAgreementModel.findOne({
                    unitNumber: unitId,
                    tenant: customerId,
                    status: { $in: ['Active', 'Pending', 'Expired'] }
                }).sort({ createdAt: -1 }); // Get the most recent one

                if (leaseAgreement) {
                    // console.log('Found lease agreement with ID:', leaseAgreement._id);

                    // Fetch unpaid invoices for this tenant and unit
                    unpaidInvoices = await invoiceModel.find({
                        'client.clientId': customerId,
                        'unit.id': unitId,
                        'status': { $in: ['Unpaid', 'Overdue', 'Partially Paid'] }
                    });

                    // console.log(`Found ${unpaidInvoices.length} unpaid invoices for this tenant and unit`);
                }
            } catch (modelError) {
                // console.warn('Could not get models:', modelError.message);
                // Continue without model validation
            }

            // Customer is in the main database - use direct model without getModel
            customer = await payservedb.Customer.findById(customerId);
            if (!customer) {
                return reply.code(404).send({
                    success: false,
                    error: `Customer with ID ${customerId} does not exist.`
                });
            }

            // If relatedHandoverId is provided, verify it exists
            if (relatedHandoverId) {
                moveInHandover = await handoverModel.findById(relatedHandoverId);
                if (!moveInHandover) {
                    return reply.code(404).send({
                        success: false,
                        error: `Move-In Handover with ID ${relatedHandoverId} does not exist.`
                    });
                }

                if (moveInHandover.handoverType !== 'MoveIn') {
                    return reply.code(400).send({
                        success: false,
                        error: `Handover with ID ${relatedHandoverId} is not a Move-In handover.`
                    });
                }
            }

            // If we have a lease agreement, extract security deposit and currency (if not provided)
            let securityDepositData = securityDeposit || {};
            let leaseCurrency = null;

            if (leaseAgreement && (!securityDepositData.amount || securityDepositData.amount === 0)) {
                const depositAmount = leaseAgreement.financialTerms?.securityDeposit || 0;
                // console.log('Using security deposit from lease agreement:', depositAmount);

                securityDepositData = {
                    amount: depositAmount,
                    deductions: securityDepositData.deductions || [],
                    refundAmount: depositAmount - (securityDepositData.deductions?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0)
                };
            }

            // Get currency from lease agreement if available
            if (leaseAgreement && leaseAgreement.currency) {
                try {
                    // Populate the currency field from the lease agreement
                    const populatedLease = await leaseAgreementModel.findById(leaseAgreement._id).populate('currency');
                    if (populatedLease && populatedLease.currency) {
                        leaseCurrency = populatedLease.currency;
                        console.log('Using currency from lease agreement:', leaseCurrency.currencyName, leaseCurrency.currencyShortCode);
                    }
                } catch (currencyError) {
                    console.warn('Could not populate currency from lease agreement:', currencyError.message);
                    // Continue without currency - will use default handling
                }
            }

            // Add unpaid invoices as deductions to the security deposit
            if (unpaidInvoices.length > 0 && securityDepositData.amount > 0) {
                // Create an array of existing deductions (if any)
                const deductions = [...(securityDepositData.deductions || [])];

                // Total of current deductions
                let totalCurrentDeductions = deductions.reduce((sum, item) => sum + (item.amount || 0), 0);

                // Add each unpaid invoice as a deduction
                for (const invoice of unpaidInvoices) {
                    // Calculate remaining amount due
                    const amountDue = invoice.totalAmount - (invoice.amountPaid || 0);

                    if (amountDue > 0) {
                        // Add as a deduction
                        deductions.push({
                            reason: `Unpaid Invoice #${invoice.invoiceNumber}`,
                            amount: amountDue,
                            description: `Outstanding balance for invoice dated ${new Date(invoice.issueDate).toLocaleDateString()}. Items: ${invoice.items.map(item => item.description).join(', ')}`,
                            invoiceId: invoice._id // Add the invoice ID reference
                        });

                        totalCurrentDeductions += amountDue;
                    }
                }

                // Update the security deposit data with the new deductions
                securityDepositData.deductions = deductions;

                // Recalculate the refund amount
                securityDepositData.refundAmount = Math.max(0, securityDepositData.amount - totalCurrentDeductions);

                // console.log(`Added ${unpaidInvoices.length} unpaid invoices as deductions. New refund amount: ${securityDepositData.refundAmount}`);
            }

            // Create handover data
            const handoverData = {
                facilityId,
                unitId,
                customerId,
                relatedHandoverId: relatedHandoverId || null,
                handoverType: 'MoveOut',
                handoverDate: handoverDate ? new Date(handoverDate) : new Date(),
                items: items || [],
                meterReadings: meterReadings || {
                    electricity: { reading: 0 },
                    water: { reading: 0 },
                    gas: { reading: 0 }
                },
                keysHandedOver: keysHandedOver || 0,
                securityDeposit: securityDepositData.amount ? securityDepositData : {
                    amount: 0,
                    deductions: [],
                    refundAmount: 0
                },
                notes: notes || '',
                attachments: attachments || [],
                signatures: signatures || {
                    propertyManager: {},
                    customer: { agreement: false }
                },
                status: status || 'Draft',
                // Add currency information from lease if available
                currency: leaseCurrency ? {
                    currencyId: leaseCurrency._id,
                    currencyName: leaseCurrency.currencyName,
                    currencyShortCode: leaseCurrency.currencyShortCode,
                    exchangeRate: leaseCurrency.exchangeRate || 1.0,
                    isDefaultCurrency: leaseCurrency.isDefaultCurrency || false
                } : null
            };

            //console.log('Creating move-out handover with data');

            // Create handover in the facility database
            handover = await handoverModel.create(handoverData);
            //console.log('Move-out handover created with ID:', handover._id);

        } catch (modelError) {
            //console.error('Error with models in create_move_out_handover:', modelError);
            return reply.code(500).send({
                success: false,
                error: `Database error: ${modelError.message}`
            });
        }

        // If status is 'Completed', trigger complete deactivation process
        let deactivationResults = {
            accountDeactivationResults: [],
            levyContractTerminationResults: [],
            walletDeactivationResults: [],
            unitUpdateResults: null
        };

        if (status === 'Completed') {
            console.log(`Move-out handover is Completed, triggering complete deactivation for customer ${customerId} from unit ${unitId}`);

            try {
                // Check if the customer is associated with this unit in any capacity
                const isHomeOwner = unit.homeOwnerId && unit.homeOwnerId.toString() === customerId.toString();
                const isTenant = unit.tenantId && unit.tenantId.toString() === customerId.toString();
                const isResident = unit.residentId && unit.residentId.toString() === customerId.toString();

                if (isHomeOwner || isTenant || isResident) {
                    // Update the occupants array - set moveOutDate for the customer being deactivated
                    const occupants = unit.occupants || [];

                    const updatedOccupants = occupants.map(occupant => {
                        const occupantCustomerId = occupant.customerId?.toString();
                        const occupantTenantId = occupant.tenantId?.toString();
                        const occupantResidentId = occupant.residentId?.toString();

                        const matchesCustomer = (
                            occupantCustomerId === customerId.toString() ||
                            occupantTenantId === customerId.toString() ||
                            occupantResidentId === customerId.toString()
                        );

                        if (matchesCustomer && occupant.moveOutDate === null) {
                            const plainOccupant = occupant.toObject ? occupant.toObject() : { ...occupant };
                            plainOccupant.moveOutDate = new Date();
                            return plainOccupant;
                        }
                        return occupant;
                    });

                    // Prepare the update operation based on customer type
                    let updateOperation = {
                        $set: {
                            occupants: updatedOccupants  // Include updated occupants array in all cases
                        }
                    };

                    if (customer.customerType === 'home owner' || isHomeOwner) {
                        // If homeowner is leaving, remove homeowner and resident (if they are the same)
                        updateOperation = {
                            $unset: { homeOwnerId: "" },
                            $set: {
                                status: "Inactive",
                                occupants: updatedOccupants
                            }
                        };

                        // If homeowner is also the resident, remove resident as well
                        if (isResident) {
                            updateOperation.$unset.residentId = "";
                        }
                    } else if (customer.customerType === 'tenant' || isTenant) {
                        // If tenant is leaving, just remove them as tenant
                        updateOperation = {
                            $unset: { tenantId: "" },
                            $set: {
                                occupants: updatedOccupants  // ✅ still update occupants
                            }
                        };

                        // If tenant is also the resident, remove resident as well
                        if (isResident) {
                            updateOperation.$unset.residentId = "";
                        }
                    } else if (isResident) {
                        // If only resident is leaving (rare case), just remove resident
                        updateOperation = {
                            $unset: { residentId: "" },
                            $set: {
                                occupants: updatedOccupants  // ✅ still update occupants
                            }
                        };
                    }

                    console.log('Applying unit update operation:', JSON.stringify(updateOperation));

                    // Update the unit
                    const updateResult = await unitModel.findOneAndUpdate(
                        { _id: unitId },
                        updateOperation,
                        { new: true }
                    );

                    deactivationResults.unitUpdateResults = {
                        status: 'success',
                        message: 'Unit updated successfully',
                        customerType: customer.customerType
                    };

                    console.log('Unit updated successfully during move-out handover');
                }

                // Deactivate customer accounts in utility database
                try {
                    // Get WaterMeterAccount model from utility database
                    const WaterMeterAccountModel = await utilityDb.getModel('WaterMeterAccount');

                    // Find all active accounts for this customer in this facility
                    const activeAccounts = await WaterMeterAccountModel.find({
                        customerId: customerId,
                        facilityId: facilityId,
                        status: 'Active'
                    });

                    console.log(`Found ${activeAccounts.length} active accounts for customer ${customerId} in facility ${facilityId}`);

                    // Deactivate each active account
                    for (const account of activeAccounts) {
                        try {
                            const updatedAccount = await WaterMeterAccountModel.findOneAndUpdate(
                                {
                                    _id: account._id,
                                    status: 'Active',
                                    facilityId: facilityId
                                },
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

                            if (updatedAccount) {
                                deactivationResults.accountDeactivationResults.push({
                                    accountId: updatedAccount._id,
                                    meterId: updatedAccount.meter_id,
                                    account_no: updatedAccount.account_no,
                                    status: 'success'
                                });

                                logger.info('Successfully deactivated account during move-out handover', {
                                    accountId: updatedAccount._id,
                                    meterId: updatedAccount.meter_id,
                                    facilityId,
                                    customerId,
                                    account_no: updatedAccount.account_no
                                });
                            }
                        } catch (accountError) {
                            console.error(`Error deactivating account ${account._id}:`, accountError);
                            logger.error('Error deactivating individual account during move-out handover:', {
                                error: accountError.message,
                                accountId: account._id,
                                customerId,
                                facilityId
                            });

                            deactivationResults.accountDeactivationResults.push({
                                accountId: account._id,
                                meterId: account.meter_id,
                                account_no: account.account_no,
                                status: 'error',
                                error: accountError.message
                            });
                        }
                    }
                } catch (utilityError) {
                    console.error('Error accessing utility database for account deactivation:', utilityError);
                    logger.error('Error in utility database operations during move-out handover:', {
                        error: utilityError.message,
                        stack: utilityError.stack,
                        customerId,
                        facilityId
                    });

                    deactivationResults.accountDeactivationResults.push({
                        status: 'error',
                        error: 'Failed to access utility database: ' + utilityError.message
                    });
                }

                // Terminate levy contracts for the customer and unit
                try {
                    // Get LevyContract model
                    const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);

                    // Find all active levy contracts for this customer and unit in this facility
                    const activeLevyContracts = await levyContractModel.find({
                        customerId: customerId,
                        unitId: unitId,
                        facilityId: facilityId,
                        status: 'Active'
                    });

                    console.log(`Found ${activeLevyContracts.length} active levy contracts for customer ${customerId} and unit ${unitId} in facility ${facilityId}`);

                    // Terminate each active levy contract
                    for (const contract of activeLevyContracts) {
                        try {
                            const updatedContract = await levyContractModel.findOneAndUpdate(
                                {
                                    _id: contract._id,
                                    status: 'Active',
                                    facilityId: facilityId
                                },
                                {
                                    status: 'Terminated',
                                    endDate: new Date(), // Set end date to today when terminating
                                    updatedBy: request.user?.id // Add the user who terminated if available
                                },
                                {
                                    new: true,
                                    runValidators: true
                                }
                            );

                            if (updatedContract) {
                                deactivationResults.levyContractTerminationResults.push({
                                    contractId: updatedContract._id,
                                    contractName: updatedContract.contractName,
                                    levyId: updatedContract.levyId,
                                    amount: updatedContract.amount,
                                    status: 'success'
                                });

                                logger.info('Successfully terminated levy contract during move-out handover', {
                                    contractId: updatedContract._id,
                                    contractName: updatedContract.contractName,
                                    facilityId,
                                    customerId,
                                    unitId
                                });
                            }
                        } catch (contractError) {
                            console.error(`Error terminating levy contract ${contract._id}:`, contractError);
                            logger.error('Error terminating individual levy contract during move-out handover:', {
                                error: contractError.message,
                                contractId: contract._id,
                                customerId,
                                unitId,
                                facilityId
                            });

                            deactivationResults.levyContractTerminationResults.push({
                                contractId: contract._id,
                                contractName: contract.contractName,
                                levyId: contract.levyId,
                                amount: contract.amount,
                                status: 'error',
                                error: contractError.message
                            });
                        }
                    }
                } catch (levyContractError) {
                    console.error('Error accessing levy contracts for termination:', levyContractError);
                    logger.error('Error in levy contract termination operations during move-out handover:', {
                        error: levyContractError.message,
                        stack: levyContractError.stack,
                        customerId,
                        unitId,
                        facilityId
                    });

                    deactivationResults.levyContractTerminationResults.push({
                        status: 'error',
                        error: 'Failed to access levy contracts: ' + levyContractError.message
                    });
                }

                // Deactivate customer wallet
                try {
                    // Get Wallet model
                    const walletModel = await getModel('Wallet', payservedb.Wallet.schema, facilityId);

                    // Find and deactivate wallet by owner (customer)
                    const customerWallet = await walletModel.findOneAndUpdate(
                        {
                            owner: customerId,
                            ownerType: 'Customer',
                            facilityId: facilityId,
                            isActive: true  // Only update if currently active
                        },
                        {
                            isActive: false
                        },
                        {
                            new: true
                        }
                    );

                    if (customerWallet) {
                        deactivationResults.walletDeactivationResults.push({
                            walletId: customerWallet._id,
                            ownerId: customerWallet.owner,
                            ownerType: customerWallet.ownerType,
                            balance: customerWallet.balance,
                            status: 'success',
                            message: 'Customer wallet deactivated successfully'
                        });

                        console.log(`Successfully deactivated wallet for customer ${customerId} during move-out handover`);
                        logger.info('Successfully deactivated customer wallet during move-out handover', {
                            walletId: customerWallet._id,
                            customerId,
                            facilityId,
                            balance: customerWallet.balance
                        });
                    } else {
                        // Check if wallet exists but is already inactive
                        const existingWallet = await walletModel.findOne({
                            owner: customerId,
                            ownerType: 'Customer',
                            facilityId: facilityId
                        });

                        if (existingWallet) {
                            deactivationResults.walletDeactivationResults.push({
                                walletId: existingWallet._id,
                                ownerId: existingWallet.owner,
                                ownerType: existingWallet.ownerType,
                                balance: existingWallet.balance,
                                status: 'already_inactive',
                                message: 'Customer wallet was already inactive'
                            });
                            console.log(`Customer wallet ${existingWallet._id} was already inactive`);
                        } else {
                            deactivationResults.walletDeactivationResults.push({
                                ownerId: customerId,
                                ownerType: 'Customer',
                                status: 'not_found',
                                message: 'No wallet found for customer'
                            });
                            console.log(`No wallet found for customer ${customerId} in facility ${facilityId}`);
                        }
                    }
                } catch (walletError) {
                    console.error('Error deactivating customer wallet during move-out handover:', walletError);
                    logger.error('Error in wallet deactivation operations during move-out handover:', {
                        error: walletError.message,
                        stack: walletError.stack,
                        customerId,
                        facilityId
                    });

                    deactivationResults.walletDeactivationResults.push({
                        ownerId: customerId,
                        ownerType: 'Customer',
                        status: 'error',
                        error: 'Failed to deactivate wallet: ' + walletError.message
                    });
                }

                // Check if the customer has any remaining unit associations
                let hasRemainingUnits = false;

                // Count units where this customer appears as homeowner, tenant, or resident
                const homeownerCount = await unitModel.countDocuments({ homeOwnerId: customerId });
                const tenantCount = await unitModel.countDocuments({ tenantId: customerId });
                const residentCount = await unitModel.countDocuments({ residentId: customerId });

                hasRemainingUnits = homeownerCount > 0 || tenantCount > 0 || residentCount > 0;

                console.log(`Customer associations - homeowner: ${homeownerCount}, tenant: ${tenantCount}, resident: ${residentCount}`);

                // Update customer status if no remaining units
                if (!hasRemainingUnits && customer.status !== 'Inactive') {
                    console.log('Customer has no remaining units, setting status to Inactive');
                    customer.status = 'Inactive';
                    await customer.save();
                } else if (hasRemainingUnits && customer.status !== 'Active') {
                    console.log('Customer still has units, setting status to Active');
                    customer.status = 'Active';
                    await customer.save();
                }

                deactivationResults.customerStatus = customer.status;
                deactivationResults.hasRemainingUnits = hasRemainingUnits;

                // After successful deactivation, update handover status to 'Completed'
                console.log('All deactivation processes completed successfully, updating handover status to Completed');

                const updatedHandover = await handoverModel.findByIdAndUpdate(
                    handover._id,
                    {
                        status: 'Completed',
                        completedAt: new Date(),
                        completedBy: request.user?.id
                    },
                    { new: true }
                );

                if (updatedHandover) {
                    console.log(`Move-out handover ${handover._id} status updated to Completed`);
                    logger.info('Move-out handover status updated to Completed after successful deactivation', {
                        handoverId: handover._id,
                        customerId,
                        unitId,
                        facilityId,
                        completedAt: new Date()
                    });

                    // Update the handover object for response
                    handover = updatedHandover;
                    deactivationResults.handoverStatusUpdate = {
                        status: 'success',
                        newStatus: 'Completed',
                        completedAt: new Date()
                    };
                } else {
                    console.warn('Failed to update handover status to Completed');
                    deactivationResults.handoverStatusUpdate = {
                        status: 'error',
                        error: 'Failed to update handover status to Completed'
                    };
                }

            } catch (deactivationError) {
                console.error('Error during deactivation process:', deactivationError);
                logger.error('Error in deactivation process during move-out handover:', {
                    error: deactivationError.message,
                    stack: deactivationError.stack,
                    customerId,
                    unitId,
                    facilityId
                });

                deactivationResults.deactivationError = {
                    message: 'Partial deactivation error: ' + deactivationError.message,
                    timestamp: new Date()
                };

                // Even if there was an error during deactivation, we should still try to update handover status
                // but mark it appropriately based on the severity of errors
                console.log('Deactivation process encountered errors, checking if handover should be marked as completed or failed');

                // Check if critical operations succeeded (at least unit update should work)
                const hasCriticalErrors = !deactivationResults.unitUpdateResults ||
                    deactivationResults.unitUpdateResults.status !== 'success';

                if (!hasCriticalErrors) {
                    // Minor errors only (utility/levy/wallet issues), still mark as completed with warnings
                    try {
                        const updatedHandover = await handoverModel.findByIdAndUpdate(
                            handover._id,
                            {
                                status: 'Completed',
                                completedAt: new Date(),
                                completedBy: request.user?.id,
                                notes: (handover.notes || '') + '\n\nWarning: Some deactivation processes encountered errors. Please review deactivation results.'
                            },
                            { new: true }
                        );

                        if (updatedHandover) {
                            handover = updatedHandover;
                            deactivationResults.handoverStatusUpdate = {
                                status: 'completed_with_warnings',
                                newStatus: 'Completed',
                                completedAt: new Date(),
                                warnings: 'Some deactivation processes encountered errors'
                            };
                        }
                    } catch (updateError) {
                        console.error('Failed to update handover status after partial deactivation:', updateError);
                        deactivationResults.handoverStatusUpdate = {
                            status: 'error',
                            error: 'Failed to update handover status: ' + updateError.message
                        };
                    }
                } else {
                    // Critical errors occurred, keep as Active and add error notes
                    try {
                        const updatedHandover = await handoverModel.findByIdAndUpdate(
                            handover._id,
                            {
                                notes: (handover.notes || '') + '\n\nError: Critical deactivation processes failed. Manual intervention required.'
                            },
                            { new: true }
                        );

                        if (updatedHandover) {
                            handover = updatedHandover;
                        }

                        deactivationResults.handoverStatusUpdate = {
                            status: 'failed',
                            newStatus: 'Active',
                            error: 'Critical deactivation processes failed, handover remains Active'
                        };
                    } catch (updateError) {
                        console.error('Failed to update handover notes after critical deactivation failure:', updateError);
                        deactivationResults.handoverStatusUpdate = {
                            status: 'error',
                            error: 'Failed to update handover: ' + updateError.message
                        };
                    }
                }
            }
        }

        try {
            // Get the handover data without using populate
            let populatedHandover = await handoverModel.findById(handover._id).lean();

            if (!populatedHandover) {
                populatedHandover = handover.toObject ? handover.toObject() : JSON.parse(JSON.stringify(handover));
            }

            // Manually add unit data
            if (unit) {
                populatedHandover.unitId = {
                    _id: unit._id,
                    name: unit.name,
                    floorUnitNo: unit.floorUnitNo,
                    division: unit.division,
                    unitType: unit.unitType,
                    status: unit.status
                };
            }

            // Manually add move-in handover data if it exists
            if (moveInHandover) {
                populatedHandover.relatedHandoverId = moveInHandover.toObject ?
                    moveInHandover.toObject() :
                    JSON.parse(JSON.stringify(moveInHandover));
            }

            // Manually add customer data
            if (customer) {
                populatedHandover.customerId = {
                    _id: customer._id,
                    firstName: customer.firstName,
                    lastName: customer.lastName,
                    email: customer.email,
                    phoneNumber: customer.phoneNumber
                };
            }

            // Add lease agreement reference if available
            if (leaseAgreement) {
                populatedHandover.leaseAgreementInfo = {
                    _id: leaseAgreement._id,
                    securityDeposit: leaseAgreement.financialTerms?.securityDeposit || 0,
                    startDate: leaseAgreement.leaseTerms?.startDate,
                    endDate: leaseAgreement.leaseTerms?.endDate,
                    currency: leaseCurrency ? {
                        _id: leaseCurrency._id,
                        currencyName: leaseCurrency.currencyName,
                        currencyShortCode: leaseCurrency.currencyShortCode,
                        exchangeRate: leaseCurrency.exchangeRate || 1.0,
                        isDefaultCurrency: leaseCurrency.isDefaultCurrency || false
                    } : null
                };
            }

            // Add unpaid invoices information
            if (unpaidInvoices.length > 0) {
                populatedHandover.unpaidInvoicesInfo = {
                    count: unpaidInvoices.length,
                    totalAmount: unpaidInvoices.reduce((sum, invoice) =>
                        sum + (invoice.totalAmount - (invoice.amountPaid || 0)), 0),
                    invoiceIds: unpaidInvoices.map(invoice => invoice._id)
                };
            }

            // Add deactivation results if status was Completed
            if (status === 'Completed') {
                populatedHandover.deactivationResults = deactivationResults;
            }

            return reply.code(200).send({
                success: true,
                message: status === 'Completed' ?
                    (deactivationResults.handoverStatusUpdate?.status === 'success' ?
                        'Move-Out Handover created and completed successfully with full customer deactivation' :
                        deactivationResults.handoverStatusUpdate?.status === 'completed_with_warnings' ?
                            'Move-Out Handover created and completed with some deactivation warnings' :
                            'Move-Out Handover created with deactivation issues - manual review required') :
                    'Move-Out Handover created successfully',
                data: populatedHandover
            });
        } catch (responseError) {
            //console.error('Error preparing response:', responseError);

            // If we still have the handover ID, return a basic success response
            if (handover && handover._id) {
                return reply.code(200).send({
                    success: true,
                    message: status === 'Completed' ?
                        (deactivationResults.handoverStatusUpdate?.status === 'success' ?
                            'Move-Out Handover created and completed with deactivation processed' :
                            deactivationResults.handoverStatusUpdate?.status === 'completed_with_warnings' ?
                                'Move-Out Handover created and completed with deactivation warnings' :
                                'Move-Out Handover created with deactivation issues') :
                        'Move-Out Handover created with limited details',
                    data: {
                        _id: handover._id,
                        handoverType: 'MoveOut',
                        status: handover.status || 'Draft',
                        deactivationResults: status === 'Completed' ? deactivationResults : undefined
                    }
                });
            } else {
                return reply.code(500).send({
                    success: false,
                    error: responseError.message || 'An error occurred while preparing the response.'
                });
            }
        }
    } catch (err) {
        //console.error('Error in create_move_out_handover:', err);

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while creating the move-out handover.'
        });
    }
};

module.exports = create_move_out_handover;