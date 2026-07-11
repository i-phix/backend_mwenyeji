const utilityDb = require('../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const updateAnalogMeter = async (request, reply) => {
    try {
        const { facilityId, meterId } = request.params;
        const updateData = request.body;
        
        if (!meterId) {
            return reply.code(400).send({
                success: false,
                error: 'Meter ID is required'
            });
        }
        
        // Get the WaterMeter model from utility database
        const analogMeterModel = await utilityDb.getModel('WaterMeter');
        
        // First retrieve the current meter
        const meter = await analogMeterModel.findById(meterId);
        
        if (!meter) {
            return reply.code(404).send({
                success: false,
                error: 'Analog meter not found'
            });
        }
        
        const safeUpdateData = { ...updateData };
        
        // Remove fields that shouldn't be updated through this endpoint
        delete safeUpdateData.previousReading;
        delete safeUpdateData.initialReading;
        delete safeUpdateData.currentReading; 
        delete safeUpdateData.readingHistory; 
        delete safeUpdateData.accountNumber; 
        delete safeUpdateData.facilityId; 
        
        // If meterNumber is being updated, check for duplicates
        if (safeUpdateData.meterNumber && safeUpdateData.meterNumber !== meter.meterNumber) {
            const existingMeter = await analogMeterModel.findOne({ 
                meterNumber: safeUpdateData.meterNumber, 
                facilityId,
                _id: { $ne: meterId } 
            });
            
            if (existingMeter) {
                return reply.code(400).send({
                    success: false,
                    error: 'A meter with this meter number already exists'
                });
            }
        }
        
        // If unitId is being updated, validate it exists in payserve database
        if (safeUpdateData.unitId && safeUpdateData.unitId !== meter.unitId) {
            try {
                const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                const unitExists = await unitModel.findById(safeUpdateData.unitId);
                
                if (!unitExists) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Selected unit does not exist'
                    });
                }
                
                // Check if another meter is already assigned to this unit
                const existingMeterOnUnit = await analogMeterModel.findOne({ 
                    unitId: safeUpdateData.unitId,
                    facilityId,
                    _id: { $ne: meterId } 
                });
                
                if (existingMeterOnUnit) {
                    return reply.code(400).send({
                        success: false,
                        error: 'Another meter is already assigned to this unit'
                    });
                }
            } catch (unitError) {
                return reply.code(400).send({
                    success: false,
                    error: 'Failed to validate unit: ' + unitError.message
                });
            }
        }
        
        // If customerId and unitId combination is being updated, check for duplicates
        const newCustomerId = safeUpdateData.customerId || meter.customerId;
        const newUnitId = safeUpdateData.unitId || meter.unitId;
        
        if (newCustomerId && (safeUpdateData.customerId || safeUpdateData.unitId)) {
            const existingCustomerUnit = await analogMeterModel.findOne({ 
                customerId: newCustomerId, 
                unitId: newUnitId,
                facilityId,
                _id: { $ne: meterId } 
            });
            
            if (existingCustomerUnit) {
                return reply.code(400).send({
                    success: false,
                    error: 'A meter for this customer and unit combination already exists'
                });
            }
        }
        
        // Update the meter in utility database
        const updatedMeter = await analogMeterModel.findByIdAndUpdate(
            meterId,
            safeUpdateData,
            { new: true }
        );
        
        // Get additional information for response (customer and unit info)
        let customerInfo = null;
        let unitInfo = null;
        
        // Get customer info if customerId exists
        if (updatedMeter.customerId) {
            try {
                const customer = await payservedb.Customer.findById(updatedMeter.customerId);
                if (customer) {
                    customerInfo = {
                        _id: customer._id,
                        fullName: `${customer.firstName} ${customer.lastName}`,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        phoneNumber: customer.phoneNumber
                    };
                }
            } catch (customerError) {
                console.warn('Failed to fetch customer info:', customerError.message);
            }
        }
        
        // Get unit info if unitId exists
        if (updatedMeter.unitId) {
            try {
                const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                const unit = await unitModel.findById(updatedMeter.unitId);
                if (unit) {
                    unitInfo = {
                        _id: unit._id,
                        name: unit.name,
                        unitNumber: unit.unitNumber
                    };
                }
            } catch (unitError) {
                console.warn('Failed to fetch unit info:', unitError.message);
            }
        }
        
        // Combine the meter data with additional information
        const meterWithInfo = {
            ...updatedMeter.toObject(),
            CustomerInfo: customerInfo,
            UnitInfo: unitInfo
        };
        
        return reply.code(200).send({
            success: true,
            message: 'Analog meter updated successfully',
            data: meterWithInfo
        });
    } catch (err) {
        console.error('Error in updating analog meter:', err);
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = updateAnalogMeter;