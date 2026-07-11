const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_vas_vendor = async (request, reply) => {
    try {
        const {
            facilityId,
            name,
            address,
            offers,
            contactDetails,
            notes
        } = request.body;

        if (!name) {
            return reply.code(400).send({
                success: false,
                message: "Vendor name is required"
            });
        }

        if (!contactDetails || !contactDetails.name || !contactDetails.phone) {
            return reply.code(400).send({
                success: false,
                message: "Contact person name and phone are required"
            });
        }

        if (!offers || !Array.isArray(offers) || offers.length === 0) {
            return reply.code(400).send({
                success: false,
                message: "At least one service offer is required"
            });
        }

        // Get the VasVendor model for this facility
        const VasVendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        // Check if vendor with same name already exists for this facility
        const existingVendor = await VasVendor.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            facilityId
        });

        if (existingVendor) {
            return reply.code(409).send({
                success: false,
                message: 'Vendor with this name already exists for this facility'
            });
        }

        // Validate that all serviceIds exist in the ValueAddedService collection
        const ValueAddedService = await getModel('ValueAddedService', payservedb.ValueAddedService.schema, facilityId);
        
        for (const offer of offers) {
            const serviceExists = await ValueAddedService.findOne({
                _id: offer.serviceId,
                facilityId
            });
            
            if (!serviceExists) {
                return reply.code(400).send({
                    success: false,
                    message: `Service with ID ${offer.serviceId} does not exist for this facility`
                });
            }
        }

        // Create new vendor document
        const newVasVendor = new VasVendor({
            facilityId,
            name,
            address: address || undefined,
            offers: offers.map(offer => ({
                serviceId: offer.serviceId
            })),
            contactDetails: {
                name: contactDetails.name,
                phone: contactDetails.phone,
                email: contactDetails.email || undefined
            },
            notes,
            status: 'ACTIVE',
        });

        const savedVendor = await newVasVendor.save();

        // Populate the service details for response
        await savedVendor.populate('offers.serviceId');

        return reply.code(200).send({
            success: true,
            message: 'VAS Vendor added successfully',
            data: savedVendor
        });

    } catch (err) {
        console.error('Error adding VAS vendor:', err);

        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = add_vas_vendor;