const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const deleteServiceVendor = async (request, reply) => {
  try {
    const { facilityId, vendorId } = request.params;

    const serviceVendorModel = await getModel('ServiceVendor', payservedb.ServiceVendor.schema, facilityId);
    const assetModel = await getModel('Asset', payservedb.Asset.schema, facilityId);

    // Get the service vendor to access its assignedAssets array
    const serviceVendor = await serviceVendorModel.findById(vendorId);

    if (!serviceVendor) {
      return reply.code(404).send({ message: 'Service Vendor not found' });
    }

    // Store the asset IDs before deletion
    const vendorAssetIds = serviceVendor.assignedAssets;

    // Delete the service vendor
    await serviceVendorModel.findByIdAndDelete(vendorId);

    // Update all assets that were assigned to this vendor
    if (vendorAssetIds && vendorAssetIds.length > 0) {
      await assetModel.updateMany(
        { _id: { $in: vendorAssetIds } },
        { $set: { assigned: false } }
      );
    }

    return reply.code(200).send({
      message: 'Service Vendor deleted successfully',
      unassignedAssets: vendorAssetIds ? vendorAssetIds.length : 0
    });

  } catch (err) {
    console.error('Error in deleteServiceVendor:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = deleteServiceVendor;