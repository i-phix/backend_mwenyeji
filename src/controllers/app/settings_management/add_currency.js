const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const addCurrency = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { currencyName, currencyShortCode, isDefaultCurrency, exchangeRate } = request.body;

    const currencyModel = await getModel(
      "Currency",
      payservedb.Currency.schema,
      facilityId
    );

    // If setting this currency as default, unset the default flag for all other currencies in the facility
    if (isDefaultCurrency) {
      await currencyModel.updateMany(
        { facilityId },
        { $set: { isDefaultCurrency: false } }
      );
    }

    // Default currencies always have an exchange rate of 1
    const finalExchangeRate = isDefaultCurrency ? 1 : exchangeRate;

    const savedCurrency = await currencyModel.create({
      facilityId,
      currencyName,
      currencyShortCode,
      isDefaultCurrency,
      exchangeRate: finalExchangeRate
    });

    return reply.code(200).send({
      message: "Currency added successfully",
      currency: savedCurrency,
    });
  } catch (err) {
    console.error("Error in addCurrency:", err);
    if (err.code === 11000) {
      return reply.code(400).send({
        error: "Currency short code already exists"
      });
    }
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addCurrency;