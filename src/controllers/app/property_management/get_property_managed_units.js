const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_property_managed_units = async (request, reply) => {
  try {
    const { facilityId } = request.params;

    // Retrieve the tenant-specific Unit model
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

    // Query units that are managed by property management
    const propertyManagedUnits = await unitModel.find({ 
      facilityId,
      isManagedByPropertyManager: true 
    });

    // Filter occupied and non-occupied property managed units
    const occupiedPropertyManagedUnits = propertyManagedUnits.filter((unit) => unit.homeOwnerId || unit.tenantId);
    const notOccupiedPropertyManagedUnits = propertyManagedUnits.filter((unit) => !unit.homeOwnerId && !unit.tenantId);

    // Return the results
    return reply.code(200).send({ 
      propertyManagedUnits, 
      occupiedPropertyManagedUnits, 
      notOccupiedPropertyManagedUnits,
      totalPropertyManagedUnits: propertyManagedUnits.length
    });
  } catch (err) {
    console.error('Error in get_property_managed_units:', err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_property_managed_units;