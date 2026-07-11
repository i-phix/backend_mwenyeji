const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const editDepartment = async (request, reply) => {
  try {
    const { facilityId, departmentId } = request.params;
    const { name } = request.body;

    // Retrieve the facility-specific department model
    const departmentModel = await getModel("FacilityDepartment", payservedb.FacilityDepartment.schema, facilityId);

    // Check if department exists
    const department = await departmentModel.findById(departmentId);
    if (!department) {
      return reply.code(404).send({
        error: "Department not found"
      });
    }

    // Update the department
    const updatedDepartment = await departmentModel.findByIdAndUpdate(
      departmentId,
      { name },
      { new: true, runValidators: true }
    );

    return reply.code(200).send({
      message: "Department updated successfully",
      department: updatedDepartment
    });
  } catch (err) {
    console.error("Error in editDepartment:", err);
    if (err.code === 11000) {
      return reply.code(400).send({
        error: "Department name already exists"
      });
    }
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = editDepartment;