const db = require('payservedb');
const mongoose = require('mongoose');
const logger = require('../../../../../config/winston');

const getPOI = () => {
    const conn = db.moveInConnection;
    if (!conn) throw new Error('Move-In DB connection not ready.');
    if (conn.models['MoveInPOI']) return conn.models['MoveInPOI'];
    return conn.model('MoveInPOI', new mongoose.Schema({}, { strict: false, timestamps: true }), 'moveinpois');
};

const save_landmark = async (request, reply) => {
    try {
        const { landmarkId } = request.params || {};
        const { name, category, area, city, county, address, details, coordinates, isActive } = request.body;

        if (!landmarkId) {
            if (!name?.trim()) return reply.code(400).send({ success: false, error: 'Landmark name is required.' });
            if (!coordinates?.lat || !coordinates?.lng) return reply.code(400).send({ success: false, error: 'Coordinates (lat, lng) are required.' });
            const lat = Number(coordinates.lat);
            const lng = Number(coordinates.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return reply.code(400).send({ success: false, error: 'Invalid coordinates.' });

            const doc = await getPOI().create({
                name: name.trim(), category: category || 'other',
                area: area || null, city: city || null, county: county || null,
                address: address || null, details: details || null,
                coordinates: { lat, lng },
                location: { type: 'Point', coordinates: [lng, lat] },
                isActive: isActive !== false,
            });
            return reply.code(201).send({ success: true, data: doc });
        } else {
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
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return reply.code(400).send({ success: false, error: 'Invalid coordinates.' });
                updates.coordinates = { lat, lng };
                updates.location = { type: 'Point', coordinates: [lng, lat] };
            }
            const doc = await getPOI().findByIdAndUpdate(landmarkId, { $set: updates }, { new: true }).lean();
            if (!doc) return reply.code(404).send({ success: false, error: 'Landmark not found.' });
            return reply.code(200).send({ success: true, data: doc });
        }
    } catch (err) {
        logger.error('[core/move_in/landmarks/save] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = save_landmark;
