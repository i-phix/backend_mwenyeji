const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const update_vas_vendor = async (request, reply) => {
    try {
        const { facilityId, vendorId } = request.params;
        const {
            name,
            address,
            offers,
            contactDetails,
            notes
        } = request.body;

        console.log("Update Request Body:", request.body);

        // Validation
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

        // Validate each offer has required fields
        for (const offer of offers) {
            if (!offer.serviceId || !offer.amount) {
                return reply.code(400).send({
                    success: false,
                    message: "Each offer must have serviceId and amount"
                });
            }

            if (offer.amount < 0) {
                return reply.code(400).send({
                    success: false,
                    message: "Amount cannot be negative"
                });
            }
        }

        // Get the VasVendor model for this facility
        const VasVendor = await getModel('VasVendor', payservedb.VasVendor.schema, facilityId);

        // Check if vendor exists
        const existingVendor = await VasVendor.findOne({
            _id: vendorId,
            facilityId
        });

        if (!existingVendor) {
            return reply.code(404).send({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Check if another vendor with same name exists (excluding current vendor)
        if (name && name !== existingVendor.name) {
            const duplicateVendor = await VasVendor.findOne({
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                facilityId,
                _id: { $ne: vendorId }
            });

            if (duplicateVendor) {
                return reply.code(409).send({
                    success: false,
                    message: 'Another vendor with this name already exists'
                });
            }
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

        // Update vendor document
        const updateData = {
            name,
            address: address || existingVendor.address,
            offers: offers.map(offer => ({
                serviceId: offer.serviceId,
                amount: offer.amount
            })),
            contactDetails: {
                name: contactDetails.name,
                phone: contactDetails.phone,
                email: contactDetails.email || existingVendor.contactDetails?.email
            },
            notes: notes !== undefined ? notes : existingVendor.notes
        };

        

        const updatedVendor = await VasVendor.findByIdAndUpdate(
            vendorId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedVendor) {
            return reply.code(404).send({
                success: false,
                message: 'Vendor not found after update'
            });
        }

        // Populate the service details for response
        await updatedVendor.populate('offers.serviceId');

        return reply.code(200).send({
            success: true,
            message: 'VAS Vendor updated successfully',
            data: updatedVendor
        });

    } catch (err) {
        console.error('Error updating VAS vendor:', err);

        // Handle duplicate key error
        if (err.code === 11000) {
            return reply.code(409).send({
                success: false,
                message: 'Duplicate entry: Vendor with this name already exists'
            });
        }

        // Handle validation errors
        if (err.name === 'ValidationError') {
            return reply.code(400).send({
                success: false,
                message: 'Validation error',
                error: err.message
            });
        }

        // Handle invalid ObjectId
        if (err.name === 'CastError' && err.kind === 'ObjectId') {
            return reply.code(400).send({
                success: false,
                message: `Invalid ${err.path} format`
            });
        }

        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = update_vas_vendor;