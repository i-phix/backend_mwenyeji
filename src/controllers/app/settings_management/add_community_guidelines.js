const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const path = require('path');
const fs = require('fs');

const AddCommunityGuidelines = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { content, contentType } = request.body;

        let pdfUrl = null;
        let pdfFileName = null;

        // Process PDF upload if file exists
        if (request.file) {
            const pdfFile = request.file;

            // Validate it's a PDF
            if (pdfFile.mimetype !== 'application/pdf') {
                // Clean up the uploaded file if it's not PDF
                if (fs.existsSync(pdfFile.path)) {
                    fs.unlinkSync(pdfFile.path);
                }
                return reply.code(400).send({
                    error: "Only PDF files are allowed"
                });
            }

            pdfUrl = `${request.protocol}://${request.headers.host}/uploads/${path.basename(pdfFile.path)}`;
            pdfFileName = pdfFile.originalname || `guidelines-${Date.now()}.pdf`;
        }

        // Validate content based on type
        if (contentType === 'text' && !content) {
            return reply.code(400).send({
                error: "Content is required for text guidelines"
            });
        }

        if (contentType === 'pdf' && !pdfUrl) {
            return reply.code(400).send({
                error: "PDF file is required for PDF guidelines"
            });
        }

        const communityGuidelines = await getModel(
            "CommunityGuidelines",
            payservedb.CommunityGuidelines.schema,
            facilityId
        );

        // If updating from PDF to text, delete old PDF file
        const existingGuidelines = await communityGuidelines.findOne({ facilityId });
        if (existingGuidelines && existingGuidelines.contentType === 'pdf' &&
            existingGuidelines.pdfUrl && contentType === 'text') {
            try {
                const oldFileName = existingGuidelines.pdfUrl.split('/').pop();
                const oldFilePath = path.join('uploads/community-guidelines', oldFileName);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            } catch (err) {
                console.error("Error deleting old PDF:", err);
                // Continue anyway, don't fail the update
            }
        }

        const guidelines = await communityGuidelines.findOneAndUpdate(
            { facilityId },
            {
                title: "Community Guidelines",
                content: contentType === 'text' ? content : (existingGuidelines?.content || ""),
                contentType: contentType || 'text',
                pdfUrl: contentType === 'pdf' ? pdfUrl : null,
                pdfFileName: contentType === 'pdf' ? pdfFileName : null,
                facilityId,
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
            }
        );

        return reply.code(200).send({
            success: true,
            message: "Community Guidelines saved successfully",
            guidelines,
        });
    } catch (err) {
        console.error("Error in AddCommunityGuidelines:", err);
        return reply.code(500).send({ error: err.message });
    }
};

module.exports = AddCommunityGuidelines;