const db = require('payservedb');


const update_landmark = async (request, reply) => {
    try {
        const { landmarkId } = request.params;
        const { name, category, area, city, county, address, details, coordinates, isActive } = request.body;

        const updates = {};
        if (name !== undefined)     updates.name     = name.trim();
        if (category !== undefined) updates.category = category;
        if (area !== undefined)     updates.area     = area || null;
        if (city !== undefined)     updates.city     = city || null;
        if (county !== undefined)   updates.county   = county || null;
        if (address !== undefined)  updates.address  = address || null;
        if (details !== undefined)  updates.details  = details || null;
        if (isActive !== undefined) updates.isActive = isActive;

        if (coordinates?.lat !== undefined && coordinates?.lng !== undefined) {
            const lat = Number(coordinates.lat);
            const lng = Number(coordinates.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return reply.code(400).send({ success: false, error: 'Invalid coordinates.' });
            }
            updates.coordinates = { lat, lng };
            updates.location = { type: 'Point', coordinates: [lng, lat] };
        }

        const doc = await db.moveIn.MoveInPOI.findByIdAndUpdate(
            landmarkId,
            { $set: updates },
            { new: true }
        ).lean();

        if (!doc) return reply.code(404).send({ success: false, error: 'Landmark not found.' });

        return reply.code(200).send({ success: true, data: doc });
    } catch (err) {
        
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_landmark;
