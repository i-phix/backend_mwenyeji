const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const editServiceVendor = async (request, reply) => {
  try {
    const { facilityId, vendorId } = request.params;
    const { name, service, agreement, dates, assignedAssets, phone, email } = request.body;

    const serviceVendorModel = await getModel('ServiceVendor', payservedb.ServiceVendor.schema, facilityId);
    const assetModel = await getModel('Asset', payservedb.Asset.schema, facilityId);

    // Get the current vendor data to compare asset changes
    const currentVendor = await serviceVendorModel.findById(vendorId);

    if (!currentVendor) {
      return reply.code(404).send({ message: 'Service Vendor not found' });
    }

    // Convert arrays to Sets for easier comparison
    const currentAssets = new Set(currentVendor.assignedAssets.map(id => id.toString()));
    const newAssets = new Set(assignedAssets.map(id => id.toString()));

    // Find assets to be unassigned (in current but not in new)
    const assetsToUnassign = [...currentAssets].filter(id => !newAssets.has(id));

    // Find assets to be assigned (in new but not in current)
    const assetsToAssign = [...newAssets].filter(id => !currentAssets.has(id));

    // Verify new assets are not already assigned to another vendor
    if (assetsToAssign.length > 0) {
      const alreadyAssignedAssets = await assetModel.find({
        _id: { $in: assetsToAssign },
        assigned: true
      });

      if (alreadyAssignedAssets.length > 0) {
        return reply.code(400).send({
          error: 'Some assets are already assigned to other vendors',
          conflictingAssets: alreadyAssignedAssets.map(asset => asset._id)
        });
      }
    }

    // Update asset statuses
    const updatePromises = [
      // Unassign removed assets
      assetsToUnassign.length > 0 ? 
        assetModel.updateMany(
          { _id: { $in: assetsToUnassign } },
          { $set: { assigned: false } }
        ) : Promise.resolve(),

      // Assign new assets
      assetsToAssign.length > 0 ?
        assetModel.updateMany(
          { _id: { $in: assetsToAssign } },
          { $set: { assigned: true } }
        ) : Promise.resolve(),

      // Update the service vendor
      serviceVendorModel.findByIdAndUpdate(
        vendorId,
        { name, service, agreement, dates, assignedAssets, phone, email },
        { new: true }
      )
    ];

    const [, , updatedServiceVendor] = await Promise.all(updatePromises);

    return reply.code(200).send({
      message: 'Service Vendor updated successfully',
      serviceVendor: updatedServiceVendor,
      assetChanges: {
        assigned: assetsToAssign.length,
        unassigned: assetsToUnassign.length
      }
    });

  } catch (err) {
    console.error('Error in editServiceVendor:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = editServiceVendor;