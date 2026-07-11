const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");

const updateSingleChild = async (request, reply) => {
  try {
    const { facilityId, parentId, childName } = request.params;
    const { parentName, value, date, checklistDate } = request.body;

    const schema = Joi.object({
      parentName: Joi.string().required(), // Parent name now comes from body
      value: Joi.alternatives()
        .try(Joi.string(), Joi.number(), Joi.boolean())
        .required(),
      date: Joi.date().optional(),
      checklistDate: Joi.date().optional(),
    });

    const { error } = schema.validate({
      parentName,
      value,
      date,
      checklistDate,
    });

    if (error) {
      return reply.code(400).send({ error: error.details[0].message });
    }

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    // Find checklist by ID instead of date
    let checklist = await checklistModel.findById(parentId);

    if (!checklist) {
      return reply.code(404).send({
        error: "Checklist not found with the provided parent ID",
      });
    }

    if (!checklist.hasParent(parentName)) {
      return reply.code(404).send({
        error: `Parent '${parentName}' not found`,
      });
    }

    // Check if child exists
    const existingChild = checklist.getChildWithDate(parentName, childName);
    if (!existingChild) {
      return reply.code(404).send({
        error: `Child '${childName}' not found in parent '${parentName}'`,
      });
    }

    // Update the child
    const defaultDate = checklistDate ? new Date(checklistDate) : new Date();
    const childDate = date ? new Date(date) : defaultDate;
    checklist.setValue(parentName, childName, value, childDate);

    const updatedChecklist = await checklist.save();

    return reply.code(200).send({
      message: `Child '${childName}' updated in parent '${parentName}'`,
      checklist: updatedChecklist,
      parentName,
      childName,
      previousValue: existingChild.value,
      newValue: value,
    });
  } catch (err) {
    console.error("Error in updateSingleChild:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  updateSingleChild,
};
