const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");

// Controller to add new reading to existing child
const addReading = async (request, reply) => {
  try {
    const { facilityId, parentId } = request.params;
    const { parentName, childName, value, date, unit, recordedBy, notes } =
      request.body;

    const schema = Joi.object({
      parentName: Joi.string().required(),
      childName: Joi.string().required(),
      value: Joi.alternatives()
        .try(Joi.string(), Joi.number(), Joi.boolean())
        .required(),
      date: Joi.date().optional(),
      unit: Joi.string().optional(),
      recordedBy: Joi.string().optional(),
      notes: Joi.string().optional(),
    });

    const { error } = schema.validate({
      parentName,
      childName,
      value,
      date,
      unit,
      recordedBy,
      notes,
    });

    if (error) {
      return reply.code(400).send({ error: error.details[0].message });
    }

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let checklist = await checklistModel.findById(parentId);

    if (!checklist) {
      return reply.code(404).send({
        error: "Checklist not found with the provided ID",
      });
    }

    // Add new reading
    const readingDate = date ? new Date(date) : new Date();
    const metadata = {
      unit: unit || undefined,
      recordedBy: recordedBy || request.user?.id,
      notes: notes || undefined,
    };

    checklist.addReading(parentName, childName, value, readingDate, metadata);
    const updatedChecklist = await checklist.save();

    return reply.code(200).send({
      message: `New reading added for '${childName}' in '${parentName}'`,
      checklist: updatedChecklist,
      newReading: {
        parentName,
        childName,
        value,
        date: readingDate,
        metadata,
      },
    });
  } catch (err) {
    console.error("Error in addReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller to get reading history for a specific child
const getReadingHistory = async (request, reply) => {
  try {
    const { facilityId, parentId, parentName, childName } = request.params;
    const { limit, startDate, endDate } = request.query;

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let checklist = await checklistModel.findById(parentId);

    if (!checklist) {
      return reply.code(404).send({
        error: "Checklist not found",
      });
    }

    let readings;

    if (startDate && endDate) {
      readings = checklist.getReadingsByDateRange(
        parentName,
        childName,
        startDate,
        endDate,
      );
    } else {
      readings = checklist.getReadingHistory(
        parentName,
        childName,
        limit ? parseInt(limit) : null,
      );
    }

    const statistics = checklist.getChildStatistics(parentName, childName);

    return reply.code(200).send({
      message: `Reading history for '${childName}' in '${parentName}'`,
      parentName,
      childName,
      readings,
      statistics,
      totalReadings: readings.length,
    });
  } catch (err) {
    console.error("Error in getReadingHistory:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller to update a specific reading
const updateReading = async (request, reply) => {
  try {
    const { facilityId, parentId, parentName, childName, readingId } =
      request.params;
    const { value, date, notes } = request.body;

    const schema = Joi.object({
      value: Joi.alternatives()
        .try(Joi.string(), Joi.number(), Joi.boolean())
        .optional(),
      date: Joi.date().optional(),
      notes: Joi.string().optional(),
    });

    const { error } = schema.validate({ value, date, notes });

    if (error) {
      return reply.code(400).send({ error: error.details[0].message });
    }

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let checklist = await checklistModel.findById(parentId);

    if (!checklist) {
      return reply.code(404).send({
        error: "Checklist not found",
      });
    }

    const updates = {};
    if (value !== undefined) updates.value = value;
    if (date) updates.date = new Date(date);
    if (notes !== undefined) updates.notes = notes;

    const success = checklist.updateReading(
      parentName,
      childName,
      readingId,
      updates,
    );

    if (!success) {
      return reply.code(404).send({
        error: "Reading not found",
      });
    }

    const updatedChecklist = await checklist.save();

    return reply.code(200).send({
      message: `Reading updated for '${childName}' in '${parentName}'`,
      checklist: updatedChecklist,
      updatedReading: {
        readingId,
        updates,
      },
    });
  } catch (err) {
    console.error("Error in updateReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller to delete a reading (soft delete)
const deleteReading = async (request, reply) => {
  try {
    const { facilityId, parentId, parentName, childName, readingId } =
      request.params;

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let checklist = await checklistModel.findById(parentId);

    if (!checklist) {
      return reply.code(404).send({
        error: "Checklist not found",
      });
    }

    const success = checklist.deleteReading(parentName, childName, readingId);

    if (!success) {
      return reply.code(404).send({
        error: "Reading not found",
      });
    }

    const updatedChecklist = await checklist.save();

    return reply.code(200).send({
      message: `Reading deleted for '${childName}' in '${parentName}'`,
      checklist: updatedChecklist,
      deletedReadingId: readingId,
    });
  } catch (err) {
    console.error("Error in deleteReading:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller to get current values (latest readings)
const getCurrentValues = async (request, reply) => {
  try {
    const { facilityId, parentId } = request.params;
    const { parentName } = request.query;

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let checklist = await checklistModel.findById(parentId);

    if (!checklist) {
      return reply.code(404).send({
        error: "Checklist not found",
      });
    }

    let result = {};

    if (parentName) {
      // Get current values for specific parent
      const parent = checklist.data.get(parentName);
      if (parent) {
        result[parentName] = parent.map((child) => ({
          name: child.name,
          currentValue: child.currentValue,
          currentDate: child.currentDate,
          unit: child.unit,
          totalReadings: child.readings.filter((r) => r.isActive).length,
        }));
      }
    } else {
      // Get current values for all parents
      for (const [pName, children] of checklist.data) {
        result[pName] = children.map((child) => ({
          name: child.name,
          currentValue: child.currentValue,
          currentDate: child.currentDate,
          unit: child.unit,
          totalReadings: child.readings.filter((r) => r.isActive).length,
        }));
      }
    }

    return reply.code(200).send({
      message: "Current values retrieved successfully",
      currentValues: result,
    });
  } catch (err) {
    console.error("Error in getCurrentValues:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Legacy controllers (updated to work with new schema)
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
      if (existingChecklist.hasParent(parentName)) {
        return reply.code(400).send({
          error: `Parent '${parentName}' already exists for this date`,
        });
      }

      existingChecklist.createParent(parentName);
      const updatedChecklist = await existingChecklist.save();

      return reply.code(200).send({
        message: `Parent '${parentName}' added to existing checklist`,
        checklist: updatedChecklist,
        parentName,
        isUpdate: true,
      });
    } else {
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
      });
    }
  } catch (err) {
    console.error("Error in createParent:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  // New controllers for historical readings
  addReading,
  getReadingHistory,
  updateReading,
  deleteReading,
  getCurrentValues,
};
