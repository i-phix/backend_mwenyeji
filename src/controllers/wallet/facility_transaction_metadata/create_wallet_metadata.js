const { getModel } = require("../../../utils/getModel");
const payservedb = require("payservedb");

const createWalletMetadata = async (walletId, facilityId, metadata) => {
  try {
    // Get the FacilityWalletTransactionsMetadata model
    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );

    // Create the metadata record with pending status by default
    const walletMetadata = await metadataModel.create({
      invoiceId: metadata.invoiceId,
      invoiceNumber: metadata.invoiceNumber,
      amount: metadata.amount,
      walletId: walletId,
      status: metadata.status || "pending", // Default to pending if not specified
      amountToLandlord: metadata.amountToLandlord || 0,
      amountToPropertyManager: metadata.amountToPropertyManager || 0,
      paidToLandlord: metadata.paidToLandlord || false,
      paidToPropertyManager: metadata.paidToPropertyManager || false,
      propertyManager: metadata.propertyManager,
      landlord: metadata.landlord,
      facility: facilityId,
      // Add fields for approval/rejection tracking
      approvedBy: null,
      approvedAt: null,
      approvalNotes: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      transactionId: null, // Will be set when approved
    });

    return walletMetadata;
  } catch (error) {
    console.error("Error creating wallet metadata:", error);
    throw error;
  }
};

// Create metadata directly without creating transaction (for pending approval)
const createPendingMetadata = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const {
      walletId,
      invoiceId,
      invoiceNumber,
      amount,
      amountToLandlord = 0,
      amountToPropertyManager = 0,
      propertyManager,
      landlord,
    } = request.body;

    // Validate required fields
    if (!walletId || !invoiceId || !invoiceNumber || !amount) {
      return reply.code(400).send({
        error: "walletId, invoiceId, invoiceNumber, and amount are required",
      });
    }

    // Verify wallet exists
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    const wallet = await walletModel.findById(walletId);
    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    // Check if wallet belongs to the facility
    if (wallet.facilityId.toString() !== facilityId) {
      return reply.code(400).send({
        error: "Wallet does not belong to this facility",
      });
    }

    // Create pending metadata
    const metadata = await createWalletMetadata(walletId, facilityId, {
      invoiceId,
      invoiceNumber,
      amount,
      status: "pending",
      amountToLandlord,
      amountToPropertyManager,
      propertyManager,
      landlord,
    });

    return reply.code(201).send({
      message: "Pending metadata created successfully",
      metadata: metadata,
      wallet: {
        id: wallet._id,
        owner: wallet.owner,
        ownerType: wallet.ownerType,
        walletType: wallet.walletType,
        currentAmount: wallet.amount,
      },
    });
  } catch (err) {
    console.error("Error in createPendingMetadata:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  createWalletMetadata,
  createPendingMetadata,
};
