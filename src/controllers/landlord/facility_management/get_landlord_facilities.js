const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

const get_landlord_facilities = async (request, reply) => {
  try {
    const { user } = request;

    // Find the user by ID
    const userExist = await payservedb.User.findById(user.userId);

    if (!userExist) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Check if the user is a landlord
    if (userExist.type !== 'Landlord') {
      return reply.code(403).send({ error: 'Access denied. User is not a landlord' });
    }

    // if (!userExist.type.includes('Landlord')) {
    //   return reply.code(403).send({ error: 'Access denied. User is not a landlord' });
    // }


    // Extract all facilityIds from customerData
    const facilityIds = userExist.customerData
      .filter(item => item.isEnabled)
      .map(item => item.facilityId);

    if (facilityIds.length === 0) {
      return reply.code(200).send([]);
    }

    // Fetch all facilities concurrently
    const facilities = await Promise.all(
      facilityIds.map(async (facilityId) => {
        const facility = await payservedb.Facility.findById(facilityId);

        if (!facility) {
          return null;
        }

        // Find customer record for this facility
        const customer = await payservedb.Customer.findOne({
          _id: userExist.customerData.find(data =>
            data.facilityId.toString() === facilityId.toString()
          ).customerId
        });

        // Find all units owned by this landlord in this facility
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const units = await unitModel.find({ homeOwnerId: customer._id });

        // Return facility with additional landlord-specific information
        return {
          _id: facility._id,
          name: facility.name,
          location: facility.location,
          customerId: customer._id,
          unitCount: units.length,
          units: units.map(unit => ({
            _id: unit._id,
            name: unit.name,
            tenantId: unit.tenantId,
            hasTenant: !!unit.tenantId
          }))
        };
      })
    );

    // Filter out null values (facilities that weren't found)
    const validFacilities = facilities.filter(facility => facility !== null);

    return reply.code(200).send(validFacilities);
  } catch (err) {
    logger.error(`Error in get_landlord_facilities: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_landlord_facilities;