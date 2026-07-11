const db = require('payservedb');
const path = require('path');
const logger = require('../../../../../config/winston');
const { uploadBufferToGCS } = require('../../../../utils/gcs');

// POST /api/move_in/landlord/units/:unitId/images
// Multipart upload — field name "images", up to 10 files. Files arrive as
// in-memory buffers (see src/middlewares/gcs_upload.js) and are streamed
// straight to Google Cloud Storage so they survive Cloud Run container
// restarts/redeploys.
const upload_unit_images = async (request, reply) => {
    try {
        const { userId } = request.user;
        const { unitId } = request.params;

        const unit = await db.moveIn.MoveInUnit.findOne({ _id: unitId, landlordId: userId });
        if (!unit) return reply.code(404).send({ error: 'Unit not found.' });

        const files = Array.isArray(request.files) ? request.files : (request.file ? [request.file] : []);
        if (!files.length) return reply.code(400).send({ error: 'No files uploaded.' });

        const newImages = [];
        for (const f of files) {
            const url = await uploadBufferToGCS(f.buffer, f.originalname, f.mimetype, 'move_in');
            newImages.push({
                category: 'Photo',
                label: path.basename(f.originalname || '', path.extname(f.originalname || '')),
                url,
            });
        }

        unit.images.push(...newImages);
        await unit.save();

        logger.info(`[move_in/landlord] ${files.length} image(s) uploaded for unit ${unitId}`);
        return reply.code(200).send({ success: true, images: unit.images });
    } catch (err) {
        logger.error('[move_in/landlord/upload_images] ' + err.message);
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = upload_unit_images;
