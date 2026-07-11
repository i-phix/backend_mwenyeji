const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const { audit_trail } = require('../../../../../utils/audit_trails');

const getStocksandspareById = async (request, reply) => {
    try {
        const { facilityId, stockId } = request.params;

        // Audit the individual stock retrieval attempt
        await audit_trail(request, {
            activity: "Get Stock Item by ID",
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
            },
        });

        const stockModel = await getModel('Stocksandspare', payservedb.Stocksandspare.schema, facilityId);

        const stock = await stockModel.findById(stockId);

        if (!stock) {
            // Audit stock not found
            await audit_trail(request, {
                activity: "Get Stock Item by ID",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
                    stock_id: stockId,
                    error: "Stock or Spare not found",
                },
            });

            return reply.code(404).send({ message: 'Stock or Spare not found' });
        }

        // Audit successful retrieval
        await audit_trail(request, {
            activity: "Get Stock Item by ID - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                stock_id: stockId,
                stock_name: stock.name,
                sku_details: stock.skuDetails,
                current_quantity: stock.quantityInStock,
                reorder_level: stock.reOrderLevel,
                below_reorder_level: stock.quantityInStock <= stock.reOrderLevel,
                metadata_entries: stock.metadata?.length || 0,
            },
        });

        return reply.code(200).send(stock);
    } catch (err) {
        console.error('Error in getStocksandspareById:', err);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Stock Item by ID - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                stock_id: request.params.stockId,
                error_type: err.name,
                error_message: err.message,
            },
        });

        return reply.code(500).send({ error: err.message });
    }
};

module.exports = getStocksandspareById;