const payservedb = require("payservedb");
const { getModel } = require("../../../../../../utils/getModel");

const createChildWorkplan = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { name, description, parent, status } = request.body;

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const childWorkplan = await childWorkplanModel.create({
      name,
      description,
      parent,
      status,
    });

    return reply.code(201).send({
      success: true,
      message: "Child workplan added successfully",
      data: {
        childWorkplan: childWorkplan,
      },
    });
  } catch (error) {
    console.error("Error creating child workplan:", error);
    // Handle duplicate key error if name has unique constraint
    if (error.code === 11000) {
      return reply.code(409).send({
        success: false,
        error: "A child workplan with this name already exists",
      });
    }
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

const updateChildWorkplan = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const { name, description, parent, status } = request.body;

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const childWorkplan = await childWorkplanModel.findByIdAndUpdate(
      id,
      { name, description, parent, status },
      { new: true },
    );

    if (!childWorkplan) {
      return reply.code(404).send({
        success: false,
        error: "Child workplan not found",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Child workplan updated successfully",
      data: {
        childWorkplan: childWorkplan,
      },
    });
  } catch (error) {
    console.error("Error updating child workplan:", error);
    // Handle duplicate key error for updates
    if (error.code === 11000) {
      return reply.code(409).send({
        success: false,
        error: "A child workplan with this name already exists",
      });
    }
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

const deleteChildWorkplan = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const childWorkplan = await childWorkplanModel.findByIdAndDelete(id);

    if (!childWorkplan) {
      return reply.code(404).send({
        success: false,
        error: "Child workplan not found",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Child workplan deleted successfully",
      data: {
        childWorkplan: childWorkplan,
      },
    });
  } catch (error) {
    console.error("Error deleting child workplan:", error);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

const getChildWorkplan = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    // Get both models for the same facility
    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );

    const childWorkplan = await childWorkplanModel.findById(id);

    if (!childWorkplan) {
      return reply.code(404).send({
        success: false,
        error: "Child workplan not found",
      });
    }

    // Manually populate the parent field
    let populatedChildWorkplan = childWorkplan.toObject();
    if (childWorkplan.parent) {
      const parent = await masterWorkplanModel.findById(childWorkplan.parent);
      populatedChildWorkplan.parent = parent;
    }

    return reply.code(200).send({
      success: true,
      data: {
        childWorkplan: populatedChildWorkplan,
      },
    });
  } catch (error) {
    console.error("Error getting child workplan:", error);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

const getChildWorkplans = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    // Get both models for the same facility
    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );

    // Get child workplans without populate first
    const childWorkplans = await childWorkplanModel.find();

    // Manually populate the parent field
    const populatedChildWorkplans = await Promise.all(
      childWorkplans.map(async (child) => {
        if (child.parent) {
          const parent = await masterWorkplanModel.findById(child.parent);
          return {
            ...child.toObject(),
            parent: parent,
          };
        }
        return child.toObject();
      }),
    );

    return reply.code(200).send({
      success: true,
      data: {
        childWorkplans: populatedChildWorkplans,
        count: populatedChildWorkplans.length,
      },
    });
  } catch (error) {
    console.error("Error getting child workplans:", error);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

const getChildWorkplansByParent = async (request, reply) => {
  try {
    const { facilityId, parentId } = request.params;

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    // Get both models for the same facility
    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const masterWorkplanModel = await getModel(
      "MasterWorkplan",
      payservedb.MasterWorkplan.schema,
      facilityId,
    );

    const childWorkplans = await childWorkplanModel.find({ parent: parentId });

    // Manually populate the parent field
    const populatedChildWorkplans = await Promise.all(
      childWorkplans.map(async (child) => {
        const parent = await masterWorkplanModel.findById(child.parent);
        return {
          ...child.toObject(),
          parent: parent,
        };
      }),
    );

    return reply.code(200).send({
      success: true,
      data: {
        childWorkplans: populatedChildWorkplans,
        count: populatedChildWorkplans.length,
      },
    });
  } catch (error) {
    console.error("Error getting child workplans by parent:", error);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

const updateChildWorkplanStatus = async (request, reply) => {
  try {
    const { facilityId, id } = request.params;
    const { status } = request.body;

    // Validate status
    const validStatuses = ["Completed", "Pending", "In Progress", "Undone"];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Try different possible schema references
    let childWorkplanSchema;
    if (payservedb.ChildWorkplan && payservedb.ChildWorkplan.schema) {
      childWorkplanSchema = payservedb.ChildWorkplan.schema;
    } else if (
      payservedb.MasterWorkplanChild &&
      payservedb.MasterWorkplanChild.schema
    ) {
      childWorkplanSchema = payservedb.MasterWorkplanChild.schema;
    } else {
      throw new Error("ChildWorkplan schema not found in payservedb");
    }

    const childWorkplanModel = await getModel(
      "ChildWorkplan",
      childWorkplanSchema,
      facilityId,
    );

    const childWorkplan = await childWorkplanModel.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );

    if (!childWorkplan) {
      return reply.code(404).send({
        success: false,
        error: "Child workplan not found",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Child workplan status updated successfully",
      data: {
        childWorkplan: childWorkplan,
      },
    });
  } catch (error) {
    console.error("Error updating child workplan status:", error);
    return reply.code(500).send({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  createChildWorkplan,
  updateChildWorkplan,
  deleteChildWorkplan,
  getChildWorkplan,
  getChildWorkplans,
  getChildWorkplansByParent,
  updateChildWorkplanStatus,
};
