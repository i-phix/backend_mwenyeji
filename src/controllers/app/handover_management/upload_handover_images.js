const path = require('path');
const logger = require('../../../../config/winston');

const upload_handover_images = async (request, reply) => {
    try {
        const { facilityId, handoverId } = request.params;

        // Validate required fields
        if (!facilityId || !handoverId) {
            logger.error('Missing required parameters for handover image upload', { 
                facilityId, 
                handoverId 
            });
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Handover ID are required'
            });
        }

        // Check if files were uploaded
        if (!request.files || request.files.length === 0) {
            logger.warn('No files provided in handover image upload request', { 
                facilityId, 
                handoverId 
            });
            return reply.code(400).send({
                success: false,
                error: 'No image files were provided'
            });
        }

        // Process uploaded files
        const uploadedImages = request.files.map(file => {
            const fileName = path.basename(file.path);
            const imageUrl = `uploads/${fileName}`;
            
            logger.info('Processed handover image upload', {
                facilityId,
                handoverId,
                originalName: file.originalname,
                fileName,
                size: file.size,
                mimetype: file.mimetype
            });

            return {
                name: file.originalname,
                url: imageUrl,
                size: file.size,
                mimetype: file.mimetype,
                uploadDate: new Date().toISOString()
            };
        });

        logger.info('Handover images uploaded successfully', {
            facilityId,
            handoverId,
            imageCount: uploadedImages.length
        });

        return reply.code(200).send({
            success: true,
            message: `${uploadedImages.length} image(s) uploaded successfully`,
            data: {
                images: uploadedImages,
                uploadCount: uploadedImages.length
            }
        });

    } catch (err) {
        logger.error('Error uploading handover images', {
            error: err.message,
            stack: err.stack
        });
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while uploading images'
        });
    }
};

module.exports = upload_handover_images;