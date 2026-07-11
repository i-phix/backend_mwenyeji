const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_units = async (request, reply) => {
  try {
    const { customerId, facilityId } = request.params;

    // Retrieve the Unit model for the facility
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Fetch units associated with the customer as a tenant, home owner, or resident
    let unitsByTenant = await unitModel.find({ tenantId: customerId });
    let unitsByOwner = await unitModel.find({ homeOwnerId: customerId });

    // Add 'customerType' to each unit
    unitsByTenant = unitsByTenant.map((unit) => ({
      ...unit.toObject(),
      customerType: 'Tenant',
      isOccupied: true,
    }));

    unitsByOwner = unitsByOwner.map((unit) => ({
      ...unit.toObject(),
      customerType: 'Home Owner',
      isOccupied: true,
    }));

    // Combine all units into a single array
    const allUnits = [...unitsByTenant, ...unitsByOwner];

    // Return the list of units
    return reply.code(200).send(allUnits);
  } catch (err) {
    console.error('Error in get_units:', err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_units;
