const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const delete_vas_vendor = async (request, reply) => {
    try {
        const { facilityId, vendorId } = request.params;

        // Dynamically get the VasVendor model for the specified facility
        const VasVendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        // Find and delete the VasVendor document
        const deletedVasVendor = await VasVendor.findOneAndDelete({
            _id: vendorId,
            facilityId: facilityId
        });

        // If no vendor was found, return an error
        if (!deletedVasVendor) {
            return reply.code(404).send({
                message: 'VasVendor not found'
            });
        }

        // Return a success response
        return reply.code(200).send({
            message: 'VasVendor deleted successfully',
            vasVendor: deletedVasVendor
        });
    } catch (err) {
        console.error('Error in deleting VasVendor:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = delete_vas_vendor;