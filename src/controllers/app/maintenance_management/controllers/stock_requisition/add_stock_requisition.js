// Adds the stcok requisition information when the stock is requisitioned

const { getModel } = require("../../../../../utils/getModel");
const payservedb = require("payservedb");

const addStockRequisition = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { stockId, quantity, description } = request.body;

    const stockRequisitionModel = await getModel(
      "StockRequisition",
      payservedb.StockRequisition.schema,
      facilityId
    );

    const newStockRequisition = await stockRequisitionModel.create({
      facilityId,
      stockId,
      quantity,
      description,
    });

    return reply.code(200).send({
      message: "Stock requisition added successfully",
      stockRequisition: newStockRequisition,
    });
  } catch (err) {
    console.error("Error in addStockRequisition:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addStockRequisition;
