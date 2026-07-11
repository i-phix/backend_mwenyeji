const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const update_user = async (request, reply) => {
    try {
        const { facilityId, userId } = request.params;
        const {
            firstName,
            lastName,
            email,
            phoneNumber,
            department,
            permissions
        } = request.body;

        // Users are in global collection, but departments are tenant-specific
        const departmentModel = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);

        // Clean the phone number format if provided
        const filteredPhoneNumber = phoneNumber ? phoneNumber.trim().slice(-9) : null;

        // Check if the user exists (using global User model)
        const existingUser = await payservedb.User.findById(userId);
        if (!existingUser) {
            console.log('User not found:', userId);
            return reply.code(404).send({
                success: false,
                error: 'User not found.'
            });
        }

        // Helper function to get user's facility ID (handles both root level and customerData array)
        const getUserFacilityId = (user) => {
            // If facilityId is at root level, use it
            if (user.facilityId) {
                return user.facilityId.toString();
            }

            // If facilityId is in customerData array, get it from there
            if (user.customerData && user.customerData.length > 0) {
                const customerData = user.customerData[0];
                if (customerData.facilityId) {
                    return customerData.facilityId.toString();
                }
            }

            return null;
        };

        // Get the user's actual facility ID
        const userFacilityId = getUserFacilityId(existingUser);

        // Validate that user belongs to this facility
        if (userFacilityId !== facilityId.toString()) {
            console.log('User facility mismatch:', {
                userFacilityId: userFacilityId,
                requestFacilityId: facilityId.toString()
            });
            return reply.code(403).send({
                success: false,
                error: 'User does not belong to this facility.'
            });
        }

        // Validate department if provided
        if (department) {
            const departmentExists = await departmentModel.findOne({
                _id: department,
                facilityId: facilityId
            });

            if (!departmentExists) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid department. Department does not exist in this facility.'
                });
            }
        }

        // Helper function to build user query for uniqueness checks
        const buildUserQuery = (field, value) => {
            const query = {
                [field]: value,
                _id: { $ne: userId }
            };

            // For users with facilityId at root level
            const rootLevelQuery = {
                ...query,
                facilityId: facilityId
            };

            // For users with facilityId in customerData array
            const customerDataQuery = {
                ...query,
                'customerData.facilityId': facilityId
            };

            // Search in both locations
            return { $or: [rootLevelQuery, customerDataQuery] };
        };

        // If phone number changed, ensure it's not already used by another user in this facility
        if (filteredPhoneNumber && existingUser.phoneNumber !== filteredPhoneNumber) {
            const phoneNumberExists = await payservedb.User.findOne(
                buildUserQuery('phoneNumber', filteredPhoneNumber)
            );

            if (phoneNumberExists) {
                return reply.code(400).send({
                    success: false,
                    error: 'A user with this phone number already exists in this facility.'
                });
            }
        }

        // If email changed, ensure it's not already used by another user in this facility
        if (email && existingUser.email !== email) {
            const emailExists = await payservedb.User.findOne(
                buildUserQuery('email', email)
            );

            if (emailExists) {             return reply.code(400).send({
                    success: false,
                    error: 'A user with this email already exists in this facility.'
                });
            }
        }

        // Create full name from first and last name
        const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : existingUser.fullName;

        // Build update object only with provided fields
        const updateData = {
            updatedAt: new Date()
        };

        // Only include fields that were actually provided in the request
        if (firstName || lastName) {
            updateData.fullName = fullName;
        }
        if (firstName) {
            updateData.firstName = firstName;
        }
        if (lastName) {
            updateData.lastName = lastName;
        }
        if (email) {
            updateData.email = email;
        }
        if (phoneNumber) {
            updateData.phoneNumber = filteredPhoneNumber;
        }
        if (department !== undefined) { // Allow setting to null/empty
            updateData.department = department || null;
        }
        if (permissions) {
            updateData.permissions = permissions;
        }

        // Update user data using global User model
        const updatedUser = await payservedb.User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        );

        // Manually populate department information if department exists
        let userResponse = updatedUser.toObject();
        if (updatedUser.department) {
            try {
                const departmentDoc = await departmentModel.findById(updatedUser.department);
                if (departmentDoc) {
                    userResponse.department = {
                        _id: departmentDoc._id,
                        name: departmentDoc.name
                    };
                }
            } catch (popError) {
                console.error('Error populating department:', popError);
                // Continue without department details if population fails
            }
        }

        // Return success response
        return reply.code(200).send({
            success: true,
            message: 'User updated successfully',
            data: userResponse
        });
    } catch (err) {
        console.error('Error updating user:', err);
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = update_user;