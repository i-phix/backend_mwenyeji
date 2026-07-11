const {
  walletUpdateValidator,
  walletBalanceValidator,
  walletUpdateByIdValidator,
} = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Update wallet (topup or deduct with transaction record)
const updateWallet = async (request, reply) => {
  try {
    const validationResults = walletUpdateValidator.validate({
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
      owner,
      ownerType,
      walletType,
      amount,
      transactionType,
      description,
    } = validationResults.value;

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

    // Build query to find wallet
    const walletQuery = { owner, ownerType, facilityId };
    if (walletType) {
      walletQuery.walletType = walletType;
    }

    // Find wallet
    const wallet = await walletModel.findOne(walletQuery);
    if (!wallet) {
      const errorMsg = walletType
        ? `Wallet of type '${walletType}' not found for this owner`
        : "Wallet not found for this owner";
      return reply.code(404).send({ error: errorMsg });
    }

    // Check if wallet is active
    if (!wallet.isActive) {
      return reply
        .code(400)
        .send({ error: "Cannot perform operations on inactive wallet" });
    }

    // Check balance for deductions
    if (transactionType === "deductable" && wallet.amount < amount) {
      return reply.code(400).send({ error: "Insufficient balance" });
    }

    // Start database transaction
    const session = await walletModel.db.startSession();
    session.startTransaction();

    try {
      // Update wallet balance based on transaction type
      if (transactionType === "topup") {
        wallet.amount += amount;
      } else if (transactionType === "deductable") {
        wallet.amount -= amount;
      }

      await wallet.save({ session });

      // Create transaction record
      const transaction = await walletTransactionModel.create(
        [
          {
            walletId: wallet._id,
            date: new Date(),
            amount: amount,
            transactionType: transactionType,
            description: description || `Wallet ${transactionType}`,
            facilityId: facilityId,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      return reply.code(200).send({
        message: `Wallet ${transactionType} completed successfully`,
        wallet: wallet,
        transaction: transaction[0],
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (err) {
    console.error("Error in updateWallet:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Update wallet balance only (without transaction record)
const updateWalletBalance = async (request, reply) => {
  try {
    const validationResults = walletBalanceValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const { facilityId, owner, ownerType, walletType, amount } =
      validationResults.value;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Build query to find wallet
    const walletQuery = { owner, ownerType, facilityId };
    if (walletType) {
      walletQuery.walletType = walletType;
    }

    // Find and update wallet
    const wallet = await walletModel.findOneAndUpdate(
      walletQuery,
      { amount: amount },
      { new: true },
    );

    if (!wallet) {
      const errorMsg = walletType
        ? `Wallet of type '${walletType}' not found for this owner`
        : "Wallet not found for this owner";
      return reply.code(404).send({ error: errorMsg });
    }

    return reply.code(200).send({
      message: "Wallet balance updated successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in updateWalletBalance:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Update wallet by ID
const updateWalletById = async (request, reply) => {
  try {
    const validationResults = walletUpdateByIdValidator.validate(request.body);

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const { facilityId, walletId } = request.params;
    const updateData = validationResults.value;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Remove empty fields from update
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined || updateData[key] === null) {
        delete updateData[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return reply.code(400).send({ error: "No valid fields to update" });
    }

    // If updating walletType, check for duplicates
    if (updateData.walletType) {
      const existingWallet = await walletModel.findById(walletId);
      if (!existingWallet) {
        return reply.code(404).send({ error: "Wallet not found" });
      }

      // Check if another wallet exists with the same owner, ownerType, and new walletType
      const duplicateWallet = await walletModel.findOne({
        owner: existingWallet.owner,
        ownerType: existingWallet.ownerType,
        walletType: updateData.walletType,
        facilityId: facilityId,
        _id: { $ne: walletId }, // Exclude current wallet
      });

      if (duplicateWallet) {
        return reply.code(400).send({
          error: `A wallet of type '${updateData.walletType}' already exists for this owner`,
        });
      }
    }

    // Find and update wallet
    const wallet = await walletModel.findByIdAndUpdate(walletId, updateData, {
      new: true,
    });

    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    // Check if wallet belongs to facility
    if (wallet.facilityId.toString() !== facilityId) {
      return reply
        .code(400)
        .send({ error: "Wallet does not belong to this facility" });
    }

    return reply.code(200).send({
      message: "Wallet updated successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in updateWalletById:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  updateWallet,
  updateWalletBalance,
  updateWalletById,
};
