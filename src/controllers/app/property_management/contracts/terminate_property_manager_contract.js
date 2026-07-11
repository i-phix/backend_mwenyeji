const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const terminatePropertyManagerContract = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;
        const { terminationReason, terminationDate } = request.body;

        // Validate required parameters
        if (!facilityId || !contractId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Contract ID are required'
            });
        }

        // Validate contractId format
        if (!mongoose.Types.ObjectId.isValid(contractId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid contract ID format'
            });
        }

        // Validate termination reason
        if (!terminationReason || terminationReason.trim().length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'Termination reason is required'
            });
        }

        // Set termination date (default to current date if not provided)
        const terminationDateObj = terminationDate ? new Date(terminationDate) : new Date();
        if (isNaN(terminationDateObj.getTime())) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid termination date format'
            });
        }

        console.log(`Terminating contract ${contractId} for facility ${facilityId}`);

        // Get models
        const models = {
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId),
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId)
        };

        // Find the contract
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

        // Check if already terminated
        if (contract.status === 'Terminated') {
            return reply.code(400).send({
                success: false,
                error: 'Contract is already terminated'
            });
        }

        // Validate termination date is not before contract start date
        if (contract.startDate && terminationDateObj < new Date(contract.startDate)) {
            return reply.code(400).send({
                success: false,
                error: 'Termination date cannot be before contract start date'
            });
        }

        console.log(`Found contract: ${contract.contractName} with ${contract.units.length} units`);

        // Create edit history entry
        const editHistoryEntry = {
            editedBy: request.user ? request.user._id : 'System',
            editedAt: new Date(),
            reason: `Contract Termination: ${terminationReason.trim()}`,
            changes: {
                action: 'TERMINATION',
                terminationDate: terminationDateObj,
                previousStatus: contract.status,
                newStatus: 'Terminated'
            }
        };

        // Update contract to terminated status - only update fields that exist in schema
        const updateData = {
            status: 'Terminated',
            endDate: terminationDateObj, // Update endDate to termination date
            nextInvoiceDate: null, // Clear next invoice date (exists in schema)
            autoSend: false, // Disable auto send (exists in schema)
            updatedBy: request.user ? request.user._id : null,
            $push: {
                editHistory: editHistoryEntry
            }
        };

        // Note: terminationDate, terminationReason, and terminatedBy fields don't exist in the schema
        // If you need these fields, they would need to be added to the schema first
        // For now, the termination info is stored in the editHistory

        const updatedContract = await models.propertyManagerContract.findByIdAndUpdate(
            contractId,
            updateData,
            { new: true }
        );

        if (!updatedContract) {
            return reply.code(500).send({
                success: false,
                error: 'Failed to update contract status'
            });
        }

        // Update all units to remove property management
        const unitUpdateResult = await models.unit.updateMany(
            { 
                _id: { $in: contract.units },
                facilityId: facilityId 
            },
            {
                $set: {
                    isManagedByPropertyManager: false
                },
                $unset: {
                    propertyManagerName: "",
                    propertyManager: "",
                    propertyManagerContract: ""
                }
            }
        );

        // Also update global units collection if needed
        try {
            await payservedb.Unit.updateMany(
                { 
                    _id: { $in: contract.units },
                    facilityId: facilityId 
                },
                {
                    $set: {
                        isManagedByPropertyManager: false
                    },
                    $unset: {
                        propertyManagerName: "",
                        propertyManager: "",
                        propertyManagerContract: ""
                    }
                }
            );
        } catch (globalUpdateError) {
            console.warn('Could not update global units collection:', globalUpdateError.message);
        }

        console.log(`Contract terminated successfully. Updated ${unitUpdateResult.modifiedCount} units.`);

        return reply.code(200).send({
            success: true,
            message: 'Property manager contract terminated successfully',
            data: {
                contract: updatedContract,
                unitsUpdated: unitUpdateResult.modifiedCount,
                terminationSummary: {
                    contractId: contractId,
                    contractName: contract.contractName,
                    terminationDate: terminationDateObj,
                    terminationReason: terminationReason.trim(),
                    previousStatus: contract.status,
                    newStatus: 'Terminated',
                    unitsAffected: contract.units.length
                }
            }
        });

    } catch (error) {
        console.error('Error terminating property manager contract:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to terminate property manager contract',
            error: error.message
        });
    }
};

module.exports = terminatePropertyManagerContract;