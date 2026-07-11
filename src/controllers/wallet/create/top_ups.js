const { topUpValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const createWalletMetadata = require("../facility_transaction_metadata/create_wallet_metadata"); // Update with correct path

const createTopUp = async (request, reply) => {
  try {
    const validationResults = topUpValidator.validate({
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
      walletId,
      amount,
      description,
      date,
      metadata,
      walletType,
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

    // If walletType is provided, verify it matches the wallet's type
    if (walletType && wallet.walletType && wallet.walletType !== walletType) {
      return reply.code(400).send({
        error: `Wallet type mismatch. Expected '${wallet.walletType}', but received '${walletType}'`,
      });
    }

    // Check if wallet is active
    if (!wallet.isActive) {
      return reply
        .code(400)
        .send({ error: "Cannot perform operations on inactive wallet" });
    }

    // Update wallet balance (without transaction)
    wallet.amount += amount;
    await wallet.save();

    // Create transaction record (without transaction)
    const transaction = await walletTransactionModel.create({
      walletId: wallet._id,
      date: date || new Date(),
      amount: amount,
      transactionType: "topup",
      description: description || "Wallet top-up",
      facilityId: facilityId,
    });

    let walletMetadata = null;

    // Create wallet metadata if ownerType is Facility and metadata is provided
    if (wallet.ownerType === "Facility" && metadata) {
      try {
        walletMetadata = await createWalletMetadata(
          walletId,
          facilityId,
          metadata,
        );
      } catch (metadataError) {
        console.error("Error creating wallet metadata:", metadataError);
        // Note: We continue execution even if metadata creation fails
        // You might want to handle this differently based on your business requirements
      }
    }

    const response = {
      message: "Top-up created successfully",
      wallet: wallet,
      transaction: transaction,
    };

    // Include metadata in response if it was created
    if (walletMetadata) {
      response.metadata = walletMetadata;
    }

    return reply.code(200).send(response);
  } catch (err) {
    console.error("Error in createTopUp:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = createTopUp;
