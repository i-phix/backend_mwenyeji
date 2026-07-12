// Generates a short, human-readable account number used as the M-Pesa
// payment reference (shown to the tenant, matched on callback).
// Format: PREFIX-XXXXXX (6 base36 chars from timestamp + random).
// Tenancies use "MVR" (unchanged); Payment records pick a prefix per
// purpose (VWG/RES/BST) so account numbers stay recognizable in logs.
function generateAccountNumber(prefix = "MVR") {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${stamp}${rand}`;
}

module.exports = { generateAccountNumber };
