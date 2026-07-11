const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getStockHistory = async (request, reply) => {
    try {
        const { facilityId, stockId } = request.params;
        const { limit = 50, offset = 0 } = request.query;

        // Audit the stock history retrieval attempt
        await audit_trail(request, {
            activity: "Get Stock History",
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                requested_limit: limit,
                requested_offset: offset,
            },
        });

        const stockModel = await getModel(
            "Stocksandspare",
            payservedb.Stocksandspare.schema,
            facilityId,
        );

        const stock = await stockModel.findById(stockId);

        if (!stock) {
            // Audit stock not found
            await audit_trail(request, {
                activity: "Get Stock History",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found",
                },
            });

            return reply.code(404).send({ message: "Stock or Spare not found" });
        }

        // Get paginated history
        const history = stock
            .getStockHistory()
            .slice(offset, offset + parseInt(limit));

        const totalEntries = stock.metadata.length;

        // Audit successful retrieval
        await audit_trail(request, {
            activity: "Get Stock History - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                stock_name: stock.name,
                sku_details: stock.skuDetails,
                total_history_entries: totalEntries,
                returned_entries: history.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                has_more: offset + parseInt(limit) < totalEntries,
            },
        });

        return reply.code(200).send({
            message: "Stock history retrieved successfully",
            history: history,
            pagination: {
                total: totalEntries,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + parseInt(limit) < totalEntries,
            },
        });
    } catch (err) {
        console.error("Error in getStockHistory:", err);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Stock History - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                stock_id: request.params.stockId,
                error_type: err.name,
                error_message: err.message,
                requested_limit: request.query.limit,
                requested_offset: request.query.offset,
            },
        });

        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getStockHistory;