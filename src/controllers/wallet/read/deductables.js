const {
  paginationValidator,
  transactionFilterValidator,
} = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Get all deductables for a facility
const getFacilityDeductables = async (request, reply) => {
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
    const query = { facilityId, transactionType: "deductable" };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Remove .populate("walletId") to fix the schema registration error
    const deductables = await walletTransactionModel
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
      message: "Deductables retrieved successfully",
      deductables: deductables,
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
    console.error("Error in getFacilityDeductables:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get deductables by wallet ID
const getWalletDeductables = async (request, reply) => {
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
    const query = { facilityId, walletId, transactionType: "deductable" };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const deductables = await walletTransactionModel
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
      message: "Wallet deductables retrieved successfully",
      deductables: deductables,
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
    console.error("Error in getWalletDeductables:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get deductables by owner
const getOwnerDeductables = async (request, reply) => {
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
      transactionType: "deductable",
    };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const deductables = await walletTransactionModel
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
      message: "Owner deductables retrieved successfully",
      deductables: deductables,
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
    console.error("Error in getOwnerDeductables:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get deductable by ID
const getDeductableById = async (request, reply) => {
  try {
    const { facilityId, deductableId } = request.params;

    // Get wallet transaction model
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    const deductable = await walletTransactionModel
      .findOne({ _id: deductableId, facilityId, transactionType: "deductable" })
      .populate("walletId");

    if (!deductable) {
      return reply.code(404).send({ error: "Deductable not found" });
    }

    return reply.code(200).send({
      message: "Deductable retrieved successfully",
      deductable: deductable,
    });
  } catch (err) {
    console.error("Error in getDeductableById:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  getFacilityDeductables,
  getWalletDeductables,
  getOwnerDeductables,
  getDeductableById,
};
