const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetCampaigns = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({ error: 'Facility ID is required' });
        }

        const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);
        const campaigns = await campaignModel.find({});

        return reply.code(200).send(campaigns);
    } catch (err) {
        console.error('Error in retrieving campaigns:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetCampaigns;


