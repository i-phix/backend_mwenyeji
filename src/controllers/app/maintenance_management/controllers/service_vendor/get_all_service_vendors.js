const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const getAllServiceVendors = async (request, reply) => {
  try {
    const { facilityId } = request.params;
    
    // Register both models
    const serviceVendorModel = await getModel('ServiceVendor', payservedb.ServiceVendor.schema, facilityId);
    const assetModel = await getModel('Asset', payservedb.Asset.schema, facilityId);

    const serviceVendors = await serviceVendorModel
      .find({ facilityId })
      .populate({
        path: 'assignedAssets',
        model: assetModel, 
        select: 'name _id'
      });

    return reply.code(200).send({
      success: true,
      data: serviceVendors
    });
  } catch (err) {
    console.error('Error in getAllServiceVendors:', err);
    return reply.code(400).send({
      success: false,
      error: err.message
    });
  }
};

module.exports = getAllServiceVendors;