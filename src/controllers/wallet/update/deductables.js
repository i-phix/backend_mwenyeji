const { deductableUpdateValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Update deductable transaction
const updateDeductable = async (request, reply) => {
  try {
    const validationResults = deductableUpdateValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const { facilityId, deductableId } = request.params;
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

    // Find the current deductable transaction
    const currentDeductable = await walletTransactionModel.findOne({
      _id: deductableId,
      facilityId,
      transactionType: "deductable",
    });

    if (!currentDeductable) {
      return reply
        .code(404)
        .send({ error: "Deductable transaction not found" });
    }

    // If amount is being updated, we need to adjust wallet balance
    if (amount !== undefined && amount !== currentDeductable.amount) {
      // Find the associated wallet
      const wallet = await walletModel.findById(currentDeductable.walletId);
      if (!wallet) {
        return reply.code(404).send({ error: "Associated wallet not found" });
      }

      // Check if wallet is active
      if (!wallet.isActive) {
        return reply
          .code(400)
          .send({ error: "Cannot update transactions for inactive wallet" });
      }

      // Calculate the difference
      const amountDifference = amount - currentDeductable.amount;

      // Check if the new amount would cause insufficient balance
      if (wallet.amount < amountDifference) {
        return reply.code(400).send({
          error: "Insufficient balance for the updated deduction amount",
        });
      }

      // Start database transaction
      const session = await walletModel.db.startSession();
      session.startTransaction();

      try {
        // Update wallet balance (subtract the difference)
        // If new amount is higher, we deduct more
        // If new amount is lower, we add back the difference
        wallet.amount -= amountDifference;
        await wallet.save({ session });

        // Update transaction record
        const updateData = {};
        if (amount !== undefined) updateData.amount = amount;
        if (description !== undefined) updateData.description = description;
        if (date !== undefined) updateData.date = date;

        const updatedDeductable =
          await walletTransactionModel.findByIdAndUpdate(
            deductableId,
            updateData,
            { new: true, session },
          );

        await session.commitTransaction();

        return reply.code(200).send({
          message: "Deductable updated successfully",
          deductable: updatedDeductable,
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

      const updatedDeductable = await walletTransactionModel.findByIdAndUpdate(
        deductableId,
        updateData,
        { new: true },
      );

      return reply.code(200).send({
        message: "Deductable updated successfully",
        deductable: updatedDeductable,
      });
    }
  } catch (err) {
    console.error("Error in updateDeductable:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  updateDeductable,
};
