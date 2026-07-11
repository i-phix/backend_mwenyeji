const axios = require("axios");
const FormData = require("form-data");
const payservedb = require("payservedb");
require("dotenv").config();

const uploadContractDocument = async (request, reply) => {
    try {
        const { contractId } = request.params;

        if (!contractId) {
            return reply.code(400).send({
                error: "Contract ID is required",
            });
        }

        // Check if contract exists
        const contract = await payservedb.FacilityContract.findById(contractId);
        if (!contract) {
            return reply.code(404).send({
                error: "Contract not found",
            });
        }

        // Check if contract is already signed
        if (contract.status === "signed") {
            return reply.code(400).send({
                error: "Contract is already signed",
            });
        }

        // Check if file was uploaded with fastify-multer
        const file = request.file;
        if (!file) {
            return reply.code(400).send({
                error: "No contract document uploaded",
            });
        }

        // Validate file type - allow PDFs, DOCs, and common image formats
        const allowedTypes = [
            // Document types
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            // Image types
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return reply.code(400).send({
                error: "Invalid file type. Allowed formats: PDF, DOC, DOCX, JPEG, PNG, GIF, BMP, TIFF, WebP",
            });
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            return reply.code(400).send({
                error: "File size too large. Maximum allowed size is 10MB",
            });
        }

        try {
            // Get file service URL from environment variable
            const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'https://api.payserve.co.ke/upload_service/';

            // Create FormData for the external upload service
            const formData = new FormData();
            formData.append('files', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype
            });

            // Upload to FastAPI service using facility ID as folder
            const uploadResponse = await axios.post(
                `${FILE_SERVICE_URL}/api/v1/upload/${contract.facility}`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                    },
                    timeout: 30000, // 30 seconds timeout
                }
            );

            const uploadResult = uploadResponse.data;

            if (!uploadResult.uploaded_files || uploadResult.uploaded_files.length === 0) {
                throw new Error("Upload service returned no files");
            }

            const uploadedFile = uploadResult.uploaded_files[0];
            const uniqueFileName = uploadedFile.unique_name;

            // Create the full view URL for the uploaded document
            const documentViewUrl = `${FILE_SERVICE_URL}/api/v1/file/${contract.facility}/${uniqueFileName}/view`;

            // Update the contract with the view URL and change status
            const updatedContract = await payservedb.FacilityContract.findByIdAndUpdate(
                contractId,
                {
                    signedContractDocument: documentViewUrl,
                    status: "signed",
                    active: true,
                    updatedAt: new Date(),
                },
                { new: true, runValidators: true }
            )
                .populate("facility")
                .populate("pricing");

            return reply.code(200).send({
                message: "Contract document uploaded successfully. Contract is now signed and active.",
                contract: updatedContract,
                uploadDetails: {
                    originalName: uploadedFile.original_name,
                    uniqueName: uniqueFileName,
                    fileSize: uploadedFile.file_size,
                    fileType: uploadedFile.file_type,
                    documentUrl: documentViewUrl,
                    downloadUrl: `${FILE_SERVICE_URL}/api/v1/file/${contract.facility}/${uniqueFileName}/download`,
                },
            });

        } catch (uploadError) {
            console.error("Upload service error:", uploadError.message);
            return reply.code(500).send({
                error: "Failed to upload to external service",
                details: uploadError.response?.data?.detail || uploadError.message,
            });
        }

    } catch (error) {
        console.error("Upload contract document error:", error);
        return reply.code(500).send({
            error: "Internal server error",
            details: error.message,
        });
    }
};

module.exports = uploadContractDocument;