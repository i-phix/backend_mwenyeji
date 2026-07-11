const payservedb = require("payservedb");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const getStocksOrSpares = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Audit the stock retrieval attempt
        await audit_trail(request, {
            activity: "Get Facility Stocks",
            custom_data: {
                facility_id: facilityId,
            },
        });

        const stockModel = await getModel(
            "Stocksandspare",
            payservedb.Stocksandspare.schema,
            facilityId,
        );

        const stocks = await stockModel.find();

        // Audit successful retrieval
        await audit_trail(request, {
            activity: "Get Facility Stocks - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                stocks_count: stocks.length,
                stocks_below_reorder: stocks.filter(stock => stock.quantityInStock <= stock.reOrderLevel).length,
                total_stock_value: stocks.reduce((sum, stock) => sum + stock.quantityInStock, 0),
            },
        });

        return reply.code(200).send({
            message: "Stocks and Spares retrieved successfully",
            stocks,
        });
    } catch (err) {
        console.error("Error in getStocksOrSpares:", err);

        // Audit the error
        await audit_trail(request, {
            activity: "Get Facility Stocks - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                error_type: err.name,
                error_message: err.message,
            },
        });

        return reply.code(400).send({ error: err.message });
    }
};

module.exports = getStocksOrSpares;