
const payservedb = require("payservedb");
const Joi = require("joi");
const { getModel } = require("../../../../../utils/getModel");
const { audit_trail } = require("../../../../../utils/audit_trails");

const addStockOrSpare = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { name, description, skuDetails, quantityInStock, reOrderLevel } =
            request.body;

        // Audit the stock creation attempt
        await audit_trail(request, {
            activity: "Create Stock Item",
            custom_data: {
                facility_id: facilityId,
                stock_data: {
                    name,
                    description,
                    skuDetails,
                    quantityInStock,
                    reOrderLevel
                },
            },
        });

        const schema = Joi.object({
            name: Joi.string().required(),
            description: Joi.string().allow(""),
            skuDetails: Joi.string().required(),
            quantityInStock: Joi.number().min(0).required(),
            reOrderLevel: Joi.number().min(0).required(),
        });

        const { error } = schema.validate({
            name,
            description,
            skuDetails,
            quantityInStock,
            reOrderLevel,
        });

        if (error) {
            // Audit validation error
            await audit_trail(request, {
                activity: "Create Stock Item",
                response_status: "error",
                custom_data: {
                    facility_id: facilityId,
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

        // Create stock item with initial metadata entry
        const stockData = {
            facilityId,
            name,
            description,
            skuDetails,
            quantityInStock,
            reOrderLevel,
            metadata: [
                {
                    timestamp: new Date(),
                    description: `Initial stock creation with ${quantityInStock} units`,
                    changeType: "initial",
                    previousQuantity: 0,
                    newQuantity: quantityInStock,
                    quantityChanged: quantityInStock,
                    userId: request.user?.id || null,
                },
            ],
        };

        const savedStock = await stockModel.create(stockData);

        // Audit successful creation
        await audit_trail(request, {
            activity: "Create Stock Item - Success",
            response_status: "success",
            custom_data: {
                facility_id: facilityId,
                created_stock_id: savedStock._id,
                stock_name: savedStock.name,
                sku_details: savedStock.skuDetails,
                initial_quantity: savedStock.quantityInStock,
                reorder_level: savedStock.reOrderLevel,
            },
        });

        return reply.code(200).send({
            message: "Stock or Spare added successfully",
            stock: savedStock,
        });
    } catch (err) {
        console.error("Error in addStockOrSpare:", err);

        // Audit the error
        await audit_trail(request, {
            activity: "Create Stock Item - Failed",
            response_status: "error",
            custom_data: {
                facility_id: request.params.facilityId,
                error_type: err.name,
                error_message: err.message,
                error_code: err.code,
                attempted_data: request.body,
            },
        });

        return reply.code(400).send({ error: err.message });
    }
};

module.exports = addStockOrSpare;