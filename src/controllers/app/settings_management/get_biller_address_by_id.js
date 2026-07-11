const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const get_biller_address_by_id = async (request, reply) => {
    try {
        const { facilityId, billerAddressId } = request.params;

        if (!facilityId || !billerAddressId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Biller Address ID are required'
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

        const billerAddress = await billerAddressModel.findOne({
            _id: billerAddressId,
            facilityId
        });

        if (!billerAddress) {
            return reply.code(404).send({
                success: false,
                error: 'Biller address not found or does not belong to this facility'
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'Biller address retrieved successfully',
            data: billerAddress
        });

    } catch (err) {
        console.error('Error in get_biller_address_by_id:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve biller address',
            details: err.message
        });
    }
};

module.exports = get_biller_address_by_id;