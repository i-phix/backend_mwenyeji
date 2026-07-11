const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const get_user_opt = async (request, reply) => {
  try {
    const { facilityId, userId } = request.params;

    // Get the tenant-specific model for CommunicationUserOpt
    const CommunicationUserOptModel = await getModel(
      "CommunicationUserOpt",
      payservedb.CommunicationUserOpt.schema,
      facilityId
    );

    // Find user communication preferences
    const userOpt = await CommunicationUserOptModel.findOne({
      user_id: userId
    });

    if (!userOpt) {
      return reply.code(404).send({
        success: false,
        message: "User communication preferences not found",
        data: null
      });
    }

    return reply.code(200).send({
      success: true,
      message: "User communication preferences found",
      data: {
        user_id: userOpt.user_id,
        sms: userOpt.sms,
        email: userOpt.email,
        createdAt: userOpt.createdAt,
        updatedAt: userOpt.updatedAt
      }
    });

  } catch (error) {
    console.error('Error in get_user_opt:', error);
    return reply.code(500).send({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

module.exports = get_user_opt;