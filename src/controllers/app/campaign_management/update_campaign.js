const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const EditCampaign = async (request, reply) => {
    try {
        const { facilityId, campaignId } = request.params;
        const {
            name,
            objective,
            description,
            startDate,
            endDate,
            targetAudience,
            channels
        } = request.body;

        const campaignModel = await getModel('Campaign', payservedb.Campaign.schema, facilityId);

        // Find the existing campaign
        const campaign = await campaignModel.findById(campaignId);
        if (!campaign) {
            return reply.code(404).send({ error: 'Campaign not found' });
        }

        // Update only the provided fields
        campaign.name = name || campaign.name;
        campaign.objective = objective || campaign.objective;
        campaign.description = description || campaign.description;
        campaign.startDate = startDate || campaign.startDate;
        campaign.endDate = endDate || campaign.endDate;
        campaign.targetAudience = targetAudience || campaign.targetAudience;
        campaign.channels = channels || campaign.channels;

        // Save the updated campaign
        await campaign.save();

        return reply.code(200).send({ message: 'Campaign updated successfully', campaign });
    } catch (err) {
        console.error('Error in updating campaign:', err);
        return reply.code(400).send({ error: err.message });
    }
}

module.exports = EditCampaign;
