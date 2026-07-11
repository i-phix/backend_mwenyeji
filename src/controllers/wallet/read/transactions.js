const {
  paginationValidator,
  transactionFilterValidator,
} = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Get all transactions for a wallet
const getWalletTransactions = async (request, reply) => {
  try {
    const { facilityId, walletId } = request.params;

    // Validate query parameters
    const queryValidation = transactionFilterValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { transactionType, page, limit, startDate, endDate } =
      queryValidation.value;

    // Get wallet transaction model
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { walletId, facilityId };
    if (transactionType) query.transactionType = transactionType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await walletTransactionModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });

    const total = await walletTransactionModel.countDocuments(query);

    // Get summary statistics
    const summaryPipeline = [
      { $match: query },
      {
        $group: {
          _id: "$transactionType",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];

    const summary = await walletTransactionModel.aggregate(summaryPipeline);
    const summaryObj = {
      topups: { amount: 0, count: 0 },
      deductables: { amount: 0, count: 0 },
      total: { amount: 0, count: 0 },
    };

    summary.forEach((item) => {
      if (item._id === "topup") {
        summaryObj.topups = { amount: item.totalAmount, count: item.count };
      } else if (item._id === "deductable") {
        summaryObj.deductables = {
          amount: item.totalAmount,
          count: item.count,
        };
      }
      summaryObj.total.amount += item.totalAmount;
      summaryObj.total.count += item.count;
    });

    return reply.code(200).send({
      message: "Wallet transactions retrieved successfully",
      transactions: transactions,
      walletId: walletId,
      summary: summaryObj,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getWalletTransactions:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get transactions by owner
const getOwnerTransactions = async (request, reply) => {
  try {
    const { facilityId, ownerId, ownerType } = request.params;

    // Validate query parameters
    const queryValidation = transactionFilterValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { transactionType, page, limit, startDate, endDate } =
      queryValidation.value;

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
    const query = { walletId: wallet._id, facilityId };
    if (transactionType) query.transactionType = transactionType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await walletTransactionModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });

    const total = await walletTransactionModel.countDocuments(query);

    // Get summary statistics
    const summaryPipeline = [
      { $match: query },
      {
        $group: {
          _id: "$transactionType",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];

    const summary = await walletTransactionModel.aggregate(summaryPipeline);
    const summaryObj = {
      topups: { amount: 0, count: 0 },
      deductables: { amount: 0, count: 0 },
      total: { amount: 0, count: 0 },
    };

    summary.forEach((item) => {
      if (item._id === "topup") {
        summaryObj.topups = { amount: item.totalAmount, count: item.count };
      } else if (item._id === "deductable") {
        summaryObj.deductables = {
          amount: item.totalAmount,
          count: item.count,
        };
      }
      summaryObj.total.amount += item.totalAmount;
      summaryObj.total.count += item.count;
    });

    return reply.code(200).send({
      message: "Owner transactions retrieved successfully",
      transactions: transactions,
      owner: { id: ownerId, type: ownerType },
      wallet: wallet,
      summary: summaryObj,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getOwnerTransactions:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get all transactions for a facility
const getFacilityTransactions = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate query parameters
    const queryValidation = transactionFilterValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { transactionType, page, limit, startDate, endDate } =
      queryValidation.value;

    // Get wallet transaction model
    const walletTransactionModel = await getModel(
      "WalletTransaction",
      payservedb.WalletTransaction.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { facilityId };
    if (transactionType) query.transactionType = transactionType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await walletTransactionModel
      .find(query)
      .populate("walletId")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });

    const total = await walletTransactionModel.countDocuments(query);

    // Get comprehensive summary statistics
    const summaryPipeline = [
      { $match: query },
      {
        $group: {
          _id: "$transactionType",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
          minAmount: { $min: "$amount" },
          maxAmount: { $max: "$amount" },
        },
      },
    ];

    const summary = await walletTransactionModel.aggregate(summaryPipeline);
    const summaryObj = {
      topups: { amount: 0, count: 0, avg: 0, min: 0, max: 0 },
      deductables: { amount: 0, count: 0, avg: 0, min: 0, max: 0 },
      total: { amount: 0, count: 0 },
    };

    summary.forEach((item) => {
      const stats = {
        amount: item.totalAmount,
        count: item.count,
        avg: item.avgAmount,
        min: item.minAmount,
        max: item.maxAmount,
      };

      if (item._id === "topup") {
        summaryObj.topups = stats;
      } else if (item._id === "deductable") {
        summaryObj.deductables = stats;
      }
      summaryObj.total.amount += item.totalAmount;
      summaryObj.total.count += item.count;
    });

    return reply.code(200).send({
      message: "Facility transactions retrieved successfully",
      transactions: transactions,
      summary: summaryObj,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getFacilityTransactions:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  getWalletTransactions,
  getOwnerTransactions,
  getFacilityTransactions,
};
