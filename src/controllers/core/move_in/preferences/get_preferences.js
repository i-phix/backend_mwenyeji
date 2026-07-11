const db = require('payservedb');
const logger = require('../../../../../config/winston');

// GET /api/core/move_in/preferences
const get_preferences = async (request, reply) => {
    try {
        const [
            totalSubmissions,
            locationAgg,
            bedroomAgg,
            listingTypeAgg,
            amenityAgg,
            priceAgg,
        ] = await Promise.all([
            db.moveIn.CustomerPreference.countDocuments({}),

            // Top locations
            db.moveIn.CustomerPreference.aggregate([
                { $match: { location: { $ne: null } } },
                { $group: { _id: '$location', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                { $project: { _id: 0, label: '$_id', count: 1 } },
            ]),

            // Bedroom preferences (from roomTypes field — e.g. '1BR', '2BR', 'Studio')
            db.moveIn.CustomerPreference.aggregate([
                { $unwind: '$roomTypes' },
                { $group: { _id: '$roomTypes', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 8 },
            ]),

            // Purpose as listing type proxy
            db.moveIn.CustomerPreference.aggregate([
                { $group: { _id: '$purpose', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $project: { _id: 0, label: '$_id', count: 1 } },
            ]),

            // Lifestyle tags as amenity proxy
            db.moveIn.CustomerPreference.aggregate([
                { $unwind: '$lifestyle' },
                { $group: { _id: '$lifestyle', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 12 },
                { $project: { _id: 0, label: '$_id', count: 1 } },
            ]),

            // Budget ranges
            db.moveIn.CustomerPreference.aggregate([
                { $match: { budgetMin: { $ne: null }, budgetMax: { $ne: null } } },
                {
                    $bucket: {
                        groupBy: '$budgetMax',
                        boundaries: [0, 10000, 20000, 30000, 50000, 80000, 120000, 200000],
                        default: '200000+',
                        output: { count: { $sum: 1 } },
                    },
                },
                { $sort: { count: -1 } },
            ]),
        ]);

        // Format price range labels
        const bucketLabels = {
            0: 'Under KES 10,000',
            10000: 'KES 10,000 – 20,000',
            20000: 'KES 20,000 – 30,000',
            30000: 'KES 30,000 – 50,000',
            50000: 'KES 50,000 – 80,000',
            80000: 'KES 80,000 – 120,000',
            120000: 'KES 120,000 – 200,000',
            '200000+': 'Over KES 200,000',
        };

        const priceRanges = priceAgg.map((b) => ({
            label: bucketLabels[b._id] || `KES ${b._id}+`,
            count: b.count,
        }));

        const topLocation = locationAgg[0]?.label || null;
        const topBedrooms = bedroomAgg[0]?._id || null;
        const medianPriceRange = priceRanges.sort((a, b) => b.count - a.count)[0]?.label || null;

        return reply.code(200).send({
            success: true,
            data: {
                totalSubmissions,
                topLocation,
                topBedrooms,
                medianPriceRange,
                locations: locationAgg,
                bedrooms: bedroomAgg,
                listingTypes: listingTypeAgg,
                amenities: amenityAgg,
                priceRanges: priceRanges.sort((a, b) => b.count - a.count),
            },
        });
    } catch (err) {
        logger.error('[core/move_in/preferences] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_preferences;
