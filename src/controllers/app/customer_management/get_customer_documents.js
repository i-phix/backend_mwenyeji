const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require('../../../utils/getModel');

const get_customer_documents = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        const documentTypeModel = await getModel(
            'DocumentType',
            payservedb.DocumentType.schema,
            facilityId
        );

        const customer = await payservedb.Customer.findById(customerId).lean();
        if (!customer) {
            return reply.code(404).send({ error: 'Customer not found' });
        }

        const documentTypeIds = customer.customerDocuments
            .map(doc => doc.documentType)
            .filter(id => mongoose.Types.ObjectId.isValid(id));

        const documentTypes = await documentTypeModel
            .find({ _id: { $in: documentTypeIds } })
            .lean();

        const documents = customer.customerDocuments.map(doc => {
            if (!mongoose.Types.ObjectId.isValid(doc.documentType)) {
                return { ...doc, documentType: null };
            }

            const fullDocumentType = documentTypes.find(
                dt => dt._id.toString() === doc.documentType.toString()
            );

            return {
                ...doc,
                documentType: fullDocumentType || null
            };
        });

        return reply.code(200).send({ documents });
    } catch (err) {
        console.error('Error fetching customer documents:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = get_customer_documents;
