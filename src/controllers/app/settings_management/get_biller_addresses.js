const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const get_biller_addresses = async (request, reply) => {
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

        const billerAddresses = await billerAddressModel.find({ facilityId })
            .sort({ isDefault: -1, createdAt: -1 }); // Default addresses first, then by creation date

        // Return data in the format expected by frontend (similar to SMS settings)
        return reply.code(200).send({
            success: true,
            message: 'Biller addresses retrieved successfully',
            data: billerAddresses
        });

    } catch (err) {
        console.error('Error in get_biller_addresses:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve biller addresses',
            details: err.message
        });
    }
};

module.exports = get_biller_addresses;