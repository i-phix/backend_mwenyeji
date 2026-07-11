const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get inspection settings
 * Route: GET /api/app/handover_management/get_inspection_settings/:facilityId
 */
const get_inspection_settings = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            category,
            active,
            search,
            unitId,
            page = 1,
            limit = 20
        } = request.query;

        console.log('Get inspection settings called for facility:', facilityId);
        console.log('Query params:', { category, active, search, unitId, page, limit });

        // Get the inspection item model for this facility
        const InspectionItem = await getModel('InspectionItem', payservedb.InspectionItem.schema, facilityId);

        // Build query conditions
        const query = { facilityId };

        // Add optional filters
        if (category) {
            query.category = category;
        }

        if (active !== undefined) {
            query.active = active === 'true';
        }

        // Filter by unitId if provided
        if (unitId) {
            query.unitId = unitId;
            console.log('Filtering by unitId:', unitId);
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get total count for pagination
        const total = await InspectionItem.countDocuments(query);
        
        // Fetch inspection items with populated currency and unit information
        let inspectionItems;
        try {
            inspectionItems = await InspectionItem.find(query)
                .populate('currencyId', 'currencyName currencyShortCode isDefaultCurrency exchangeRate')
                .populate('unitId', 'name floorUnitNo')
                .sort({ category: 1, name: 1 })
                .skip(skip)
                .limit(parseInt(limit));
        } catch (populateError) {
            console.error('Error with populate, falling back to basic query:', populateError);
            // Fallback to basic query without populate
            inspectionItems = await InspectionItem.find(query)
                .sort({ category: 1, name: 1 })
                .skip(skip)
                .limit(parseInt(limit));
        }
        
        // Get distinct categories for filtering options
        const categories = await InspectionItem.distinct('category', { facilityId });
        
        // Calculate pagination metadata
        const totalPages = Math.ceil(total / parseInt(limit));
        
        console.log('Found inspection items:', inspectionItems.length);
        
        return reply.code(200).send({
            success: true,
            data: inspectionItems,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages,
                categories
            }
        });
    } catch (err) {
        console.error('Error in get_inspection_settings:', err);
        
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while fetching inspection settings.'
        });
    }
};

module.exports = get_inspection_settings;