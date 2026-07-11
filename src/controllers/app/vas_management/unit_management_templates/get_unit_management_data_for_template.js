const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_unit_management_data_for_template = async (request, reply) => {
    try {
        const { facilityId, managementId } = request.params;

        // Validate facilityId
        if (!facilityId || !mongoose.Types.ObjectId.isValid(facilityId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid facility ID'
            });
        }

        // Validate managementId
        if (!managementId || !mongoose.Types.ObjectId.isValid(managementId)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid management ID'
            });
        }

        // Get models
        const ServiceRequest = await getModel('ServiceRequest', payservedb.ServiceRequest.schema, facilityId);
        const UnitManagementTemplate = await getModel('UnitManagementTemplate', payservedb.UnitManagementTemplate.schema, facilityId);

        // Find service request
        const serviceRequest = await ServiceRequest.findById(managementId).lean();

        if (!serviceRequest) {
            return reply.code(404).send({
                success: false,
                message: 'Service request not found'
            });
        }

        // Find template - use default if not specified
        const templateQuery = serviceRequest.templateId
            ? { _id: serviceRequest.templateId, facilityId }
            : { isDefault: true, facilityId };

        const template = await UnitManagementTemplate.findOne(templateQuery).lean();

        if (!template) {
            return reply.code(404).send({
                success: false,
                message: 'Template not found. Please create a template first.'
            });
        }

        // Get unit data
        const unitData = await payservedb.Unit.findById(serviceRequest.unitId).lean();

        if (!unitData) {
            return reply.code(404).send({
                success: false,
                message: 'Unit not found'
            });
        }

        // Get tenant data
        const tenantData = await payservedb.Customer.findById(serviceRequest.customerId).lean();

        // Get landlord data
        const landlordData = await payservedb.Landlord.findById(unitData.landlordId).lean();

        // Get property data
        const propertyData = await payservedb.Property.findById(unitData.propertyId).lean();

        // Get currency data
        const currencyData = await payservedb.Currency.findById(serviceRequest.currencyId || propertyData.currencyId).lean();

        // Get value added service data
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        const serviceData = await ValueAddedService.findById(serviceRequest.serviceId).lean();

        // Management details
        const managementDetails = {
            startDate: serviceRequest.startDate || new Date().toISOString(),
            endDate: serviceRequest.endDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
            duration: serviceRequest.duration || 12,
            commission: {
                percentage: serviceRequest.percentage || 10,
                fixedAmount: serviceRequest.fixedAmount || 0,
                frequency: serviceRequest.frequency || 'monthly'
            },
            fee: serviceRequest.amount || 0,
            paymentDueDate: serviceRequest.paymentDueDate || 1,
            landlordResponsibilities: 'Major repairs, structural maintenance',
            managerResponsibilities: 'Rent collection, regular inspections, tenant screening',
            tenantResponsibilities: 'Minor repairs, cleaning, reporting issues',
            noticePeriod: '60 days',
            terminationConditions: 'Breach of contract, mutual agreement',
            earlyTerminationFee: '1 month commission'
        };

        // Compile and return data
        const data = {
            templateContent: template.templateContent,
            unit: unitData,
            tenant: tenantData,
            landlord: landlordData,
            property: propertyData,
            currency: currencyData,
            service: serviceData,
            management: managementDetails
        };

        return reply.code(200).send({
            success: true,
            data
        });
    } catch (err) {
        console.error('Error in get_unit_management_data_for_template:', err);

        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = get_unit_management_data_for_template;