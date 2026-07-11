const payservedb = require("payservedb");

const { getModel } = require("../../../../../utils/getModel");

const addMaintenanceService = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { name } = request.body;

    const serviceModel = await getModel(
      "MaintenanceService",
      payservedb.MaintenanceService.schema,
      facilityId,
    );

    const newService = await serviceModel.create({
      facilityId,
      name,
    });

    return reply.code(200).send({
      message: "Maintenance service added successfully",
      service: newService,
    });
  } catch (err) {
    console.error("Error in addMaintenanceService:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addMaintenanceService;
