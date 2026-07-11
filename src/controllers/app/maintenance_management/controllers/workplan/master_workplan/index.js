const payservedb = require("payservedb");
const { getModel } = require("../../../../../../utils/getModel");

const createMasterWorkplan = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { title, description } = request.body;
    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );
    const masterWorkplan = await masterWorkplanModel.create({
      title,
      description,
      facility: facilityId,
    });
    return reply.code(201).send({
      message: "Master workplan added successfully",
      masterWorkplan: masterWorkplan,
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.title) {
      return reply.code(409).send({
        error: "A master workplan with this title already exists",
      });
    }
    return reply.code(500).send({
      error: error.message,
    });
  }
};

const updateMasterWorkplan = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const { title, description } = request.body;
    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );
    const masterWorkplan = await masterWorkplanModel.findByIdAndUpdate(
      id,
      { title, description },
      { new: true },
    );
    if (!masterWorkplan) {
      return reply.code(404).send({
        error: "Master workplan not found",
      });
    }
    return reply.code(200).send({
      message: "Master workplan updated successfully",
      masterWorkplan: masterWorkplan,
    });
  } catch (error) {
    // Handle duplicate key error for updates too
    if (error.code === 11000 && error.keyPattern && error.keyPattern.title) {
      return reply.code(409).send({
        error: "A master workplan with this title already exists",
      });
    }
    return reply.code(500).send({
      error: error.message,
    });
  }
};

const deleteMasterWorkplan = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );
    const masterWorkplan = await masterWorkplanModel.findByIdAndDelete(id);
    if (!masterWorkplan) {
      return reply.code(404).send({
        error: "Master workplan not found",
      });
    }
    return reply.code(200).send({
      message: "Master workplan deleted successfully",
      masterWorkplan: masterWorkplan,
    });
  } catch (error) {
    return reply.code(500).send({
      error: error.message,
    });
  }
};

const getMasterWorkplan = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );
    const masterWorkplan = await masterWorkplanModel.findById(id);
    if (!masterWorkplan) {
      return reply.code(404).send({
        error: "Master workplan not found",
      });
    }
    return reply.code(200).send({
      masterWorkplan: masterWorkplan,
    });
  } catch (error) {
    return reply.code(500).send({
      error: error.message,
    });
  }
};

const getMasterWorkplans = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );
    const masterWorkplans = await masterWorkplanModel.find();
    return reply.code(200).send({
      masterWorkplans: masterWorkplans,
      count: masterWorkplans.length,
    });
  } catch (error) {
    return reply.code(500).send({
      error: error.message,
    });
  }
};

module.exports = {
  createMasterWorkplan,
  updateMasterWorkplan,
  deleteMasterWorkplan,
  getMasterWorkplan,
  getMasterWorkplans,
};
