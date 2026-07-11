// Gets the information for stock which has been requisitioned as well as the requisition description
const getStockRequisitionInfo = async (request, reply) => {
  try {
    const { facilityId, stockId } = request.params;
    const stockRequisitionInfo =
      await stockRequisitionService.getStockRequisitionInfo(
        facilityId,
        stockId
      );
    reply.code(200).send(stockRequisitionInfo);
  } catch (err) {
    console.error("Error in getStockRequisitionInfo:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getStockRequisitionInfo;
