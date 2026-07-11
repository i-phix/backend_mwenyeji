const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const path = require('path');
const fs = require('fs');
const util = require('util');

const mkdir = util.promisify(fs.mkdir);

const upload_lease = async (request, reply) => {
    try {
        const { leaseId, facilityId } = request.body;

        // Validate request body
        if (!leaseId || !facilityId) {
            return reply.code(400).send({ error: 'Lease ID and Facility ID are required.' });
        }

        // Fetch the lease model and the lease record from the facility-specific database
        const leaseModel = await getModel('Lease', payservedb.Lease.schema, facilityId);
        const lease = await leaseModel.findById(leaseId);

        if (!lease) {
            return reply.code(404).send({ error: 'Lease not found.' });
        }

        // Validate file upload
        if (!request.isMultipart()) {
            return reply.code(400).send({ error: 'Lease document file is required.' });
        }

        const file = await request.file(); // Get the file from the multipart request

        if (!file) {
            return reply.code(400).send({ error: 'Lease document file is required.' });
        }

        // Optional: Validate file type (e.g., allow only PDF or DOCX files)
        const allowedFileTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedFileTypes.includes(file.mimetype)) {
            return reply.code(400).send({ error: 'Invalid file type. Only PDF and DOCX files are allowed.' });
        }

        // Ensure the directory for lease uploads exists
        const uploadDir = path.join(__dirname, '../../../uploads/leases/');
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (dirErr) {
            console.error('Directory creation failed:', dirErr.message);
            return reply.code(500).send({ error: 'Failed to create upload directory.' });
        }

        // Save the file locally (you can replace this with cloud storage logic if required)
        const filePath = path.join(uploadDir, `${Date.now()}-${file.filename}`);
        await file.toFile(filePath); // Save the file to the local filesystem

        // Update the lease record in the database
        lease.signedCopyUrl = filePath; // Save the file path or URL
        lease.status = 'signed'; // Update the lease status
        await lease.save();

        return reply.code(200).send({
            message: 'Lease uploaded successfully.',
            filePath: `/uploads/leases/${path.basename(filePath)}`, // Provide relative path or cloud URL
        });
    } catch (err) {
        console.error('Error uploading lease:', err.message);
        return reply.code(502).send({ error: 'Failed to upload lease.' });
    }
};

module.exports = upload_lease;
