const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { ObjectId } = require('mongodb');

const get_service_invoices_by_customer = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        console.log('Input IDs:', { facilityId, customerId });

        // Validate input
        if (!facilityId || !customerId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Customer ID are required'
            });
        }

        // Validate ObjectId
        if (!ObjectId.isValid(facilityId) || !ObjectId.isValid(customerId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid Facility ID or Customer ID'
            });
        }

        const facilityObjectId = new ObjectId(facilityId);
        const customerObjectId = new ObjectId(customerId);

        // Get both models
        let serviceInvoiceModel, valueAddedServiceModel;
        try {
            serviceInvoiceModel = await getModel(
                "VasInvoice",
                payservedb.VasInvoice.schema,
                facilityObjectId
            );

            valueAddedServiceModel = await getModel(
                "ValueAddedService",
                payservedb.ValueAddedService.schema,
                facilityObjectId
            );

            console.log('Models created successfully');
        } catch (modelError) {
            console.error('Model Creation Error:', modelError);
            return reply.code(500).send({
                success: false,
                error: `Error creating models: ${modelError.message}`
            });
        }

        // Fetch service invoices
        try {
            const serviceInvoices = await serviceInvoiceModel.find({
                customerId: customerObjectId
            });

            console.log('Found service invoices:', serviceInvoices.length);

            // Add service names to invoices
            const invoicesWithServiceNames = await Promise.all(serviceInvoices.map(async (invoice) => {
                try {
                    console.log('Processing invoice:', invoice._id.toString());
                    console.log('Service ID:', invoice.serviceId.toString());

                    const service = await valueAddedServiceModel.findById(invoice.serviceId);
                    console.log('Found service:', service);

                    const result = {
                        ...invoice.toObject(),
                        serviceName: service ? service.serviceName : 'Unknown Service'
                    };

                    console.log('Processed invoice result:', {
                        invoiceId: result._id,
                        serviceName: result.serviceName
                    });

                    return result;
                } catch (error) {
                    console.error(`Error processing invoice ${invoice._id}:`, error);
                    return {
                        ...invoice.toObject(),
                        serviceName: 'Error retrieving service'
                    };
                }
            }));

            return reply.code(200).send({
                success: true,
                data: invoicesWithServiceNames
            });
        } catch (queryError) {
            console.error('Query error:', queryError);
            return reply.code(500).send({
                success: false,
                error: 'Error fetching service invoices: ' + queryError.message
            });
        }
    } catch (err) {
        console.error('Unexpected error in get_service_invoices_by_customer:', err);
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_service_invoices_by_customer;