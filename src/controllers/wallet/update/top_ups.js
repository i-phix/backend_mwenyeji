const { topUpUpdateValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Update top-up transaction
const updateTopUp = async (request, reply) => {
  try {
    const validationResults = topUpUpdateValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const { facilityId, topUpId } = request.params;
    const { amount, description, date } = validationResults.value;

    // Get models
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Find the current top-up transaction
    const currentTopUp = await walletTransactionModel.findOne({
      _id: topUpId,
      facilityId,
      transactionType: "topup",
    });

    if (!currentTopUp) {
      return reply.code(404).send({ error: "Top-up transaction not found" });
    }

    // If amount is being updated, we need to adjust wallet balance
    if (amount !== undefined && amount !== currentTopUp.amount) {
      // Find the associated wallet
      const wallet = await walletModel.findById(currentTopUp.walletId);
      if (!wallet) {
        return reply.code(404).send({ error: "Associated wallet not found" });
      }

      // Check if wallet is active
      if (!wallet.isActive) {
        return reply
          .code(400)
          .send({ error: "Cannot update transactions for inactive wallet" });
      }

      // Start database transaction
      const session = await walletModel.db.startSession();
      session.startTransaction();

      try {
        // Calculate the difference
        const amountDifference = amount - currentTopUp.amount;

        // Update wallet balance
        wallet.amount += amountDifference;
        await wallet.save({ session });

        // Update transaction record
        const updateData = {};
        if (amount !== undefined) updateData.amount = amount;
        if (description !== undefined) updateData.description = description;
        if (date !== undefined) updateData.date = date;

        const updatedTopUp = await walletTransactionModel.findByIdAndUpdate(
          topUpId,
          updateData,
          { new: true, session },
        );

        await session.commitTransaction();

        return reply.code(200).send({
          message: "Top-up updated successfully",
          topUp: updatedTopUp,
          wallet: wallet,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      // Only updating description or date, no wallet balance change needed
      const updateData = {};
      if (description !== undefined) updateData.description = description;
      if (date !== undefined) updateData.date = date;

      if (Object.keys(updateData).length === 0) {
        return reply.code(400).send({ error: "No valid fields to update" });
      }

      const updatedTopUp = await walletTransactionModel.findByIdAndUpdate(
        topUpId,
        updateData,
        { new: true },
      );

      return reply.code(200).send({
        message: "Top-up updated successfully",
        topUp: updatedTopUp,
      });
    }
  } catch (err) {
    console.error("Error in updateTopUp:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  updateTopUp,
};
