const db = require('payservedb');
const logger = require('../../../../config/winston');
const { getModel } = require('../../../utils/getModel');
const { uploadBufferToGCS } = require('../../../utils/gcs');
const { ensureMoveInLandlordForPayServeUser, sendError } = require('./context');

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
};

const numberOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

// POST /api/landlord/move_in/list_unit
// Creates a new standalone MoveInUnit listing for this landlord.
// Expects multipart/form-data processed by fastify-multer (upload.any()).
// Image files use fieldname pattern "img_<Category>" (e.g. "img_Living Room").
const list_unit = async (request, reply) => {
    try {
        const { userId } = request.user;

        const { moveInLandlord } = await ensureMoveInLandlordForPayServeUser(userId);

        const body = request.body || {};
        const title       = body.title;
        const price       = Number(body.price);
        const listingType = body.listingType;
        const bedrooms    = body.bedrooms    !== undefined && body.bedrooms    !== '' ? Number(body.bedrooms)    : undefined;
        const bathrooms   = body.bathrooms   !== undefined && body.bathrooms   !== '' ? Number(body.bathrooms)   : undefined;
        const grossArea   = body.grossArea   !== undefined && body.grossArea   !== '' ? Number(body.grossArea)   : undefined;
        const description = body.description || null;
        const locationAddress = body.locationAddress || null;
        const locationCity    = body.locationCity    || null;
        const locationCounty  = body.locationCounty  || null;
        const coordinates = {
            lat: numberOrNull(body.latitude ?? body.lat),
            lng: numberOrNull(body.longitude ?? body.lng),
        };
        const safeCoordinates = coordinates.lat !== null && coordinates.lng !== null ? coordinates : null;
        const sourceUnitId    = body.sourceUnitId || body.payserveUnitId || null;
        const sourceFacilityId = body.sourceFacilityId || body.facilityId || null;

        const amenities = parseJsonArray(body.amenities);
        const landmarks = parseJsonArray(body.landmarks);
        const nearbyServices = parseJsonArray(body.nearbyServices);

        // imagesMeta: { [category]: [{ label: string }] }
        let imagesMeta = {};
        try { imagesMeta = JSON.parse(body.imagesMeta || '{}'); } catch (_) {}

        if (!title || !price || !listingType) {
            return reply.code(400).send({ error: 'title, price, and listingType are required.' });
        }

        // Handle uploaded images — fieldname = "img_<Category>"
        // imagesMeta carries per-image labels indexed by category.
        // Files arrive as in-memory buffers (upload.any() uses memoryStorage
        // — see routes/landlord.js) and are streamed to Google Cloud Storage
        // so they survive Cloud Run container restarts/redeploys.
        const categoryCounters = {};
        const imageObjects = [];
        const files = Array.isArray(request.files) ? request.files : [];
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

        let source = 'standalone';
        let payserveUnit = null;
        let UnitModel = null;
        if (sourceUnitId && sourceFacilityId) {
            UnitModel = await getModel('Unit', db.Unit.schema, sourceFacilityId);
            payserveUnit = await UnitModel.findOne({
                _id: sourceUnitId,
                $or: [{ tenantId: null }, { tenantId: { $exists: false } }],
            });
            if (!payserveUnit) {
                return reply.code(404).send({ error: 'Selected PayServe unit is not available for Move-In listing.' });
            }
            source = 'payserve';
        }

        const newUnit = new db.moveIn.MoveInUnit({
            landlordId: moveInLandlord._id,
            source,
            sourceFacilityId: source === 'payserve' ? sourceFacilityId : null,
            sourceUnitId: source === 'payserve' ? sourceUnitId : null,
            payserveLandlordId: source === 'payserve' ? userId : null,
            title,
            price,
            listingType,
            description,
            bedrooms,
            bathrooms,
            grossArea,
            location: {
                address: locationAddress,
                city: locationCity,
                county: locationCounty,
                coordinates: safeCoordinates,
                landmarks,
            },
            amenities,
            nearbyServices,
            images: imageObjects,
            moveInApproval: 'pending',
            isListed: false,
            moveInStatus: 'pending_approval',
        });

        await newUnit.save();

        if (source === 'payserve' && UnitModel && payserveUnit) {
            await UnitModel.updateOne(
                { _id: sourceUnitId },
                {
                    $set: {
                        listedInMoveIn: false,
                        moveInApproval: 'pending',
                        moveInStatus: 'pending_approval',
                        moveInListingId: newUnit._id,
                        listingType: 'rent',
                        moveInPrice: price,
                        moveInBedrooms: bedrooms ?? payserveUnit.moveInBedrooms ?? null,
                        moveInBathrooms: bathrooms ?? payserveUnit.moveInBathrooms ?? null,
                        moveInDescription: description,
                        moveInAmenities: amenities,
                        moveInLandmarks: landmarks,
                        moveInNearbyServices: nearbyServices,
                        moveInLocationAddress: locationAddress,
                        moveInLocationCity: locationCity,
                        moveInLocationCounty: locationCounty,
                        moveInCoordinates: safeCoordinates,
                        moveInImages: imageObjects.map((img) => img.url),
                        moveInLastSyncedAt: new Date(),
                    },
                }
            );
        }

        logger.info(`[landlord/move_in] New listing created by landlord ${userId}: ${newUnit._id}`);
        return reply.code(200).send({ success: true, message: 'Listing submitted for approval.', data: { id: newUnit._id } });
    } catch (err) {
        logger.error('[landlord/move_in/list_unit] ' + err.message);
        return sendError(reply, err);
    }
};

module.exports = list_unit;
