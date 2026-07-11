const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const addAsset = async (request, reply) => {
  // Audit the asset creation attempt
  await audit_trail(request, {
    activity: "Create Asset",
    custom_data: {
      facility_id: request.params.facilityId, 
      asset_data: request.body,
    },
  });

  try {
    const { facilityId } = request.params;
    const {
      name,
      location,
      serialNumber,
      dateBought,
      insuranceStatus,
      inspection_certificate,
      documents,
    } = request.body;

    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );
    const savedAsset = await assetModel.create({
      facilityId,
      name,
      location,
      serialNumber,
      dateBought,
      insuranceStatus,
      inspection_certificate: inspection_certificate || [],
      documents: documents || [],
      assigned: false,
    });

    // Audit successful creation
    await audit_trail(request, {
      activity: "Create Asset - Success",
      custom_data: {
        created_asset_id: savedAsset._id,
        asset_name: savedAsset.name,
        serial_number: savedAsset.serialNumber,
      },
    });

    return reply.code(200).send({
      message: "Asset added successfully",
      asset: savedAsset,
    });
  } catch (err) {
    console.error("Error in addAsset:", err);

    // Audit the error
    await audit_trail(request, {
      activity: "Create Asset - Failed",
      custom_data: {
        error_type: err.name,
        error_message: err.message,
        error_code: err.code,
      },
    });

    if (err.name === "ValidationError") {
      const missingFields = Object.keys(err.errors);
      return reply.code(400).send({
        error: `Validation failed: Missing required fields: ${missingFields.join(", ")}`,
        details: err.errors,
      });
    }
    if (err.code === 11000) {
      return reply.code(400).send({
        error:
          "Serial number already exists. Please use a unique serial number.",
      });
    }
    return reply.code(400).send({ error: err.message });
  }
};
module.exports = addAsset;
