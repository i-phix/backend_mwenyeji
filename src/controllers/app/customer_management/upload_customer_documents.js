const payservedb = require('payservedb');
const path = require('path');

const upload_customer_documents = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;
        const {
            documentName,
            documentType
        } = request.body;

        const file = request.file
            ? `${request.protocol}://${request.headers.host}/uploads/${path.basename(request.file.path)}`
            : null;


        const customer = await payservedb.Customer.findById(customerId);

        const customerDocument = {
            documentName,
            documentType,
            document: file,
            facilityId: facilityId
        };

        customer.customerDocuments.push(customerDocument);
        await customer.save();

        return reply.code(200).send({ message: 'Document uploaded successfully', customerDocument });
    } catch (err) {
        console.error('Error in adding customer document:', err);
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = upload_customer_documents;
