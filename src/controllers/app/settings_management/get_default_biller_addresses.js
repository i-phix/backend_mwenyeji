const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const get_default_biller_address = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        const billerAddressModel = await getModel("BillerAddress", payservedb.BillerAddress.schema, facilityId);

        // Find the default biller address for this facility
        const defaultBillerAddress = await billerAddressModel.findOne({ 
            facilityId,
            isDefault: true 
        });

        if (!defaultBillerAddress) {
            return reply.code(404).send({
                success: false,
                error: 'No default biller address found for this facility'
            });
        }

        // Return data in the format expected by frontend
        return reply.code(200).send({
            success: true,
            message: 'Default biller address retrieved successfully',
            data: defaultBillerAddress
        });

    } catch (err) {
        console.error('Error in get_default_biller_address:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve default biller address',
            details: err.message
        });
    }
};

module.exports = get_default_biller_address;