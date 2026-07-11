const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");

const addDailyChecklist = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { data, checklistDate } = request.body;

    // Validation schema
    const childSchema = Joi.object({
      value: Joi.alternatives()
        .try(Joi.string(), Joi.number(), Joi.boolean())
        .required(),
      date: Joi.date().optional(),
    });

    const parentSchema = Joi.object().pattern(
      Joi.string(), // child name
      childSchema,
    );

    const schema = Joi.object({
      data: Joi.object()
        .pattern(
          Joi.string(), // parent name
          parentSchema,
        )
        .required(),
      checklistDate: Joi.date().optional(),
    });

    const { error } = schema.validate({
      data,
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

    // Check if checklist for this date already exists
    const defaultDate = checklistDate ? new Date(checklistDate) : new Date();
    const startOfDay = new Date(defaultDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(defaultDate);
    endOfDay.setHours(23, 59, 59, 999);

    let existingChecklist = await checklistModel.findOne({
      facilityId,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (existingChecklist) {
      // Update existing checklist
      Object.keys(data).forEach((parentName) => {
        Object.keys(data[parentName]).forEach((childName) => {
          const childData = data[parentName][childName];
          const date = childData.date ? new Date(childData.date) : defaultDate;

          existingChecklist.setValue(
            parentName,
            childName,
            childData.value,
            date,
          );
        });
      });

      const updatedChecklist = await existingChecklist.save();

      return reply.code(200).send({
        message: "Daily checklist updated successfully",
        checklist: updatedChecklist,
        isUpdate: true,
      });
    } else {
      // Create new checklist
      const newChecklist = new checklistModel({
        facilityId,
      });

      // Add all data using the schema methods
      Object.keys(data).forEach((parentName) => {
        Object.keys(data[parentName]).forEach((childName) => {
          const childData = data[parentName][childName];
          const date = childData.date ? new Date(childData.date) : defaultDate;

          newChecklist.setValue(parentName, childName, childData.value, date);
        });
      });

      const savedChecklist = await newChecklist.save();

      return reply.code(201).send({
        message: "Daily checklist created successfully",
        checklist: savedChecklist,
        isUpdate: false,
      });
    }
  } catch (err) {
    console.error("Error in addDailyChecklist:", err);
    return reply.code(400).send({ error: err.message });
  }
};

const createParent = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { parentName, checklistDate } = request.body;

    const schema = Joi.object({
      parentName: Joi.string().required(),
      checklistDate: Joi.date().optional(),
    });

    const { error } = schema.validate({ parentName, checklistDate });
    if (error) {
      return reply.code(400).send({ error: error.details[0].message });
    }

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    // Check if parent name already exists across ALL checklists for this facility
    const existingParentCheck = await checklistModel.findOne({
      facilityId,
      [`data.${parentName}`]: { $exists: true },
    });

    if (existingParentCheck) {
      return reply.code(400).send({
        error: `Parent '${parentName}' already exists in facility. Parent names must be unique across all checklists.`,
        existingChecklistId: existingParentCheck._id,
      });
    }

    // Check if checklist for this date already exists
    const defaultDate = checklistDate ? new Date(checklistDate) : new Date();
    const startOfDay = new Date(defaultDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(defaultDate);
    endOfDay.setHours(23, 59, 59, 999);

    let existingChecklist = await checklistModel.findOne({
      facilityId,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (existingChecklist) {
      // Add parent to existing checklist (we already checked uniqueness above)
      existingChecklist.createParent(parentName);
      const updatedChecklist = await existingChecklist.save();

      return reply.code(200).send({
        message: `Parent '${parentName}' added to existing checklist`,
        checklist: updatedChecklist,
        parentName,
        isUpdate: true,
        checklistId: updatedChecklist._id,
      });
    } else {
      // Create new checklist with parent
      const newChecklist = new checklistModel({
        facilityId,
      });

      newChecklist.createParent(parentName);
      const savedChecklist = await newChecklist.save();

      return reply.code(201).send({
        message: `New checklist created with parent '${parentName}'`,
        checklist: savedChecklist,
        parentName,
        isUpdate: false,
        checklistId: savedChecklist._id,
      });
    }
  } catch (err) {
    console.error("Error in createParent:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller to add children to existing parent
const addChildrenToParent = async (request, reply) => {
  try {
    const { facilityId, parentId } = request.params;
    const { parentName, children, checklistDate } = request.body;

    const childSchema = Joi.object({
      value: Joi.alternatives()
        .try(Joi.string(), Joi.number(), Joi.boolean())
        .required(),
      date: Joi.date().optional(),
    });

    const schema = Joi.object({
      parentName: Joi.string().required(), // Parent name now comes from body
      children: Joi.object()
        .pattern(
          Joi.string(), // child name
          childSchema,
        )
        .required(),
      checklistDate: Joi.date().optional(),
    });

    const { error } = schema.validate({ parentName, children, checklistDate });

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

    // Check if parent exists, if not create it
    if (!checklist.hasParent(parentName)) {
      checklist.createParent(parentName);
    }

    // Add all children
    const defaultDate = checklistDate ? new Date(checklistDate) : new Date();
    Object.keys(children).forEach((childName) => {
      const childData = children[childName];
      const date = childData.date ? new Date(childData.date) : defaultDate;

      checklist.setValue(parentName, childName, childData.value, date);
    });

    const updatedChecklist = await checklist.save();

    return reply.code(200).send({
      message: `${Object.keys(children).length} children added to parent '${parentName}'`,
      checklist: updatedChecklist,
      parentName,
      childrenAdded: Object.keys(children),
    });
  } catch (err) {
    console.error("Error in addChildrenToParent:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller to add single child to existing parent
const addSingleChild = async (request, reply) => {
  try {
    const { facilityId, parentId } = request.params;
    const { parentName, childName, value, date, checklistDate } = request.body;

    const schema = Joi.object({
      parentName: Joi.string().required(), // Parent name now comes from body
      childName: Joi.string().required(),
      value: Joi.alternatives()
        .try(Joi.string(), Joi.number(), Joi.boolean())
        .required(),
      date: Joi.date().optional(),
      checklistDate: Joi.date().optional(),
    });

    const { error } = schema.validate({
      parentName,
      childName,
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

    // Check if parent exists, if not create it
    if (!checklist.hasParent(parentName)) {
      checklist.createParent(parentName);
    }

    // Check if child already exists
    const existingChild = checklist.getChildWithDate(parentName, childName);
    if (existingChild) {
      return reply.code(400).send({
        error: `Child '${childName}' already exists in parent '${parentName}'`,
      });
    }

    // Add the child
    const defaultDate = checklistDate ? new Date(checklistDate) : new Date();
    const childDate = date ? new Date(date) : defaultDate;
    checklist.setValue(parentName, childName, value, childDate);

    const updatedChecklist = await checklist.save();

    return reply.code(200).send({
      message: `Child '${childName}' added to parent '${parentName}'`,
      checklist: updatedChecklist,
      parentName,
      childName,
      value,
    });
  } catch (err) {
    console.error("Error in addSingleChild:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  addDailyChecklist,
  createParent,
  addChildrenToParent,
  addSingleChild,
};
