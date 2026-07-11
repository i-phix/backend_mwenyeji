const mongoose = require('mongoose');
const axios = require('axios');
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

const create_lease_agreement = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Log the incoming request for debugging
        console.log('Lease agreement request body:', JSON.stringify(request.body, null, 2));
        console.log('Facility ID from params:', facilityId);

        const {
            unitNumber,
            landlord,
            tenant,
            currency,
            leaseTerms,
            financialTerms,
            billingCycle,
            leaseTemplate,
            status = 'Pending',
            requireLandlordApproval = false,
            reminders = [],
            leaseDocuments = [],
            escalations = [],
            isNewTenant,
            glAccounts, // Extract GL accounts from request
            bankDetails: primaryBankDetailsId, // Top-level bank details reference
            billerAddressId
        } = request.body;

        // Comprehensive Validation with better error handling
        const requiredFields = [
            'unitNumber', 'landlord', 'tenant', 'currency',
            'monthlyRent', 'paymentDueDate', 'securityDeposit',
            'depositMonths', 'frequency', 'leaseTemplate'
        ];

        // Check for required fields at both root and nested levels
        const missingFields = requiredFields.filter(field => {
            let value;

            // Check at root level first (for backward compatibility)
            if (request.body[field] !== undefined && request.body[field] !== null && request.body[field] !== '') {
                return false; // Field exists at root level
            }

            // If not at root, check in nested objects
            if (field === 'monthlyRent' || field === 'paymentDueDate' || field === 'securityDeposit' || field === 'depositMonths') {
                value = request.body.financialTerms?.[field];
            } else if (field === 'frequency') {
                value = request.body.billingCycle?.frequency;
            } else {
                value = request.body[field];
            }

            return value === undefined || value === null || value === '';
        });

        if (missingFields.length > 0) {
            return reply.code(400).send({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate required nested objects
        if (!leaseTerms || !financialTerms || !billingCycle) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required lease terms, financial terms, or billing cycle in the request body.'
            });
        }

        // Dynamically fetch models with facility context
        const models = {
            leaseAgreement: await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            currency: await getModel('Currency', payservedb.Currency.schema, facilityId),
            customer: await getModel('Customer', payservedb.Customer.schema, facilityId),
            leaseTemplate: await getModel('LeaseTemplate', payservedb.LeaseTemplate.schema, facilityId),
            doubleEntryModel: await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId),
            glAccountModel: await getModel('GLAccount', payservedb.GLAccount.schema, facilityId),
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId),
            handover: await getModel('Handover', payservedb.Handover.schema, facilityId),
            bankDetails: await getModel('BankDetails', payservedb.BankDetails.schema, facilityId)
        };

        console.log('Models initialized for facility:', facilityId);

        // Enhanced Unit Validation
        const unit = await models.unit.findById(unitNumber);
        if (!unit) {
            console.log(`Unit not found with ID: ${unitNumber} in facility: ${facilityId}`);
            return reply.code(404).send({
                success: false,
                error: `Unit with ID ${unitNumber} does not exist in this facility.`
            });
        }

        console.log('Unit found:', {
            id: unit._id,
            name: unit.name,
            facilityId: unit.facilityId,
            tenantId: unit.tenantId,
            homeOwnerId: unit.homeOwnerId
        });

        // Check if unit has both tenant and landlord assigned
        // For resident home owners, they can serve as both tenant and landlord using the same ID
        if (!unit.homeOwnerId) {
            return reply.code(400).send({
                success: false,
                error: `Unit ${unit.name} must have a home owner (landlord) assigned before creating a lease.`,
                details: {
                    hasTenant: !!unit.tenantId,
                    hasLandlord: !!unit.homeOwnerId,
                    unitName: unit.name
                }
            });
        }

        // Check if we have a tenant assignment OR if the home owner is a resident
        if (!unit.tenantId) {
            // If no explicit tenant assignment, check if home owner is a resident
            try {
                const homeOwner = await models.customer.findById(unit.homeOwnerId) ||
                                await payservedb.Customer.findById(unit.homeOwnerId);

                if (!homeOwner || homeOwner.residentType?.toLowerCase() !== 'resident') {
                    return reply.code(400).send({
                        success: false,
                        error: `Unit ${unit.name} must have a tenant assigned or the home owner must be a resident before creating a lease.`,
                        details: {
                            hasTenant: !!unit.tenantId,
                            hasLandlord: !!unit.homeOwnerId,
                            homeOwnerResidentType: homeOwner?.residentType || 'not found',
                            unitName: unit.name
                        }
                    });
                }

                console.log(`Home owner ${homeOwner.firstName} ${homeOwner.lastName} is a resident, can serve as both landlord and tenant`);
            } catch (customerError) {
                console.error('Error checking home owner resident status:', customerError);
                return reply.code(400).send({
                    success: false,
                    error: `Unit ${unit.name} must have a tenant assigned before creating a lease.`,
                    details: {
                        hasTenant: !!unit.tenantId,
                        hasLandlord: !!unit.homeOwnerId,
                        unitName: unit.name,
                        error: 'Could not verify home owner resident status'
                    }
                });
            }
        }

        console.log('Unit validation passed - has both tenant and landlord assigned');

        // Check for existing active or pending leases on this unit BEFORE validating customers
        const existingLease = await models.leaseAgreement.findOne({
            unitNumber: unitNumber,
            facilityId: facilityId,
            status: { $in: ['Active', 'Pending'] }
        });

        if (existingLease) {
            console.log('Existing lease found:', {
                leaseId: existingLease._id,
                status: existingLease.status,
                unitNumber: existingLease.unitNumber
            });
            return reply.code(400).send({
                success: false,
                error: `Unit ${unit.name} already has an ${existingLease.status.toLowerCase()} lease. Please terminate the existing lease first.`,
                existingLeaseId: existingLease._id,
                existingLeaseStatus: existingLease.status
            });
        }

        console.log('No existing active/pending leases found for unit');

        // Enhanced Customer Validation with multiple lookup strategies
        let tenantDoc = null;
        let landlordDoc = null;

        try {
            // Strategy 1: Try facility-scoped model first
            console.log(`Looking for tenant with ID: ${tenant} in facility-scoped model`);
            tenantDoc = await models.customer.findById(tenant);
            
            if (!tenantDoc) {
                console.log('Tenant not found in facility-scoped model, trying global model');
                // Strategy 2: Try global model
                tenantDoc = await payservedb.Customer.findById(tenant);
                
                if (tenantDoc) {
                    console.log('Tenant found in global model:', {
                        id: tenantDoc._id,
                        name: `${tenantDoc.firstName} ${tenantDoc.lastName}`,
                        facilityId: tenantDoc.facilityId,
                        customerType: tenantDoc.customerType
                    });
                    
                    // Verify the tenant belongs to the correct facility
                    if (tenantDoc.facilityId.toString() !== facilityId.toString()) {
                        console.log('Tenant belongs to different facility:', {
                            tenantFacilityId: tenantDoc.facilityId,
                            expectedFacilityId: facilityId
                        });
                        return reply.code(400).send({
                            success: false,
                            error: `Tenant ${tenantDoc.firstName} ${tenantDoc.lastName} does not belong to this facility.`
                        });
                    }
                }
            } else {
                console.log('Tenant found in facility-scoped model:', {
                    id: tenantDoc._id,
                    name: `${tenantDoc.firstName} ${tenantDoc.lastName}`,
                    customerType: tenantDoc.customerType
                });
            }

            // Same strategy for landlord
            console.log(`Looking for landlord with ID: ${landlord} in facility-scoped model`);
            landlordDoc = await models.customer.findById(landlord);
            
            if (!landlordDoc) {
                console.log('Landlord not found in facility-scoped model, trying global model');
                landlordDoc = await payservedb.Customer.findById(landlord);
                
                if (landlordDoc) {
                    console.log('Landlord found in global model:', {
                        id: landlordDoc._id,
                        name: `${landlordDoc.firstName} ${landlordDoc.lastName}`,
                        facilityId: landlordDoc.facilityId,
                        customerType: landlordDoc.customerType
                    });
                    
                    // Verify the landlord belongs to the correct facility
                    if (landlordDoc.facilityId.toString() !== facilityId.toString()) {
                        console.log('Landlord belongs to different facility:', {
                            landlordFacilityId: landlordDoc.facilityId,
                            expectedFacilityId: facilityId
                        });
                        return reply.code(400).send({
                            success: false,
                            error: `Landlord ${landlordDoc.firstName} ${landlordDoc.lastName} does not belong to this facility.`
                        });
                    }
                }
            } else {
                console.log('Landlord found in facility-scoped model:', {
                    id: landlordDoc._id,
                    name: `${landlordDoc.firstName} ${landlordDoc.lastName}`,
                    customerType: landlordDoc.customerType
                });
            }

        } catch (customerError) {
            console.error('Error finding customers:', customerError);
            return reply.code(500).send({
                success: false,
                error: 'Error validating customer information',
                details: customerError.message
            });
        }

        // Check if customers were found
        if (!tenantDoc) {
            console.log(`Tenant with ID ${tenant} not found in any model`);
            return reply.code(404).send({
                success: false,
                error: `Tenant with ID ${tenant} does not exist or does not belong to this facility.`
            });
        }

        if (!landlordDoc) {
            console.log(`Landlord with ID ${landlord} not found in any model`);
            return reply.code(404).send({
                success: false,
                error: `Landlord with ID ${landlord} does not exist or does not belong to this facility.`
            });
        }

        console.log('Both tenant and landlord found successfully');

        // Validate customer types - handle resident home owners who serve as both tenant and landlord
        const isSameCustomer = tenant.toString() === landlord.toString();

        if (isSameCustomer) {
            // Same customer serving as both tenant and landlord - must be a resident home owner
            if (landlordDoc.customerType?.toLowerCase() !== 'home owner') {
                console.log(`Invalid customer type for dual role: ${landlordDoc.customerType}`);
                return reply.code(400).send({
                    success: false,
                    error: `Customer ${landlordDoc.firstName} ${landlordDoc.lastName} must be registered as a home owner to serve as both tenant and landlord. Current type: ${landlordDoc.customerType}`
                });
            }

            if (landlordDoc.residentType?.toLowerCase() !== 'resident') {
                console.log(`Invalid resident type for dual role: ${landlordDoc.residentType}`);
                return reply.code(400).send({
                    success: false,
                    error: `Customer ${landlordDoc.firstName} ${landlordDoc.lastName} must be a resident home owner to serve as both tenant and landlord. Current resident type: ${landlordDoc.residentType}`
                });
            }

            console.log(`Customer ${landlordDoc.firstName} ${landlordDoc.lastName} is a resident home owner serving as both tenant and landlord`);
        } else {
            // Different customers for tenant and landlord - validate each separately
            if (tenantDoc.customerType?.toLowerCase() !== 'tenant') {
                console.log(`Invalid tenant customer type: ${tenantDoc.customerType}`);
                return reply.code(400).send({
                    success: false,
                    error: `Customer ${tenantDoc.firstName} ${tenantDoc.lastName} is not registered as a tenant. Current type: ${tenantDoc.customerType}`
                });
            }

            if (landlordDoc.customerType?.toLowerCase() !== 'home owner') {
                console.log(`Invalid landlord customer type: ${landlordDoc.customerType}`);
                return reply.code(400).send({
                    success: false,
                    error: `Customer ${landlordDoc.firstName} ${landlordDoc.lastName} is not registered as a home owner. Current type: ${landlordDoc.customerType}`
                });
            }
        }

        console.log('Customer types validated successfully');

        // Validate that the provided tenant and landlord match the unit assignments
        // Handle resident home owners who serve as both tenant and landlord
        if (isSameCustomer) {
            // Same customer serving both roles - validate against home owner assignment
            if (unit.homeOwnerId.toString() !== landlord.toString()) {
                console.log('Dual role customer ID mismatch:', {
                    unitHomeOwnerId: unit.homeOwnerId.toString(),
                    providedCustomerId: landlord.toString()
                });
                return reply.code(400).send({
                    success: false,
                    error: `The selected customer does not match the home owner assigned to unit ${unit.name}.`,
                    details: {
                        unitAssignedHomeOwner: unit.homeOwnerId.toString(),
                        providedCustomer: landlord.toString()
                    }
                });
            }

            // For resident home owners, if unit has no explicit tenant assignment,
            // we allow the home owner to serve as tenant
            if (unit.tenantId && unit.tenantId.toString() !== tenant.toString()) {
                console.log('Tenant ID mismatch for dual role customer:', {
                    unitTenantId: unit.tenantId.toString(),
                    providedTenantId: tenant.toString()
                });
                return reply.code(400).send({
                    success: false,
                    error: `The selected tenant does not match the tenant assigned to unit ${unit.name}.`,
                    details: {
                        unitAssignedTenant: unit.tenantId.toString(),
                        providedTenant: tenant.toString()
                    }
                });
            }

            console.log(`Resident home owner ${landlordDoc.firstName} ${landlordDoc.lastName} validated for dual role in unit ${unit.name}`);
        } else {
            // Different customers for tenant and landlord - validate each separately
            if (unit.tenantId && unit.tenantId.toString() !== tenant.toString()) {
                console.log('Tenant ID mismatch:', {
                    unitTenantId: unit.tenantId.toString(),
                    providedTenantId: tenant.toString()
                });
                return reply.code(400).send({
                    success: false,
                    error: `The selected tenant does not match the tenant assigned to unit ${unit.name}.`,
                    details: {
                        unitAssignedTenant: unit.tenantId.toString(),
                        providedTenant: tenant.toString()
                    }
                });
            }

            if (unit.homeOwnerId.toString() !== landlord.toString()) {
                console.log('Landlord ID mismatch:', {
                    unitLandlordId: unit.homeOwnerId.toString(),
                    providedLandlordId: landlord.toString()
                });
                return reply.code(400).send({
                    success: false,
                    error: `The selected landlord does not match the landlord assigned to unit ${unit.name}.`,
                    details: {
                        unitAssignedLandlord: unit.homeOwnerId.toString(),
                        providedLandlord: landlord.toString()
                    }
                });
            }
        }

        console.log('Unit assignments match provided tenant and landlord');

        // Currency validation with multiple strategies
        let currencyExists = null;
        try {
            console.log(`Looking for currency with ID: ${currency}`);
            
            // First try with the dynamic model (facility-specific)
            currencyExists = await models.currency.findById(currency);

            if (!currencyExists) {
                console.log('Currency not found in facility-scoped model, trying global model');
                // If not found, try the global model
                currencyExists = await payservedb.Currency.findById(currency);
            }

            if (!currencyExists) {
                console.log('Currency not found in global model, trying facility-specific query');
                // Try to find by facilityId as well
                currencyExists = await models.currency.findOne({
                    _id: currency,
                    facilityId: facilityId
                });
            }

            if (currencyExists) {
                console.log('Currency found:', {
                    id: currencyExists._id,
                    name: currencyExists.currencyName,
                    code: currencyExists.currencyShortCode
                });
            }

        } catch (err) {
            console.error('Error finding currency:', err);
        }

        if (!currencyExists) {
            console.log(`Currency with ID ${currency} not found`);
            return reply.code(404).send({
                success: false,
                error: `Currency with ID ${currency} does not exist.`
            });
        }

        console.log('Currency validation passed');

        // Validate primary bank details if provided
        let primaryBankDetails = null;
        if (primaryBankDetailsId) {
            try {
                console.log(`Validating primary bank details with ID: ${primaryBankDetailsId}`);

                primaryBankDetails = await models.bankDetails.findById(primaryBankDetailsId);
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

                console.log('Primary bank details validated:', {
                    id: primaryBankDetails._id,
                    bankName: primaryBankDetails.bankName,
                    accountName: primaryBankDetails.accountName
                });
            } catch (bankError) {
                console.error('Error validating primary bank details:', bankError);
                return reply.code(400).send({
                    success: false,
                    error: `Invalid primary bank details reference: ${bankError.message}`
                });
            }
        }

        // Process escalations if provided
        const processedEscalations = [];
        if (Array.isArray(escalations) && escalations.length > 0) {
            console.log(`Processing ${escalations.length} escalations`);
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
            console.log(`Processed ${processedEscalations.length} valid escalations`);
        }

        // Process and validate payment methods
        const processedPaymentMethods = [];
        if (financialTerms.paymentMethods && Array.isArray(financialTerms.paymentMethods)) {
            for (const method of financialTerms.paymentMethods) {
                const processedMethod = {
                    type: method.type,
                    isPrimary: Boolean(method.isPrimary),
                    details: method.details || {}
                };

                // Handle bank transfer methods with bank details reference
                if (method.type === 'Bank Transfer' && method.bankDetailsId) {
                    try {
                        // Validate that the bank details exist
                        const bankDetails = await models.bankDetails.findById(method.bankDetailsId);
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

                        processedMethod.bankDetailsId = bankDetails._id;
                        console.log('Validated bank details for payment method:', {
                            bankDetailsId: bankDetails._id,
                            bankName: bankDetails.bankName,
                            accountName: bankDetails.accountName
                        });
                    } catch (bankError) {
                        console.error('Error validating bank details:', bankError);
                        return reply.code(400).send({
                            success: false,
                            error: `Invalid bank details reference: ${bankError.message}`
                        });
                    }
                }

                processedPaymentMethods.push(processedMethod);
            }
        }

        // Prepare the financial terms
        const processedFinancialTerms = {
            monthlyRent: Number(financialTerms.monthlyRent),
            paymentDueDate: Number(financialTerms.paymentDueDate),
            paymentMethods: processedPaymentMethods,
            securityDeposit: Number(financialTerms.securityDeposit),
            depositMonths: Number(financialTerms.depositMonths),
            balanceBroughtForward: Number(financialTerms.balanceBroughtForward || 0),
            taxEnabled: financialTerms.taxEnabled !== undefined ? Boolean(financialTerms.taxEnabled) : false,
            enabledTaxes: financialTerms.enabledTaxes
        };

        // Add escalations to financial terms if any were processed
        if (processedEscalations.length > 0) {
            processedFinancialTerms.escalations = processedEscalations;
        }

        // Only include penaltyId if it exists in the request
        if (financialTerms.penaltyId) {
            processedFinancialTerms.penaltyId = financialTerms.penaltyId;
        }

        // Create lease agreement data
        const leaseAgreementData = {
            facilityId,
            unitNumber: unit._id,
            landlord,
            tenant,
            currency: currencyExists._id,
            leaseTerms: {
                startDate: new Date(leaseTerms.startDate),
                endDate: new Date(leaseTerms.endDate),
                duration: Number(leaseTerms.duration),
                autoRenewal: leaseTerms.autoRenewal || false
            },
            isNewTenant,
            financialTerms: processedFinancialTerms,
            billingCycle: {
                frequency: billingCycle.frequency,
                nextInvoiceDate: billingCycle.nextInvoiceDate ? new Date(billingCycle.nextInvoiceDate) : null,
                autoSend: billingCycle.autoSend || false
            },
            leaseTemplate,
            status: status || 'Pending',
            requireLandlordApproval: Boolean(requireLandlordApproval),
            reminders,
            leaseDocuments
        };

        // Add optional references
        if (primaryBankDetails) {
            leaseAgreementData.bankDetails = primaryBankDetails._id;
        }

        if (billerAddressId) {
            leaseAgreementData.billerAddressId = billerAddressId;
        }

        console.log('Lease agreement data prepared');

        // Process GL accounts if provided
        if (glAccounts && glAccounts.invoice && glAccounts.payment) {
            console.log('Processing GL accounts for lease agreement');
            
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
                
                console.log('Looking for GL accounts with IDs:', uniqueAccountIds.map(id => id.toString()));
                
                // Add facilityId to the query to ensure we only find accounts in this facility
                const existingGLAccounts = await models.glAccountModel.find({
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
                    // Create double entry records for invoice and payment
                    const [invoiceDoubleEntry, paymentDoubleEntry] = await Promise.all([
                        models.doubleEntryModel.create({
                            accountdebited: glAccounts.invoice.debit,
                            accountcredited: glAccounts.invoice.credit,
                            facilityId,
                            createdBy: request.user ? request.user._id : null,
                            description: `Invoice double entry for lease: ${unit.name || 'Unknown Unit'}`
                        }),
                        models.doubleEntryModel.create({
                            accountdebited: glAccounts.payment.debit,
                            accountcredited: glAccounts.payment.credit,
                            facilityId,
                            createdBy: request.user ? request.user._id : null,
                            description: `Payment double entry for lease: ${unit.name || 'Unknown Unit'}`
                        })
                    ]);
                    
                    console.log('Created double entry records for lease:', {
                        invoiceDoubleEntry: invoiceDoubleEntry._id,
                        paymentDoubleEntry: paymentDoubleEntry._id
                    });
                    
                    // Add the double entry accounts and GL accounts to the lease data
                    leaseAgreementData.invoiceDoubleEntryAccount = invoiceDoubleEntry._id;
                    leaseAgreementData.paymentDoubleEntryAccount = paymentDoubleEntry._id;
                    leaseAgreementData.glAccounts = {
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
                    console.error('Error creating double entry records:', glError);
                    // Continue without GL accounts if there's an error
                    // We don't want to block lease creation due to GL errors
                }
            }
        }

        console.log('Creating lease agreement with data:', {
            facilityId: leaseAgreementData.facilityId,
            unitNumber: leaseAgreementData.unitNumber,
            tenant: leaseAgreementData.tenant,
            landlord: leaseAgreementData.landlord,
            status: leaseAgreementData.status
        });

        // Create Lease Agreement
        const leaseAgreement = await models.leaseAgreement.create(leaseAgreementData);
        console.log('Lease agreement created successfully:', {
            id: leaseAgreement._id,
            status: leaseAgreement.status
        });

        // *** Auto-complete move-in handover if exists but not completed ***
        try {
            console.log(`Checking for existing move-in handover for unit ${unitNumber} and tenant ${tenant}`);
            
            // Look for an existing move-in handover that is not completed
            const existingMoveInHandover = await models.handover.findOne({
                facilityId: facilityId,
                unitId: unitNumber,
                customerId: tenant,
                handoverType: 'MoveIn',
                status: { $in: ['Draft'] } // Only update if it's still in draft
            });

            if (existingMoveInHandover) {
                console.log('Found existing move-in handover in draft status:', {
                    handoverId: existingMoveInHandover._id,
                    currentStatus: existingMoveInHandover.status
                });

                // Update the handover status to completed
                existingMoveInHandover.status = 'Completed';
                existingMoveInHandover.handoverDate = new Date(); // Update handover date to now
                
                await existingMoveInHandover.save();
                
                console.log('Successfully auto-completed move-in handover:', {
                    handoverId: existingMoveInHandover._id,
                    newStatus: 'Completed',
                    handoverDate: existingMoveInHandover.handoverDate
                });
            } else {
                console.log('No draft move-in handover found for this unit and tenant combination');
            }
        } catch (handoverError) {
            console.error('Error auto-completing move-in handover:', handoverError);
            // Don't fail lease creation if handover update fails - just log the error
        }

        // *** Update any existing property management contracts for this unit ***
        let contractUpdateResults = [];
        try {
            console.log(`Searching for property management contract with unit: ${unitNumber} in facility: ${facilityId}`);
            
            const existingContracts = await models.propertyManagerContract.find({
                units: unitNumber,
                facilityId: facilityId,
                status: { $in: ['Inactive', 'Active'] }
            });

            console.log(`Found ${existingContracts.length} property management contracts for unit ${unitNumber}`);

            for (const existingContract of existingContracts) {
                try {
                    console.log(`Processing property management contract ${existingContract._id}:`, {
                        contractId: existingContract._id,
                        contractName: existingContract.contractName,
                        currentStatus: existingContract.status,
                        unitsCount: existingContract.units?.length || 0
                    });
                    
                    // Determine the new contract status based on lease status
                    const newContractStatus = (leaseAgreement.status === 'Active') ? 'Active' : 'Inactive';

                    if (leaseAgreement.status === 'Active') {
                        // Lease is Active, sync lease data to contract
                        console.log('Lease is Active, syncing data to property management contract');
                        
                        // Calculate next invoice date if not provided in lease
                        let nextInvoiceDate = leaseAgreement.billingCycle.nextInvoiceDate;
                        if (!nextInvoiceDate && leaseAgreement.leaseTerms.startDate && leaseAgreement.financialTerms.paymentDueDate) {
                            nextInvoiceDate = calculateNextInvoiceDate(
                                leaseAgreement.leaseTerms.startDate,
                                leaseAgreement.financialTerms.paymentDueDate,
                                leaseAgreement.billingCycle.frequency
                            );
                            console.log('Calculated nextInvoiceDate for contract:', nextInvoiceDate);
                        }
                        
                        console.log('Syncing lease data to property management contract:', {
                            startDate: leaseAgreement.leaseTerms.startDate,
                            endDate: leaseAgreement.leaseTerms.endDate,
                            paymentDueDate: leaseAgreement.financialTerms.paymentDueDate,
                            frequency: leaseAgreement.billingCycle.frequency,
                            nextInvoiceDate: nextInvoiceDate,
                            balanceBroughtForward: leaseAgreement.financialTerms.balanceBroughtForward
                        });
                        
                        // Use the sync method with properly calculated dates
                        await existingContract.syncWithLeaseData({
                            leaseTerms: {
                                startDate: leaseAgreement.leaseTerms.startDate,
                                endDate: leaseAgreement.leaseTerms.endDate
                            },
                            financialTerms: {
                                paymentDueDate: leaseAgreement.financialTerms.paymentDueDate, // Day of month (1-31)
                                balanceBroughtForward: leaseAgreement.financialTerms.balanceBroughtForward
                            },
                            billingCycle: {
                                frequency: leaseAgreement.billingCycle.frequency,
                                nextInvoiceDate: nextInvoiceDate, // Full date when next invoice should be generated
                                lastInvoiceDate: leaseAgreement.billingCycle.lastInvoiceDate,
                                autoSend: leaseAgreement.billingCycle.autoSend
                            }
                        });

                        // Update status to Active and add edit history
                        existingContract.status = 'Active';
                        existingContract.updatedBy = request.user ? request.user._id : null;
                        
                        // Add edit history entry
                        existingContract.editHistory = existingContract.editHistory || [];
                        existingContract.editHistory.push({
                            editedBy: request.user ? request.user._id : 'System',
                            editedAt: new Date(),
                            reason: `Lease creation: New lease ${leaseAgreement._id} created, syncing lease-dependent fields`,
                            changes: {
                                action: 'LEASE_CREATION_SYNC',
                                newLeaseId: leaseAgreement._id,
                                previousStatus: existingContract.status,
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
                        
                        await existingContract.save();

                        contractUpdateResults.push({
                            contractId: existingContract._id,
                            contractName: existingContract.contractName,
                            previousStatus: existingContract.status,
                            newStatus: 'Active',
                            fieldsCleared: false,
                            fieldsSynced: true,
                            success: true
                        });

                        console.log(`Successfully updated property management contract ${existingContract._id} with lease data:`, {
                            paymentDueDate: leaseAgreement.financialTerms.paymentDueDate,
                            nextInvoiceDate: nextInvoiceDate,
                            frequency: leaseAgreement.billingCycle.frequency,
                            status: 'Active'
                        });

                    } else {
                        // Lease is NOT Active (Pending, Expired, Terminated), clear lease-dependent fields
                        console.log(`Lease status is ${leaseAgreement.status}, setting contract to Inactive and clearing lease-dependent fields`);
                        
                       const contractUpdateData = {
                            status: 'Inactive',
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
                                    reason: `Lease creation with non-Active status: Lease ${leaseAgreement._id} created with status ${leaseAgreement.status}, clearing lease-dependent fields`,
                                    changes: {
                                        action: 'LEASE_CREATION_NON_ACTIVE',
                                        newLeaseId: leaseAgreement._id,
                                        leaseStatus: leaseAgreement.status,
                                        previousContractStatus: existingContract.status,
                                        newContractStatus: 'Inactive',
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

                        const updatedContract = await models.propertyManagerContract.findByIdAndUpdate(
                            existingContract._id,
                            contractUpdateData,
                            { new: true }
                        );

                        contractUpdateResults.push({
                            contractId: existingContract._id,
                            contractName: existingContract.contractName,
                            previousStatus: existingContract.status,
                            newStatus: 'Inactive',
                            fieldsCleared: true,
                            fieldsSynced: false,
                            success: true
                        });

                        console.log(`Successfully updated property management contract ${existingContract._id} to Inactive status due to non-Active lease`);
                    }

                } catch (contractError) {
                    console.error(`Error updating contract ${existingContract._id}:`, contractError);
                    contractUpdateResults.push({
                        contractId: existingContract._id,
                        contractName: existingContract.contractName,
                        success: false,
                        error: contractError.message
                    });
                }
            }

        } catch (contractUpdateError) {
            console.error('Error updating property management contract:', {
                error: contractUpdateError.message,
                stack: contractUpdateError.stack,
                unitNumber: unitNumber,
                facilityId: facilityId
            });
            // Don't fail lease creation if contract update fails
        }

        // Auto-generate invoice if nextInvoiceDate is today
        const nextInvoiceDate = leaseAgreement.billingCycle?.nextInvoiceDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (nextInvoiceDate) {
            const nextDate = new Date(nextInvoiceDate);
            nextDate.setHours(0, 0, 0, 0);

            console.log('Checking if invoice should be auto-generated:', {
                nextInvoiceDate: nextDate,
                today: today,
                shouldGenerate: nextDate.getTime() <= today.getTime()
            });

            if (nextDate.getTime() <= today.getTime()) {
                try {
                    console.log('Auto-generating invoice for lease');
                    
                    // Fetch facility + tenant + unit data
                    const facility = await payservedb.Facility.findById(facilityId).lean();
                    const unitDoc = await models.unit.findById(unitNumber).lean();

                    // Format dates correctly as YYYY-MM-DD strings
                    const formatDate = (dateObj) => {
                        if (!dateObj) return null;
                        const date = new Date(dateObj);
                        return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
                    };

                    // Construct billing config with properly formatted dates
                    const billingConfig = {
                        facilityId: facility._id,
                        facilityName: facility.name,
                        currency: facility.currency || 'KES',
                        billingDate: new Date().toISOString(), // Keep as ISO string since it's date-time
                        leaseDetails: {
                            unitNumber: unitDoc?.name || 'Unknown Unit',
                            tenantName: `${tenantDoc?.firstName || ''} ${tenantDoc?.lastName || ''}`,
                            startDate: formatDate(leaseAgreement.leaseTerms?.startDate),
                            endDate: formatDate(leaseAgreement.leaseTerms?.endDate)
                        }
                    };

                    // Clone the lease object to avoid modification issues
                    const leaseCopy = JSON.parse(JSON.stringify(leaseAgreement));
                    const baseUrl = process.env.INVOICE_SERVICE_URL;

                    console.log('Calling invoice service at:', `${baseUrl}/api/facilities/${facilityId}/invoice/lease/invoice`);

                    // Post to the service route (adjust base URL if needed)
                    const response = await axios.post(`${baseUrl}/api/facilities/${facilityId}/invoice/lease/invoice`, {
                        lease: leaseCopy,
                        billingConfig
                    });

                    const invoice = response.data;
                    console.log('Invoice created successfully:', invoice.id || 'Unknown ID');

                   return reply.code(201).send({
                        success: true,
                        message: 'Lease Agreement and invoice created successfully',
                        data: {
                            leaseAgreement,
                            invoice,
                            propertyManagementUpdates: {
                                contractsFound: contractUpdateResults.length,
                                contractsUpdated: contractUpdateResults.filter(r => r.success).length,
                                contractsFailed: contractUpdateResults.filter(r => !r.success).length,
                                details: contractUpdateResults
                            }
                        }
                    });
                } catch (error) {
                    console.error('Failed to create invoice via API call:', {
                        error: error.message,
                        stack: error.stack,
                        response: error.response?.data
                    });

                    return reply.code(201).send({
                        success: true,
                        message: 'Lease created but failed to generate invoice via service route.',
                        error: error.message,
                        data: {
                            leaseAgreement,
                            propertyManagementUpdates: {
                                contractsFound: contractUpdateResults.length,
                                contractsUpdated: contractUpdateResults.filter(r => r.success).length,
                                contractsFailed: contractUpdateResults.filter(r => !r.success).length,
                                details: contractUpdateResults
                            }
                        }
                    });
                }
            }
        }

        // Return successful response when no invoice is created
        console.log('Lease agreement creation completed successfully');
        return reply.code(201).send({
            success: true,
            message: 'Lease Agreement created successfully',
            data: {
                leaseAgreement,
                propertyManagementUpdates: {
                    contractsFound: contractUpdateResults.length,
                    contractsUpdated: contractUpdateResults.filter(r => r.success).length,
                    contractsFailed: contractUpdateResults.filter(r => !r.success).length,
                    details: contractUpdateResults
                }
            }
        });
    } catch (error) {
        console.error('Error creating lease agreement:', {
            error: error.message,
            stack: error.stack,
            facilityId: request.params.facilityId
        });
        return reply.code(500).send({
            success: false,
            message: 'Failed to create lease agreement',
            error: error.message
        });
    }
};

module.exports = create_lease_agreement;