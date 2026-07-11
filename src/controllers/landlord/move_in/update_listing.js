const db = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');
const { uploadBufferToGCS } = require('../../../utils/gcs');
const { ensureMoveInLandlordForPayServeUser, landlordRecordFilter, sendError } = require('./context');

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return undefined;
    if (typeof value !== 'string') return undefined;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : undefined;
    } catch (_) {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
};

const numberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

// PUT /api/landlord/move_in/list_unit/:unitId
// Updates an existing MoveInUnit listing — resets approval to pending.
// Expects multipart/form-data processed by fastify-multer (upload.any()).
// Image files use fieldname pattern "img_<Category>" (e.g. "img_Living Room").
const update_listing = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { unitId } = request.params;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);

        const existing = await db.moveIn.MoveInUnit.findOne({
            _id: unitId,
            ...landlordRecordFilter({ payserveUserId: userId, moveInLandlordId: moveInLandlord._id }),
        });
        if (!existing) return reply.code(404).send({ error: 'Listing not found.' });

        const body = request.body || {};
        const title       = body.title;
        const price       = body.price       ? Number(body.price)       : undefined;
        const listingType = body.listingType  || undefined;
        const bedrooms    = body.bedrooms    !== undefined && body.bedrooms    !== '' ? Number(body.bedrooms)    : undefined;
        const bathrooms   = body.bathrooms   !== undefined && body.bathrooms   !== '' ? Number(body.bathrooms)   : undefined;
        const grossArea   = body.grossArea   !== undefined && body.grossArea   !== '' ? Number(body.grossArea)   : undefined;
        const description = body.description || null;
        const locationAddress = body.locationAddress || null;
        const locationCity    = body.locationCity    || null;
        const locationCounty  = body.locationCounty  || null;
        const hasCoordinates = body.latitude !== undefined || body.longitude !== undefined || body.lat !== undefined || body.lng !== undefined;
        const coordinates = {
            lat: numberOrNull(body.latitude ?? body.lat),
            lng: numberOrNull(body.longitude ?? body.lng),
        };
        const safeCoordinates = coordinates.lat !== null && coordinates.lng !== null ? coordinates : null;

        const amenities = parseJsonArray(body.amenities);
        const landmarks = parseJsonArray(body.landmarks);
        const nearbyServices = parseJsonArray(body.nearbyServices);

        let imagesMeta = {};
        try { imagesMeta = JSON.parse(body.imagesMeta || '{}'); } catch (_) {}

        const update = { moveInApproval: 'pending', isListed: false, moveInStatus: 'pending_approval' };

        if (title)       update.title = title;
        if (price)       update.price = price;
        if (listingType) update.listingType = listingType;
        if (bedrooms  !== undefined) update.bedrooms  = bedrooms;
        if (bathrooms !== undefined) update.bathrooms = bathrooms;
        if (grossArea !== undefined) update.grossArea = grossArea;
        if (description !== null)   update.description = description;
        if (amenities)  update.amenities = amenities;
        if (nearbyServices) update.nearbyServices = nearbyServices;
        if (locationAddress || locationCity || locationCounty || hasCoordinates) {
            update.location = {
                address: locationAddress ?? existing.location?.address,
                city:    locationCity    ?? existing.location?.city,
                county:  locationCounty  ?? existing.location?.county,
                coordinates: hasCoordinates ? safeCoordinates : existing.location?.coordinates,
                landmarks: landmarks ?? existing.location?.landmarks ?? [],
            };
        } else if (landmarks) {
            update.location = {
                ...(existing.location?.toObject ? existing.location.toObject() : existing.location || {}),
                landmarks,
            };
        }

        // Handle uploaded images — fieldname = "img_<Category>"
        // Files arrive as in-memory buffers (upload.any() uses memoryStorage
        // — see routes/landlord.js) and are streamed to Google Cloud Storage
        // so they survive Cloud Run container restarts/redeploys.
        const files = Array.isArray(request.files) ? request.files : [];
        if (files.length > 0) {
            const categoryCounters = {};
            const imageObjects = [];
            for (const file of files) {
                const category = file.fieldname.startsWith('img_')
                    ? file.fieldname.slice(4)
                    : 'Other';
                const idx = categoryCounters[category] ?? 0;
                categoryCounters[category] = idx + 1;
                const label = (imagesMeta[category]?.[idx]?.label) || '';
                const url = await uploadBufferToGCS(file.buffer, file.originalname, file.mimetype, 'move_in');
                imageObjects.push({ category, label, url });
            }
            update.images = imageObjects;
        }

        await db.moveIn.MoveInUnit.findByIdAndUpdate(unitId, update);

        if (existing.source === 'payserve' && existing.sourceFacilityId && existing.sourceUnitId) {
            const UnitModel = await getModel('Unit', db.Unit.schema, existing.sourceFacilityId);
            const payserveUpdate = {
                listedInMoveIn: false,
                moveInApproval: 'pending',
                moveInStatus: 'pending_approval',
                moveInListingId: existing._id,
                moveInLastSyncedAt: new Date(),
            };
            if (price !== undefined) payserveUpdate.moveInPrice = price;
            if (bedrooms !== undefined) payserveUpdate.moveInBedrooms = bedrooms;
            if (bathrooms !== undefined) payserveUpdate.moveInBathrooms = bathrooms;
            if (description !== null) payserveUpdate.moveInDescription = description;
            if (amenities) payserveUpdate.moveInAmenities = amenities;
            if (nearbyServices) payserveUpdate.moveInNearbyServices = nearbyServices;
            if (landmarks) payserveUpdate.moveInLandmarks = landmarks;
            if (update.location) {
                payserveUpdate.moveInLocationAddress = update.location.address;
                payserveUpdate.moveInLocationCity = update.location.city;
                payserveUpdate.moveInLocationCounty = update.location.county;
                payserveUpdate.moveInCoordinates = update.location.coordinates || null;
            }
            if (update.images) payserveUpdate.moveInImages = update.images.map((img) => img.url);
            await UnitModel.updateOne({ _id: existing.sourceUnitId }, { $set: payserveUpdate });
        }

        logger.info(`[landlord/move_in] Listing ${unitId} updated by landlord ${userId}`);
        return reply.code(200).send({ success: true, message: 'Listing updated and re-submitted for approval.' });
    } catch (err) {
        logger.error('[landlord/move_in/update_listing] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = update_listing;
