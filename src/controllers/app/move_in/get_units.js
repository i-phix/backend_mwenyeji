const db = require('payservedb');
const logger = require('../../../../config/winston');
const { getFacilityAndUnit, mapUnitForMoveIn } = require('./helpers');

const get_units = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { facility, UnitModel } = await getFacilityAndUnit({ facilityId });

        const units = await UnitModel.find({}).lean();
        const data = units.map((unit) => mapUnitForMoveIn({ unit, facility }));

        return reply.code(200).send({
            success: true,
            data,
            facility: {
                _id: facility._id,
                name: facility.name,
                location: facility.location || null,
            },
        });
    } catch (err) {
        logger.error('[app/move_in/get_units] ' + err.message);
        return reply.code(err.statusCode || 502).send({ error: err.message });
    }
};

module.exports = get_units;
