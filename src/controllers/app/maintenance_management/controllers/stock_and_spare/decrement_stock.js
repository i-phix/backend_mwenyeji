const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const decrementStock = async (request, reply) => {
    try {
        const { facilityId, stockId } = request.params;
        const { quantity, description } = request.body;

        // Audit the stock decrement attempt
        await audit_trail(request, {
            activity: "Decrement Stock Quantity",
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                decrement_quantity: quantity,
                decrement_description: description,
            },
        });

        const schema = Joi.object({
            quantity: Joi.number().min(1).required(),
            description: Joi.string().required(),
        });

        const { error } = schema.validate({ quantity, description });
        if (error) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Decrement Stock Quantity",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error_type: "ValidationError",
                    validation_error: error.details[0].message,
                    attempted_data: request.body,
                },
            });

            return reply.code(400).send({ error: error.details[0].message });
        }

        const stockModel = await getModel(
            "Stocksandspare",
            payservedb.Stocksandspare.schema,
            facilityId,
        );

        const stock = await stockModel.findById(stockId);

        if (!stock) {
            // Audit stock not found
            await audit_trail(request, {
                activity: "Decrement Stock Quantity",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found",
                    attempted_decrement: quantity,
                },
            });

            return reply.code(404).send({ message: "Stock or Spare not found" });
        }

        // Store previous data for audit trail
        const previousData = {
            id: stock._id,
            name: stock.name,
            skuDetails: stock.skuDetails,
            quantityInStock: stock.quantityInStock,
            reOrderLevel: stock.reOrderLevel,
        };

        // Check if there's sufficient stock before decrementing
        if (stock.quantityInStock < quantity) {
            // Audit insufficient stock error
            await audit_trail(request, {
                activity: "Decrement Stock Quantity",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    stock_name: stock.name,
                    error_type: "InsufficientStock",
                    current_quantity: stock.quantityInStock,
                    requested_decrement: quantity,
                    shortage: quantity - stock.quantityInStock,
                },
            });
        }

        // Use the schema method to reduce stock with metadata
        await stock.reduceStock(quantity, description, request.user?.id);

        // Audit successful decrement
        await audit_trail(request, {
            activity: "Decrement Stock Quantity - Success",
            response_status: "success",
            previous_data: previousData,
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                stock_name: stock.name,
                sku_details: stock.skuDetails,
                previous_quantity: previousData.quantityInStock,
                new_quantity: stock.quantityInStock,
                quantity_removed: quantity,
                decrement_description: description,
                user_id: request.user?.id,
                below_reorder_level: stock.quantityInStock <= stock.reOrderLevel,
            },
        });

        return reply.code(200).send({
            message: "Stock decremented successfully",
            stock: stock,
        });
    } catch (err) {
        console.error("Error in decrementStock:", err);

        // Audit the error
        await audit_trail(request, {
            activity: "Decrement Stock Quantity - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                stock_id: request.params.stockId,
                error_type: err.name,
                error_message: err.message,
                attempted_decrement: request.body.quantity,
                decrement_description: request.body.description,
            },
        });

        return reply.code(400).send({ error: err.message });
    }
};

module.exports = decrementStock;