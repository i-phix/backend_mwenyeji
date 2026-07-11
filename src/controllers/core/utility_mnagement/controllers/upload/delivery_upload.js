const path = require('path');
const fs = require('fs');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
const logger = require('../../../../../../config/winston');

const uploadDeliveryDocument = async (request, reply) => {
    try {
        const deliveryId = request.params.deliveryId;
        // Access the file uploaded by multer. Adjust based on your route configuration.
        const file = request.files?.signedDocument?.[0];
        if (!file) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }

        // Get the delivery model and validate the delivery
        const deliveryModel = await getModel('MetersDelivery', payservedb.MetersDelivery.schema);
        const existingDelivery = await deliveryModel.findById(deliveryId);
        if (!existingDelivery) {
            return reply.code(404).send({ error: 'Delivery not found' });
        }
        if (existingDelivery.status === 'completed') {
            return reply.code(400).send({ error: 'Delivery is already completed' });
        }

        // OPTIONAL: If you want the file in a specific subfolder (e.g., "delivery-docs")
        const deliveryDocsDir = path.resolve(__dirname, '../../../../../uploads/delivery-docs');
        if (!fs.existsSync(deliveryDocsDir)) {
            fs.mkdirSync(deliveryDocsDir, { recursive: true });
        }
        // Move the file from its current location (uploadPath defined in your multer config) to the "delivery-docs" folder.
        const newFilePath = path.join(deliveryDocsDir, file.filename);
        fs.renameSync(file.path, newFilePath);

        // Construct a URL (assuming your static files are served from /uploads)
        const fileUrl = `/uploads/delivery-docs/${file.filename}`;

        // Update the delivery document with the file URL and additional details
        const updatedDelivery = await deliveryModel.findByIdAndUpdate(
            deliveryId,
            { 
                fileUrl: fileUrl, 
                receivedBy: request.body.receivedBy || existingDelivery.receivedBy,
                postNotes: request.body.postNotes || existingDelivery.postNotes
            },
            { new: true, runValidators: true }
        );

        logger.info(`Delivery document uploaded for delivery ${deliveryId}`);
        return reply.code(200).send({
            message: 'Delivery document uploaded successfully',
            delivery: updatedDelivery
        });

    } catch (err) {
        logger.error(`Error uploading delivery document: ${err.message}`);
        return reply.code(500).send({ 
            error: 'Failed to upload delivery document', 
            details: err.message 
        });
    }
};

module.exports = uploadDeliveryDocument;
