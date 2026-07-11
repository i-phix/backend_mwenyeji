const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_unit_documents = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;

        // Get models
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const documentTypeModel = await getModel('DocumentType', payservedb.DocumentType.schema, facilityId);

        // Find the unit
        const unit = await unitModel.findById(unitId).lean();
        if (!unit) {
            return reply.code(404).send({ error: 'Unit not found' });
        }

        // Get all document type IDs that are referenced
        const documentTypeIds = unit.unitDocuments.map(doc => doc.documentType);

        // Fetch all those document types from database
        const documentTypes = await documentTypeModel
            .find({ _id: { $in: documentTypeIds } })
            .lean();

        // Replace each document's documentType ID with the full documentType object
        const documents = unit.unitDocuments.map(doc => {
            const fullDocumentType = documentTypes.find(
                dt => dt._id.toString() === doc.documentType.toString()
            );

            return {
                ...doc,
                documentType: fullDocumentType
            };
        });

        return reply.code(200).send({ documents });

    } catch (err) {
        console.error('Error fetching unit documents:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_unit_documents;
