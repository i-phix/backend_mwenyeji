const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const terminateLevyContract = async (request, reply) => {
    try {
        const { facilityId, contractId } = request.params;
        const {
            terminationDate,
            terminationReason,
            effectiveImmediately = false
        } = request.body;

        // Log the request for debugging
        console.log('Terminating contract:', {
            facilityId,
            contractId,
            terminationDate,
            terminationReason,
            effectiveImmediately
        });

        // Validate required fields
        if (!terminationDate && !effectiveImmediately) {
            return reply.code(400).send({
                success: false,
                error: 'Termination date is required unless terminating immediately'
            });
        }

        // Get the levy contract model
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const customerModel = await payservedb.Customer;
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Find the contract
        const contract = await levyContractModel.findById(contractId);

        if (!contract) {
            return reply.code(404).send({
                success: false,
                error: 'Levy contract not found'
            });
        }

        // Check if contract is already terminated
        if (contract.status === 'Terminated') {
            return reply.code(400).send({
                success: false,
                error: 'Contract is already terminated'
            });
        }

        // Validate termination date
        let effectiveTerminationDate;
        if (effectiveImmediately) {
            effectiveTerminationDate = new Date();
        } else {
            effectiveTerminationDate = new Date(terminationDate);

            if (isNaN(effectiveTerminationDate.getTime())) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid termination date format'
                });
            }

            // Termination date cannot be before contract start date
            if (effectiveTerminationDate < contract.startDate) {
                return reply.code(400).send({
                    success: false,
                    error: 'Termination date cannot be before contract start date'
                });
            }
        }

        // Update the contract
        const updateData = {
            status: 'Terminated',
            endDate: effectiveTerminationDate,
            updatedBy: request.user ? request.user._id : null
        };

        // Add termination metadata if you want to track it
        // You might want to add these fields to your schema:
        // terminationDate: Date,
        // terminationReason: String,
        // terminatedBy: ObjectId

        console.log('Updating contract with:', updateData);

        // Update the contract
        const updatedContract = await levyContractModel.findByIdAndUpdate(
            contractId,
            updateData,
            { new: true, runValidators: true }
        );

        // Try to populate the updated contract
        try {
            const populatedContract = await levyContractModel.findById(updatedContract._id)
                .populate({
                    path: 'levyId',
                    model: levyModel,
                    select: 'levyName amount billingType glAccounts'
                })
                .populate({
                    path: 'customerId',
                    model: customerModel,
                    select: 'firstName lastName'
                })
                .populate({
                    path: 'unitId',
                    model: unitModel,
                    select: 'name'
                });

            return reply.code(200).send({
                success: true,
                message: 'Levy contract terminated successfully',
                contract: populatedContract,
                terminationInfo: {
                    terminationDate: effectiveTerminationDate,
                    terminationReason: terminationReason || 'Not specified',
                    terminatedBy: request.user ? request.user._id : null
                }
            });

        } catch (populateError) {
            console.log('Population failed, returning basic contract:', populateError.message);

            return reply.code(200).send({
                success: true,
                message: 'Levy contract terminated successfully',
                contract: updatedContract,
                terminationInfo: {
                    terminationDate: effectiveTerminationDate,
                    terminationReason: terminationReason || 'Not specified',
                    terminatedBy: request.user ? request.user._id : null
                }
            });
        }

    } catch (err) {
        console.error('Error in terminateLevyContract:', err);

        // Handle validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => error.message);
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Handle cast errors (invalid ObjectId)
        if (err.name === 'CastError') {
            return reply.code(400).send({
                success: false,
                error: 'Invalid contract ID format'
            });
        }

        // Handle other errors
        return reply.code(500).send({
            success: false,
            error: 'Failed to terminate levy contract',
            details: err.message
        });
    }
};

module.exports = terminateLevyContract;