const payservedb = require("payservedb");

const getCustomerUserById = async (request, reply) => {
  try {
    const { id } = request.params;
    const user = await payservedb.Customer.findById(id);
    if (!user) return reply.status(404).json({ message: "User not found" });
    reply.code(200).send({
      message: "User found",
      user,
    });
  } catch (error) {
    reply.status(500).send({ message: error.message });
  }
};

const getUserById = async (request, reply) => {
  try {
    const { id } = request.params;
    const user = await payservedb.User.findById(id);
    if (!user) return reply.status(404).json({ message: "User not found" });
    reply.code(200).send({
      message: "User found",
      user,
    });
  } catch (error) {
    reply.status(500).send({ message: error.message });
  }
};

const getUsersWhoAreStaff = async (request, reply) => {
  try {
    // Find users where type includes "Company" - indicating staff/admin users
    const staffUsers = await payservedb.User.find({
      type: { $in: ["Company"] }
    });
    
    if (!staffUsers || staffUsers.length === 0) {
      return reply.status(404).json({ 
        message: "No staff users found" 
      });
    }

    reply.code(200).send({
      message: "Staff users found",
      users: staffUsers,
      count: staffUsers.length
    });
  } catch (error) {
    reply.status(500).send({ 
      message: error.message 
    });
  }
};

module.exports = {
  getCustomerUserById,
  getUserById,
  getUsersWhoAreStaff,
};
