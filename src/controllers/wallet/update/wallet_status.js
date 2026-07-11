const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Deactivate wallet
const deactivateWallet = async (request, reply) => {
  try {
    const { facilityId, walletId } = request.params;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Find and deactivate wallet
    const wallet = await walletModel.findByIdAndUpdate(
      walletId,
      {
        isActive: false,
      },
      { new: true },
    );

    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    return reply.code(200).send({
      message: "Wallet deactivated successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in deactivateWallet:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Activate wallet
const activateWallet = async (request, reply) => {
  try {
    const { facilityId, walletId } = request.params;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Find and activate wallet
    const wallet = await walletModel.findByIdAndUpdate(
      walletId,
      {
        isActive: true,
      },
      { new: true },
    );

    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    return reply.code(200).send({
      message: "Wallet activated successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in activateWallet:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Deactivate wallet by owner
const deactivateWalletByOwner = async (request, reply) => {
  try {
    const { facilityId, ownerId, ownerType } = request.params;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Find and deactivate wallet
    const wallet = await walletModel.findOneAndUpdate(
      { owner: ownerId, ownerType, facilityId },
      { isActive: false },
      { new: true },
    );

    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    return reply.code(200).send({
      message: "Wallet deactivated successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in deactivateWalletByOwner:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Activate wallet by owner
const activateWalletByOwner = async (request, reply) => {
  try {
    const { facilityId, ownerId, ownerType } = request.params;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Find and activate wallet
    const wallet = await walletModel.findOneAndUpdate(
      { owner: ownerId, ownerType, facilityId },
      { isActive: true },
      { new: true },
    );

    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    return reply.code(200).send({
      message: "Wallet activated successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in activateWalletByOwner:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  deactivateWallet,
  activateWallet,
  deactivateWalletByOwner,
  activateWalletByOwner,
};
