// const payservedb = require('payservedb');
// const { getModel } = require('../../../utils/getModel');

// const ReleaseUnitField = async (request, reply) => {
//     try {
//         const { facilityId, unitId } = request.params;
//         const { updates } = request.body;

//         // Ensure the model is correctly retrieved
//         const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

//         // Convert empty strings to null to avoid BSON ObjectId casting error
//         Object.keys(updates).forEach((key) => {
//             if (updates[key] === "") {
//                 updates[key] = null; // Set to null instead of an empty string
//             }
//         });

//         const updatedUnit = await unitModel.findByIdAndUpdate(unitId, { $set: updates }, { new: true });

//         if (!updatedUnit) {
//             return reply.code(404).send({ error: "Unit not found." });
//         }

//         return reply.code(200).send({ success: true, message: "Unit field updated successfully", data: updatedUnit });

//     } catch (err) {
//         console.error('Error updating unit field:', err);
//         return reply.code(400).send({ error: err.message });
//     }
// };

// module.exports = ReleaseUnitField;


const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const ReleaseUnitField = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const { updates } = request.body;

        // Retrieve the Unit model
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Fetch the existing unit
        const unit = await unitModel.findById(unitId);
        if (!unit) {
            return reply.code(404).send({ error: "Unit not found." });
        }

        // Check if residentId is being removed and update the corresponding customer
        if (updates.hasOwnProperty("residentId") && unit.residentId) {
            // Find the customer associated with the residentId
            const customer = await payservedb.Customer.findById(unit.residentId);
            if (customer) {
                // Update the residentType to 'non-resident'
                await payservedb.Customer.findByIdAndUpdate(unit.residentId, { $set: { residentType: "non-resident" } });
            }
        }

        // Convert empty strings to null before updating the unit
        Object.keys(updates).forEach((key) => {
            if (updates[key] === "") {
                updates[key] = null;
            }
        });

        // Update the unit
        const updatedUnit = await unitModel.findByIdAndUpdate(unitId, { $set: updates }, { new: true });

        return reply.code(200).send({ success: true, message: "Unit field updated successfully", data: updatedUnit });

    } catch (err) {
        console.error('Error updating unit field:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = ReleaseUnitField;


