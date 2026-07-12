// Platform-wide defaults used until the admin payment-settings UI (Phase 3)
// lets these be configured at runtime.
module.exports = {
  DEFAULT_COMMISSION_RATE: 0.1, // 10% of monthly rent, deducted before landlord payout
  RESERVATION_HOLD_HOURS: 48,   // how long a pending reservation stays valid before expiring
};
