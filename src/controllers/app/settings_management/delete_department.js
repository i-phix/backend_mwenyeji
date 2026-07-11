const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const deleteDepartment = async (request, reply) => {
  try {
    const { facilityId, departmentId } = request.params;

    if (!departmentId) {
      return reply.code(400).send({
        error: "Department ID is required"
      });
    }

    // Retrieve the facility-specific department model
    const departmentModel = await getModel("FacilityDepartment", payservedb.FacilityDepartment.schema, facilityId);

    // Retrieve the department document using the facility-specific model
    const department = await departmentModel.findById(departmentId);
    if (!department) {
      return reply.code(404).send({
        error: "Department not found"
      });
    }

    const deletedDepartment = await departmentModel.findByIdAndDelete(departmentId);

    return reply.code(200).send({
      message: "Department deleted successfully",
      department: deletedDepartment
    });
  } catch (err) {
    console.error("Error in deleteDepartment:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = deleteDepartment;