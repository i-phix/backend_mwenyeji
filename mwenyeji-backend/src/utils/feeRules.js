// Shared by the fee-preview endpoint, tenancy creation (commission), and
// boost pricing. A "fee block" is { rule, value } where rule is one of:
//   same_as_rent        -> value is ignored, amount = rentAmount
//   percentage_of_rent   -> amount = rentAmount * value / 100
//   fixed_amount         -> amount = value (KES)
function computeAmountFromRule(rule, value, rentAmount) {
  const rent = Number(rentAmount) || 0;
  switch (rule) {
    case "same_as_rent":
      return rent;
    case "percentage_of_rent":
      return Math.round((rent * (Number(value) || 0)) / 100);
    case "fixed_amount":
      return Math.round(Number(value) || 0);
    default:
      return 0;
  }
}

module.exports = { computeAmountFromRule };
