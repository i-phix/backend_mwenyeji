const payservedb = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');

const getUnits = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const userType = request.user.type;

        // Verify user is customer support agent
        if (userType !== 'Customer_Support') {
            return reply.code(403).send({
                success: false,
                error: 'Access denied. Customer Support agents only.'
            });
        }

        // Get query parameters for filtering and pagination
        const {
            facilityId,
            search,
            page = 1,
            limit = 10
        } = request.query;

        let allUnits = [];
        let facilitiesToQuery = [];

        // If facilityId is specified, only query that facility
        if (facilityId) {
            const facility = await payservedb.Facility.findById(facilityId).lean();
            if (facility) {
                facilitiesToQuery.push(facility);
            }
        } else {
            // Get all facilities
            facilitiesToQuery = await payservedb.Facility.find({}).lean();
        }

        // Query units from each facility's database
        for (const facility of facilitiesToQuery) {
            try {
                // Get the unit model for this facility's database
                const UnitModel = await getModel('Unit', payservedb.Unit.schema, facility._id.toString());

                // Build filter for this facility
                const filter = {};

                // Search across multiple fields
                if (search) {
                    filter.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { unitType: { $regex: search, $options: 'i' } },
                        { division: { $regex: search, $options: 'i' } },
                        { floorUnitNo: { $regex: search, $options: 'i' } }
                    ];
                }

                // Get units from this facility
                const units = await UnitModel.find(filter).lean();

                // Add facility information to each unit
                const unitsWithFacility = units.map(unit => ({
                    ...unit,
                    facilityId: facility._id,
                    facility_id: {
                        _id: facility._id,
                        name: facility.name,
                        address: facility.address,
                        company_id: facility.company_id
                    }
                }));

                allUnits = allUnits.concat(unitsWithFacility);
            } catch (err) {
                logger.error(`Error fetching units from facility ${facility._id}: ${err.message}`);
                // Continue with other facilities
            }
        }

        // Sort all units
        allUnits.sort((a, b) => {
            const aName = a.name || '';
            const bName = b.name || '';
            return aName.localeCompare(bName);
        });

        // Apply pagination
        const totalUnits = allUnits.length;
        const totalPages = Math.ceil(totalUnits / parseInt(limit));
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedUnits = allUnits.slice(skip, skip + parseInt(limit));

        logger.info(`Agent ${userId} retrieved ${paginatedUnits.length} units (page ${page} of ${totalPages}, total: ${totalUnits})`);

        return reply.code(200).send({
            success: true,
            data: paginatedUnits,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_items: totalUnits,
                total_pages: totalPages,
                has_next_page: parseInt(page) < totalPages,
                has_prev_page: parseInt(page) > 1
            }
        });

    } catch (err) {
        logger.error(`Error fetching units for agent: ${err.message}`, { stack: err.stack });
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve units'
        });
    }
};

module.exports = getUnits;
