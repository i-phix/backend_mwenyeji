const { getModel } = require("../../../utils/getModel");
const { paginationValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");

const getWalletMetadata = async (request, reply) => {
  try {
    // Extract parameters from request
    const { facilityId, walletId } = request.params;

    // Validate query parameters
    const queryValidation = paginationValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, includeInactive } = queryValidation.value;

    // Get the metadata model
    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );

    // Verify wallet exists first
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
      return reply
        .code(400)
        .send({ error: "Wallet does not belong to this facility" });
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only filter by walletId
    const query = { walletId };

    // Exclude cancelled status if includeInactive is false
    if (!includeInactive) {
      query.status = { $ne: "cancelled" };
    }

    // Get wallet metadata with pagination (without populate for now)
    const walletMetadata = await metadataModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    // Get total count
    const total = await metadataModel.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));

    return reply.code(200).send({
      message: "Wallet metadata retrieved successfully",
      metadata: walletMetadata,
      wallet: {
        _id: wallet._id,
        owner: wallet.owner,
        ownerType: wallet.ownerType,
        walletType: wallet.walletType,
        amount: wallet.amount,
        isActive: wallet.isActive,
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (err) {
    console.error("Error in getWalletMetadata:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getWalletMetadata;
