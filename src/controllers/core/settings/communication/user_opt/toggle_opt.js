const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const toggle_opt = async (request, reply) => {
    try {
        const { facilityId, userId } = request.params;
        const { sms, email } = request.body;

        // Get the tenant-specific model for CommunicationUserOpt
        const CommunicationUserOptModel = await getModel(
            "CommunicationUserOpt",
            payservedb.CommunicationUserOpt.schema,
            facilityId
        );

        // Check if user opt record already exists
        let userOpt = await CommunicationUserOptModel.findOne({
            user_id: userId
        });

        if (userOpt) {
            // Update existing preferences
            if (sms !== undefined) {
                userOpt.sms = sms;
            }
            if (email !== undefined) {
                userOpt.email = email;
            }
            await userOpt.save();
        } else {
            // Create new user opt record with provided preferences or defaults
            userOpt = await CommunicationUserOptModel.create({
                user_id: userId,
                sms: sms !== undefined ? sms : true,
                email: email !== undefined ? email : true
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'Communication preferences updated successfully',
            preferences: {
                sms: userOpt.sms,
                email: userOpt.email
            }
        });

    } catch (error) {
        console.error('Error in toggle_opt:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

module.exports = toggle_opt;