const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getServiceVendorById = async (request, reply) => {
  try {
    const { facilityId, vendorId } = request.params;

    const serviceVendorModel = await getModel('ServiceVendor', payservedb.ServiceVendor.schema, facilityId);

    const serviceVendor = await serviceVendorModel.findById(vendorId);

    if (!serviceVendor) {
      return reply.code(404).send({ message: 'Service Vendor not found' });
    }

    return reply.code(200).send(serviceVendor);
  } catch (err) {
    console.error('Error in getServiceVendorById:', err);
    return reply.code(500).send({ error: err.message });
  }
};

module.exports = getServiceVendorById;