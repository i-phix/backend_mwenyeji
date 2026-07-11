const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const deleteStockOrSpare = async (request, reply) => {
    try {
        const { facilityId, stockId } = request.params;

        const stockModel = await getModel(
            "Stocksandspare",
            payservedb.Stocksandspare.schema,
            facilityId,
        );

        // Get the current stock data before deleting (for audit trail)
        const currentStock = await stockModel.findById(stockId);

        if (!currentStock) {
            // Audit stock not found
            await audit_trail(request, {
                activity: "Delete Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found",
                },
            });

            return reply.code(404).send({ message: "Stock or Spare not found" });
        }

        // Store data before deletion for audit trail
        const stockDataBeforeDeletion = {
            id: currentStock._id,
            name: currentStock.name,
            description: currentStock.description,
            skuDetails: currentStock.skuDetails,
            quantityInStock: currentStock.quantityInStock,
            reOrderLevel: currentStock.reOrderLevel,
            metadata: currentStock.metadata,
        };

        // Audit deletion attempt
        await audit_trail(request, {
            activity: "Delete Stock Item",
            deleted_data: stockDataBeforeDeletion,
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                stock_name: currentStock.name,
                sku_details: currentStock.skuDetails,
                quantity_at_deletion: currentStock.quantityInStock,
            },
        });

        const deletedStock = await stockModel.findByIdAndDelete(stockId);

        if (!deletedStock) {
            // Audit deletion failure (shouldn't happen, but safety check)
            await audit_trail(request, {
                activity: "Delete Stock Item - Failed",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare could not be deleted",
                },
            });

            return reply.code(404).send({ message: "Stock or Spare not found" });
        }

        // Audit successful deletion
        await audit_trail(request, {
            activity: "Delete Stock Item - Success",
            response_status: "success",
            deleted_data: stockDataBeforeDeletion,
            custom_data: {
                facility_id: facilityId,
                deleted_stock_id: stockId,
                stock_name: stockDataBeforeDeletion.name,
                sku_details: stockDataBeforeDeletion.skuDetails,
                final_quantity: stockDataBeforeDeletion.quantityInStock,
            },
        });

        return reply
            .code(200)
            .send({ message: "Stock or Spare deleted successfully" });
    } catch (err) {
        console.error("Error in deleteStockOrSpare:", err);

        // Audit the error
        await audit_trail(request, {
            activity: "Delete Stock Item - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                stock_id: request.params.stockId,
                error_type: err.name,
                error_message: err.message,
                error_code: err.code,
            },
        });

        return reply.code(400).send({ error: err.message });
    }
};

module.exports = deleteStockOrSpare;