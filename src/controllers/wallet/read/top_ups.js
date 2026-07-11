const {
  paginationValidator,
  transactionFilterValidator,
} = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Get all top-ups for a facility
const getFacilityTopUps = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate query parameters
    const queryValidation = transactionFilterValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, startDate, endDate } = queryValidation.value;

    // Get wallet transaction model
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { facilityId, transactionType: "topup" };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Remove .populate("walletId") to avoid the schema registration error
    const topUps = await walletTransactionModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });

    const total = await walletTransactionModel.countDocuments(query);

    // Calculate total amount
    const totalAmountResult = await walletTransactionModel.aggregate([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const totalAmount =
      totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

    return reply.code(200).send({
      message: "Top-ups retrieved successfully",
      topUps: topUps,
      summary: {
        totalTransactions: total,
        totalAmount: totalAmount,
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getFacilityTopUps:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get top-ups by wallet ID
const getWalletTopUps = async (request, reply) => {
  try {
    const { facilityId, walletId } = request.params;

    // Validate query parameters
    const queryValidation = transactionFilterValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, startDate, endDate } = queryValidation.value;

    // Get wallet transaction model
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { facilityId, walletId, transactionType: "topup" };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const topUps = await walletTransactionModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });

    const total = await walletTransactionModel.countDocuments(query);

    // Calculate total amount for this wallet
    const totalAmountResult = await walletTransactionModel.aggregate([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const totalAmount =
      totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

    return reply.code(200).send({
      message: "Wallet top-ups retrieved successfully",
      topUps: topUps,
      walletId: walletId,
      summary: {
        totalTransactions: total,
        totalAmount: totalAmount,
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getWalletTopUps:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get top-ups by owner
const getOwnerTopUps = async (request, reply) => {
  try {
    const { facilityId, ownerId, ownerType } = request.params;

    // Validate query parameters
    const queryValidation = transactionFilterValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, startDate, endDate } = queryValidation.value;

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

    // Find wallet first
    const wallet = await walletModel.findOne({
      owner: ownerId,
      ownerType,
      facilityId,
    });
    if (!wallet) {
      return reply.code(404).send({ error: "Wallet not found" });
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {
      facilityId,
      walletId: wallet._id,
      transactionType: "topup",
    };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const topUps = await walletTransactionModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });

    const total = await walletTransactionModel.countDocuments(query);

    // Calculate total amount
    const totalAmountResult = await walletTransactionModel.aggregate([
      { $match: query },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
    const totalAmount =
      totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

    return reply.code(200).send({
      message: "Owner top-ups retrieved successfully",
      topUps: topUps,
      owner: { id: ownerId, type: ownerType },
      wallet: wallet,
      summary: {
        totalTransactions: total,
        totalAmount: totalAmount,
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getOwnerTopUps:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get top-up by ID
const getTopUpById = async (request, reply) => {
  try {
    const { facilityId, topUpId } = request.params;

    // Get wallet transaction model
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    const topUp = await walletTransactionModel
      .findOne({ _id: topUpId, facilityId, transactionType: "topup" })
      .populate("walletId");

    if (!topUp) {
      return reply.code(404).send({ error: "Top-up not found" });
    }

    return reply.code(200).send({
      message: "Top-up retrieved successfully",
      topUp: topUp,
    });
  } catch (err) {
    console.error("Error in getTopUpById:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  getFacilityTopUps,
  getWalletTopUps,
  getOwnerTopUps,
  getTopUpById,
};
