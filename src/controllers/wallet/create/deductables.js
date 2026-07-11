const { deductValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const createDeductable = async (request, reply) => {
  try {
    const validationResults = deductValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const { facilityId, walletId, amount, description, date } =
      validationResults.value;

    // Get models
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    // Find wallet
    const wallet = await walletModel.findById(walletId);
    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    // Check if wallet belongs to the facility
    if (wallet.facilityId.toString() !== facilityId) {
      return reply
        .code(400)
        .send({ error: "Wallet does not belong to this facility" });
    }

    // Check if wallet is active
    if (!wallet.isActive) {
      return reply
        .code(400)
        .send({ error: "Cannot perform operations on inactive wallet" });
    }

    // Check sufficient balance
    if (wallet.amount < amount) {
      return reply.code(400).send({ error: "Insufficient balance" });
    }

    // Update wallet balance (without transaction)
    wallet.amount -= amount;
    await wallet.save();

    // Create transaction record (without transaction)
    const transaction = await walletTransactionModel.create({
      walletId: wallet._id,
      date: date || new Date(),
      amount: amount,
      transactionType: "deductable",
      description: description || "Wallet deduction",
      facilityId: facilityId,
    });

    return reply.code(200).send({
      message: "Deduction created successfully",
      wallet: wallet,
      transaction: transaction,
    });
  } catch (err) {
    console.error("Error in createDeductable:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = createDeductable;
