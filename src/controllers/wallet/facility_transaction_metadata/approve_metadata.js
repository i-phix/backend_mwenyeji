const {
  approveMetadataValidator,
  approveMultipleMetadataValidator,
  rejectMetadataValidator,
  pendingMetadataQueryValidator,
} = require("../../../utils/validator");
const { getModel } = require("../../../utils/getModel");
const payservedb = require("payservedb");

// Approve single metadata and create transaction
const approveSingleMetadata = async (request, reply) => {
  try {
    const { facilityId, metadataId } = request.params;

    // Validate request body
    const validation = approveMetadataValidator.validate(request.body);
    if (validation.error) {
      return reply
        .code(400)
        .send({ error: validation.error.details[0].message });
    }

    const { approvedBy, notes } = validation.value;

    // Get models
    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );
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

    // Find the metadata
    const metadata = await metadataModel.findById(metadataId);
    if (!metadata) {
      return reply.code(404).send({ error: "Metadata not found" });
    }

    // Check if metadata belongs to the facility
    if (metadata.facility.toString() !== facilityId) {
      return reply.code(400).send({
        error: "Metadata does not belong to this facility",
      });
    }

    // Check if metadata is in pending status
    if (metadata.status !== "pending") {
      return reply.code(400).send({
        error: `Cannot approve metadata with status: ${metadata.status}`,
      });
    }

    // Find the associated wallet
    const wallet = await walletModel.findById(metadata.walletId);
    if (!wallet) {
      return reply.code(404).send({ error: "Associated wallet not found" });
    }

    // Check if wallet is active
    if (!wallet.isActive) {
      return reply.code(400).send({
        error: "Cannot approve transactions for inactive wallet",
      });
    }

    // Perform operations without explicit session - let mongoose handle it
    try {
      // Store original amounts for response
      const previousAmount = wallet.amount;

      // Update wallet balance
      wallet.amount += metadata.amount;
      await wallet.save();

      // Create wallet transaction
      const transaction = await walletTransactionModel.create({
        walletId: wallet._id,
        date: new Date(),
        amount: metadata.amount,
        transactionType: "topup",
        description: `Approved transaction from invoice ${metadata.invoiceNumber}`,
        facilityId: facilityId,
        metadataId: metadata._id, // Link to metadata
      });

      // Update metadata status
      metadata.status = "approved";
      metadata.approvedBy = approvedBy;
      metadata.approvedAt = new Date();
      if (notes) metadata.approvalNotes = notes;
      metadata.transactionId = transaction._id; // Link to created transaction
      await metadata.save();

      return reply.code(200).send({
        success: true,
        message: "Metadata approved and transaction created successfully",
        metadata: metadata,
        transaction: transaction,
        wallet: {
          id: wallet._id,
          newAmount: wallet.amount,
          previousAmount: previousAmount,
        },
      });
    } catch (error) {
      console.error("Error in approval process:", error);

      // If there was an error, try to rollback wallet amount
      try {
        const rollbackWallet = await walletModel.findById(metadata.walletId);
        if (rollbackWallet && rollbackWallet.amount >= metadata.amount) {
          rollbackWallet.amount -= metadata.amount;
          await rollbackWallet.save();
        }
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }

      throw error;
    }
  } catch (err) {
    console.error("Error in approveSingleMetadata:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Approve multiple metadata records and create transactions
const approveMultipleMetadata = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate request body
    const validation = approveMultipleMetadataValidator.validate(request.body);
    if (validation.error) {
      return reply
        .code(400)
        .send({ error: validation.error.details[0].message });
    }

    const { metadataIds, approvedBy, notes } = validation.value;

    // Get models
    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );
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

    // Find all metadata records
    const metadataRecords = await metadataModel.find({
      _id: { $in: metadataIds },
      facility: facilityId,
    });

    if (metadataRecords.length !== metadataIds.length) {
      return reply.code(404).send({
        error:
          "Some metadata records were not found or do not belong to this facility",
      });
    }

    // Check if all metadata are in pending status
    const nonPendingMetadata = metadataRecords.filter(
      (m) => m.status !== "pending",
    );
    if (nonPendingMetadata.length > 0) {
      return reply.code(400).send({
        error: `Cannot approve non-pending metadata. IDs with invalid status: ${nonPendingMetadata.map((m) => `${m._id} (${m.status})`).join(", ")}`,
      });
    }

    // Group metadata by wallet to optimize wallet updates
    const metadataByWallet = {};
    metadataRecords.forEach((metadata) => {
      const walletId = metadata.walletId.toString();
      if (!metadataByWallet[walletId]) {
        metadataByWallet[walletId] = [];
      }
      metadataByWallet[walletId].push(metadata);
    });

    // Get all affected wallets
    const walletIds = Object.keys(metadataByWallet);
    const wallets = await walletModel.find({ _id: { $in: walletIds } });

    if (wallets.length !== walletIds.length) {
      return reply.code(404).send({
        error: "Some associated wallets were not found",
      });
    }

    const walletMap = {};
    wallets.forEach((wallet) => {
      walletMap[wallet._id.toString()] = wallet;
    });

    // Check if all wallets are active
    const inactiveWallets = wallets.filter((w) => !w.isActive);
    if (inactiveWallets.length > 0) {
      return reply.code(400).send({
        error: `Cannot approve transactions for inactive wallets: ${inactiveWallets.map((w) => w._id).join(", ")}`,
      });
    }

    const results = {
      approved: [],
      failed: [],
      transactions: [],
      walletUpdates: [],
    };

    // Process each wallet's metadata sequentially to avoid conflicts
    for (const [walletId, walletMetadata] of Object.entries(metadataByWallet)) {
      try {
        const wallet = walletMap[walletId];
        const totalAmount = walletMetadata.reduce(
          (sum, m) => sum + m.amount,
          0,
        );
        const previousAmount = wallet.amount;

        // Update wallet balance
        wallet.amount += totalAmount;
        await wallet.save();

        // Create transactions for each metadata
        for (const metadata of walletMetadata) {
          try {
            const transaction = await walletTransactionModel.create({
              walletId: wallet._id,
              date: new Date(),
              amount: metadata.amount,
              transactionType: "topup",
              description: `Approved transaction from invoice ${metadata.invoiceNumber}`,
              facilityId: facilityId,
              metadataId: metadata._id,
            });

            // Update metadata
            metadata.status = "approved";
            metadata.approvedBy = approvedBy;
            metadata.approvedAt = new Date();
            if (notes) metadata.approvalNotes = notes;
            metadata.transactionId = transaction._id;
            await metadata.save();

            results.approved.push({
              metadataId: metadata._id,
              invoiceNumber: metadata.invoiceNumber,
              amount: metadata.amount,
              transactionId: transaction._id,
            });

            results.transactions.push(transaction);
          } catch (error) {
            console.error(`Error processing metadata ${metadata._id}:`, error);
            results.failed.push({
              metadataId: metadata._id,
              invoiceNumber: metadata.invoiceNumber,
              error: error.message,
            });
          }
        }

        results.walletUpdates.push({
          walletId: wallet._id,
          previousAmount,
          newAmount: wallet.amount,
          totalAdded: totalAmount,
          transactionCount: walletMetadata.length,
        });
      } catch (error) {
        console.error(`Error processing wallet ${walletId}:`, error);
        // Add all wallet metadata to failed list
        walletMetadata.forEach((metadata) => {
          results.failed.push({
            metadataId: metadata._id,
            invoiceNumber: metadata.invoiceNumber,
            error: `Wallet processing failed: ${error.message}`,
          });
        });
      }
    }

    return reply.code(200).send({
      success: true,
      message: `Successfully approved ${results.approved.length} metadata records${results.failed.length > 0 ? ` (${results.failed.length} failed)` : ""}`,
      results: results,
      summary: {
        totalProcessed: metadataIds.length,
        totalApproved: results.approved.length,
        totalFailed: results.failed.length,
        totalAmount: results.approved.reduce((sum, r) => sum + r.amount, 0),
        walletsAffected: results.walletUpdates.length,
      },
    });
  } catch (err) {
    console.error("Error in approveMultipleMetadata:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get pending metadata for approval
const getPendingMetadata = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate query parameters
    const queryValidation = pendingMetadataQueryValidator.validate(
      request.query,
    );
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, walletId, sortBy, sortOrder } = queryValidation.value;

    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );

    // Build query
    const query = {
      facility: facilityId,
      status: "pending",
    };

    if (walletId) {
      query.walletId = walletId;
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get pending metadata with pagination and populate related data
    const pendingMetadata = await metadataModel
      .find(query)
      .populate({
        path: "walletId",
        select: "owner ownerType walletType amount isActive",
        populate: [
          {
            path: "owner",
            select: "firstName lastName email companyName",
          },
        ],
      })
      .populate("propertyManager", "firstName lastName email")
      .populate("landlord", "firstName lastName email companyName")
      .populate("createdBy", "firstName lastName email")
      .limit(parseInt(limit))
      .skip(skip)
      .sort(sort);

    const total = await metadataModel.countDocuments(query);

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          minAmount: { $min: "$amount" },
          maxAmount: { $max: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];

    const summaryResult = await metadataModel.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalAmount: 0,
      avgAmount: 0,
      minAmount: 0,
      maxAmount: 0,
      count: 0,
    };

    // Get breakdown by wallet if needed
    let walletBreakdown = null;
    if (!walletId) {
      const walletBreakdownPipeline = [
        { $match: query },
        {
          $group: {
            _id: "$walletId",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }, // Top 10 wallets by pending amount
      ];

      walletBreakdown = await metadataModel.aggregate(walletBreakdownPipeline);
    }

    return reply.code(200).send({
      success: true,
      message: "Pending metadata retrieved successfully",
      data: {
        pendingMetadata: pendingMetadata,
        summary: {
          total,
          totalAmount: summary.totalAmount,
          avgAmount: summary.avgAmount,
          minAmount: summary.minAmount,
          maxAmount: summary.maxAmount,
        },
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        ...(walletBreakdown && { walletBreakdown }),
      },
    });
  } catch (err) {
    console.error("Error in getPendingMetadata:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Reject metadata
// Reject metadata
const rejectMetadata = async (request, reply) => {
  try {
    const { facilityId, metadataId } = request.params;

    // Validate request body
    const validation = rejectMetadataValidator.validate(request.body);
    if (validation.error) {
      return reply
        .code(400)
        .send({ error: validation.error.details[0].message });
    }

    const { rejectedBy, rejectionReason } = validation.value;

    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );

    // Find the metadata
    const metadata = await metadataModel.findById(metadataId);
    if (!metadata) {
      return reply.code(404).send({ error: "Metadata not found" });
    }

    // Check if metadata belongs to the facility
    if (metadata.facility.toString() !== facilityId) {
      return reply.code(400).send({
        error: "Metadata does not belong to this facility",
      });
    }

    // Check if metadata is in pending status
    if (metadata.status !== "pending") {
      return reply.code(400).send({
        error: `Cannot reject metadata with status: ${metadata.status}`,
      });
    }

    // Update metadata status to rejected
    metadata.status = "rejected";
    metadata.rejectedBy = rejectedBy;
    metadata.rejectedAt = new Date();
    metadata.rejectionReason = rejectionReason;
    await metadata.save();

    // Only populate walletId to avoid User model issues
    try {
      await metadata.populate({
        path: "walletId",
        select: "owner ownerType walletType amount",
      });
    } catch (populateError) {
      console.warn(
        "Warning: Could not populate wallet data:",
        populateError.message,
      );
    }

    return reply.code(200).send({
      success: true,
      message: "Metadata rejected successfully",
      metadata: metadata,
    });
  } catch (err) {
    console.error("Error in rejectMetadata:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get metadata approval analytics
const getApprovalAnalytics = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    const { startDate, endDate, groupBy = "status" } = request.query;

    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );

    // Build match query
    const matchQuery = { facility: facilityId };

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Status breakdown
    const statusBreakdown = await metadataModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Approval time analytics for approved transactions
    const approvalTimeAnalytics = await metadataModel.aggregate([
      {
        $match: {
          ...matchQuery,
          status: "approved",
          createdAt: { $exists: true },
          approvedAt: { $exists: true },
        },
      },
      {
        $addFields: {
          approvalTimeHours: {
            $divide: [
              { $subtract: ["$approvedAt", "$createdAt"] },
              3600000, // Convert to hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgApprovalTimeHours: { $avg: "$approvalTimeHours" },
          minApprovalTimeHours: { $min: "$approvalTimeHours" },
          maxApprovalTimeHours: { $max: "$approvalTimeHours" },
          totalApproved: { $sum: 1 },
        },
      },
    ]);

    // Top approvers
    const topApprovers = await metadataModel.aggregate([
      {
        $match: {
          ...matchQuery,
          status: "approved",
          approvedBy: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$approvedBy",
          approvalCount: { $sum: 1 },
          totalApproved: { $sum: "$amount" },
        },
      },
      { $sort: { approvalCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "approver",
          pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }],
        },
      },
    ]);

    // Daily/Weekly/Monthly trends if requested
    let trends = null;
    if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
      const groupFormat =
        groupBy === "day"
          ? { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          : groupBy === "week"
            ? { $dateToString: { format: "%Y-%U", date: "$createdAt" } }
            : { $dateToString: { format: "%Y-%m", date: "$createdAt" } };

      trends = await metadataModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              period: groupFormat,
              status: "$status",
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.period": 1 } },
      ]);
    }

    return reply.code(200).send({
      success: true,
      message: "Analytics retrieved successfully",
      analytics: {
        statusBreakdown,
        approvalMetrics: approvalTimeAnalytics[0] || null,
        topApprovers,
        ...(trends && { trends }),
        summary: {
          totalTransactions: statusBreakdown.reduce(
            (sum, item) => sum + item.count,
            0,
          ),
          totalAmount: statusBreakdown.reduce(
            (sum, item) => sum + item.totalAmount,
            0,
          ),
          avgTransactionAmount:
            statusBreakdown.reduce(
              (sum, item) => sum + item.totalAmount / item.count,
              0,
            ) / statusBreakdown.length || 0,
        },
      },
    });
  } catch (err) {
    console.error("Error in getApprovalAnalytics:", err);
    return reply.code(500).send({ error: err.message });
  }
};

// Get metadata by ID with full details
const getMetadataById = async (request, reply) => {
  try {
    const { facilityId, metadataId } = request.params;

    const metadataModel = await getModel(
      "FacilityWalletTransactionsMetadata",
      payservedb.FacilityWalletTransactionsMetadata.schema,
      facilityId,
    );

    const metadata = await metadataModel
      .findById(metadataId)
      .populate({
        path: "walletId",
        select: "owner ownerType walletType amount isActive",
        populate: {
          path: "owner",
          select: "firstName lastName email companyName",
        },
      })
      .populate("propertyManager", "firstName lastName email")
      .populate("landlord", "firstName lastName email companyName")
      .populate("approvedBy", "firstName lastName email")
      .populate("rejectedBy", "firstName lastName email")
      .populate("createdBy", "firstName lastName email")
      .populate("transactionId", "date amount description transactionType");

    if (!metadata) {
      return reply.code(404).send({ error: "Metadata not found" });
    }

    // Check if metadata belongs to the facility
    if (metadata.facility.toString() !== facilityId) {
      return reply.code(400).send({
        error: "Metadata does not belong to this facility",
      });
    }

    return reply.code(200).send({
      success: true,
      message: "Metadata retrieved successfully",
      metadata: metadata,
    });
  } catch (err) {
    console.error("Error in getMetadataById:", err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = {
  approveSingleMetadata,
  approveMultipleMetadata,
  getPendingMetadata,
  rejectMetadata,
  getApprovalAnalytics,
  getMetadataById,
};
