const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const ReleaseUnit = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;

        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        const updatedUnit = await unitModel.findByIdAndUpdate(
            unitId,
            { $set: { homeOwnerId: null, residentId: null, tenantId: null } }, // Set to null
            { new: true }
        );

        if (!updatedUnit) {
            return reply.code(404).send({ error: "Unit not found." });
        }

        return reply.code(200).send({ success: true, message: "Unit released successfully", data: updatedUnit });

    } catch (err) {
        console.error('Error releasing unit:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = ReleaseUnit;
