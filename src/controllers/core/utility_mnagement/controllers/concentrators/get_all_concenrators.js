const payservedb = require('payservedb');
const logger = require('../../../../../../config/winston');

const get_concentrators = async (request, reply) => {
    try {
        const concentrators = await payservedb.Concentrator.find({});

        const concentratorsWithInfo = await Promise.all(
            concentrators.map(async (concentrator) => {
                let manufacturer = null;
                if (concentrator.manufacturer) {
                    manufacturer = await payservedb.MeterManufacturer.findById(concentrator.manufacturer);
                }

                return {
                    ...concentrator.toObject(),
                    ManufacturerInfo: manufacturer
                        ? {
                            name: manufacturer.name,
                        }
                        : null
                };
            })
        );

        return reply.code(200).send({
            message: 'Concentrators retrieved successfully',
            concentrators: concentratorsWithInfo
        });
    } catch (err) {
        logger.error('Error in retrieving concentrators:', err);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_concentrators;
