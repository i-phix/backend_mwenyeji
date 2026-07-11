const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const GetOneCampaign = async (request, reply) => {
    try {
        const { facilityId, campaignId } = request.params;

        if (!facilityId || !campaignId) {
            return reply.code(400).send({ error: 'Facility ID and Campaign ID are required' });
        }

        const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);

        const campaign = await campaignModel.findById(campaignId);

        if (!campaign) {
            return reply.code(404).send({ error: 'Campaign not found' });
        }

        return reply.code(200).send(campaign);
    } catch (err) {
        console.error('Error in retrieving campaign:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = GetOneCampaign;
