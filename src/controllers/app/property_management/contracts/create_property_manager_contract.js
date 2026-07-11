const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

const createPropertyManagerContract = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Log the incoming request for debugging
        console.log('Property Manager Contract request body:', JSON.stringify(request.body, null, 2));

        const {
            contractName,
            propertyManager, // Required field
            units,
            customerId,
            startDate,
            endDate,
            paymentDueDate, // Updated from invoiceDay
            balanceBroughtForward,
            managementFee, // Required - structure: { type: 'percentage'|'amount', value: number }
            frequency, // Updated from collectionFrequency
            status,
            autoSend,
            glAccounts // Extract GL accounts from request
        } = request.body;

        // Validate required fields for basic contract creation
        if (!contractName || !propertyManager || !units || !customerId || !managementFee || !managementFee.type || 
            managementFee.value === undefined || managementFee.value === null) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields: contractName, propertyManager, units, customerId, managementFee (with type and value)'
            });
        }

        // Validate managementFee structure
        if (!['percentage', 'amount'].includes(managementFee.type)) {
            return reply.code(400).send({
                success: false,
                error: 'managementFee.type must be either "percentage" or "amount"'
            });
        }

        // Validate managementFee value
        if (typeof managementFee.value !== 'number' || managementFee.value < 0) {
            return reply.code(400).send({
                success: false,
                error: 'managementFee.value must be a non-negative number'
            });
        }

        // Additional validation for percentage type
        if (managementFee.type === 'percentage' && managementFee.value > 100) {
            return reply.code(400).send({
                success: false,
                error: 'managementFee.value cannot exceed 100 when type is percentage'
            });
        }

        // Get the department model to find Property Management department ID
        const departmentModel = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);
        
        // Find Property Management department
        const propMgmtDept = await departmentModel.findOne({
            name: 'Property Management',
            facilityId: facilityId
        });

        console.log('Property Management department:', propMgmtDept);

        // Validate property manager exists and is from Property Management department
        // Use payservedb.User for global User collection (same as customers)
        let propertyManagerUser = null;

        // First, try to find user with populated department object
        propertyManagerUser = await payservedb.User.findOne({
            _id: propertyManager,
            facilityId: facilityId,
            isEnabled: { $ne: false } // Ensure user is enabled (if field exists)
        }).populate({
            path: 'department',
            model: departmentModel,
            select: 'name'
        });

        // Check if department is properly populated and matches
        if (propertyManagerUser && propertyManagerUser.department && 
            propertyManagerUser.department.name === 'Property Management') {
            console.log('Found property manager with populated department:', propertyManagerUser.fullName);
        } else {
            // If no populated department or doesn't match, check by department ID
            if (propMgmtDept) {
                propertyManagerUser = await payservedb.User.findOne({
                    _id: propertyManager,
                    department: propMgmtDept._id, // Check by department ID
                    facilityId: facilityId,
                    isEnabled: { $ne: false }
                });

                if (propertyManagerUser) {
                    console.log('Found property manager by department ID:', propertyManagerUser.fullName);
                } else {
                    // Also try string comparison for department
                    propertyManagerUser = await payservedb.User.findOne({
                        _id: propertyManager,
                        department: propMgmtDept._id.toString(), // Check by department ID as string
                        facilityId: facilityId,
                        isEnabled: { $ne: false }
                    });

                    if (propertyManagerUser) {
                        console.log('Found property manager by department ID string:', propertyManagerUser.fullName);
                    }
                }
            }
        }

        if (!propertyManagerUser) {
            // If still not found, get user details for better error message
            const userExists = await payservedb.User.findOne({
                _id: propertyManager,
                facilityId: facilityId
            });

            if (!userExists) {
                return reply.code(404).send({
                    success: false,
                    error: `User with ID ${propertyManager} does not exist in this facility`
                });
            } else {
                return reply.code(400).send({
                    success: false,
                    error: `User ${userExists.fullName} is not assigned to the Property Management department`,
                    userDepartment: userExists.department,
                    requiredDepartment: propMgmtDept ? propMgmtDept._id : 'Property Management department not found'
                });
            }
        }

        console.log(`Found property manager: ${propertyManagerUser.fullName} (${propertyManagerUser.email})`);

        // Dynamically fetch models with facility context
        const models = {
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            customer: await getModel('Customer', payservedb.Customer.schema, facilityId),
            leaseAgreement: await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId),
            doubleEntryModel: await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId),
            glAccountModel: await getModel('GLAccount', payservedb.GLAccount.schema, facilityId)
        };

        // Validate units exist and have homeowners
        const unitDocs = await models.unit.find({
            _id: { $in: units },
            facilityId: facilityId,
            homeOwnerId: { $exists: true, $ne: null } // Ensure unit has a homeowner
        });

        if (unitDocs.length !== units.length) {
            const foundUnitIds = unitDocs.map(unit => unit._id.toString());
            const missingUnits = units.filter(unitId => !foundUnitIds.includes(unitId.toString()));
            return reply.code(404).send({
                success: false,
                error: `Units not found or do not have homeowners assigned: ${missingUnits.join(', ')}`
            });
        }

        // Check for existing contracts for these units
        const existingContracts = await models.propertyManagerContract.find({
            units: { $in: units },
            facilityId: facilityId,
            status: { $in: ['Active', 'Inactive'] } // Don't allow if there's already an active or inactive contract
        });

        if (existingContracts.length > 0) {
            const conflictingUnits = existingContracts.flatMap(contract => contract.units);
            const conflictingUnitNames = unitDocs
                .filter(unit => conflictingUnits.some(id => id.toString() === unit._id.toString()))
                .map(unit => unit.name);
            
            return reply.code(409).send({
                success: false,
                error: `Property management contracts already exist for units: ${conflictingUnitNames.join(', ')}`
            });
        }

        // Validate customer exists - check global collection first for homeowners only
        let customer = await payservedb.Customer.findOne({ 
            _id: customerId,
            customerType: 'home owner' // Note: customerType is "home owner" with space
        });
        
        // If not found globally, check facility-specific collection
        if (!customer) {
            customer = await models.customer.findOne({ 
                _id: customerId,
                customerType: 'home owner'
            });
        }
        
        if (!customer) {
            return reply.code(404).send({
                success: false,
                error: `Home owner client with ID ${customerId} does not exist`
            });
        }

        // Check if there are existing leases for the units
        const existingLeases = await models.leaseAgreement.find({
            unitNumber: { $in: units },
            status: { $in: ['Active', 'Pending'] },
            facilityId: facilityId
        });

        console.log(`Found ${existingLeases.length} existing leases for the selected units`);

        // Determine contract status and populate data based on lease existence
        let contractStatus = 'Inactive'; // Default to Inactive for units without leases
        let leaseBasedData = {};

        if (existingLeases.length > 0) {
            // Use first lease as primary data source for contract fields
            const primaryLease = existingLeases[0];
            
            // Populate contract with lease data (GL accounts are NOT copied from lease)
            leaseBasedData = {
                startDate: primaryLease.leaseTerms?.startDate || (startDate ? new Date(startDate) : undefined),
                endDate: primaryLease.leaseTerms?.endDate || (endDate ? new Date(endDate) : undefined),
                paymentDueDate: primaryLease.financialTerms?.paymentDueDate || (paymentDueDate ? parseInt(paymentDueDate) : undefined), // Updated field name
                balanceBroughtForward: primaryLease.financialTerms?.balanceBroughtForward || parseFloat(balanceBroughtForward) || 0,
                frequency: primaryLease.billingCycle?.frequency || frequency || 'Monthly', // Updated field name
                nextInvoiceDate: primaryLease.billingCycle?.nextInvoiceDate || undefined, // New field
                lastInvoiceDate: primaryLease.billingCycle?.lastInvoiceDate || undefined, // New field
                autoSend: primaryLease.billingCycle?.autoSend !== undefined ? primaryLease.billingCycle.autoSend : Boolean(autoSend)
            };

            // Check if we have all required fields to make contract Active
            const hasAllRequiredFields = leaseBasedData.startDate && leaseBasedData.endDate && 
                                       leaseBasedData.paymentDueDate && leaseBasedData.frequency;
            
            if (hasAllRequiredFields) {
                contractStatus = 'Active';
            }

            console.log('Populating contract with lease data:', leaseBasedData);
        } else {
            // No leases exist - create minimal contract with only user-provided fields
            leaseBasedData = {
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                paymentDueDate: paymentDueDate ? parseInt(paymentDueDate) : undefined, // Updated field name
                balanceBroughtForward: parseFloat(balanceBroughtForward) || 0,
                frequency: frequency || undefined, // Updated field name
                autoSend: Boolean(autoSend)
            };

            console.log('Creating minimal contract without lease data');
        }

        // Use provided status if valid, otherwise use determined status
        const statusOptions = ['Active', 'Inactive', 'Completed', 'Suspended', 'Terminated'];
        if (status && statusOptions.includes(status)) {
            contractStatus = status;
        }

        // Validate dates only if both are provided
        if (leaseBasedData.startDate && leaseBasedData.endDate && 
            new Date(leaseBasedData.startDate) >= new Date(leaseBasedData.endDate)) {
            return reply.code(400).send({
                success: false,
                error: 'End date must be after start date'
            });
        }

        // Create the property manager contract data
        const contractData = {
            contractName,
            propertyManager: propertyManager, // Add property manager reference
            units,
            customerId,
            managementFee: {
                type: managementFee.type,
                value: parseFloat(managementFee.value)
            },
            status: contractStatus,
            facilityId,
            createdBy: request.user ? request.user._id : null
        };

        // Only add optional fields if they have values (matching simplified schema)
        if (leaseBasedData.startDate) contractData.startDate = leaseBasedData.startDate;
        if (leaseBasedData.endDate) contractData.endDate = leaseBasedData.endDate;
        if (leaseBasedData.paymentDueDate) contractData.paymentDueDate = leaseBasedData.paymentDueDate; // Updated field name
        if (leaseBasedData.balanceBroughtForward !== undefined) contractData.balanceBroughtForward = leaseBasedData.balanceBroughtForward;
        if (leaseBasedData.frequency) contractData.frequency = leaseBasedData.frequency; // Updated field name
        if (leaseBasedData.nextInvoiceDate) contractData.nextInvoiceDate = leaseBasedData.nextInvoiceDate; // New direct field
        if (leaseBasedData.lastInvoiceDate) contractData.lastInvoiceDate = leaseBasedData.lastInvoiceDate; // New direct field
        if (leaseBasedData.autoSend !== undefined) contractData.autoSend = leaseBasedData.autoSend; // Now a direct field

        // Process manually provided GL accounts (always required to be manually entered)
        if (glAccounts && glAccounts.invoice && glAccounts.payment) {
            // Verify that all referenced GL accounts exist
            const glAccountIds = [
                glAccounts.invoice.debit,
                glAccounts.invoice.credit,
                glAccounts.payment.debit,
                glAccounts.payment.credit
            ].filter(Boolean);
            
            if (glAccountIds.length > 0) {
                const objectIdAccountIds = glAccountIds.map(id => {
                    try {
                        return typeof id === 'string' ? new ObjectId(id) : id;
                    } catch (err) {
                        console.error(`Invalid ObjectId format for: ${id}`, err);
                        return id;
                    }
                });
                
                const uniqueAccountIds = [...new Set(objectIdAccountIds.map(id => id.toString()))].map(id => new ObjectId(id));
                
                // Try facility-specific GL accounts first
                let existingGLAccounts = await models.glAccountModel.find({
                    _id: { $in: uniqueAccountIds },
                    facilityId: facilityId
                });

                // If not all found in facility collection, try global collection
                if (existingGLAccounts.length < uniqueAccountIds.length) {
                    const foundIds = existingGLAccounts.map(acc => acc._id.toString());
                    const remainingIds = uniqueAccountIds.filter(id => !foundIds.includes(id.toString()));
                    
                    const globalGLAccounts = await payservedb.GLAccount.find({
                        _id: { $in: remainingIds }
                    });
                    
                    existingGLAccounts = [...existingGLAccounts, ...globalGLAccounts];
                }
                
                if (existingGLAccounts.length !== uniqueAccountIds.length) {
                    const existingIds = existingGLAccounts.map(account => account._id.toString());
                    const missingIds = uniqueAccountIds.map(id => id.toString()).filter(id => !existingIds.includes(id));
                    
                    return reply.code(400).send({
                        success: false,
                        error: `One or more referenced GL accounts do not exist: ${missingIds.join(', ')}`,
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
                            description: `Invoice double entry for property management contract: ${contractName}`
                        }),
                        models.doubleEntryModel.create({
                            accountdebited: glAccounts.payment.debit,
                            accountcredited: glAccounts.payment.credit,
                            facilityId,
                            createdBy: request.user ? request.user._id : null,
                            description: `Payment double entry for property management contract: ${contractName}`
                        })
                    ]);
                    
                    // Add the double entry accounts and GL accounts to the contract data
                    contractData.invoiceDoubleEntryAccount = invoiceDoubleEntry._id;
                    contractData.paymentDoubleEntryAccount = paymentDoubleEntry._id;
                    contractData.glAccounts = {
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
                    return reply.code(500).send({
                        success: false,
                        error: 'Failed to create GL double entry records',
                        details: glError.message
                    });
                }
            }
        }

        console.log('Creating property manager contract with data:', JSON.stringify(contractData, null, 2));

        // Create Property Manager Contract
        const contract = await models.propertyManagerContract.create(contractData);

        // Update all units to set property management fields
        try {
            await models.unit.updateMany(
                { 
                    _id: { $in: units },
                    facilityId: facilityId 
                },
                {
                    $set: {
                        isManagedByPropertyManager: true,
                        propertyManager: propertyManager,
                        propertyManagerName: propertyManagerUser.fullName,
                        propertyManagerContract: contract._id
                    }
                }
            );
            
            console.log(`Updated ${units.length} units with property management information`);
        } catch (unitUpdateError) {
            console.error('Error updating units with property management info:', unitUpdateError);
            // If unit update fails, we should rollback the contract creation
            await models.propertyManagerContract.findByIdAndDelete(contract._id);
            return reply.code(500).send({
                success: false,
                error: 'Failed to update units with property management information',
                details: unitUpdateError.message
            });
        }

        // Populate the property manager details for the response
        const contractWithDetails = await models.propertyManagerContract.findById(contract._id);

        // Check if contract is complete based on simplified schema requirements
        const isComplete = contract.startDate && contract.endDate && contract.paymentDueDate && contract.frequency;

        return reply.code(201).send({
            success: true,
            message: 'Property Manager Contract created successfully',
            data: {
                contract: contractWithDetails,
                propertyManager: {
                    id: propertyManagerUser._id,
                    name: propertyManagerUser.fullName,
                    email: propertyManagerUser.email,
                    department: propertyManagerUser.department
                },
                hasLeaseData: existingLeases.length > 0,
                unitsWithLeases: existingLeases.length,
                unitsWithoutLeases: units.length - existingLeases.length,
                status: contractStatus,
                completionStatus: {
                    isComplete: isComplete,
                    canBeActive: contractStatus === 'Active',
                    missingFields: !isComplete ? getIncompleteFields(contract) : []
                }
            }
        });

    } catch (error) {
        console.error('Error creating property manager contract:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to create property manager contract',
            error: error.message
        });
    }
};

// Helper function to identify incomplete fields
const getIncompleteFields = (contract) => {
    const requiredFields = ['startDate', 'endDate', 'paymentDueDate', 'frequency'];
    return requiredFields.filter(field => !contract[field]);
};

module.exports = createPropertyManagerContract;