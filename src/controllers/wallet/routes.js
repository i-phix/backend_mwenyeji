const authenticateJWT = require("../../middlewares/jwt_authentication");

// Import CREATE controllers
const createWallet = require("./create/wallet");
const createTopUp = require("./create/top_ups");
const createDeductable = require("./create/deductables");

// Import READ controllers
const {
  getWalletById,
  getWalletByOwner,
  getFacilityWallets,
  getWalletsByOwnerType,
  getInactiveWallets,
  searchWallets,
} = require("./read/wallet");

const getWalletMetadata = require("./facility_transaction_metadata/get_wallet_metadata");

const {
  getFacilityTopUps,
  getWalletTopUps,
  getOwnerTopUps,
  getTopUpById,
} = require("./read/top_ups");

const {
  getFacilityDeductables,
  getWalletDeductables,
  getOwnerDeductables,
  getDeductableById,
} = require("./read/deductables");

const {
  getWalletTransactions,
  getOwnerTransactions,
  getFacilityTransactions,
} = require("./read/transactions");

// Import UPDATE controllers
const {
  updateWallet,
  updateWalletBalance,
  updateWalletById,
} = require("./update/wallet");

const { updateTopUp } = require("./update/top_ups");
const { updateDeductable } = require("./update/deductables");
const { transferMoney } = require("./update/transfer");

// Import WALLET STATUS controllers
const {
  deactivateWallet,
  activateWallet,
  deactivateWalletByOwner,
  activateWalletByOwner,
} = require("./update/wallet_status");

// Import METADATA APPROVAL controllers
const {
  approveSingleMetadata,
  approveMultipleMetadata,
  getPendingMetadata,

  rejectMetadata,
} = require("./facility_transaction_metadata/approve_metadata");

const {
  createPendingMetadata,
} = require("./facility_transaction_metadata/create_wallet_metadata");

async function registerRoutes(fastify) {
  // Define base route and middleware inside the function
  const walletBaseRoute = "/api/app/wallet";
  const jwt = { prehandler: authenticateJWT };

  // CREATE ROUTES
  fastify.post(`${walletBaseRoute}/:facilityId/create`, createWallet);
  fastify.post(`${walletBaseRoute}/:facilityId/topup`, createTopUp);
  fastify.post(`${walletBaseRoute}/:facilityId/deduct`, createDeductable);

  // READ ROUTES - WALLETS
  fastify.get(
    `${walletBaseRoute}/:facilityId/wallet/:walletId`,

    getWalletById,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/owner/:ownerId/:ownerType`,

    getWalletByOwner,
  );
  fastify.get(`${walletBaseRoute}/:facilityId/all`, getFacilityWallets);
  fastify.get(
    `${walletBaseRoute}/:facilityId/type/:ownerType`,

    getWalletsByOwnerType,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/inactive`,

    getInactiveWallets,
  );
  fastify.get(`${walletBaseRoute}/:facilityId/search`, searchWallets);

  // READ ROUTES - METADATA
  fastify.get(
    `${walletBaseRoute}/:facilityId/wallet/:walletId/metadata`,
    getWalletMetadata,
  );

  // READ ROUTES - TOP UPS
  fastify.get(
    `${walletBaseRoute}/:facilityId/topups/all`,

    getFacilityTopUps,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/topups/wallet/:walletId`,

    getWalletTopUps,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/topups/owner/:ownerId/:ownerType`,

    getOwnerTopUps,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/topups/:topUpId`,

    getTopUpById,
  );

  // READ ROUTES - DEDUCTABLES
  fastify.get(
    `${walletBaseRoute}/:facilityId/deductables/all`,

    getFacilityDeductables,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/deductables/wallet/:walletId`,

    getWalletDeductables,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/deductables/owner/:ownerId/:ownerType`,

    getOwnerDeductables,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/deductables/:deductableId`,

    getDeductableById,
  );

  // READ ROUTES - TRANSACTIONS
  fastify.get(
    `${walletBaseRoute}/:facilityId/transactions/wallet/:walletId`,

    getWalletTransactions,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/transactions/owner/:ownerId/:ownerType`,

    getOwnerTransactions,
  );
  fastify.get(
    `${walletBaseRoute}/:facilityId/transactions/all`,

    getFacilityTransactions,
  );

  // UPDATE ROUTES
  fastify.put(`${walletBaseRoute}/:facilityId/update`, updateWallet);
  fastify.put(
    `${walletBaseRoute}/:facilityId/balance`,

    updateWalletBalance,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/wallet/:walletId`,

    updateWalletById,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/topups/:topUpId`,

    updateTopUp,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/deductables/:deductableId`,

    updateDeductable,
  );
  fastify.put(`${walletBaseRoute}/:facilityId/transfer`, transferMoney);

  // WALLET STATUS ROUTES
  fastify.put(
    `${walletBaseRoute}/:facilityId/wallet/:walletId/activate`,

    activateWallet,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/wallet/:walletId/deactivate`,

    deactivateWallet,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/owner/:ownerId/:ownerType/activate`,

    activateWalletByOwner,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/owner/:ownerId/:ownerType/deactivate`,

    deactivateWalletByOwner,
  );

  // METADATA APPROVAL ROUTES
  fastify.get(
    `${walletBaseRoute}/:facilityId/metadata/pending`,
    getPendingMetadata,
  );
  fastify.post(
    `${walletBaseRoute}/:facilityId/metadata/pending`,
    createPendingMetadata,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/metadata/:metadataId/approve`,
    approveSingleMetadata,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/metadata/approve-multiple`,
    approveMultipleMetadata,
  );
  fastify.put(
    `${walletBaseRoute}/:facilityId/metadata/:metadataId/reject`,
    rejectMetadata,
  );
}

module.exports = {
  registerRoutes,
};
