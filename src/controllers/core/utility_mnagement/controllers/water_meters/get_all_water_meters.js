const utilityDb = require('../../../../../middlewares/utilityDb');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const get_meters = async (request, reply) => {
  try {
    // Get pagination parameters from query
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get search parameters
    const search = request.query.search || '';
    
    // Get the model
    const MeterModel = await utilityDb.getModel('WaterMeter');
    
    // Build search query
    let searchQuery = { meterType: 'smart' };
    
    if (search) {
      searchQuery.$or = [
        { meterNumber: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { accountNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get total count for pagination
    const totalMeters = await MeterModel.countDocuments(searchQuery);
    
    // Get paginated meters from utility database
    const meters = await MeterModel.find(searchQuery)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit);
    
    // Map through meters to add facility information
    const metersWithInfo = await Promise.all(
      meters.map(async (meter) => {
        let facilityInfo = null;
        
        // If meter has facilityId, get the facility data from payservedb
        if (meter.facilityId) {
          try {
            const facility = await payservedb.Facility.findById(meter.facilityId);
            if (facility) {
              facilityInfo = {
                name: facility.name
              };
            }
          } catch (err) {
            // Silently handle facility fetch errors
          }
        }
        
        // Return the meter data with facility info
        return {
          ...meter.toObject(),
          FacilityInfo: facilityInfo
        };
      })
    );
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalMeters / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return reply.code(200).send({
      message: 'Smart meters retrieved successfully',
      meters: metersWithInfo,
      pagination: {
        currentPage: page,
        totalPages,
        totalMeters,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    });
  } catch (err) {
    logger.error(`Error in retrieving smart meters: ${err.message}`);
    return reply.code(502).send({ error: err.message });
  }
};

module.exports = get_meters;