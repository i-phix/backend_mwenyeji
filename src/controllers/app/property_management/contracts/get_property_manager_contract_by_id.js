const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

const getPropertyManagerContractById = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;

        // Validate facilityId and contractId
        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        if (!contractId) {
            return reply.code(400).send({
                success: false,
                error: 'Contract ID is required'
            });
        }

        // Validate contractId format
        if (!mongoose.Types.ObjectId.isValid(contractId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid contract ID format'
            });
        }

        // Get the department model to properly handle department references
        const departmentModel = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);
        
        // Find Property Management department for reference
        const propMgmtDept = await departmentModel.findOne({
            name: 'Property Management',
            facilityId: facilityId
        });

        console.log('Property Management department:', propMgmtDept);

        // Dynamically fetch models with facility context
        const models = {
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            customer: await getModel('Customer', payservedb.Customer.schema, facilityId),
            leaseAgreement: await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId)
        };

        // Fetch the specific contract
        const contract = await models.propertyManagerContract.findOne({
            _id: contractId,
            facilityId: facilityId
        });

        if (!contract) {
            return reply.code(404).send({
                success: false,
                error: 'Property manager contract not found'
            });
        }

        console.log(`Found contract: ${contract.contractName} with ${contract.units?.length || 0} units`);
        console.log('Contract property manager ID:', contract.propertyManager);

        // Enhanced property manager fetching with department validation
        let propertyManagerDetails = null;
        if (contract.propertyManager) {
            try {
                // First try with populated department
                propertyManagerDetails = await payservedb.User.findOne({
                    _id: contract.propertyManager,
                    facilityId: facilityId,
                    role: "Staff"
                }).populate({
                    path: 'department',
                    model: departmentModel,
                    select: 'name'
                });

                // Validate department if populated
                if (propertyManagerDetails && propertyManagerDetails.department) {
                    if (propertyManagerDetails.department.name !== 'Property Management') {
                        console.warn(`Property manager ${propertyManagerDetails.fullName} is not in Property Management department`);
                    }
                } else {
                    // If no populated department, try by department ID
                    if (propMgmtDept) {
                        const pmByDeptId = await payservedb.User.findOne({
                            _id: contract.propertyManager,
                            department: propMgmtDept._id,
                            facilityId: facilityId,
                            role: "Staff"
                        });

                        if (pmByDeptId) {
                            propertyManagerDetails = pmByDeptId;
                            console.log('Found property manager by department ID');
                        } else {
                            // Also try string comparison for department
                            const pmByDeptIdString = await payservedb.User.findOne({
                                _id: contract.propertyManager,
                                department: propMgmtDept._id.toString(),
                                facilityId: facilityId,
                                role: "Staff"
                            });

                            if (pmByDeptIdString) {
                                propertyManagerDetails = pmByDeptIdString;
                                console.log('Found property manager by department ID string');
                            }
                        }
                    }
                }

                // Fallback: get user details without department validation
                if (!propertyManagerDetails) {
                    propertyManagerDetails = await payservedb.User.findOne({
                        _id: contract.propertyManager,
                        facilityId: facilityId,
                        role: "Staff"
                    });

                    if (!propertyManagerDetails) {
                        // Final fallback: get user without role filter
                        propertyManagerDetails = await payservedb.User.findOne({
                            _id: contract.propertyManager,
                            facilityId: facilityId
                        });
                    }
                }

                console.log('Property manager found:', propertyManagerDetails ? {
                    id: propertyManagerDetails._id,
                    name: propertyManagerDetails.fullName,
                    email: propertyManagerDetails.email,
                    department: propertyManagerDetails.department,
                    isValidPM: propertyManagerDetails.department === propMgmtDept?._id || 
                              propertyManagerDetails.department === propMgmtDept?._id.toString() ||
                              (typeof propertyManagerDetails.department === 'object' && 
                               propertyManagerDetails.department?.name === 'Property Management')
                } : 'Not found');
            } catch (pmError) {
                console.error('Error fetching property manager details:', pmError);
            }
        }

        // Fetch unit details with enhanced error handling
        let unitDetails = [];
        if (contract.units && contract.units.length > 0) {
            try {
                // Try facility-specific collection first
                unitDetails = await models.unit.find({
                    _id: { $in: contract.units },
                    facilityId: facilityId
                });

                // If some units missing, try global collection
                if (unitDetails.length < contract.units.length) {
                    const foundUnitIds = unitDetails.map(unit => unit._id.toString());
                    const missingUnitIds = contract.units.filter(id => !foundUnitIds.includes(id.toString()));
                    
                    const globalUnits = await payservedb.Unit.find({
                        _id: { $in: missingUnitIds },
                        facilityId: facilityId
                    });
                    
                    unitDetails = [...unitDetails, ...globalUnits];
                }

                console.log(`Found ${unitDetails.length} unit details out of ${contract.units.length} requested`);
            } catch (unitError) {
                console.error('Error fetching unit details:', unitError);
            }
        }

        // Fetch customer details - check global collection first, then facility-specific
        let customerDetails = null;
        if (contract.customerId) {
            try {
                // Try global Customer collection first
                customerDetails = await payservedb.Customer.findOne({
                    _id: contract.customerId,
                    customerType: 'home owner'
                });

                // If not found globally, try facility-specific
                if (!customerDetails) {
                    customerDetails = await models.customer.findOne({
                        _id: contract.customerId,
                        customerType: 'home owner'
                    });
                }

                // Final fallback without customerType filter
                if (!customerDetails) {
                    customerDetails = await payservedb.Customer.findOne({
                        _id: contract.customerId
                    });
                }

                console.log('Customer found:', customerDetails ? {
                    id: customerDetails._id,
                    name: `${customerDetails.firstName} ${customerDetails.lastName}`,
                    email: customerDetails.email,
                    type: customerDetails.customerType
                } : 'Not found');
            } catch (customerError) {
                console.error('Error fetching customer details:', customerError);
            }
        }

        // Check for related lease agreements
        let relatedLeases = [];
        if (contract.units && contract.units.length > 0) {
            try {
                relatedLeases = await models.leaseAgreement.find({
                    unitNumber: { $in: contract.units },
                    facilityId: facilityId,
                    status: { $in: ['Active', 'Pending', 'Completed'] }
                }).select('unitNumber status leaseTerms financialTerms billingCycle');

                console.log(`Found ${relatedLeases.length} related lease agreements`);
            } catch (leaseError) {
                console.error('Error fetching related leases:', leaseError);
            }
        }

        // Build response with structure that frontend expects - using actual schema fields
        const contractResponse = {
            // Core contract fields
            _id: contract._id,
            contractName: contract.contractName,
            propertyManager: contract.propertyManager, // Keep the ObjectId reference
            units: contract.units, // Keep the array of ObjectIds
            customerId: contract.customerId, // Keep the ObjectId reference
            
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
            
            // POPULATED DETAILS for frontend display (additional fields)
            propertyManagerDetails: propertyManagerDetails ? {
                _id: propertyManagerDetails._id,
                fullName: propertyManagerDetails.fullName,
                firstName: propertyManagerDetails.firstName,
                lastName: propertyManagerDetails.lastName,
                email: propertyManagerDetails.email,
                phoneNumber: propertyManagerDetails.phoneNumber,
                department: propertyManagerDetails.department,
                role: propertyManagerDetails.role,
                // Add validation status for frontend
                isValidPropertyManager: propertyManagerDetails.department === propMgmtDept?._id || 
                                     propertyManagerDetails.department === propMgmtDept?._id?.toString() ||
                                     (typeof propertyManagerDetails.department === 'object' && 
                                      propertyManagerDetails.department?.name === 'Property Management')
            } : null,
            
            unitDetails: unitDetails.map(unit => ({
                _id: unit._id,
                name: unit.name,
                unitType: unit.unitType,
                division: unit.division,
                floorUnitNo: unit.floorUnitNo,
                status: unit.status,
                homeOwnerId: unit.homeOwnerId,
                isManagedByPropertyManager: unit.isManagedByPropertyManager,
                propertyManagerName: unit.propertyManagerName
            })),
            
            customer: customerDetails ? {
                _id: customerDetails._id,
                customerNumber: customerDetails.customerNumber,
                firstName: customerDetails.firstName,
                lastName: customerDetails.lastName,
                email: customerDetails.email,
                phoneNumber: customerDetails.phoneNumber,
                idNumber: customerDetails.idNumber,
                customerType: customerDetails.customerType,
                status: customerDetails.status
            } : null,
            
            // Lease integration information
            relatedLeases: relatedLeases.map(lease => ({
                _id: lease._id,
                unitNumber: lease.unitNumber,
                status: lease.status,
                startDate: lease.leaseTerms?.startDate,
                endDate: lease.leaseTerms?.endDate,
                paymentDueDate: lease.financialTerms?.paymentDueDate,
                frequency: lease.billingCycle?.frequency
            })),
            
            // Summary fields for UI convenience
            totalUnits: unitDetails.length,
            totalRelatedLeases: relatedLeases.length,
            contractDuration: contract.startDate && contract.endDate ? 
                Math.ceil((new Date(contract.endDate) - new Date(contract.startDate)) / (1000 * 60 * 60 * 24)) : null,
            
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
            
            // Department validation status
            departmentValidation: {
                propMgmtDeptExists: !!propMgmtDept,
                propMgmtDeptId: propMgmtDept?._id,
                propertyManagerDepartmentValid: propertyManagerDetails ? (
                    propertyManagerDetails.department === propMgmtDept?._id || 
                    propertyManagerDetails.department === propMgmtDept?._id?.toString() ||
                    (typeof propertyManagerDetails.department === 'object' && 
                     propertyManagerDetails.department?.name === 'Property Management')
                ) : false
            }
        };

        console.log('=== CONTRACT RESPONSE STRUCTURE ===');
        console.log('Property Manager ID:', contractResponse.propertyManager);
        console.log('Property Manager Details Available:', !!contractResponse.propertyManagerDetails);
        console.log('Property Manager Department Valid:', contractResponse.departmentValidation.propertyManagerDepartmentValid);
        console.log('Units Count:', contractResponse.units?.length || 0);
        console.log('Units Found:', contractResponse.unitDetails?.length || 0);
        console.log('Customer ID:', contractResponse.customerId);
        console.log('Customer Details Available:', !!contractResponse.customer);
        console.log('Related Leases:', contractResponse.totalRelatedLeases);
        console.log('Has Lease Data:', contractResponse.hasLeaseData);
        console.log('Missing Lease Fields:', contractResponse.missingLeaseFields);

        // Return the structure that frontend expects
        return reply.code(200).send({
            success: true,
            message: 'Property manager contract retrieved successfully',
            data: contractResponse
        });

    } catch (error) {
        console.error('Error fetching property manager contract by ID:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to fetch property manager contract',
            error: error.message
        });
    }
};

module.exports = getPropertyManagerContractById;