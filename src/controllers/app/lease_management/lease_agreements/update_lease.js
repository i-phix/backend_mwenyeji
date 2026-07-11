const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

// Helper function to calculate next invoice date based on payment due date
const calculateNextInvoiceDate = (startDate, paymentDueDate, frequency = 'Monthly') => {
    if (!startDate || !paymentDueDate) return null;
    
    const baseDate = new Date(startDate);
    baseDate.setDate(paymentDueDate);
    
    // If the payment due date has passed this month, set for next month
    if (baseDate < startDate) {
        baseDate.setMonth(baseDate.getMonth() + 1);
    }
    
    return baseDate;
};

const edit_lease_agreement = async (request, reply) => {
    try {
        const { facilityId, leaseId } = request.params;
        const {
            unitNumber,
            currency,
            leaseTerms,
            financialTerms,
            billingCycle,
            status,
            reminders = [],
            editHistory, // New field to handle edit history
            requireLandlordApproval, // Added support for landlord approval
            escalations = [], // Added support for lease escalations
            monthlyRent,
            paymentDueDate,
            securityDeposit,
            depositMonths,
            frequency,
            glAccounts, // Added GL accounts similar to create function
            bankDetails: primaryBankDetailsId, // Top-level bank details reference
            billerAddressId
        } = request.body;

        // Debug logging
        console.log('Received lease agreement update data:', JSON.stringify(request.body, null, 2));
        
        // Validate edit reason if edit history is provided
        if (editHistory && (!editHistory.reason || !editHistory.reason.trim())) {
            return reply.code(400).send({
                success: false,
                error: 'Edit reason is required'
            });
        }

        // Dynamically fetch models
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const currencyModel = await getModel('Currency', payservedb.Currency.schema, facilityId);
        const doubleEntryModel = await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId);
        const glAccountModel = await getModel('GLAccount', payservedb.GLAccount.schema, facilityId);
        const propertyManagerContractModel = await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId);
        const bankDetailsModel = await getModel('BankDetails', payservedb.BankDetails.schema, facilityId);

        // Find existing lease agreement
        const existingLease = await leaseAgreementModel.findById(leaseId);
        if (!existingLease) {
            return reply.code(404).send({
                success: false,
                error: `Lease agreement with ID ${leaseId} not found.`
            });
        }

        // Prepare update data
        const updateData = {};

        // Handle unit update if provided
        if (unitNumber) {
            const unit = await unitModel.findById(unitNumber);
            if (!unit) {
                return reply.code(404).send({
                    success: false,
                    error: `Unit with ID ${unitNumber} does not exist.`
                });
            }
            updateData.unitNumber = unit._id;
            updateData.landlord = unit.homeOwnerId;
            updateData.tenant = unit.tenantId;
        }

        // Handle currency update if provided
        if (currency) {
            let currencyExists = null;
            try {
                currencyExists = await currencyModel.findById(currency);
                if (!currencyExists) {
                    currencyExists = await payservedb.Currency.findById(currency);
                }
                if (!currencyExists) {
                    currencyExists = await currencyModel.findOne({
                        _id: currency,
                        facilityId: facilityId
                    });
                }
            } catch (err) {
                console.error('Error finding currency:', err);
            }

            if (!currencyExists) {
                return reply.code(404).send({
                    success: false,
                    error: `Currency with ID ${currency} does not exist.`
                });
            }
            updateData.currency = currencyExists._id;
        }

        // Update lease terms if provided
        if (leaseTerms) {
            updateData.leaseTerms = {
                ...existingLease.leaseTerms,
                startDate: leaseTerms.startDate ? new Date(leaseTerms.startDate) : existingLease.leaseTerms.startDate,
                endDate: leaseTerms.endDate ? new Date(leaseTerms.endDate) : existingLease.leaseTerms.endDate,
                duration: leaseTerms.duration ? Number(leaseTerms.duration) : existingLease.leaseTerms.duration,
                autoRenewal: leaseTerms.autoRenewal !== undefined ? leaseTerms.autoRenewal : existingLease.leaseTerms.autoRenewal
            };
        }

        // Process escalations if provided
        let processedEscalations = [];
        if (Array.isArray(escalations) && escalations.length > 0) {
            for (const esc of escalations) {
                // Validate escalation data
                if (!esc.effectiveDate || !esc.type || !esc.value) {
                    console.warn('Skipping invalid escalation:', esc);
                    continue;
                }

                // Make sure type is valid
                if (!['percentage', 'fixed'].includes(esc.type)) {
                    console.warn(`Invalid escalation type: ${esc.type}`);
                    continue;
                }

                processedEscalations.push({
                    effectiveDate: new Date(esc.effectiveDate),
                    type: esc.type,
                    value: parseFloat(esc.value),
                    status: esc.status || 'scheduled'
                });
            }
        }

        // Update financial terms if provided
        if (financialTerms) {
            updateData.financialTerms = {
                ...existingLease.financialTerms,
                monthlyRent: financialTerms.monthlyRent ? Number(financialTerms.monthlyRent) : existingLease.financialTerms.monthlyRent,
                paymentDueDate: financialTerms.paymentDueDate ? Number(financialTerms.paymentDueDate) : existingLease.financialTerms.paymentDueDate,
                securityDeposit: financialTerms.securityDeposit ? Number(financialTerms.securityDeposit) : existingLease.financialTerms.securityDeposit,
                // Handle depositMonths - use existing value or default to 2
                depositMonths: financialTerms.depositMonths ? 
                    Number(financialTerms.depositMonths) : 
                    (existingLease.financialTerms.depositMonths || 2),
                // Handle balanceBroughtForward - use existing value or default to 0
                balanceBroughtForward: financialTerms.balanceBroughtForward !== undefined ?
                    Number(financialTerms.balanceBroughtForward) :
                    (existingLease.financialTerms.balanceBroughtForward || 0),
                penaltyId: financialTerms.penaltyId || existingLease.financialTerms.penaltyId,
                taxEnabled: financialTerms.taxEnabled !== undefined ?
                    Boolean(financialTerms.taxEnabled) :
                    (existingLease.financialTerms.taxEnabled !== undefined ? existingLease.financialTerms.taxEnabled : true)
            };

            // Add escalations to financial terms if provided, otherwise keep existing ones
            if (processedEscalations.length > 0) {
                updateData.financialTerms.escalations = processedEscalations;
            } else if (existingLease.financialTerms.escalations) {
                updateData.financialTerms.escalations = existingLease.financialTerms.escalations;
            }

            // Update payment methods if provided with bank details validation
            if (financialTerms.paymentMethods) {
                const processedPaymentMethods = [];

                for (const method of financialTerms.paymentMethods) {
                    const formattedMethod = {
                        type: method.type,
                        isPrimary: Boolean(method.isPrimary),
                        details: method.details || {}
                    };

                    // Handle bank transfer methods with bank details reference
                    if (method.type === 'Bank Transfer' && method.bankDetailsId) {
                        try {
                            // Validate that the bank details exist
                            const bankDetails = await bankDetailsModel.findById(method.bankDetailsId);
                            if (!bankDetails) {
                                return reply.code(400).send({
                                    success: false,
                                    error: `Bank details with ID ${method.bankDetailsId} not found for payment method.`
                                });
                            }

                            // Verify bank details belong to this facility
                            if (bankDetails.facilityId.toString() !== facilityId.toString()) {
                                return reply.code(400).send({
                                    success: false,
                                    error: `Bank details ${method.bankDetailsId} does not belong to this facility.`
                                });
                            }

                            formattedMethod.bankDetailsId = bankDetails._id;
                            console.log('Validated bank details for payment method during update:', {
                                bankDetailsId: bankDetails._id,
                                bankName: bankDetails.bankName,
                                accountName: bankDetails.accountName
                            });
                        } catch (bankError) {
                            console.error('Error validating bank details during update:', bankError);
                            return reply.code(400).send({
                                success: false,
                                error: `Invalid bank details reference: ${bankError.message}`
                            });
                        }
                    }

                    processedPaymentMethods.push(formattedMethod);
                }

                updateData.financialTerms.paymentMethods = processedPaymentMethods;
            }
        }

        // Update billing cycle if provided
        if (billingCycle) {
            updateData.billingCycle = {
                ...existingLease.billingCycle,
                frequency: billingCycle.frequency || existingLease.billingCycle.frequency || frequency,
                nextInvoiceDate: billingCycle.nextInvoiceDate ? new Date(billingCycle.nextInvoiceDate) : existingLease.billingCycle.nextInvoiceDate,
                autoSend: billingCycle.autoSend !== undefined ? billingCycle.autoSend : existingLease.billingCycle.autoSend
            };
        }

        // Update status if provided
        if (status) {
            updateData.status = status;
        }

        // Update requireLandlordApproval if provided
        if (requireLandlordApproval !== undefined) {
            updateData.requireLandlordApproval = Boolean(requireLandlordApproval);
        }

        // Update reminders if provided
        if (reminders.length > 0) {
            updateData.reminders = reminders;
        }

        // Validate and update primary bank details if provided
        if (primaryBankDetailsId) {
            try {
                console.log(`Validating primary bank details for update with ID: ${primaryBankDetailsId}`);

                const primaryBankDetails = await bankDetailsModel.findById(primaryBankDetailsId);
                if (!primaryBankDetails) {
                    return reply.code(400).send({
                        success: false,
                        error: `Primary bank details with ID ${primaryBankDetailsId} not found.`
                    });
                }

                // Verify bank details belong to this facility
                if (primaryBankDetails.facilityId.toString() !== facilityId.toString()) {
                    return reply.code(400).send({
                        success: false,
                        error: `Primary bank details ${primaryBankDetailsId} does not belong to this facility.`
                    });
                }

                updateData.bankDetails = primaryBankDetails._id;
                console.log('Primary bank details validated for update:', {
                    id: primaryBankDetails._id,
                    bankName: primaryBankDetails.bankName,
                    accountName: primaryBankDetails.accountName
                });
            } catch (bankError) {
                console.error('Error validating primary bank details for update:', bankError);
                return reply.code(400).send({
                    success: false,
                    error: `Invalid primary bank details reference: ${bankError.message}`
                });
            }
        }

        // Update biller address if provided
        if (billerAddressId) {
            updateData.billerAddressId = billerAddressId;
        }

        // Process GL accounts if provided
        if (glAccounts && glAccounts.invoice && glAccounts.payment) {
            // Verify that all referenced GL accounts exist
            const glAccountIds = [
                glAccounts.invoice.debit,
                glAccounts.invoice.credit,
                glAccounts.payment.debit,
                glAccounts.payment.credit
            ].filter(Boolean); // Filter out any undefined/null values
            
            if (glAccountIds.length > 0) {
                // Convert string IDs to ObjectIds if needed
                const objectIdAccountIds = glAccountIds.map(id => {
                    try {
                        return typeof id === 'string' ? new ObjectId(id) : id;
                    } catch (err) {
                        console.error(`Invalid ObjectId format for: ${id}`, err);
                        return id; // Return original if conversion fails
                    }
                });
                
                // Get unique IDs to check (since the same account might be used in multiple positions)
                const uniqueAccountIds = [...new Set(objectIdAccountIds.map(id => id.toString()))].map(id => new ObjectId(id));
                
                console.log('Looking for GL accounts with IDs:', objectIdAccountIds);
                console.log('Unique account IDs to check:', uniqueAccountIds);
                
                // Add facilityId to the query to ensure we only find accounts in this facility
                const existingGLAccounts = await glAccountModel.find({
                    _id: { $in: uniqueAccountIds },
                    facilityId: facilityId
                });
                
                console.log(`Found ${existingGLAccounts.length} out of ${uniqueAccountIds.length} unique GL accounts`);
                
                // Check if all of the unique accounts were found
                if (existingGLAccounts.length !== uniqueAccountIds.length) {
                    // Find which accounts are missing
                    const existingIds = existingGLAccounts.map(account => account._id.toString());
                    const missingIds = uniqueAccountIds.map(id => id.toString()).filter(id => !existingIds.includes(id));
                    
                    console.error('Missing GL accounts:', missingIds);
                    
                    // Create more detailed error message
                    const accountPositions = [];
                    if (missingIds.includes(glAccounts.invoice.debit?.toString())) accountPositions.push('Invoice Debit');
                    if (missingIds.includes(glAccounts.invoice.credit?.toString())) accountPositions.push('Invoice Credit');
                    if (missingIds.includes(glAccounts.payment.debit?.toString())) accountPositions.push('Payment Debit');
                    if (missingIds.includes(glAccounts.payment.credit?.toString())) accountPositions.push('Payment Credit');
                    
                    return reply.code(400).send({
                        success: false,
                        error: `One or more referenced GL accounts do not exist in this facility: ${missingIds.join(', ')}`,
                        missingPositions: accountPositions,
                        missingAccounts: missingIds,
                        facilityId: facilityId
                    });
                }
                
                try {
                    // Get unit name for the description
                    const unit = await unitModel.findById(existingLease.unitNumber);
                    const unitName = unit ? unit.name : 'Unknown Unit';

                    // Update or create double entry records for invoice
                    let invoiceDoubleEntryUpdate;
                    if (existingLease.invoiceDoubleEntryAccount) {
                        // Update existing double entry
                        invoiceDoubleEntryUpdate = await doubleEntryModel.findByIdAndUpdate(
                            existingLease.invoiceDoubleEntryAccount,
                            {
                                accountdebited: glAccounts.invoice.debit,
                                accountcredited: glAccounts.invoice.credit,
                                facilityId,
                                updatedBy: request.user ? request.user._id : null,
                                updatedAt: new Date(),
                                description: `Invoice double entry for lease: ${unitName} (Updated)`
                            },
                            { new: true }
                        );
                    } else {
                        // Create new double entry
                        invoiceDoubleEntryUpdate = await doubleEntryModel.create({
                            accountdebited: glAccounts.invoice.debit,
                            accountcredited: glAccounts.invoice.credit,
                            facilityId,
                            createdBy: request.user ? request.user._id : null,
                            description: `Invoice double entry for lease: ${unitName}`
                        });
                    }

                    // Update or create double entry records for payment
                    let paymentDoubleEntryUpdate;
                    if (existingLease.paymentDoubleEntryAccount) {
                        // Update existing double entry
                        paymentDoubleEntryUpdate = await doubleEntryModel.findByIdAndUpdate(
                            existingLease.paymentDoubleEntryAccount,
                            {
                                accountdebited: glAccounts.payment.debit,
                                accountcredited: glAccounts.payment.credit,
                                facilityId,
                                updatedBy: request.user ? request.user._id : null,
                                updatedAt: new Date(),
                                description: `Payment double entry for lease: ${unitName} (Updated)`
                            },
                            { new: true }
                        );
                    } else {
                        // Create new double entry
                        paymentDoubleEntryUpdate = await doubleEntryModel.create({
                            accountdebited: glAccounts.payment.debit,
                            accountcredited: glAccounts.payment.credit,
                            facilityId,
                            createdBy: request.user ? request.user._id : null,
                            description: `Payment double entry for lease: ${unitName}`
                        });
                    }
                    
                    console.log('Updated/Created double entry records for lease:', {
                        invoiceDoubleEntry: invoiceDoubleEntryUpdate?._id,
                        paymentDoubleEntry: paymentDoubleEntryUpdate?._id
                    });
                    
                    // Update the lease data with the double entry accounts and GL accounts
                    updateData.invoiceDoubleEntryAccount = invoiceDoubleEntryUpdate?._id;
                    updateData.paymentDoubleEntryAccount = paymentDoubleEntryUpdate?._id;
                    updateData.glAccounts = {
                        invoice: {
                            debit: glAccounts.invoice.debit,
                            credit: glAccounts.invoice.credit
                        },
                        payment: {
                            debit: glAccounts.payment.debit,
                            credit: glAccounts.payment.credit
                        }
                    };
                } catch (glError) {
                    console.error('Error updating/creating double entry records:', glError);
                    // Continue without GL accounts if there's an error
                    // We don't want to block lease update due to GL errors
                }
            }
        }

        // Setup update operation
        let updateOperation = { $set: updateData };
        
        // Handle edit history if provided
        if (editHistory) {
            const newEditHistoryEntry = {
                editedAt: new Date(),
                editedBy: editHistory.editedBy,
                reason: editHistory.reason,
                changes: editHistory.changes || {}
            };
            
            // Add to edit history array using $push
            updateOperation.$push = { 
                editHistory: newEditHistoryEntry 
            };
        }

        // Perform the update
        const updatedLease = await leaseAgreementModel.findByIdAndUpdate(
            leaseId,
            updateOperation,
            { new: true, runValidators: true }
        ).populate({
            path: 'currency',
            model: currencyModel,
            select: 'currencyName currencyShortCode'
        });

        // *** Update Property Management Contract with lease changes ***
        let contractUpdateResults = [];
        try {
            // Find any property management contracts that include this unit
            const affectedContracts = await propertyManagerContractModel.find({
                units: existingLease.unitNumber,
                facilityId: facilityId,
                status: { $in: ['Active', 'Inactive'] } // Don't update already terminated contracts
            });

            console.log(`Found ${affectedContracts.length} property management contracts affected by lease update`);

            for (const contract of affectedContracts) {
                try {
                    // Determine the new contract status based on lease status
                    const newContractStatus = (updatedLease.status === 'Active') ? 'Active' : 'Inactive';

                    // If lease status is not Active, clear lease-dependent fields
                    if (updatedLease.status !== 'Active') {
                        console.log(`Lease status is ${updatedLease.status}, clearing lease-dependent fields from contract ${contract._id}`);
                        
                        const contractUpdateData = {
                            status: newContractStatus,
                            updatedBy: request.user ? request.user._id : null,
                            updatedAt: new Date(),
                            // Clear lease-dependent fields
                            $unset: {
                                startDate: "",
                                endDate: "",
                                paymentDueDate: "",
                                frequency: "",
                                autoSend: "",
                                balanceBroughtForward: "",
                                nextInvoiceDate: "",
                                lastInvoiceDate: ""
                            },
                            // Add edit history entry
                            $push: {
                                editHistory: {
                                    editedBy: request.user ? request.user._id : 'System',
                                    editedAt: new Date(),
                                    reason: `Lease status change: Lease ${leaseId} status changed to ${updatedLease.status}, clearing lease-dependent fields`,
                                    changes: {
                                        action: 'LEASE_STATUS_CHANGE_UPDATE',
                                        updatedLeaseId: leaseId,
                                        newLeaseStatus: updatedLease.status,
                                        previousContractStatus: contract.status,
                                        newContractStatus: newContractStatus,
                                        clearedFields: [
                                            'startDate', 
                                            'endDate', 
                                            'paymentDueDate', 
                                            'frequency', 
                                            'autoSend', 
                                            'balanceBroughtForward', 
                                            'nextInvoiceDate',
                                            'lastInvoiceDate'
                                        ]
                                    }
                                }
                            }
                        };

                        const updatedContract = await propertyManagerContractModel.findByIdAndUpdate(
                            contract._id,
                            contractUpdateData,
                            { new: true }
                        );

                        contractUpdateResults.push({
                            contractId: contract._id,
                            contractName: contract.contractName,
                            previousStatus: contract.status,
                            newStatus: newContractStatus,
                            fieldsCleared: true,
                            success: true
                        });

                    } else {
                        // Lease is Active, sync lease data to contract
                        console.log(`Syncing lease data to property management contract ${contract._id}`);
                        
                        // Calculate next invoice date if not provided in lease
                        let nextInvoiceDate = updatedLease.billingCycle?.nextInvoiceDate;
                        if (!nextInvoiceDate && updatedLease.leaseTerms?.startDate && updatedLease.financialTerms?.paymentDueDate) {
                            nextInvoiceDate = calculateNextInvoiceDate(
                                updatedLease.leaseTerms.startDate,
                                updatedLease.financialTerms.paymentDueDate,
                                updatedLease.billingCycle?.frequency
                            );
                            console.log('Calculated nextInvoiceDate for contract:', nextInvoiceDate);
                        }
                        
                        // Use the sync method with properly calculated dates
                        await contract.syncWithLeaseData({
                            leaseTerms: {
                                startDate: updatedLease.leaseTerms?.startDate,
                                endDate: updatedLease.leaseTerms?.endDate
                            },
                            financialTerms: {
                                paymentDueDate: updatedLease.financialTerms?.paymentDueDate,
                                balanceBroughtForward: updatedLease.financialTerms?.balanceBroughtForward
                            },
                            billingCycle: {
                                frequency: updatedLease.billingCycle?.frequency,
                                nextInvoiceDate: nextInvoiceDate,
                                lastInvoiceDate: updatedLease.billingCycle?.lastInvoiceDate,
                                autoSend: updatedLease.billingCycle?.autoSend
                            }
                        });

                        // Update status to Active and add edit history
                        contract.status = 'Active';
                        contract.updatedBy = request.user ? request.user._id : null;
                        
                        // Add edit history entry
                        contract.editHistory = contract.editHistory || [];
                        contract.editHistory.push({
                            editedBy: request.user ? request.user._id : 'System',
                            editedAt: new Date(),
                            reason: `Lease update: Lease ${leaseId} was updated, syncing lease-dependent fields`,
                            changes: {
                                action: 'LEASE_UPDATE_SYNC',
                                updatedLeaseId: leaseId,
                                previousStatus: contract.status,
                                newStatus: 'Active',
                                syncedFields: [
                                    'startDate', 
                                    'endDate', 
                                    'paymentDueDate', 
                                    'frequency', 
                                    'autoSend', 
                                    'balanceBroughtForward', 
                                    'nextInvoiceDate',
                                    'lastInvoiceDate'
                                ]
                            }
                        });
                        
                        await contract.save();

                        contractUpdateResults.push({
                            contractId: contract._id,
                            contractName: contract.contractName,
                            previousStatus: contract.status,
                            newStatus: 'Active',
                            fieldsCleared: false,
                            fieldsSynced: true,
                            success: true
                        });
                    }

                    console.log(`Successfully updated property management contract ${contract._id}`);

                } catch (contractError) {
                    console.error(`Error updating contract ${contract._id}:`, contractError);
                    contractUpdateResults.push({
                        contractId: contract._id,
                        contractName: contract.contractName,
                        success: false,
                        error: contractError.message
                    });
                }
            }

        } catch (contractError) {
            console.error('Error finding/updating property management contracts:', contractError);
            // Don't fail lease update if contract update fails
        }

        return reply.code(200).send({
            success: true,
            message: 'Lease Agreement updated successfully',
            data: {
                leaseAgreement: updatedLease,
                propertyManagementUpdates: {
                    contractsFound: contractUpdateResults.length,
                    contractsUpdated: contractUpdateResults.filter(r => r.success).length,
                    contractsFailed: contractUpdateResults.filter(r => !r.success).length,
                    details: contractUpdateResults
                }
            }
        });

    } catch (err) {
        console.error('Error in edit_lease_agreement:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while updating the lease agreement.'
        });
    }
};

module.exports = edit_lease_agreement;