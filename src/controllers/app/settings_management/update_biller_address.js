const payservedb = require("payservedb");
const { getModel } = require("../../../utils/getModel");
const fs = require('fs');
const path = require('path');

const update_biller_address = async (request, reply) => {
    try {
        const { facilityId, billerAddressId } = request.params;
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

        // Website validation (if provided)
        if (website) {
            const websiteRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
            if (!websiteRegex.test(website)) {
                // Clean up uploaded file if validation fails
                if (request.file && request.file.path) {
                    fs.unlink(request.file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                    });
                }
                
                return reply.code(400).send({
                    success: false,
                    error: 'Please enter a valid website URL'
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

        // Check if the biller address exists and belongs to this facility
        const existingBillerAddress = await billerAddressModel.findOne({
            _id: billerAddressId,
            facilityId
        });

        if (!existingBillerAddress) {
            // Clean up uploaded file if address not found
            if (request.file && request.file.path) {
                fs.unlink(request.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }
            
            return reply.code(404).send({
                success: false,
                error: 'Biller address not found or does not belong to this facility'
            });
        }

        // Check if name already exists for another record in this facility
        const duplicateAddress = await billerAddressModel.findOne({
            facilityId,
            name: name.trim(),
            _id: { $ne: billerAddressId }
        });

        if (duplicateAddress) {
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
                { facilityId, _id: { $ne: billerAddressId } },
                { $set: { isDefault: false } }
            );
        }

        const updateData = {
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
            isDefault: isDefault || false,
            updatedBy: request.user ? request.user._id : null,
            updatedAt: new Date()
        };

        // Handle logo update
        if (request.file) {
            // Delete old logo file if it exists
            if (existingBillerAddress.logo) {
                const oldLogoPath = path.join(__dirname, '../../../uploads/logos', existingBillerAddress.logo);
                fs.unlink(oldLogoPath, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting old logo file:', unlinkErr);
                });
            }
            updateData.logo = request.file.filename;
        }

        const updatedBillerAddress = await billerAddressModel.findByIdAndUpdate(
            billerAddressId,
            updateData,
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            success: true,
            message: 'Biller address updated successfully',
            data: updatedBillerAddress
        });

    } catch (err) {
        console.error('Error in update_biller_address:', err);

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

        return reply.code(500).send({
            success: false,
            error: 'Failed to update biller address',
            details: err.message
        });
    }
};

module.exports = update_biller_address;