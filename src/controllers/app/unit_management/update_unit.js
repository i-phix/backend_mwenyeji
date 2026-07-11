const payservedb = require('payservedb');
const { getModel } = require("../../../utils/getModel");

const update_unit = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const { 
            unitName, 
            division, 
            floorUnit, 
            unitType, 
            lrNumber, 
            isManagedByPropertyManager,
            propertyManagementFee 
        } = request.body;

        const query = { _id: unitId, facilityId };
        
        // Build update data object
        const data = {
            name: unitName,
            division,
            unitType,
            floorUnitNo: floorUnit,
            landRateNumber: lrNumber,
            isManagedByPropertyManager: Boolean(isManagedByPropertyManager)
        };

        const unitModel = await getModel("Unit", payservedb.Unit.schema, facilityId);

        const existingUnitName = await unitModel.findOne({ name: unitName, facilityId });
        if (existingUnitName && existingUnitName._id.toString() !== unitId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Unit name already exists' 
            });
        }

        // Handle propertyManagementFee based on management status
        if (isManagedByPropertyManager) {
            if (propertyManagementFee !== undefined && propertyManagementFee !== null) {
                const feeValue = parseFloat(propertyManagementFee);
                if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
                    return reply.code(400).send({ 
                        success: false,
                        error: 'Property management fee must be a number between 0 and 100 (0% to 100%)' 
                    });
                }
                data.propertyManagementFee = feeValue;
            }
        } else {
            // Clear fee if not managed by property manager
            data.propertyManagementFee = null;
        }

        // Check if unit exists
        const existingUnit = await unitModel.findOne(query);
        if (!existingUnit) {
            return reply.code(404).send({ 
                success: false,
                error: 'Unit not found' 
            });
        }

        // Update the unit
        const result = await unitModel.updateOne(query, { $set: data });
        
        if (result.modifiedCount === 0) {
            return reply.code(400).send({ 
                success: false,
                error: 'No changes made to the unit' 
            });
        }
        
        return reply.code(200).send({
            success: true,
            message: 'Unit updated successfully',
            data: {
                unitId,
                updatedFields: Object.keys(data)
            }
        });
        
    } catch (err) {
        console.error('Error updating unit:', err);
        return reply.code(502).send({ 
            success: false,
            error: err.message 
        });
    }
};

module.exports = update_unit;