const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_zoho_stats = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    const ZohoIntegrationModel = await getModel(
      'ZohoIntegration',
      payservedb.ZohoIntegration.schema,
      facilityId
    );

    // Find existing configuration
    const config = await ZohoIntegrationModel.findOne({ facilityId });

    if (!config) {
      return reply.code(404).send({
        success: false,
        error: 'Zoho integration not found for this facility'
      });
    }

    // Calculate statistics
    const totalSyncs = config.successfulSyncs + config.failedSyncs;
    const successRate = totalSyncs > 0
      ? ((config.successfulSyncs / totalSyncs) * 100).toFixed(2)
      : 0;

    // Time since last sync
    let timeSinceLastSync = null;
    if (config.lastSyncedAt) {
      const now = new Date();
      const diff = now - config.lastSyncedAt;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        timeSinceLastSync = `${days} day${days > 1 ? 's' : ''} ago`;
      } else if (hours > 0) {
        timeSinceLastSync = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else if (minutes > 0) {
        timeSinceLastSync = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else {
        timeSinceLastSync = 'Just now';
      }
    }

    // Build statistics object
    const stats = {
      // Sync Statistics
      totalInvoicesSynced: config.totalInvoicesSynced || 0,
      totalPaymentsSynced: config.totalPaymentsSynced || 0,
      totalCustomersSynced: config.totalCustomersSynced || 0,

      // Success/Failure Metrics
      successfulSyncs: config.successfulSyncs || 0,
      failedSyncs: config.failedSyncs || 0,
      totalSyncs: totalSyncs,
      syncSuccessRate: parseFloat(successRate),

      // Connection Information
      connectionStatus: config.connectionStatus,
      isActive: config.isActive,
      lastSyncedAt: config.lastSyncedAt,
      timeSinceLastSync: timeSinceLastSync,
      lastConnectionTest: config.lastConnectionTest,

      // Configuration
      autoSyncEnabled: config.autoSyncEnabled,
      syncFrequency: config.syncFrequency,
      syncInvoicesOnCreation: config.syncInvoicesOnCreation,
      syncPaymentsOnReceipt: config.syncPaymentsOnReceipt,

      // Token Information
      tokenRefreshCount: config.tokenRefreshCount || 0,
      lastTokenRefreshAt: config.lastTokenRefreshAt,
      tokenExpiresAt: config.tokenExpiresAt,

      // Errors
      lastSyncError: config.lastSyncError,
      connectionError: config.connectionError,

      // Organization
      organizationId: config.organizationId
    };

    return reply.code(200).send({
      success: true,
      data: stats
    });

  } catch (err) {
    console.error('Error in get_zoho_stats:', err);

    return reply.code(502).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = get_zoho_stats;
