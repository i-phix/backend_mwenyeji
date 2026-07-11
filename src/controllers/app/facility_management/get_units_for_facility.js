const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_units = async (request, reply) => {
  try {
    const unitModel = await getModel('Unit', payservedb.Unit.schema, request.params.facilityId);

    // Use query parameters directly for filtering
    const units = await unitModel.find(request.query);

    if (units.length === 0) {
      return reply.code(404).send({ message: 'No units found' });
    }

    return reply.code(200).send(units);
  } catch (err) {
    console.error(`Error fetching units: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_units;


// const get_units_for_facility = async (request, reply) => {
//   try {
//     const { facilityId } = request.params; // facilityId from URL
//     const { customerType } = request.query; // customerType from query params

//     if (!customerType) {
//       return reply.code(400).send({ error: 'customerType query parameter is required' });
//     }

//     // Get the unit model for the given facilityId
//     const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

//     let query = {};

//     // Check customerType and build query accordingly
//     if (customerType === "home owner") {
//       query = { $or: [{ homeOwnerId: { $exists: false } }, { tenantId: { $exists: true } }] };
//     } else if (customerType === "tenant") {
//       query = { $or: [{ tenantId: { $exists: false } }, { homeOwnerId: { $exists: true } }] };
//     } else {
//       return reply.code(400).send({ error: 'Invalid customerType. Must be "home owner" or "tenant".' });
//     }

//     // Fetch units matching the query
//     const units = await unitModel.find(query);

//     if (units.length === 0) {
//       return reply.code(404).send({ message: 'No units found for the given customer type' });
//     }

//     // Return the units
//     return reply.code(200).send(units);
//   } catch (err) {
//     console.error(`Error fetching units: ${err.message}`);
//     return reply.code(502).send({ error: err.message });
//   }
// };
