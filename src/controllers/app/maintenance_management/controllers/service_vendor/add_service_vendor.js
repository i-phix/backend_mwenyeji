const { serviceVendorValidator } = require('../../../../../utils/validator');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const addServiceVendor = async (request, reply) => {
  try {
    const validationResults = serviceVendorValidator.validate({
      ...request.body,
      facilityId: request.params.facilityId,
    });

    if (validationResults.error) {
      return reply.code(400).send({ error: validationResults.error.details[0].message });
    }

    const { facilityId } = validationResults.value;
    const { name, service, phone, email } = validationResults.value;

    // Get models
    const serviceVendorModel = await getModel('ServiceVendor', payservedb.ServiceVendor.schema, facilityId);
    // const assetModel = await getModel('Asset', payservedb.Asset.schema, facilityId);

    // // Verify that all assets exist and are unassigned
    // const assets = await assetModel.find({ 
    //   _id: { $in: assignedAssets },
    //   assigned: false,
    // });

    // if (assets.length !== assignedAssets.length) {
    //   return reply.code(400).send({
    //     error: 'Some assets are already assigned or do not exist',
    //   });
    // }

    // Create the service vendor
    const savedServiceVendor = await serviceVendorModel.create({
      facilityId,
      name,
      service,
      phone,
      email,
    });

    // if (savedServiceVendor) {
    //   try {
    //     await assetModel.updateMany(
    //       { _id: { $in: assignedAssets } },
    //       { $set: { assigned: true } },
    //     );
    //   } catch (updateError) {
    //     await serviceVendorModel.findByIdAndDelete(savedServiceVendor._id);
    //     throw new Error('Failed to update assets: ' + updateError.message);
    //   }
    // }

    return reply.code(200).send({
      message: 'Service Vendor added successfully',
      serviceVendor: savedServiceVendor,
    });

  } catch (err) {
    console.error('Error in addServiceVendor:', err);
    return reply.code(400).send({ error: err.message });
  }
};

module.exports = addServiceVendor;
