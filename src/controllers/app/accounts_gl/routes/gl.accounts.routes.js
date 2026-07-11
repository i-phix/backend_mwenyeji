const authenticateJWT = require("../../../../middlewares/jwt_authentication");
const addGlAccount = require("../controllers/add_gl_account");
const getGlAccounts = require("../controllers/get_gl_accounts");
const addGLAccounts = require("../controllers/add_gl_entry");
const addAccountsDoubleEntry = require("../controllers/add_account_double_entry");


const glAccountsBaseRoute = "/api/v1/gl-accounts"
const glEntryBaseRoutes = "/api/v1/gl-entries"
const doubleEntriesAccountBaseRoutes = "/api/v1/gl-account-double-entry"

async function registerAccountRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT };
    // fastify.post(glAccountsBaseRoute + "/:facilityId", jwt, addGlAccount.addGlAccount);
    fastify.post(glAccountsBaseRoute + "/:facilityId", addGlAccount.addGlAccount);
    fastify.get(glAccountsBaseRoute + "/:facilityId", getGlAccounts.getGlAccounts);
    fastify.get(glAccountsBaseRoute + "/final-accounts/:facilityId", getGlAccounts.getFinalAccounts);
    fastify.get(glAccountsBaseRoute + "/:facilityId/:accountId", addGlAccount.getAccountById);
    fastify.get(glAccountsBaseRoute + "/get-account-by-code/:facilityId/:accountCode", addGlAccount.getAccountByCode);

    // GL Entry Endpoints
    fastify.post(glEntryBaseRoutes + "/add-debit-entry/:facilityId", addGLAccounts.addDebitEntry);
    fastify.post(glEntryBaseRoutes + "/add-credit-entry/:facilityId", addGLAccounts.addCreditEntry);
    fastify.get(glEntryBaseRoutes + "/get-all-entries/:facilityId", addGLAccounts.getGlEntries);
    fastify.get(glEntryBaseRoutes + "/get-entry-by-account/:facilityId/:accountId", addGLAccounts.getGLEntriesForAccount);
    fastify.get(glEntryBaseRoutes + "/get-entry-by-id/:facilityId/:entryId", addGLAccounts.getGlEntryById);

    // GL Account Double Entry Endpoints
    fastify.post(doubleEntriesAccountBaseRoutes + "/add-account-double-entry/:facilityId", addAccountsDoubleEntry.addAccountsDoubleEntry);
    fastify.post(doubleEntriesAccountBaseRoutes + "/add-double-entry-record/:facilityId/:doubleEntryId", addAccountsDoubleEntry.addDoubleEntryRecord);
    fastify.get(doubleEntriesAccountBaseRoutes + "/get-account-double-entry/:facilityId/:accountId", addAccountsDoubleEntry.getDoubleEntryRecords);
    fastify.get(doubleEntriesAccountBaseRoutes + "/get-all-account-double-entries/:facilityId", addAccountsDoubleEntry.getAllDoubleEntryRecords);
}

module.exports = {
    registerAccountRoutes,
};