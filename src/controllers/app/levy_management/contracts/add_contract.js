const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const forwardGenerateUpfrontInvoice = require('../../levy_management/invoices/forwardGenerateUpfrontInvoice');

const addLevyContract = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const {
            contractName,
            levyId,
            unitIds,
            amount,
            startDate,
            endDate,
            status,
            balanceBroughtForward,
            // taxEnabled,
            enabledTaxes,
            paymentFrequency,
            upfrontPayment
        } = request.body;

        // Normalize unitIds to always be an array
        const unitsToProcess = Array.isArray(unitIds) ? unitIds : [unitIds];
        const isMultiple = unitsToProcess.length > 1;

        // Input validation for required fields
        const missingFields = [];
        if (!contractName || contractName.trim() === "") missingFields.push('Contract name');
        if (!levyId) missingFields.push('Levy');
        if (!unitsToProcess || unitsToProcess.length === 0) missingFields.push('At least one unit');
        if (!amount) missingFields.push('Amount');
        if (!startDate) missingFields.push('Start date');
        if (!endDate) missingFields.push('End date');
        if (!status) missingFields.push('Status');

        if (missingFields.length > 0) {
            const errorMessage = `Required fields missing: ${missingFields.join(', ')}`;
            console.error(errorMessage);
            return reply.code(400).send({
                success: false,
                error: errorMessage
            });
        }

        // Validate date format and logic
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);

        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid date format'
            });
        }

        if (startDateObj >= endDateObj) {
            return reply.code(400).send({
                success: false,
                error: 'End date must be after start date'
            });
        }

        // Validate amount
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'Amount must be a positive number'
            });
        }

        // Validate upfront payment if enabled
        if (upfrontPayment && upfrontPayment.enabled) {
            if (!upfrontPayment.amount || isNaN(upfrontPayment.amount) || parseFloat(upfrontPayment.amount) <= 0) {
                return reply.code(400).send({
                    success: false,
                    error: 'Valid upfront amount is required when upfront payment is enabled'
                });
            }
            
            if (!upfrontPayment.billingPeriods || !Array.isArray(upfrontPayment.billingPeriods) || upfrontPayment.billingPeriods.length === 0) {
                return reply.code(400).send({
                    success: false,
                    error: 'At least one billing period must be selected for upfront payment'
                });
            }
            
            const validFrequencies = ['Monthly', 'Quarterly', 'Semi-Annually', 'Annually'];
            if (!upfrontPayment.collectionFrequency || !validFrequencies.includes(upfrontPayment.collectionFrequency)) {
                return reply.code(400).send({
                    success: false,
                    error: 'Valid collection frequency is required for upfront payment'
                });
            }
        }

        // Get all required models
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const customerModel = await payservedb.Customer;
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Verify levy exists and has GL accounts
        const levy = await levyModel.findById(levyId);

        if (!levy) {
            return reply.code(400).send({
                success: false,
                error: 'Referenced levy does not exist'
            });
        }

        // if (!levy.glAccounts ||
        //     !levy.glAccounts.invoice?.debit || !levy.glAccounts.invoice?.credit ||
        //     !levy.glAccounts.payment?.debit || !levy.glAccounts.payment?.credit) {
        //     return reply.code(400).send({
        //         success: false,
        //         error: 'The selected levy does not have GL accounts properly configured. Please update the levy configuration first.'
        //     });
        // }


        const effectivePaymentFrequency = paymentFrequency || levy.collectionFrequency || "Monthly";

        // Arrays to store results and errors
        const savedContracts = [];
        const errors = [];
        const upfrontInvoiceResults = [];

        // Process each unit
        for (let index = 0; index < unitsToProcess.length; index++) {
            const unitId = unitsToProcess[index];

            try {
                // Verify unit exists
                const unit = await unitModel.findById(unitId);

                if (!unit) {
                    errors.push({
                        unitId,
                        unitName: 'Unknown',
                        error: 'Unit does not exist'
                    });
                    continue;
                }

                // Check for existing active contract
                const existingContract = await levyContractModel.findOne({
                    levyId,
                    unitId,
                    status: 'Active'
                });

                if (existingContract) {
                    errors.push({
                        unitId,
                        unitName: unit.name,
                        error: 'An active contract already exists for this levy and unit'
                    });
                    continue;
                }

                // Determine customer
                let customerId = null;
                const levyApplicantLower = levy.levyApplicant?.toLowerCase() || 'home owner';

                if (levyApplicantLower === 'tenant' || levyApplicantLower === 'tenants') {
                    customerId = unit.tenantId || unit.homeOwnerId;

                    if (!unit.tenantId && unit.homeOwnerId) {
                        console.log(`Unit ${unit.name}: No tenant found, using homeowner as fallback`);
                    }
                } else {
                    customerId = unit.homeOwnerId || unit.tenantId;

                    if (!unit.homeOwnerId && unit.tenantId) {
                        console.log(`Unit ${unit.name}: No homeowner found, using tenant as fallback`);
                    }
                }

                if (!customerId) {
                    errors.push({
                        unitId,
                        unitName: unit.name,
                        error: `No ${levyApplicantLower === 'tenant' ? 'tenant' : 'homeowner'} found for this unit`
                    });
                    continue;
                }

                // Verify customer exists
                const customer = await customerModel.findById(customerId);

                if (!customer) {
                    errors.push({
                        unitId,
                        unitName: unit.name,
                        error: 'Referenced customer does not exist'
                    });
                    continue;
                }

                // Create contract data
                const contractData = {
                    contractName: isMultiple ? `${contractName.trim()} - ${unit.name}` : contractName.trim(),
                    levyId,
                    customerId,
                    unitId,
                    amount: parseFloat(amount),
                    startDate,
                    endDate,
                    status,
                    paymentFrequency: effectivePaymentFrequency,
                    facilityId,
                    balanceBroughtForward: parseFloat(balanceBroughtForward) || 0,
                    // taxEnabled,
                    enabledTaxes,
                    createdBy: request.user ? request.user._id : null
                };

                // Add upfront payment configuration if provided
                if (upfrontPayment && upfrontPayment.enabled) {
                    contractData.upfrontPayment = {
                        enabled: true,
                        amount: parseFloat(upfrontPayment.amount),
                        billingPeriods: upfrontPayment.billingPeriods,
                        collectionFrequency: upfrontPayment.collectionFrequency || effectivePaymentFrequency,
                        remainingAmount: parseFloat(upfrontPayment.amount),
                        processedPeriods: [],
                        createdAt: new Date()
                    };
                }

                const savedContract = await levyContractModel.create(contractData);

                // Try to populate the contract
                try {
                    const populatedContract = await levyContractModel.findById(savedContract._id)
                        .populate({
                            path: 'levyId',
                            model: levyModel,
                            select: 'levyName amount billingType glAccounts collectionFrequency levyApplicant'
                        })
                        .populate({
                            path: 'customerId',
                            model: customerModel,
                            select: 'firstName lastName customerType'
                        })
                        .populate({
                            path: 'unitId',
                            model: unitModel,
                            select: 'name'
                        });

                    savedContracts.push(populatedContract);

                } catch (populateError) {
                    console.log(`Population failed for unit ${unit.name}, using manual approach:`, populateError.message);

                    const contract = savedContract.toObject();
                    const populatedContract = {
                        ...contract,
                        levyId: {
                            _id: levy._id,
                            levyName: levy.levyName,
                            amount: levy.amount,
                            billingType: levy.billingType,
                            collectionFrequency: levy.collectionFrequency,
                            levyApplicant: levy.levyApplicant,
                            glAccounts: levy.glAccounts
                        },
                        customerId: {
                            _id: customer._id,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            customerType: customer.customerType
                        },
                        unitId: {
                            _id: unit._id,
                            name: unit.name
                        }
                    };

                    savedContracts.push(populatedContract);
                }

                // TRIGGER UPFRONT INVOICE GENERATION IF ENABLED
                if (upfrontPayment && upfrontPayment.enabled) {
                    try {
                        console.log(`[UPFRONT-INVOICE] Triggering upfront invoice generation for contract ${savedContract._id}`);
                        
                        const upfrontInvoiceResult = await forwardGenerateUpfrontInvoice({
                            facilityId,
                            contractId: savedContract._id.toString(),
                            billingPeriods: upfrontPayment.billingPeriods,
                            upfrontAmount: parseFloat(upfrontPayment.amount),
                            collectionFrequency: upfrontPayment.collectionFrequency || effectivePaymentFrequency
                        });

                        upfrontInvoiceResults.push({
                            contractId: savedContract._id,
                            unitName: unit.name,
                            success: true,
                            invoiceData: upfrontInvoiceResult.data
                        });

                        console.log(`[UPFRONT-INVOICE] Successfully generated upfront invoice for contract ${savedContract._id}`);
                    } catch (upfrontInvoiceError) {
                        console.error(`[UPFRONT-INVOICE] Error generating upfront invoice for contract ${savedContract._id}:`, upfrontInvoiceError.message);
                        
                        // Don't fail the whole contract creation, just log the error
                        upfrontInvoiceResults.push({
                            contractId: savedContract._id,
                            unitName: unit.name,
                            success: false,
                            error: upfrontInvoiceError.message
                        });
                    }
                }

            } catch (unitError) {
                console.error(`Error processing unit ${unitId}:`, unitError);
                
                let unitName = 'Unknown';
                try {
                    const unit = await unitModel.findById(unitId);
                    if (unit) unitName = unit.name;
                } catch (e) {
                    // Ignore
                }
                
                errors.push({
                    unitId,
                    unitName: unitName,
                    error: unitError.message
                });
            }
        }

        // Prepare response
        const responseData = {
            contracts: isMultiple ? savedContracts : savedContracts[0],
            glAccountsInfo: {
                configured: true,
                source: 'levy',
                message: 'GL accounts are configured at the levy level'
            },
            upfrontPaymentInfo: upfrontPayment?.enabled ? {
                enabled: true,
                message: `Upfront payment configured for ${upfrontPayment.billingPeriods.length} period(s)`,
                invoicesGenerated: upfrontInvoiceResults.filter(r => r.success).length,
                invoicesFailed: upfrontInvoiceResults.filter(r => !r.success).length,
                results: upfrontInvoiceResults
            } : { enabled: false }
        };

        if (errors.length === 0) {
            return reply.code(200).send({
                success: true,
                message: isMultiple
                    ? `${savedContracts.length} levy contracts added successfully`
                    : 'Levy contract added successfully',
                ...responseData
            });
        } else if (savedContracts.length > 0) {
            return reply.code(200).send({
                success: true,
                partial: true,
                message: `${savedContracts.length} of ${unitsToProcess.length} levy contracts added successfully`,
                ...responseData,
                errors: errors
            });
        } else {
            return reply.code(400).send({
                success: false,
                error: 'Failed to create any levy contracts',
                errors: errors
            });
        }

    } catch (err) {
        console.error('Error in addLevyContract:', err);

        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => error.message);
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        if (err.name === 'MissingSchemaError') {
            return reply.code(500).send({
                success: false,
                error: 'Internal server error: Schema registration issue',
                details: 'Please contact system administrator'
            });
        }

        if (err.code === 11000) {
            return reply.code(400).send({
                success: false,
                error: 'A contract with similar details already exists'
            });
        }

        return reply.code(500).send({
            success: false,
            error: 'Failed to create levy contract',
            details: err.message
        });
    }
};

module.exports = addLevyContract;