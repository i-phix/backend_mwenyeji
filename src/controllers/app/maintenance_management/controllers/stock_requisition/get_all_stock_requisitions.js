// Gets all the stock requisition information that belongs to a facility

const { getModel } = require("../../../../../utils/getModel");
const payservedb = require("payservedb");

const getStockRequisitions = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Get the models
    const stockRequisitionModel = await getModel(
      "StockRequisition",
      payservedb.StockRequisition.schema,
      facilityId
    );

    const stockModel = await getModel(
      "Stocksandspare",
      payservedb.Stocksandspare.schema,
      facilityId
    );

    // Fetch requisitions
    const requisitions = await stockRequisitionModel.find({ facilityId });

    // Fetch corresponding stock details for each requisition
    const requisitionsWithStockDetails = await Promise.all(
      requisitions.map(async (requisition) => {
        const stock = await stockModel.findById(requisition.stockId);
        return {
          _id: requisition._id,
          quantity: requisition.quantity,
          description: requisition.description,
          createdAt: requisition.createdAt,
          stock: {
            name: stock ? stock.name : "Unknown",
            skuDetails: stock ? stock.skuDetails : "N/A",
          },
        };
      })
    );

    reply.code(200).send({
      success: true,
      data: requisitionsWithStockDetails,
    });
  } catch (err) {
    console.error("Error in getStockRequisitions:", err);
    return reply.code(500).send({
      success: false,
      error: err.message,
    });
  }
};

module.exports = getStockRequisitions;
