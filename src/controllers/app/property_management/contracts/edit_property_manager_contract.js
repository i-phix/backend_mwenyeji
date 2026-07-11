const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const ObjectId = mongoose.Types.ObjectId;

const editPropertyManagerContract = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;

        // Log the incoming request for debugging
        console.log('Edit Property Manager Contract request body:', JSON.stringify(request.body, null, 2));
        console.log('Contract ID:', contractId, 'Facility ID:', facilityId);

        const {
            contractName,
            propertyManager,
            units,
            customerId,
            managementFee,
            status,
            glAccounts, // GL accounts can be edited
            editReason // Required reason for edit
        } = request.body;

        // Validate required fields
        if (!contractId || !mongoose.Types.ObjectId.isValid(contractId)) {
            return reply.code(400).send({
                success: false,
                error: 'Valid contract ID is required'
            });
        }

        if (!editReason || editReason.trim().length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'Edit reason is required for audit trail'
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

        // Dynamically fetch models with facility context
        const models = {
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            customer: await getModel('Customer', payservedb.Customer.schema, facilityId),
            doubleEntryModel: await getModel('GLAccountDoubleEntries', payservedb.GLAccountDoubleEntries.schema, facilityId),
            glAccountModel: await getModel('GLAccount', payservedb.GLAccount.schema, facilityId)
        };

        // Find the existing contract and populate property manager details
        const existingContract = await models.propertyManagerContract.findOne({
            _id: contractId,
            facilityId: facilityId
        });

        if (!existingContract) {
            return reply.code(404).send({
                success: false,
                error: 'Property manager contract not found'
            });
        }

        // Fetch current property manager details with enhanced department checking
        let currentPropertyManagerDetails = null;
        if (existingContract.propertyManager) {
            try {
                // First try with populated department
                currentPropertyManagerDetails = await payservedb.User.findOne({
                    _id: existingContract.propertyManager,
                    facilityId: facilityId,
                    role: "Staff"
                }).populate({
                    path: 'department',
                    model: departmentModel,
                    select: 'name'
                });
                
                // If not found with populated department or department doesn't match, try by department ID
                if (!currentPropertyManagerDetails || 
                    (currentPropertyManagerDetails.department && 
                     currentPropertyManagerDetails.department.name !== 'Property Management')) {
                    
                    if (propMgmtDept) {
                        currentPropertyManagerDetails = await payservedb.User.findOne({
                            _id: existingContract.propertyManager,
                            department: propMgmtDept._id,
                            facilityId: facilityId,
                            role: "Staff"
                        });

                        // Also try string comparison for department
                        if (!currentPropertyManagerDetails) {
                            currentPropertyManagerDetails = await payservedb.User.findOne({
                                _id: existingContract.propertyManager,
                                department: propMgmtDept._id.toString(),
                                facilityId: facilityId,
                                role: "Staff"
                            });
                        }
                    }
                }
                
                if (currentPropertyManagerDetails) {
                    // Attach property manager details to existing contract for response
                    existingContract.propertyManagerDetails = {
                        _id: currentPropertyManagerDetails._id,
                        fullName: currentPropertyManagerDetails.fullName,
                        email: currentPropertyManagerDetails.email,
                        department: currentPropertyManagerDetails.department,
                        role: currentPropertyManagerDetails.role
                    };
                }
                
                console.log('Current property manager details:', currentPropertyManagerDetails ? {
                    id: currentPropertyManagerDetails._id,
                    name: currentPropertyManagerDetails.fullName,
                    email: currentPropertyManagerDetails.email,
                    department: currentPropertyManagerDetails.department
                } : 'Not found');
            } catch (pmError) {
                console.error('Error fetching current property manager details:', pmError);
            }
        }

        // Prevent editing terminated contracts
        if (existingContract.status === 'Terminated') {
            return reply.code(400).send({
                success: false,
                error: 'Cannot edit terminated contracts'
            });
        }

        console.log('Found existing contract:', {
            id: existingContract._id,
            name: existingContract.contractName,
            status: existingContract.status,
            currentPropertyManagerId: existingContract.propertyManager,
            currentPropertyManagerName: currentPropertyManagerDetails?.fullName || 'Unknown'
        });

        // Store original data for audit trail - Updated to match simplified schema
        const originalData = {
            contractName: existingContract.contractName,
            propertyManager: existingContract.propertyManager,
            units: existingContract.units,
            customerId: existingContract.customerId,
            managementFee: existingContract.managementFee,
            status: existingContract.status,
            startDate: existingContract.startDate,
            endDate: existingContract.endDate,
            paymentDueDate: existingContract.paymentDueDate, // Updated field name
            frequency: existingContract.frequency, // Updated field name
            balanceBroughtForward: existingContract.balanceBroughtForward,
            autoSend: existingContract.autoSend,
            glAccounts: existingContract.glAccounts
        };

        // Prepare update data - only allow editable fields
        const updateData = {
            updatedBy: request.user ? request.user._id : null,
            updatedAt: new Date()
        };

        const changes = {}; // Track what changed for audit

        // 1. Contract Name - can be edited
        if (contractName !== undefined && contractName !== existingContract.contractName) {
            if (!contractName || contractName.trim().length === 0) {
                return reply.code(400).send({
                    success: false,
                    error: 'Contract name cannot be empty'
                });
            }
            updateData.contractName = contractName.trim();
            changes.contractName = { from: existingContract.contractName, to: contractName.trim() };
        }

        // 2. Property Manager - can be edited with enhanced validation
        if (propertyManager !== undefined && propertyManager !== existingContract.propertyManager?.toString()) {
            let propertyManagerUser = null;

            // First, try to find user with populated department object
            propertyManagerUser = await payservedb.User.findOne({
                _id: propertyManager,
                facilityId: facilityId,
                role: "Staff",
                isEnabled: { $ne: false }
            }).populate({
                path: 'department',
                model: departmentModel,
                select: 'name'
            });

            // Check if department is properly populated and matches
            if (propertyManagerUser && propertyManagerUser.department && 
                propertyManagerUser.department.name === 'Property Management') {
                console.log('Found new property manager with populated department:', propertyManagerUser.fullName);
            } else {
                // If no populated department or doesn't match, check by department ID
                if (propMgmtDept) {
                    propertyManagerUser = await payservedb.User.findOne({
                        _id: propertyManager,
                        department: propMgmtDept._id, // Check by department ID
                        facilityId: facilityId,
                        role: "Staff",
                        isEnabled: { $ne: false }
                    });

                    if (propertyManagerUser) {
                        console.log('Found new property manager by department ID:', propertyManagerUser.fullName);
                    } else {
                        // Also try string comparison for department
                        propertyManagerUser = await payservedb.User.findOne({
                            _id: propertyManager,
                            department: propMgmtDept._id.toString(), // Check by department ID as string
                            facilityId: facilityId,
                            role: "Staff",
                            isEnabled: { $ne: false }
                        });

                        if (propertyManagerUser) {
                            console.log('Found new property manager by department ID string:', propertyManagerUser.fullName);
                        }
                    }
                }
            }

            if (!propertyManagerUser) {
                // If still not found, get user details for better error message
                const userExists = await payservedb.User.findOne({
                    _id: propertyManager,
                    facilityId: facilityId,
                    role: "Staff"
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

            console.log(`Found new property manager: ${propertyManagerUser.fullName} (${propertyManagerUser.email})`);

            updateData.propertyManager = propertyManager;
            changes.propertyManager = { 
                from: existingContract.propertyManager?.toString(), 
                to: propertyManager,
                fromName: currentPropertyManagerDetails?.fullName || 'Previous Manager',
                toName: propertyManagerUser.fullName
            };
        }

        // 3. Units - READONLY in edit (cannot be changed)
        // Units field is not editable in edit mode

        // 4. Customer ID - READONLY in edit (tied to unit ownership)
        // Customer field is not editable in edit mode

        // 5. Management Fee - can be edited
        if (managementFee !== undefined) {
            // Validate management fee structure
            if (!managementFee.type || !['percentage', 'amount'].includes(managementFee.type)) {
                return reply.code(400).send({
                    success: false,
                    error: 'managementFee.type must be either "percentage" or "amount"'
                });
            }

            if (typeof managementFee.value !== 'number' || managementFee.value < 0) {
                return reply.code(400).send({
                    success: false,
                    error: 'managementFee.value must be a non-negative number'
                });
            }

            if (managementFee.type === 'percentage' && managementFee.value > 100) {
                return reply.code(400).send({
                    success: false,
                    error: 'managementFee.value cannot exceed 100 when type is percentage'
                });
            }

            // Check if management fee actually changed
            const currentFee = existingContract.managementFee;
            if (!currentFee || 
                currentFee.type !== managementFee.type || 
                currentFee.value !== managementFee.value) {
                
                updateData.managementFee = {
                    type: managementFee.type,
                    value: parseFloat(managementFee.value)
                };
                changes.managementFee = { 
                    from: currentFee, 
                    to: updateData.managementFee 
                };
            }
        }

        // 6. Status - can be edited (with restrictions)
        if (status !== undefined && status !== existingContract.status) {
            const validStatuses = ['Active', 'Inactive', 'Completed', 'Suspended'];
            if (!validStatuses.includes(status)) {
                return reply.code(400).send({
                    success: false,
                    error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            updateData.status = status;
            changes.status = { from: existingContract.status, to: status };
        }

        // 7. GL Accounts - can be edited
        if (glAccounts && glAccounts.invoice && glAccounts.payment) {
            console.log('Processing GL accounts update');
            
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
                
                // Verify GL accounts exist - check facility-specific first, then global
                let existingGLAccounts = await models.glAccountModel.find({
                    _id: { $in: uniqueAccountIds },
                    facilityId: facilityId
                });

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
                        error: `One or more referenced GL accounts do not exist: ${missingIds.join(', ')}`
                    });
                }
                
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
                
                changes.glAccounts = {
                    from: originalData.glAccounts,
                    to: updateData.glAccounts
                };
            }
        }

        // Note: Contract terms like startDate, endDate, paymentDueDate, frequency, etc. 
        // are populated from lease data and are READONLY in edit mode
        // They should only be updated when the associated lease changes

        // Check if any changes were made
        if (Object.keys(changes).length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'No changes detected. Please modify at least one field.'
            });
        }

        // Add edit history entry
        const editHistoryEntry = {
            editedBy: request.user ? request.user._id : 'System',
            editedAt: new Date(),
            reason: editReason.trim(),
            changes: {
                action: 'EDIT',
                fieldsChanged: Object.keys(changes),
                originalData: originalData,
                newData: changes
            }
        };

        updateData.$push = { editHistory: editHistoryEntry };

        console.log('Updating contract with data:', Object.keys(updateData));

        // Update the contract
        const updatedContract = await models.propertyManagerContract.findByIdAndUpdate(
            contractId,
            updateData,
            { new: true }
        );

        if (!updatedContract) {
            return reply.code(500).send({
                success: false,
                error: 'Failed to update contract'
            });
        }

        // Fetch updated property manager details for response
        let updatedPropertyManagerDetails = null;
        if (updatedContract.propertyManager) {
            try {
                // Use the same enhanced logic for fetching updated property manager
                updatedPropertyManagerDetails = await payservedb.User.findOne({
                    _id: updatedContract.propertyManager,
                    facilityId: facilityId,
                    role: "Staff"
                }).populate({
                    path: 'department',
                    model: departmentModel,
                    select: 'name'
                });

                // If not found with populated department, try by department ID
                if (!updatedPropertyManagerDetails && propMgmtDept) {
                    updatedPropertyManagerDetails = await payservedb.User.findOne({
                        _id: updatedContract.propertyManager,
                        department: propMgmtDept._id,
                        facilityId: facilityId,
                        role: "Staff"
                    });

                    // Also try string comparison
                    if (!updatedPropertyManagerDetails) {
                        updatedPropertyManagerDetails = await payservedb.User.findOne({
                            _id: updatedContract.propertyManager,
                            department: propMgmtDept._id.toString(),
                            facilityId: facilityId,
                            role: "Staff"
                        });
                    }
                }
            } catch (pmError) {
                console.error('Error fetching updated property manager details:', pmError);
            }
        }

        // Update units if property manager was changed
        if (changes.propertyManager) {
            try {
                // Get the new property manager details from global User collection
                const newPropertyManagerUser = await payservedb.User.findById(changes.propertyManager.to);
                
                if (newPropertyManagerUser) {
                    // Update all units associated with this contract
                    const contractUnits = existingContract.units; // Use existing units (units are readonly in edit)
                    
                    await models.unit.updateMany(
                        { 
                            _id: { $in: contractUnits },
                            facilityId: facilityId 
                        },
                        {
                            $set: {
                                propertyManager: changes.propertyManager.to,
                                propertyManagerName: newPropertyManagerUser.fullName,
                                // Keep the existing propertyManagerContract reference
                                propertyManagerContract: contractId
                            }
                        }
                    );
                    
                    console.log(`Updated property manager for ${contractUnits.length} units to: ${newPropertyManagerUser.fullName}`);
                } else {
                    console.error('Could not find new property manager user for unit updates');
                }

            } catch (unitUpdateError) {
                console.error('Error updating units after property manager change:', unitUpdateError);
                // Log error but don't fail the contract update
            }
        }

        console.log('Contract updated successfully:', updatedContract._id);

        // Create enhanced response with populated property manager details
        const responseData = {
            contract: {
                ...updatedContract.toObject(),
                // Include property manager details if available
                propertyManagerDetails: updatedPropertyManagerDetails ? {
                    _id: updatedPropertyManagerDetails._id,
                    fullName: updatedPropertyManagerDetails.fullName,
                    email: updatedPropertyManagerDetails.email,
                    department: updatedPropertyManagerDetails.department,
                    role: updatedPropertyManagerDetails.role
                } : (currentPropertyManagerDetails ? {
                    _id: currentPropertyManagerDetails._id,
                    fullName: currentPropertyManagerDetails.fullName,
                    email: currentPropertyManagerDetails.email,
                    department: currentPropertyManagerDetails.department,
                    role: currentPropertyManagerDetails.role
                } : null)
            },
            changesApplied: Object.keys(changes),
            changesSummary: changes,
            editReason: editReason.trim(),
            editedBy: request.user ? request.user._id : 'System',
            editedAt: new Date()
        };

        return reply.code(200).send({
            success: true,
            message: 'Property Manager Contract updated successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error updating property manager contract:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to update property manager contract',
            error: error.message
        });
    }
};

module.exports = editPropertyManagerContract;