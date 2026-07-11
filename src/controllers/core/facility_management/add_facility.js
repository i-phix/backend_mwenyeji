const payservedb = require("payservedb");
const mongoose = require("mongoose");

// Utility function to generate unique database names
const generateDbName = (facilityName) => {
  const timestamp = Date.now();
  const cleanedName = facilityName
    .trim()
    .toLowerCase()
    .split(" ")[0]
    .replace(/[^a-z0-9]/g, "_");
  return `${cleanedName}_db_${timestamp}`;
};

// Function to generate unique facility account number (P001, P002, etc.)
const generateFacilityAccountNumber = async () => {
  // Find the facility with the highest account number
  const lastFacility = await payservedb.Facility.findOne({
    accountNumber: { $regex: /^P\d+$/ }
  })
    .sort({ accountNumber: -1 })
    .lean();

  if (!lastFacility || !lastFacility.accountNumber) {
    return "P001";
  }

  const lastNumber = parseInt(lastFacility.accountNumber.replace("P", ""), 10);
  const nextNumber = lastNumber + 1;
  return `P${String(nextNumber).padStart(3, "0")}`;
};

// PayServe account sync class (reused pattern from water accounts)
class PayServeAccountManager {
  constructor() {
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 1000;
  }

  async addAccountDetails(accountNumber, facilityId, customerId) {
    const payload = { accountNumber, facilityId, customerId };
    let attempt = 1;
    let lastError = null;

    while (attempt <= this.MAX_RETRIES) {
      try {
        const response = await fetch(
          "https://sandbox.payments.payserve.co.ke/v1/addAccount",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          let parsedError;
          try {
            parsedError = JSON.parse(errorBody);
          } catch (e) {
            parsedError = { message: errorBody };
          }

          if (parsedError.message === "Account already exists") {
            return {
              success: true,
              message: "Account already exists",
              accountNumber,
            };
          }

          throw new Error(
            `PayServe API responded with status ${response.status}: ${errorBody}`
          );
        }

        const result = await response.json();
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === this.MAX_RETRIES) break;

        const backoffDelay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        attempt++;
      }
    }

    throw new Error(
      `Failed to add account details after ${this.MAX_RETRIES} attempts: ${lastError.message}`
    );
  }
}

// Function to create the facility database
const createDatabaseForFacility = async (dbName) => {
  try {
    let facilityDbUri;
    if (process.env.MONGODB_URI) {
      const u = new URL(process.env.MONGODB_URI);
      u.pathname = `/${dbName}`;
      facilityDbUri = u.toString();
    } else {
      facilityDbUri = `mongodb://localhost:27017/${dbName}`;
    }
    const newDbConnection = mongoose.createConnection(facilityDbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`Database ${dbName} created successfully.`);
    return true;
  } catch (err) {
    console.error(`Error creating database ${dbName}:`, err);
    throw err;
  }
};

// Main function to handle facility creation
const add_facility = async (request, reply) => {
  const payServeAccountManager = new PayServeAccountManager();

  try {
    const { id } = request.params; // Company ID
    const { facilityName, facilityLocation, subDivision, divisionArray } =
      request.body;

    // Find the company
    const company = await payservedb.Company.findById(id);
    if (!company) {
      return reply.code(404).send("Company not found.");
    }

    let facilities = company.facilities;

    // Generate unique account number and database name
    const dbName = generateDbName(facilityName);
    const accountNumber = await generateFacilityAccountNumber();

    // Create the facility document
    const facilityData = new payservedb.Facility({
      name: facilityName,
      location: facilityLocation,
      subDivision: subDivision,
      divisionArray: divisionArray,
      isEnabled: true,
      dbName: dbName,
      accountNumber: accountNumber,
      payServeSync: false,
      modules: {
        visitor: false,
        levy: false,
        maintenance: false,
        lease: false,
        vas: false,
        tickets: false,
        utility: false,
        booking: false,
        handover: false,
        expense: false,
        campaign: false,
        accounts: false,
      },
    });

    // Save the facility
    const savedFacility = await facilityData.save();

    // Add facility ID to company
    facilities.push(savedFacility._id);
    await payservedb.Company.updateOne({ _id: id }, { facilities });

    // Create the facility database
    await createDatabaseForFacility(dbName);

    // Sync account to PayServe (M-Pesa)
    try {
      await payServeAccountManager.addAccountDetails(
        accountNumber,
        savedFacility._id.toString(),
        savedFacility._id.toString() // Using facilityId as customerId for facility accounts
      );

      // Mark as synced
      await payservedb.Facility.updateOne(
        { _id: savedFacility._id },
        { payServeSync: true }
      );

      console.log(
        `Facility account ${accountNumber} synced to PayServe successfully.`
      );
    } catch (payServeError) {
      // Don't fail the entire operation — sync can be retried later
      console.error(
        `PayServe sync failed for facility ${accountNumber}:`,
        payServeError.message
      );
      await payservedb.Facility.updateOne(
        { _id: savedFacility._id },
        { payServeSync: false }
      );
    }

    return reply.code(200).send({
      success: true,
      message: "Facility added successfully.",
      data: {
        facilityId: savedFacility._id,
        accountNumber,
        dbName,
      },
    });
  } catch (err) {
    console.error(err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = add_facility;