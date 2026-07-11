const { walletValidator } = require("../../../utils/validator");
const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const createWallet = async (request, reply) => {
  try {
    const validationResults = walletValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply
        .code(400)
        .send({ error: validationResults.error.details[0].message });
    }

    const { facilityId, owner, ownerType, walletType, amount, isActive } =
      validationResults.value;

    // Use getModel for wallet (facility-specific)
    const walletModel = await getModel(
      "Wallet",
      payservedb.Wallet.schema,
      facilityId,
    );

    // Check if wallet already exists for this owner and wallet type
    const existingWallet = await walletModel.findOne({
      owner,
      ownerType,
      walletType,
      facilityId,
    });

    if (existingWallet) {
      return reply.code(400).send({
        error: `Wallet of type '${walletType}' already exists for this owner`,
      });
    }

    // Verify owner exists based on ownerType (use models directly, not getModel)
    if (ownerType === "User") {
      const userModel = payservedb.User;
      const user = await userModel.findById(owner);
      if (!user) {
        return reply.code(400).send({ error: "User not found" });
      }
    } else if (ownerType === "Customer") {
      const customerModel = payservedb.Customer;
      const customer = await customerModel.findById(owner);
      if (!customer) {
        return reply.code(400).send({ error: "Customer not found" });
      }
    } else if (ownerType === "Facility") {
      const facilityModel = payservedb.Facility;
      const facility = await facilityModel.findById(owner);
      if (!facility) {
        return reply.code(400).send({ error: "Facility not found" });
      }
    }

    // Create the wallet
    const savedWallet = await walletModel.create({
      facilityId,
      owner,
      ownerType,
      walletType,
      amount: amount || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    return reply.code(200).send({
      message: "Wallet created successfully",
      wallet: savedWallet,
    });
  } catch (err) {
    console.error("Error in createWallet:", err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = createWallet;
