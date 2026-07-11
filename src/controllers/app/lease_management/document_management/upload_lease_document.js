const payservedb = require('payservedb');
const path = require('path');
const fs = require('fs');
const { getModel } = require('../../../../utils/getModel');

const uploadLeaseDocument = async (request, reply) => {
    try {
        console.log("Upload lease document controller called");
        console.log("Request params:", request.params);
        
        const { facilityId, leaseId } = request.params;
        
        // Validate parameters
        if (!facilityId || !leaseId) {
            return reply.code(400).send({ 
                success: false, 
                error: 'Missing required parameters: facilityId and leaseId are required' 
            });
        }

        // Check if a file was uploaded
        if (!request.file) {
            return reply.code(400).send({ 
                success: false, 
                error: 'No document uploaded' 
            });
        }

        console.log('Uploaded file:', request.file);

        // Get the model for the specified facility
        const LeaseAgreement = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);

        // Find the lease agreement
        const lease = await LeaseAgreement.findById(leaseId);
        if (!lease) {
            return reply.code(404).send({ 
                success: false, 
                error: `Lease agreement with ID ${leaseId} not found` 
            });
        }

        // Extract just the filename from the full path
        const filename = path.basename(request.file.path);
        
        // Prepare document data with a relative path instead of absolute path
        const documentData = {
            fileName: request.file.originalname,
            fileUrl: `uploads/${filename}`, // Store relative path for frontend access
            uploadedAt: new Date()
        };

        console.log("Document data to be saved:", documentData);

        // Initialize the leaseDocuments array if it doesn't exist
        if (!lease.leaseDocuments) {
            lease.leaseDocuments = [];
        }

        // Add the document to the lease
        lease.leaseDocuments.push(documentData);
        
        // Update lease status to Active when document is uploaded
        lease.status = 'Active';

        // Save the updated lease
        await lease.save();
        
        console.log(`Document added to lease ${leaseId}. Status changed to Active. Total documents: ${lease.leaseDocuments.length}`);

        return reply.code(200).send({
            success: true,
            message: 'Document uploaded successfully. Lease status updated to Active.',
            document: documentData
        });
    } catch (err) {
        console.error('Error uploading lease document:', err);
        return reply.code(500).send({ 
            success: false, 
            error: err.message || 'Internal server error' 
        });
    }
};

module.exports = uploadLeaseDocument;