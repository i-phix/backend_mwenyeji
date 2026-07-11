const payservedb = require("payservedb");
const logger = require("./../../../../config/winston");

/**
 * Retrieves company information for public (unauthenticated) access
 * This endpoint is used with the public invoice viewer to display company details
 * 
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Object} Company information or error response
 */
const get_unauthenticated_company_information = async (request, reply) => {
    let facilityId = 'UNKNOWN';

    try {
        // Extract facilityId from request parameters
        facilityId = request.params?.facilityId;

        // Validate facilityId
        if (!facilityId) {
            logger.warn("Company information request: Missing facility ID", {
                requestParams: request.params
            });

            return reply.code(400).send({
                success: false,
                message: "Facility ID is required"
            });
        }

        // Log the incoming request
        logger.info(`Retrieving company information for facility`, {
            facilityId: facilityId
        });

        // Find the facility by facilityId
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            logger.warn(`Facility not found`, {
                facilityId: facilityId
            });

            return reply.code(404).send({
                success: false,
                message: "Facility not found"
            });
        }

        // Find the company that owns this facility
        const company = await payservedb.Company.findOne({ facilities: facilityId });
        if (!company) {
            logger.warn(`Company not found for facility`, {
                facilityId: facilityId
            });

            return reply.code(404).send({
                success: false,
                message: "Company not found for this facility"
            });
        }

        // Prepare company information
        const companyData = {
            // Basic company details
            _id: company._id,
            name: company.name,
            address: company.address,
            city: company.city,
            state: company.state,
            country: company.country,
            postalCode: company.postalCode,
            
            // Contact information
            phoneNumber: company.phoneNumber,
            email: company.email,
            
            // Additional details
            logo: company.logo,
            currency: company.currency,
            taxNumber: company.taxNumber,
            
            // Facility-specific details
            facilityId: facility._id,
            facilityName: facility.name,
            facilityCode: facility.code
        };

        // Log successful retrieval
        logger.info(`Successfully retrieved company information`, {
            facilityId: facilityId,
            companyName: companyData.name
        });

        // Return company information
        return reply.code(200).send({
            success: true,
            message: "Company information retrieved successfully",
            data: companyData
        });

    } catch (err) {
        // Comprehensive error logging
        logger.error("Unexpected error in retrieving company information", {
            message: err.message,
            stack: err.stack,
            facilityId: facilityId
        });

        // Return a generic error response
        return reply.code(500).send({
            success: false,
            message: "Unable to access company information",
            errorId: Date.now().toString()
        });
    }
};

module.exports = get_unauthenticated_company_information;