const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const incrementStock = async (request, reply) => {
    try {
        const { facilityId, stockId } = request.params;
        const { quantity, description } = request.body;

        // Audit the stock increment attempt
        await audit_trail(request, {
            activity: "Increment Stock Quantity",
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                increment_quantity: quantity,
                increment_description: description,
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
                activity: "Increment Stock Quantity",
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
                activity: "Increment Stock Quantity",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found",
                    attempted_increment: quantity,
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

        // Use the schema method to add stock with metadata
        await stock.addStock(quantity, description, request.user?.id);

        // Audit successful increment
        await audit_trail(request, {
            activity: "Increment Stock Quantity - Success",
            response_status: "success",
            previous_data: previousData,
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                stock_name: stock.name,
                sku_details: stock.skuDetails,
                previous_quantity: previousData.quantityInStock,
                new_quantity: stock.quantityInStock,
                quantity_added: quantity,
                increment_description: description,
                user_id: request.user?.id,
            },
        });

        return reply.code(200).send({
            message: "Stock incremented successfully",
            stock: stock,
        });
    } catch (err) {
        console.error("Error in incrementStock:", err);

        // Audit the error
        await audit_trail(request, {
            activity: "Increment Stock Quantity - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                stock_id: request.params.stockId,
                error_type: err.name,
                error_message: err.message,
                attempted_increment: request.body.quantity,
                increment_description: request.body.description,
            },
        });

        return reply.code(400).send({ error: err.message });
    }
};

module.exports = incrementStock;