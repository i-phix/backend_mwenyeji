const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const addDepartment = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { name } = request.body;

    if (!name) {
      return reply.code(400).send({
        error: "Department name is required"
      });
    }

    const departmentModel = await getModel(
      "FacilityDepartment",
      payservedb.FacilityDepartment.schema,
      facilityId
    );

    const savedDepartment = await departmentModel.create({
      facilityId,
      name
    });

    return reply.code(200).send({
      message: "Department added successfully",
      department: savedDepartment,
    });
  } catch (err) {
    console.error("Error in addDepartment:", err);
    if (err.code === 11000) {
      return reply.code(400).send({
        error: "Department name already exists"
      });
    }
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addDepartment;