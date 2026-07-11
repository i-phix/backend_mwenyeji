const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const GetCommunityGuidelines = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const communityGuidelines = await getModel(
      "CommunityGuidelines",
      payservedb.CommunityGuidelines.schema,
      facilityId
    );

    const guidelines = await communityGuidelines.findOne({ facilityId });

    if (!guidelines) {
      return reply.code(404).send({
        success: false,
        error: "Community Guidelines not found"
      });
    }

    return reply.code(200).send({
      success: true,
      guidelines,
    });
  } catch (err) {
    console.error("Error in GetCommunityGuidelines:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = GetCommunityGuidelines;
