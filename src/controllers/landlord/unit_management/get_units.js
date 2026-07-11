const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_landlord_units_by_facility = async (request, reply) => {
  try {
    const { user } = request;
    const { facilityId } = request.params; // Required facility ID parameter
    
    if (!facilityId) {
      return reply.code(400).send({ error: 'Facility ID is required' });
    }

    // Find the user by ID
    const userExist = await payservedb.User.findById(user.userId);
    
    if (!userExist) {
      return reply.code(404).send({ error: 'User not found' });
    }
    
    // Check if the user is a landlord
    if (userExist.type !== 'Landlord') {
      return reply.code(403).send({ error: 'Access denied. User is not a landlord' });
    }

    // Get the customerData entry for this specific facility
    const facilityData = userExist.customerData.find(
      data => data.facilityId.toString() === facilityId && data.isEnabled
    );
    
    if (!facilityData) {
      return reply.code(404).send({ error: 'Facility not found or user does not have access to this facility' });
    }

    // Get the facility details
    const facility = await payservedb.Facility.findById(facilityId);
    
    if (!facility) {
      return reply.code(404).send({ error: 'Facility not found' });
    }
    
    // Get the Unit model for this facility
    const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
    
    // Find units where the user is the homeowner in this facility
    const units = await unitModel.find({ homeOwnerId: facilityData.customerId });
    
    // Get tenant information for each unit
    const unitsWithDetails = await Promise.all(units.map(async (unit) => {
      let tenantInfo = null;
      
      // If unit has a tenant, get tenant information
      if (unit.tenantId) {
        const tenant = await payservedb.Customer.findById(unit.tenantId);
        if (tenant) {
          tenantInfo = {
            _id: tenant._id,
            fullName: `${tenant.firstName} ${tenant.lastName}`,
            phoneNumber: tenant.phoneNumber,
            email: tenant.email
          };
        }
      }
      
      return {
        ...unit.toObject(),
        customerType: 'Home Owner',
        isOccupied: !!unit.tenantId,
        tenant: tenantInfo
      };
    }));
    
    return reply.code(200).send(unitsWithDetails);
  } catch (err) {
    console.error('Error in get_landlord_units_by_facility:', err);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_landlord_units_by_facility;