const db = require('payservedb');


const create_landmark = async (request, reply) => {
    try {
        const { name, category, area, city, county, address, details, coordinates, isActive } = request.body;

        if (!name?.trim()) {
            return reply.code(400).send({ success: false, error: 'Landmark name is required.' });
        }
        if (!coordinates?.lat || !coordinates?.lng) {
            return reply.code(400).send({ success: false, error: 'Coordinates (lat, lng) are required.' });
        }

        const lat = Number(coordinates.lat);
        const lng = Number(coordinates.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return reply.code(400).send({ success: false, error: 'Invalid coordinates.' });
        }

        const doc = await db.moveIn.MoveInPOI.create({
            name: name.trim(),
            category: category || 'other',
            area: area || null,
            city: city || null,
            county: county || null,
            address: address || null,
            details: details || null,
            coordinates: { lat, lng },
            location: { type: 'Point', coordinates: [lng, lat] },
            isActive: isActive !== false,
        });

        return reply.code(201).send({ success: true, data: doc });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = create_landmark;
