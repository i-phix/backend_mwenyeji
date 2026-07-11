const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");

const getFacilityStatus = async (request, reply) => {
  try {
    // Only need facilityId since there's one communication status per facility
    const { facilityId } = request.params;

    // Extract facility logic directly instead of calling get_facility
    const facility = await payservedb.Facility.findById(facilityId);
    if (!facility) {
      return reply.code(404).send({ error: `Facility doesn't exist` });
    }
    console.log("==================");
    console.log("==================");
    console.log(facility);
    console.log("==================");
    console.log("==================");

    const communicationStatusModel = await getModel(
      "CommunicationStatus",
      payservedb.CommunicationStatus.schema,
      facilityId,
    );

    // Find by facilityId instead of by ID
    const communicationStatus = await communicationStatusModel.findOne({
      facilityId,
    });

    if (!communicationStatus) {
      return reply
        .code(404)
        .send({ message: "Communication status not found for this facility" });
    }

    return reply.code(200).send({
      emailStatus: communicationStatus.emailStatus,
      smsStatus: communicationStatus.smsStatus,
      facilityId: communicationStatus.facilityId,
    });
  } catch (error) {
    return reply.code(500).send({ message: error.message });
  }
};

module.exports = {
  getFacilityStatus,
};
