const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const updateCurrency = async (request, reply) => {
  try {
    const { facilityId, currencyId } = request.params;
    const { isDefaultCurrency, exchangeRate } = request.body;

    const currencyModel = await getModel(
      "Currency",
      payservedb.Currency.schema,
      facilityId
    );

    // If setting this currency as default, unset the default flag for all other currencies in the facility
    if (isDefaultCurrency) {
      await currencyModel.updateMany(
        { facilityId, _id: { $ne: currencyId } },
        { $set: { isDefaultCurrency: false } }
      );
    }

    // Prepare update object
    const updateData = { isDefaultCurrency };
    
    // Default currencies always have an exchange rate of 1
    if (isDefaultCurrency) {
      updateData.exchangeRate = 1;
    } else if (exchangeRate !== undefined) {
      updateData.exchangeRate = exchangeRate;
    }

    const updatedCurrency = await currencyModel.findOneAndUpdate(
      { _id: currencyId, facilityId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedCurrency) {
      return reply.code(404).send({ error: "Currency not found" });
    }

    return reply.code(200).send({
      message: "Currency updated successfully",
      currency: updatedCurrency,
    });
  } catch (err) {
    console.error("Error in updateCurrency:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = updateCurrency;