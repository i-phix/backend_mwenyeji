// middlewares/asset_validation.js
const validateAssetData = (request, reply, done) => {
  const { name, location, serialNumber, dateBought, insuranceStatus } =
    request.body;

  const errors = [];

  // Required field validation
  if (!name || name.trim() === "") {
    errors.push("name is required and cannot be empty");
  }

  if (!location || location.trim() === "") {
    errors.push("location is required and cannot be empty");
  }

  if (!serialNumber || serialNumber.trim() === "") {
    errors.push("serialNumber is required and cannot be empty");
  }

  if (!dateBought || dateBought.trim() === "") {
    errors.push("dateBought is required and cannot be empty");
  }

  if (!insuranceStatus) {
    errors.push("insuranceStatus is required");
  }

  // Enum validation for insuranceStatus
  const validInsuranceStatuses = ["Insured", "Not Insured", "Expired"];
  if (insuranceStatus && !validInsuranceStatuses.includes(insuranceStatus)) {
    errors.push(
      `insuranceStatus must be one of: ${validInsuranceStatuses.join(", ")}`,
    );
  }

  // Date validation (basic format check)
  if (dateBought && isNaN(Date.parse(dateBought))) {
    errors.push("dateBought must be a valid date");
  }

  if (errors.length > 0) {
    return reply.code(400).send({
      error: "Validation failed",
      details: errors,
    });
  }

  done();
};

const validateInspectionCertificate = (request, reply, done) => {
  const { dateInspected, status, certificate } = request.body;

  const errors = [];

  // Required field validation
  if (!dateInspected) {
    errors.push("dateInspected is required");
  }

  if (!status) {
    errors.push("status is required");
  }

  if (!certificate || certificate.trim() === "") {
    errors.push("certificate is required and cannot be empty");
  }

  // Enum validation for status
  const validStatuses = ["Passed", "Failed", "Pending"];
  if (status && !validStatuses.includes(status)) {
    errors.push(`status must be one of: ${validStatuses.join(", ")}`);
  }

  // Date validation
  if (dateInspected && isNaN(Date.parse(dateInspected))) {
    errors.push("dateInspected must be a valid date");
  }

  // Future date validation (inspection can't be in the future)
  if (dateInspected && new Date(dateInspected) > new Date()) {
    errors.push("dateInspected cannot be in the future");
  }

  if (errors.length > 0) {
    return reply.code(400).send({
      error: "Validation failed",
      details: errors,
    });
  }

  done();
};

const validateAssignedStatus = (request, reply, done) => {
  const { assigned } = request.body;

  if (assigned === undefined || assigned === null) {
    return reply.code(400).send({
      error: "assigned field is required",
    });
  }

  if (typeof assigned !== "boolean") {
    return reply.code(400).send({
      error: "assigned field must be a boolean value (true or false)",
    });
  }

  done();
};

const validateBulkAssignedStatus = (request, reply, done) => {
  const { assetIds, assigned } = request.body;

  const errors = [];

  if (!assetIds || !Array.isArray(assetIds)) {
    errors.push("assetIds must be an array");
  } else if (assetIds.length === 0) {
    errors.push("assetIds cannot be empty");
  }

  if (assigned === undefined || assigned === null) {
    errors.push("assigned field is required");
  } else if (typeof assigned !== "boolean") {
    errors.push("assigned field must be a boolean value");
  }

  if (errors.length > 0) {
    return reply.code(400).send({
      error: "Validation failed",
      details: errors,
    });
  }

  done();
};

module.exports = {
  validateAssetData,
  validateInspectionCertificate,
  validateAssignedStatus,
  validateBulkAssignedStatus,
};
