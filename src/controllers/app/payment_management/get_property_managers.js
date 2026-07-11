const mongoose = require('mongoose');
const payservedb = require('payservedb');
const logger = require('../../../../config/winston');

/**
 * Get property managers of type 'Company' for a specific facility
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<Object>} - List of property managers
 */
const get_property_managers = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            logger.warn('[get_property_managers] Missing facilityId in request');
            return reply.code(400).send({
                success: false,
                message: 'Facility ID is required'
            });
        }

        const facilityObjectId = new mongoose.Types.ObjectId(facilityId);

        // Get the Company model from payservedb
        const Company = mongoose.model('Company', payservedb.Company.schema);

        const company = await Company.findOne({
            facilities: facilityObjectId,
            isEnabled: true
        }).lean();

        if (!company) {
            logger.warn(`[get_property_managers] No company found with facilityId: ${facilityObjectId}`);
            return reply.code(404).send({
                success: false,
                message: 'No company found for the given facility'
            });
        }

        const companyId = company._id;

        // Get the User model from payservedb
        const User = mongoose.model('User', payservedb.User.schema);

        const propertyManagers = await User.find({
            type: 'Company',
            companies: companyId,
            customerData: {
                $elemMatch: {
                    facilityId: facilityObjectId,
                    isEnabled: true
                }
            }
        })
        .select('_id fullName email phoneNumber type role')
        .lean();

        return reply.code(200).send({
            success: true,
            data: propertyManagers,
            count: propertyManagers.length
        });

    } catch (error) {
        logger.error(`Error getting property managers: ${error.message}`, { stack: error.stack });
        return reply.code(500).send({
            success: false,
            message: 'Failed to fetch property managers',
            error: error.message
        });
    }
};

module.exports = get_property_managers;
