const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_or_update_tax_rate = async (request, reply) => {
    try {
        // Extract parameters from request
        const { facilityId } = request.params;
        const taxId = request.params.taxId; // For update operations
        const { taxRate, country, currency, taxType } = request.body;

        // Validate required fields
        if (!facilityId || !taxRate || !country || !currency || !taxType) {
            return reply.code(400).send({
                success: false,
                message: 'Missing required fields',
                requiredFields: ['facilityId', 'taxRate', 'country', 'currency', 'taxType']
            });
        }

        // Validate tax rate is a positive number
        const parsedTaxRate = parseFloat(taxRate);
        if (isNaN(parsedTaxRate) || parsedTaxRate < 0) {
            return reply.code(400).send({
                success: false,
                message: 'Tax rate must be a positive number'
            });
        }

        // Get the CountryTaxRate model for the facility
        const CountryTaxRate = await getModel('CountryTaxRate', payservedb.CountryTaxRate.schema, facilityId);

        // Check if updating existing tax rate
        if (taxId) {
            // Find existing tax rate
            const existingTaxRate = await CountryTaxRate.findById(taxId);

            if (!existingTaxRate) {
                return reply.code(404).send({
                    success: false,
                    message: 'Tax rate not found'
                });
            }

            // Check if another tax rate with same type exists (excluding current record)
            const duplicateTaxType = await CountryTaxRate.findOne({
                facilityId,
                taxType,
                _id: { $ne: taxId }
            });

            if (duplicateTaxType) {
                return reply.code(400).send({
                    success: false,
                    message: 'Tax rate already exists for this type'
                });
            }

            // Update existing tax rate
            existingTaxRate.taxRate = parsedTaxRate;
            existingTaxRate.country = country;
            existingTaxRate.currency = currency;
            existingTaxRate.taxType = taxType;
            existingTaxRate.updatedAt = new Date();

            // Save the updated tax rate
            const updatedTaxRate = await existingTaxRate.save();

            return reply.code(200).send({
                success: true,
                message: 'Tax rate updated successfully',
                data: updatedTaxRate
            });
        } else {
            // Check if tax rate already exists for this facility and tax type
            const existingTaxRate = await CountryTaxRate.findOne({
                facilityId,
                taxType
            });

            if (existingTaxRate) {
                return reply.code(400).send({
                    success: false,
                    message: 'Tax rate already exists for this type'
                });
            }

            // Create new tax rate
            const newTaxRate = new CountryTaxRate({
                facilityId,
                taxRate: parsedTaxRate,
                country,
                currency,
                taxType,
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true
            });

            // Save the new tax rate
            const savedTaxRate = await newTaxRate.save();

            return reply.code(201).send({
                success: true,
                message: 'Tax rate added successfully',
                data: savedTaxRate
            });
        }
    } catch (err) {
        console.error('Error in adding or updating tax rate:', err);

        // Handle specific MongoDB errors
        if (err.name === 'ValidationError') {
            return reply.code(400).send({
                success: false,
                message: 'Validation error',
                errors: Object.values(err.errors).map(e => e.message)
            });
        }

        if (err.name === 'CastError') {
            return reply.code(400).send({
                success: false,
                message: 'Invalid ID format'
            });
        }

        // Generic error response
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = add_or_update_tax_rate;