const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const fs = require('fs');
const path = require('path');

const add_biller_address = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            name,
            companyName,
            website,
            email,
            phone,
            address,
            city,
            state,
            country,
            postalCode,
            isDefault
        } = request.body;

        const baseUrl = `${request.protocol}://${request.headers.host}/uploads`;

        const digitalSignature = request.file
            ? `${baseUrl}/${path.basename(request.file.path)}`
            : null;

        // Input validation
        if (!name || !companyName || !email || !address || !city || !country) {
            // Clean up uploaded file if validation fails
            if (request.file && request.file.path) {
                fs.unlink(request.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }

            return reply.code(400).send({
                success: false,
                error: 'Required fields missing: name, companyName, email, address, city, and country are required'
            });
        }

        // Email validation
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            // Clean up uploaded file if validation fails
            if (request.file && request.file.path) {
                fs.unlink(request.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }

            return reply.code(400).send({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        // Website validation (only if provided and not empty)
        if (website && website.trim() !== '') {
            // More flexible website regex that accepts various URL formats
            const websiteRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

            if (!websiteRegex.test(website.trim())) {
                // Clean up uploaded file if validation fails
                if (request.file && request.file.path) {
                    fs.unlink(request.file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                    });
                }

                return reply.code(400).send({
                    success: false,
                    error: 'Please enter a valid website URL (e.g., https://example.com, www.example.com, or example.com)'
                });
            }
        }

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            // Clean up uploaded file if facility not found
            if (request.file && request.file.path) {
                fs.unlink(request.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }

            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        const billerAddressModel = await getModel("BillerAddress", payservedb.BillerAddress.schema, facilityId);

        // Check if address name already exists for this facility
        const existingAddress = await billerAddressModel.findOne({
            facilityId,
            name: name.trim()
        });

        if (existingAddress) {
            // Clean up uploaded file if duplicate found
            if (request.file && request.file.path) {
                fs.unlink(request.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }

            return reply.code(400).send({
                success: false,
                error: 'A biller address with this name already exists'
            });
        }

        // If this is being set as default, unset any existing default
        if (isDefault) {
            await billerAddressModel.updateMany(
                { facilityId },
                { $set: { isDefault: false } }
            );
        }

        const billerAddressData = {
            name: name.trim(),
            companyName: companyName.trim(),
            website: website?.trim() || '',
            email: email.trim().toLowerCase(),
            phone: phone?.trim() || '',
            address: address.trim(),
            city: city.trim(),
            state: state?.trim() || '',
            country: country.trim(),
            postalCode: postalCode?.trim() || '',
            digitalSignature,
            isDefault: isDefault || false,
            facilityId,
            createdBy: request.user ? request.user._id : null
        };

        const savedBillerAddress = await billerAddressModel.create(billerAddressData);

        return reply.code(200).send({
            success: true,
            message: 'Biller address added successfully',
            data: savedBillerAddress
        });

    } catch (err) {
        console.error('Error in add_biller_address:', err);

        // If there was a file uploaded but an error occurred, clean up the file
        if (request.file && request.file.path) {
            fs.unlink(request.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
            });
        }

        // Handle mongoose validation errors
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(error => error.message);
            return reply.code(400).send({
                success: false,
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Handle duplicate key errors
        if (err.code === 11000) {
            return reply.code(400).send({
                success: false,
                error: 'Biller address with this name already exists'
            });
        }

        return reply.code(500).send({
            success: false,
            error: 'Failed to add biller address',
            details: err.message
        });
    }
};

module.exports = add_biller_address;