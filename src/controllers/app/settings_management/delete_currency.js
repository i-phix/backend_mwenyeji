const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const deleteCurrency = async (request, reply) => {
  try {
    const { facilityId, currencyId } = request.params;

    if (!currencyId) {
      return reply.code(400).send({
        error: "Currency ID is required"
      });
    }

    // Retrieve the facility-specific currency model
    const currencyModel = await getModel("Currency", payservedb.Currency.schema, facilityId);

    // Retrieve the currency document using the facility-specific model
    const currency = await currencyModel.findById(currencyId);
    if (!currency) {
      return reply.code(404).send({
        error: "Currency not found"
      });
    }

    if (currency.isDefaultCurrency) {
      return reply.code(400).send({
        error: "Cannot delete default currency"
      });
    }

    const deletedCurrency = await currencyModel.findByIdAndDelete(currencyId);

    return reply.code(200).send({
      message: "Currency deleted successfully",
      currency: deletedCurrency
    });
  } catch (err) {
    console.error("Error in deleteCurrency:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = deleteCurrency;
