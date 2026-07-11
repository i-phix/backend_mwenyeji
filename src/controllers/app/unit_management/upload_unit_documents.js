const payservedb = require('payservedb');
const path = require('path');
const { getModel } = require('../../../utils/getModel');

const upload_unit_documents = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;
        const {
            documentName,
            documentType
        } = request.body;

        const file = request.file
            ? `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.file.path)}`
            : null;

        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

        const unit = await unitModel.findById(unitId);

        const unitDocument = {
            documentName,
            documentType,
            document: file,
            facilityId: facilityId
        };

        unit.unitDocuments.push(unitDocument);
        await unit.save();

        return reply.code(200).send({ message: 'Document uploaded successfully', unitDocument });
    } catch (err) {
        console.error('Error in adding unit document:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = upload_unit_documents;
