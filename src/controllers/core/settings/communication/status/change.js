const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const get_facility = require("../../../../core/facility_management/get_facility");

const addFacilityQueue = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { emailStatus, smsStatus } = request.body;

    

    const communicationStatusModel = await getModel(
      "CommunicationStatus",
      payservedb.CommunicationStatus.schema,
      facilityId,
    );

    // Check if status already exists for this facility
    const existingStatus = await communicationStatusModel.findOne({
      facilityId,
    });

    if (existingStatus) {
      return reply.code(400).send({
        error: "Communication status already exists for this facility",
        existingStatus,
      });
    }

    const communicationStatus = await communicationStatusModel.create({
      emailStatus,
      smsStatus,
      facilityId,
    });

    reply.code(201).send(communicationStatus);
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
};

const updateFacilityQueue = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { emailStatus, smsStatus } = request.body;

    // Fixed: Use CommunicationStatus model
    const communicationStatusModel = await getModel(
      "CommunicationStatus",
      payservedb.CommunicationStatus.schema,
      facilityId,
    );

    const communicationStatus = await communicationStatusModel.findOne({
      facilityId,
    });
    if (!communicationStatus) {
      return reply.code(404).send({ error: "Communication status not found" });
    }

    communicationStatus.emailStatus = emailStatus;
    communicationStatus.smsStatus = smsStatus;
    await communicationStatus.save();

    reply.code(200).send(communicationStatus);
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
};

module.exports = {
  addFacilityQueue,
  updateFacilityQueue,
};
