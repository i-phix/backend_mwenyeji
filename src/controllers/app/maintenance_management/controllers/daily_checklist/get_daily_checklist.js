const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");

const getDailyChecklist = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { date, parentName } = request.query;

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let query = { facilityId };

    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const checklists = await checklistModel.find(query).sort({ createdAt: -1 });

    // Filter by parent if specified
    let filteredData = checklists;
    if (parentName && checklists.length > 0) {
      filteredData = checklists.map((checklist) => {
        const filteredChecklist = checklist.toObject();
        if (checklist.data.has(parentName)) {
          filteredChecklist.data = new Map([
            [parentName, checklist.data.get(parentName)],
          ]);
        } else {
          filteredChecklist.data = new Map();
        }
        return filteredChecklist;
      });
    }

    return reply.code(200).send({
      message: "Daily checklists retrieved successfully",
      checklists: filteredData,
      count: filteredData.length,
    });
  } catch (err) {
    console.error("Error in getDailyChecklist:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Controller for getting specific parent data
const getParentData = async (request, reply) => {
  try {
    const { facilityId, parentName } = request.params;
    const { date } = request.query;

    const checklistModel = await getModel(
      "DailyChecklist",
      payservedb.DailyChecklist.schema,
      facilityId,
    );

    let query = { facilityId };

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const checklist = await checklistModel
      .findOne(query)
      .sort({ createdAt: -1 });

    if (!checklist || !checklist.hasParent(parentName)) {
      return reply.code(404).send({
        error: `Parent '${parentName}' not found in checklist`,
      });
    }

    const parentData = {};
    const childNames = checklist.getChildNames(parentName);

    childNames.forEach((childName) => {
      parentData[childName] = checklist.getChildWithDate(parentName, childName);
    });

    return reply.code(200).send({
      message: `Parent data for '${parentName}' retrieved successfully`,
      parentName,
      data: parentData,
      childCount: childNames.length,
    });
  } catch (err) {
    console.error("Error in getParentData:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  getDailyChecklist,
  getParentData,
};
