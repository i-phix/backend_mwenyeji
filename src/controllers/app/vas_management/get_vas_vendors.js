const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_vas_vendors = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                message: "facilityId is required"
            });
        }

        // Register BOTH models on the same connection before populating
        const VasVendor = await getModel(
            'VasVendor',
            payservedb.VasVendor.schema,
            facilityId
        );

        // This ensures ValueAddedService is registered on the same connection
        await getModel(
            'ValueAddedService',
            payservedb.ValueAddedService.schema,
            facilityId
        );

        const vendors = await VasVendor.find({ facilityId })
            .populate({
                path: 'offers.serviceId',
                select: 'serviceName providerType'
            })
            .sort({ createdAt: -1 });

        return reply.code(200).send({
            vendors,
            success: true,
            message: "VAS vendors retrieved successfully",
        });

    } catch (err) {
        console.error('Error fetching VAS vendors:', err);
        return reply.code(500).send({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
};

module.exports = get_vas_vendors;