const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getBillerAddressForLevy = async (request, reply) => {
    try {
        const { facilityId, billerAddressId } = request.params;

        if (!facilityId || !billerAddressId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Biller Address ID are required'
            });
        }

        // Validate facility from main database
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Get tenant-specific BillerAddress model
        const billerAddressModel = await getModel("BillerAddress", payservedb.BillerAddress.schema, facilityId);

        const billerAddress = await billerAddressModel.findOne({
            _id: billerAddressId,
            facilityId: facilityId
        });

        if (!billerAddress) {
            return reply.code(404).send({
                success: false,
                error: 'Biller address not found for this facility'
            });
        }

        return reply.code(200).send({
            success: true,
            data: billerAddress
        });

    } catch (err) {
        console.error('Error fetching biller address for levy:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve biller address',
            details: err.message
        });
    }
};

module.exports = getBillerAddressForLevy;
