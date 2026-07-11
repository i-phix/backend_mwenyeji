const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

const add_penalty = async (request, reply) => {
    try {
        logger.info('Adding penalty for facilityId:', request.params.facilityId);

        const { name, type, effectDays, percentage, amount, isActive } = request.body;
        const { facilityId } = request.params;

        if (!name || !type || !effectDays || !percentage || !amount || !isActive) {
            logger.error('Missing required fields in request body');
            return reply.code(400).send({ error: 'Missing required fields in request body' });
        }

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        const penaltyExist = await penaltyModel.findOne({ name });

        if (penaltyExist) {
            logger.error('Penalty already exists for name:', name);
            throw new Error('Penalty already exists.')
        } else {
            let data = new penaltyModel({
                facilityId, name, type, effectDays, percentage, amount, isActive
            })

            logger.debug('Saving penalty data:', data);

            const response = await data.save();

            logger.info('Penalty added successfully:', response);

            return reply.code(200).send('Penalty has been added.')
        }
    } catch (err) {
        logger.error('Error adding penalty:', err);
        return reply.code(502).send({ error: err.message });
    }
}

module.exports = add_penalty

