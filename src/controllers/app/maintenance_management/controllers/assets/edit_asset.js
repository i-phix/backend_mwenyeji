const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const editAsset = async (request, reply) => {
  let response_status = "success";
  try {
    const { facilityId, assetId } = request.params;
    const updateData = request.body;
    const assetModel = await getModel(
      "Asset",
      payservedb.Asset.schema,
      facilityId,
    );

    // Get the current asset data before updating (for audit trail)
    const currentAsset = await assetModel.findById(assetId);
    if (!currentAsset) {
      response_status = "not_found";

      return reply.code(404).send({ message: "Asset not found" });
    }

    // Store previous data for audit trail
    const previousData = {
      name: currentAsset.name,
      location: currentAsset.location,
      serialNumber: currentAsset.serialNumber,
      dateBought: currentAsset.dateBought,
      insuranceStatus: currentAsset.insuranceStatus,
      inspection_certificate: currentAsset.inspection_certificate,
      documents: currentAsset.documents,
      assigned: currentAsset.assigned,
    };

    // Validate that required fields aren't being set to null/undefined
    const requiredFields = [
      "name",
      "location",
      "serialNumber",
      "dateBought",
      "insuranceStatus",
    ];
    for (const field of requiredFields) {
      if (updateData.hasOwnProperty(field) && !updateData[field]) {
        // Audit validation error
        await audit_trail(request, {
          activity: "Update Asset - Validation Error",
          custom_data: {
            facility_id: facilityId,
            asset_id: assetId,
            error_type: "Required field empty",
            failed_field: field,
            attempted_update: updateData,
          },
        });

        return reply.code(400).send({
          error: `${field} is required and cannot be empty`,
        });
      }
    }

    // Validate insuranceStatus enum if provided
    if (updateData.insuranceStatus) {
      const validInsuranceStatuses = ["Insured", "Not Insured", "Expired"];
      if (!validInsuranceStatuses.includes(updateData.insuranceStatus)) {
        // Audit enum validation error
        await audit_trail(request, {
          activity: "Update Asset - Validation Error",
          custom_data: {
            facility_id: facilityId,
            asset_id: assetId,
            error_type: "Invalid enum value",
            failed_field: "insuranceStatus",
            attempted_value: updateData.insuranceStatus,
            valid_values: validInsuranceStatuses,
          },
        });

        return reply.code(400).send({
          error: `insuranceStatus must be one of: ${validInsuranceStatuses.join(", ")}`,
        });
      }
    }

    const updatedAsset = await assetModel.findByIdAndUpdate(
      assetId,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedAsset) {
      // Audit asset not found during update
      await audit_trail(request, {
        activity: "Update Asset - Not Found During Update",
        custom_data: {
          facility_id: facilityId,
          asset_id: assetId,
          error: "Asset not found during update operation",
        },
      });

      return reply.code(404).send({ message: "Asset not found" });
    }

    // Audit successful update with previous data
    await audit_trail(request, {
      activity: "Update Asset",
      previous_data: previousData,
      response_status: response_status,
      custom_data: {
        facility_id: facilityId,
        updated_asset_id: updatedAsset._id,
        asset_name: updatedAsset.name,
        serial_number: updatedAsset.serialNumber,
        fields_changed: getChangedFields(previousData, updateData),
        update_summary: generateUpdateSummary(previousData, updateData),
      },
    });

    return reply.code(200).send({
      message: "Asset updated successfully",
      asset: updatedAsset,
    });
  } catch (err) {
    console.error("Error in editAsset:", err);

    if (err.name === "ValidationError") {
      // Audit MongoDB validation error
      await audit_trail(request, {
        activity: "Update Asset - MongoDB Validation Error",
        custom_data: {
          facility_id: request.params.facilityId,
          asset_id: request.params.assetId,
          error_type: "ValidationError",
          validation_errors: err.errors,
          attempted_update: request.body,
        },
      });

      return reply.code(400).send({
        error: "Validation failed",
        details: err.errors,
      });
    }

    if (err.code === 11000) {
      // Audit duplicate key error
      await audit_trail(request, {
        activity: "Update Asset - Duplicate Error",
        custom_data: {
          facility_id: request.params.facilityId,
          asset_id: request.params.assetId,
          error_type: "DuplicateKey",
          error_code: err.code,
          duplicate_field: "serialNumber",
          attempted_serial_number: request.body.serialNumber,
        },
      });

      return reply.code(400).send({
        error:
          "Serial number already exists. Please use a unique serial number.",
      });
    }

    // Audit generic error
    await audit_trail(request, {
      activity: "Update Asset - System Error",
      custom_data: {
        facility_id: request.params.facilityId,
        asset_id: request.params.assetId,
        error_type: "SystemError",
        error_name: err.name,
        error_message: err.message,
        attempted_update: request.body,
      },
    });

    return reply.code(400).send({ error: err.message });
  }
};

// Helper function to identify which fields were changed
const getChangedFields = (previousData, updateData) => {
  const changedFields = [];

  Object.keys(updateData).forEach((key) => {
    if (previousData[key] !== updateData[key]) {
      changedFields.push(key);
    }
  });

  return changedFields;
};

// Helper function to generate a summary of changes
const generateUpdateSummary = (previousData, updateData) => {
  const changes = {};

  Object.keys(updateData).forEach((key) => {
    if (previousData[key] !== updateData[key]) {
      changes[key] = {
        from: previousData[key],
        to: updateData[key],
      };
    }
  });

  return changes;
};

module.exports = editAsset;
