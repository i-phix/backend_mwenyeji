const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

const getPropertyManagerContracts = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Validate facilityId
        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        // Get the department model for proper property manager validation
        const departmentModel = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);
        
        // Find Property Management department for validation
        const propMgmtDept = await departmentModel.findOne({
            name: 'Property Management',
            facilityId: facilityId
        });

        console.log('Property Management department:', propMgmtDept);

        // Dynamically fetch models with facility context
        const models = {
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            customer: await getModel('Customer', payservedb.Customer.schema, facilityId)
        };

        // Fetch all property manager contracts for the facility
        const contracts = await models.propertyManagerContract.find({ 
            facilityId: facilityId 
        }).sort({ createdAt: -1 }); // Sort by newest first

        if (!contracts || contracts.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No property manager contracts found',
                data: {
                    contracts: [],
                    summary: {
                        totalContracts: 0,
                        totalActive: 0,
                        totalInactive: 0,
                        totalUnits: 0,
                        uniqueClients: 0,
                        uniquePropertyManagers: 0,
                        validPropertyManagers: 0
                    },
                    count: 0
                }
            });
        }

        // Get all unique IDs from contracts
        const allUnitIds = [...new Set(contracts.flatMap(contract => contract.units || []))];
        const allCustomerIds = [...new Set(contracts.map(contract => contract.customerId).filter(Boolean))];
        const allPropertyManagerIds = [...new Set(contracts.map(contract => contract.propertyManager).filter(Boolean))];

        console.log(`Processing ${contracts.length} contracts with ${allUnitIds.length} unique units, ${allCustomerIds.length} unique customers, ${allPropertyManagerIds.length} unique property managers`);

        // Enhanced property manager fetching with department validation
        const fetchPropertyManagers = async () => {
            // First, try to find property managers with populated department
            let propertyManagers = await payservedb.User.find({
                _id: { $in: allPropertyManagerIds },
                facilityId: facilityId,
                role: "Staff"
            }).populate({
                path: 'department',
                model: departmentModel,
                select: 'name'
            });

            console.log(`Found ${propertyManagers.length} property managers with populated departments`);

            // Validate populated departments and track valid ones
            const validPMsWithPopulatedDept = propertyManagers.filter(pm => 
                pm.department && pm.department.name === 'Property Management'
            );

            console.log(`${validPMsWithPopulatedDept.length} property managers have valid populated departments`);

            // If some property managers are missing or don't have valid departments, try by department ID
            if (validPMsWithPopulatedDept.length < allPropertyManagerIds.length && propMgmtDept) {
                const foundValidPMIds = validPMsWithPopulatedDept.map(pm => pm._id.toString());
                const remainingPMIds = allPropertyManagerIds.filter(id => !foundValidPMIds.includes(id.toString()));

                console.log(`Looking for ${remainingPMIds.length} remaining property managers by department ID`);

                // Try by department ObjectId
                const pmsByDeptId = await payservedb.User.find({
                    _id: { $in: remainingPMIds },
                    department: propMgmtDept._id,
                    facilityId: facilityId,
                    role: "Staff"
                });

                console.log(`Found ${pmsByDeptId.length} property managers by department ObjectId`);

                // Try by department string ID for remaining ones
                const foundByDeptIdIds = pmsByDeptId.map(pm => pm._id.toString());
                const stillMissingIds = remainingPMIds.filter(id => !foundByDeptIdIds.includes(id.toString()));

                let pmsByDeptIdString = [];
                if (stillMissingIds.length > 0) {
                    pmsByDeptIdString = await payservedb.User.find({
                        _id: { $in: stillMissingIds },
                        department: propMgmtDept._id.toString(),
                        facilityId: facilityId,
                        role: "Staff"
                    });

                    console.log(`Found ${pmsByDeptIdString.length} property managers by department string ID`);
                }

                // Combine all valid property managers
                propertyManagers = [...validPMsWithPopulatedDept, ...pmsByDeptId, ...pmsByDeptIdString];
            } else {
                propertyManagers = validPMsWithPopulatedDept;
            }

            // Final fallback: get all property managers without department validation
            if (propertyManagers.length < allPropertyManagerIds.length) {
                const foundPMIds = propertyManagers.map(pm => pm._id.toString());
                const missingPMIds = allPropertyManagerIds.filter(id => !foundPMIds.includes(id.toString()));

                console.log(`Getting ${missingPMIds.length} remaining property managers without department validation`);

                const fallbackPMs = await payservedb.User.find({
                    _id: { $in: missingPMIds },
                    facilityId: facilityId,
                    role: "Staff"
                });

                if (fallbackPMs.length > 0) {
                    console.log(`Found ${fallbackPMs.length} property managers as fallback`);
                    propertyManagers = [...propertyManagers, ...fallbackPMs];
                }

                // Final fallback without role filter
                if (propertyManagers.length < allPropertyManagerIds.length) {
                    const stillMissingIds = allPropertyManagerIds.filter(id => 
                        !propertyManagers.find(pm => pm._id.toString() === id.toString())
                    );

                    const finalFallbackPMs = await payservedb.User.find({
                        _id: { $in: stillMissingIds },
                        facilityId: facilityId
                    });

                    if (finalFallbackPMs.length > 0) {
                        console.log(`Found ${finalFallbackPMs.length} property managers in final fallback`);
                        propertyManagers = [...propertyManagers, ...finalFallbackPMs];
                    }
                }
            }

            return propertyManagers;
        };

        // Fetch related data in parallel
        const [units, customers, propertyManagers] = await Promise.all([
            // Fetch units from facility-specific collection first, then global if needed
            models.unit.find({ 
                _id: { $in: allUnitIds },
                facilityId: facilityId 
            }).then(async (facilityUnits) => {
                console.log(`Found ${facilityUnits.length} units in facility collection`);
                
                // If some units are missing from facility collection, try global collection
                if (facilityUnits.length < allUnitIds.length) {
                    const foundUnitIds = facilityUnits.map(unit => unit._id.toString());
                    const missingUnitIds = allUnitIds.filter(id => !foundUnitIds.includes(id.toString()));
                    
                    console.log(`Looking for ${missingUnitIds.length} missing units in global collection`);
                    
                    const globalUnits = await payservedb.Unit.find({ 
                        _id: { $in: missingUnitIds },
                        facilityId: facilityId // Still filter by facilityId in global collection
                    });
                    
                    console.log(`Found ${globalUnits.length} additional units in global collection`);
                    
                    return [...facilityUnits, ...globalUnits];
                }
                
                return facilityUnits;
            }),
            
            // Check both global and facility-specific customer collections
            Promise.all([
                payservedb.Customer.find({ 
                    _id: { $in: allCustomerIds },
                    customerType: 'home owner'
                }),
                models.customer.find({ 
                    _id: { $in: allCustomerIds },
                    customerType: 'home owner'
                })
            ]).then(([globalCustomers, facilityCustomers]) => {
                console.log(`Found ${globalCustomers.length} global customers and ${facilityCustomers.length} facility customers`);
                
                // Combine and deduplicate customers
                const allCustomers = [...globalCustomers, ...facilityCustomers];
                const uniqueCustomers = allCustomers.filter((customer, index, self) => 
                    index === self.findIndex(c => c._id.toString() === customer._id.toString())
                );
                
                console.log(`Total unique customers: ${uniqueCustomers.length}`);
                return uniqueCustomers;
            }),

            // Enhanced property manager fetching
            fetchPropertyManagers()
        ]);

        console.log(`Final counts - Units: ${units.length}, Customers: ${customers.length}, Property Managers: ${propertyManagers.length}`);

        // Create lookup maps for better performance
        const unitMap = new Map(units.map(unit => [unit._id.toString(), unit]));
        const customerMap = new Map(customers.map(customer => [customer._id.toString(), customer]));
        const propertyManagerMap = new Map(propertyManagers.map(pm => [pm._id.toString(), pm]));

        // Count valid property managers (those in Property Management department)
        const validPropertyManagers = propertyManagers.filter(pm => {
            if (!propMgmtDept) return false;
            
            // Check if department matches Property Management
            if (pm.department === propMgmtDept._id.toString() || 
                pm.department?.toString() === propMgmtDept._id.toString()) {
                return true;
            }
            
            // Check if populated department matches
            if (typeof pm.department === 'object' && pm.department?.name === 'Property Management') {
                return true;
            }
            
            return false;
        });

        console.log(`${validPropertyManagers.length} out of ${propertyManagers.length} property managers are in Property Management department`);

        // Process contracts with populated data
        const populatedContracts = contracts.map(contract => {
            // Get contract units with details
            const contractUnits = (contract.units || []).map(unitId => {
                const unit = unitMap.get(unitId.toString());
                if (unit) {
                    return {
                        _id: unit._id,
                        name: unit.name,
                        unitType: unit.unitType,
                        division: unit.division,
                        floorUnitNo: unit.floorUnitNo,
                        homeOwnerId: unit.homeOwnerId,
                        status: unit.status,
                        isManagedByPropertyManager: unit.isManagedByPropertyManager
                    };
                } else {
                    console.warn(`Unit not found: ${unitId}`);
                    return {
                        _id: unitId,
                        name: `Unit ${unitId}`,
                        unitType: 'Unknown',
                        division: 'Unknown',
                        status: 'Unknown'
                    };
                }
            });

            // Get customer details
            const customer = customerMap.get(contract.customerId?.toString());
            const customerDetails = customer ? {
                _id: customer._id,
                customerNumber: customer.customerNumber,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phoneNumber: customer.phoneNumber,
                customerType: customer.customerType,
                status: customer.status
            } : {
                _id: contract.customerId,
                firstName: 'Unknown',
                lastName: 'Customer',
                customerType: 'home owner'
            };

            // Get property manager details with validation status
            const propertyManager = propertyManagerMap.get(contract.propertyManager?.toString());
            let propertyManagerDetails = null;
            let isValidPropertyManager = false;

            if (propertyManager) {
                // Check if this property manager is valid (in Property Management department)
                if (propMgmtDept) {
                    isValidPropertyManager = (
                        propertyManager.department === propMgmtDept._id.toString() || 
                        propertyManager.department?.toString() === propMgmtDept._id.toString() ||
                        (typeof propertyManager.department === 'object' && 
                         propertyManager.department?.name === 'Property Management')
                    );
                }

                propertyManagerDetails = {
                    _id: propertyManager._id,
                    fullName: propertyManager.fullName,
                    firstName: propertyManager.firstName,
                    lastName: propertyManager.lastName,
                    email: propertyManager.email,
                    phoneNumber: propertyManager.phoneNumber,
                    department: propertyManager.department,
                    role: propertyManager.role,
                    isValidPropertyManager: isValidPropertyManager
                };
            }

            // Calculate contract duration (only if both dates exist)
            let contractDuration = null;
            if (contract.startDate && contract.endDate) {
                contractDuration = Math.ceil(
                    (new Date(contract.endDate) - new Date(contract.startDate)) / (1000 * 60 * 60 * 24)
                ); // Duration in days
            }

            // Return flat structure with ALL core fields that exist in the schema
            return {
                // Core contract fields
                _id: contract._id,
                contractName: contract.contractName,
                propertyManager: contract.propertyManager, // Keep ObjectId reference
                units: contract.units || [], // Keep array of ObjectIds
                customerId: contract.customerId, // Keep ObjectId reference
                
                // Management fee
                managementFee: contract.managementFee,
                
                // Status and dates - ONLY fields that exist in schema
                status: contract.status,
                startDate: contract.startDate,
                endDate: contract.endDate,
                paymentDueDate: contract.paymentDueDate, // Exists in schema
                nextInvoiceDate: contract.nextInvoiceDate, // Exists in schema
                lastInvoiceDate: contract.lastInvoiceDate, // Exists in schema
                
                // Financial terms - ONLY fields that exist in schema
                balanceBroughtForward: contract.balanceBroughtForward,
                frequency: contract.frequency, // Exists in schema
                autoSend: contract.autoSend,
                
                // GL Accounts - Both fields exist in schema
                glAccounts: contract.glAccounts,
                invoiceDoubleEntryAccount: contract.invoiceDoubleEntryAccount, // Exists in schema
                paymentDoubleEntryAccount: contract.paymentDoubleEntryAccount, // Exists in schema
                
                // Audit trail
                createdAt: contract.createdAt,
                updatedAt: contract.updatedAt,
                createdBy: contract.createdBy,
                updatedBy: contract.updatedBy,
                editHistory: contract.editHistory || [],
                
                // Facility
                facilityId: contract.facilityId,
                
                // POPULATED DETAILS for frontend display
                propertyManagerDetails: propertyManagerDetails,
                unitDetails: contractUnits,
                customer: customerDetails,
                
                // Summary fields for UI convenience
                totalUnits: contractUnits.length,
                contractDuration: contractDuration,
                
                // Additional computed fields for frontend convenience
                formattedManagementFee: contract.managementFee ? 
                    `${contract.managementFee.value}${contract.managementFee.type === 'percentage' ? '%' : ' (Fixed)'}` : null,
                isActive: contract.status === 'Active',
                hasValidDates: !!(contract.startDate && contract.endDate),
                
                // Lease integration status - using actual schema fields
                hasLeaseData: !!(contract.startDate && contract.endDate && contract.paymentDueDate && contract.frequency),
                missingLeaseFields: [
                    !contract.startDate && 'Start Date',
                    !contract.endDate && 'End Date', 
                    !contract.paymentDueDate && 'Payment Due Date',
                    !contract.frequency && 'Frequency'
                ].filter(Boolean),

                // Validation status for this contract
                validationStatus: {
                    hasValidPropertyManager: isValidPropertyManager,
                    propertyManagerFound: !!propertyManager,
                    unitsFound: contractUnits.filter(u => u.name !== `Unit ${u._id}`).length,
                    customerFound: !!customer
                }
            };
        });

        // Calculate summary statistics
        const summary = {
            totalContracts: contracts.length,
            totalActive: contracts.filter(c => c.status === 'Active').length,
            totalInactive: contracts.filter(c => c.status === 'Inactive').length,
            totalCompleted: contracts.filter(c => c.status === 'Completed').length,
            totalSuspended: contracts.filter(c => c.status === 'Suspended').length,
            totalTerminated: contracts.filter(c => c.status === 'Terminated').length,
            totalUnits: allUnitIds.length,
            uniqueClients: allCustomerIds.length,
            uniquePropertyManagers: allPropertyManagerIds.length,
            validPropertyManagers: validPropertyManagers.length,
            unitsFoundInDB: units.length,
            customersFoundInDB: customers.length,
            propertyManagersFoundInDB: propertyManagers.length,
            contractsWithValidPM: populatedContracts.filter(c => 
                c.validationStatus.hasValidPropertyManager
            ).length,
            departmentValidation: {
                propMgmtDeptExists: !!propMgmtDept,
                propMgmtDeptId: propMgmtDept?._id,
                totalPMsInCorrectDept: validPropertyManagers.length
            }
        };

        console.log('Contract fetch summary:', summary);

        return reply.code(200).send({
            success: true,
            message: 'Property manager contracts retrieved successfully',
            data: {
                contracts: populatedContracts,
                summary: summary,
                count: contracts.length
            }
        });

    } catch (error) {
        console.error('Error fetching property manager contracts:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to fetch property manager contracts',
            error: error.message
        });
    }
};

module.exports = getPropertyManagerContracts;