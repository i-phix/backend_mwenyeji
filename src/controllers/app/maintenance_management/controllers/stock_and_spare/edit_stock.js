const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const editStockOrSpare = async (request, reply) => {
    try {
        const { facilityId, stockId } = request.params;
        const updateData = request.body;

        // Validate input data
        const schema = Joi.object({
            name: Joi.string().optional(),
            description: Joi.string().allow("").optional(),
            skuDetails: Joi.string().optional(),
            reOrderLevel: Joi.number().min(0).optional(),
        });

        const { error } = schema.validate(updateData);
        if (error) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Update Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error_type: "ValidationError",
                    validation_error: error.details[0].message,
                    attempted_update: updateData,
                },
            });

            return reply.code(400).send({ error: error.details[0].message });
        }

        const stockModel = await getModel(
            "Stocksandspare",
            payservedb.Stocksandspare.schema,
            facilityId,
        );

        // Get the current stock data before updating (for audit trail)
        const currentStock = await stockModel.findById(stockId);
        if (!currentStock) {
            // Audit stock not found
            await audit_trail(request, {
                activity: "Update Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found",
                },
            });

            return reply.code(404).send({ message: "Stock or Spare not found" });
        }

        // Store previous data for audit trail
        const previousData = {
            name: currentStock.name,
            description: currentStock.description,
            skuDetails: currentStock.skuDetails,
            quantityInStock: currentStock.quantityInStock,
            reOrderLevel: currentStock.reOrderLevel,
        };

        // Validate that required fields aren't being set to null/undefined
        const requiredFields = ["name", "skuDetails"];
        for (const field of requiredFields) {
            if (updateData.hasOwnProperty(field) && !updateData[field]) {
                // Audit validation error
                await audit_trail(request, {
                    activity: "Update Stock Item",
                    response_status: "error",
                    custom_data: {
                        facility_id: facilityId,
                        stock_id: stockId,
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

        // Update the stock item
        const updatedStock = await stockModel.findByIdAndUpdate(
            stockId,
            updateData,
            {
                new: true,
                runValidators: true,
            },
        );

        if (!updatedStock) {
            // Audit stock not found during update
            await audit_trail(request, {
                activity: "Update Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found during update operation",
                },
            });

            return reply.code(404).send({ message: "Stock or Spare not found" });
        }

        // Check for actual changes and audit accordingly
        const fieldsChanged = getChangedFields(previousData, updateData);

        if (fieldsChanged.length > 0) {
            // Audit successful update with changes
            await audit_trail(request, {
                activity: "Update Stock Item",
                response_status: "success",
                previous_data: previousData,
                custom_data: {
                    facility_id: facilityId,
                    updated_stock_id: updatedStock._id,
                    stock_name: updatedStock.name,
                    sku_details: updatedStock.skuDetails,
                    fields_changed: fieldsChanged,
                    update_summary: generateUpdateSummary(previousData, updateData),
                    update_data: updateData,
                    current_quantity: updatedStock.quantityInStock,
                    reorder_level: updatedStock.reOrderLevel,
                },
            });
        } else {
            // Audit no-change update
            await audit_trail(request, {
                activity: "Update Stock Item",
                response_status: "success",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    message: "No fields were changed in this update",
                    update_data: updateData,
                },
            });
        }

        return reply.code(200).send({
            message: "Stock or Spare updated successfully",
            stock: updatedStock,
        });
    } catch (err) {
        console.error("Error in editStockOrSpare:", err);

        if (err.name === "ValidationError") {
            // Audit MongoDB validation error
            await audit_trail(request, {
                activity: "Update Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: request.params.facilityId,
                    stock_id: request.params.stockId,
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
                activity: "Update Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: request.params.facilityId,
                    stock_id: request.params.stockId,
                    error_type: "DuplicateKey",
                    error_code: err.code,
                    duplicate_field: "skuDetails",
                    attempted_sku: request.body.skuDetails,
                },
            });

            return reply.code(400).send({
                error: "SKU details already exist. Please use unique SKU details.",
            });
        }

        // Audit generic error
        await audit_trail(request, {
            activity: "Update Stock Item",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                stock_id: request.params.stockId,
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
        // Handle different data types properly
        const prevValue = previousData[key];
        const newValue = updateData[key];

        // Convert to strings for comparison
        const prevStr = String(prevValue || "");
        const newStr = String(newValue || "");

        if (prevStr !== newStr) {
            changedFields.push(key);
        }
    });

    return changedFields;
};

// Helper function to generate a summary of changes
const generateUpdateSummary = (previousData, updateData) => {
    const changes = {};

    Object.keys(updateData).forEach((key) => {
        const prevValue = previousData[key];
        const newValue = updateData[key];

        // Convert to strings for comparison
        const prevStr = String(prevValue || "");
        const newStr = String(newValue || "");

        if (prevStr !== newStr) {
            changes[key] = {
                from: prevValue,
                to: newValue,
            };
        }
    });

    return changes;
};

module.exports = editStockOrSpare;