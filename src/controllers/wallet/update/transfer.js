const { transferValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Transfer money between wallets
const transferMoney = async (request, reply) => {
  try {
    const validationResults = transferValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const {
      facilityId,
      fromOwner,
      fromOwnerType,
      toOwner,
      toOwnerType,
      amount,
      description,
    } = validationResults.value;

    // Prevent transfer to the same wallet
    if (fromOwner === toOwner && fromOwnerType === toOwnerType) {
      return reply
        .code(400)
        .send({ error: "Cannot transfer to the same wallet" });
    }

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

    // Find both wallets
    const fromWallet = await walletModel.findOne({
      owner: fromOwner,
      ownerType: fromOwnerType,
      facilityId,
    });

    const toWallet = await walletModel.findOne({
      owner: toOwner,
      ownerType: toOwnerType,
      facilityId,
    });

    if (!fromWallet) {
      return reply.code(404).send({ error: "Source wallet not found" });
    }

    if (!toWallet) {
      return reply.code(404).send({ error: "Destination wallet not found" });
    }

    // Check if both wallets are active
    if (!fromWallet.isActive) {
      return reply.code(400).send({ error: "Source wallet is inactive" });
    }

    if (!toWallet.isActive) {
      return reply.code(400).send({ error: "Destination wallet is inactive" });
    }

    // Check sufficient balance
    if (fromWallet.amount < amount) {
      return reply
        .code(400)
        .send({ error: "Insufficient balance in source wallet" });
    }

    try {
      // Update wallet balances
      fromWallet.amount -= amount;
      toWallet.amount += amount;

      await fromWallet.save();
      await toWallet.save();

      // Create transaction records for both wallets
      const transferDescription = description || `Transfer between wallets`;

      const deductTransaction = await walletTransactionModel.create({
        walletId: fromWallet._id,
        date: new Date(),
        amount: amount,
        transactionType: "deductable",
        description: `${transferDescription} (Transfer out to ${toOwnerType}: ${toOwner})`,
        facilityId: facilityId,
      });

      const topUpTransaction = await walletTransactionModel.create({
        walletId: toWallet._id,
        date: new Date(),
        amount: amount,
        transactionType: "topup",
        description: `${transferDescription} (Transfer in from ${fromOwnerType}: ${fromOwner})`,
        facilityId: facilityId,
      });

      return reply.code(200).send({
        message: "Money transferred successfully",
        transfer: {
          fromWallet: fromWallet,
          toWallet: toWallet,
          amount: amount,
          deductTransaction: deductTransaction,
          topUpTransaction: topUpTransaction,
        },
      });
    } catch (error) {
      // Since we don't have transactions anymore, we can't roll back automatically
      // In a production environment, you might want to implement compensating operations here
      throw error;
    }
  } catch (err) {
    console.error("Error in transferMoney:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  transferMoney,
};
