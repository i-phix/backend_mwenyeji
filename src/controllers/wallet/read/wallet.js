const {
  paginationValidator,
  walletSearchValidator,
} = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

// Get wallet by ID
const getWalletById = async (request, reply) => {
  try {
    const { facilityId, walletId } = request.params;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    const wallet = await walletModel.findById(walletId);

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
      message: "Wallet retrieved successfully",
      wallet: wallet,
    });
  } catch (err) {
    console.error("Error in getWalletById:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get wallet by owner
const getWalletByOwner = async (request, reply) => {
  try {
    const { facilityId, ownerId, ownerType } = request.params;
    const { walletType } = request.query; // Optional wallet type filter

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Build query
    const query = {
      owner: ownerId,
      ownerType,
      facilityId,
    };

    // Add walletType to query if provided
    if (walletType) {
      query.walletType = walletType;
    }

    const wallets = await walletModel.find(query);

    if (!wallets || wallets.length === 0) {
      return reply.code(404).send({ error: "No wallets found for this owner" });
    }

    // If walletType was specified, return single wallet, otherwise return array
    const response = walletType && wallets.length === 1 ? wallets[0] : wallets;

    return reply.code(200).send({
      message: "Wallet(s) retrieved successfully",
      wallet: walletType && wallets.length === 1 ? response : undefined,
      wallets: walletType && wallets.length === 1 ? undefined : response,
    });
  } catch (err) {
    console.error("Error in getWalletByOwner:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get all wallets in facility
const getFacilityWallets = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate query parameters
    const queryValidation = paginationValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, includeInactive } = queryValidation.value;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only include active wallets unless specified
    const query = { facilityId };
    if (!includeInactive) {
      query.isActive = true;
    }

    const wallets = await walletModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await walletModel.countDocuments(query);

    return reply.code(200).send({
      message: "Wallets retrieved successfully",
      wallets: wallets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getFacilityWallets:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get wallets by owner type
const getWalletsByOwnerType = async (request, reply) => {
  try {
    const { facilityId, ownerType } = request.params;

    // Validate query parameters
    const queryValidation = paginationValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, includeInactive } = queryValidation.value;
    const { walletType } = request.query; // Optional wallet type filter

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only include active wallets unless specified
    const query = { facilityId, ownerType };
    if (!includeInactive) {
      query.isActive = true;
    }
    if (walletType) {
      query.walletType = walletType;
    }

    const wallets = await walletModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await walletModel.countDocuments(query);

    return reply.code(200).send({
      message: "Wallets retrieved successfully",
      wallets: wallets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getWalletsByOwnerType:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get wallets by wallet type
const getWalletsByWalletType = async (request, reply) => {
  try {
    const { facilityId, walletType } = request.params;

    // Validate query parameters
    const queryValidation = paginationValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit, includeInactive } = queryValidation.value;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only include active wallets unless specified
    const query = { facilityId, walletType };
    if (!includeInactive) {
      query.isActive = true;
    }

    const wallets = await walletModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await walletModel.countDocuments(query);

    return reply.code(200).send({
      message: "Wallets retrieved successfully",
      wallets: wallets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getWalletsByWalletType:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Get inactive wallets in facility
const getInactiveWallets = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate query parameters
    const queryValidation = paginationValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const { page, limit } = queryValidation.value;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const wallets = await walletModel
      .find({ facilityId, isActive: false })
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await walletModel.countDocuments({
      facilityId,
      isActive: false,
    });

    return reply.code(200).send({
      message: "Inactive wallets retrieved successfully",
      wallets: wallets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in getInactiveWallets:", err);
    return reply.code(400).send({ error: err.message });
  }
};

// Search wallets with filters
const searchWallets = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Validate query parameters
    const queryValidation = walletSearchValidator.validate(request.query);
    if (queryValidation.error) {
      return reply
        .code(400)
        .send({ error: queryValidation.error.details[0].message });
    }

    const {
      ownerType,
      walletType,
      isActive,
      minAmount,
      maxAmount,
      page,
      limit,
    } = queryValidation.value;

    // Get wallet model
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { facilityId };
    if (ownerType) query.ownerType = ownerType;
    if (walletType) query.walletType = walletType;
    if (isActive !== undefined) query.isActive = isActive;
    if (minAmount !== undefined)
      query.amount = { ...query.amount, $gte: minAmount };
    if (maxAmount !== undefined)
      query.amount = { ...query.amount, $lte: maxAmount };

    const wallets = await walletModel
      .find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await walletModel.countDocuments(query);

    return reply.code(200).send({
      message: "Wallets search completed successfully",
      wallets: wallets,
      searchCriteria: { ownerType, walletType, isActive, minAmount, maxAmount },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Error in searchWallets:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = {
  getWalletById,
  getWalletByOwner,
  getFacilityWallets,
  getWalletsByOwnerType,
  getWalletsByWalletType, // New controller
  getInactiveWallets,
  searchWallets,
};
