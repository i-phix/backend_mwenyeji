const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_users = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get tenant-specific department model for manual population
        const departmentModel = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);

        // Find users with Staff role OR admin role with type "Company"
        // For admin users, check customerData.facilityId, for staff users check root facilityId
        const users = await payservedb.User.find({
            $or: [
                // Staff users - facilityId at root level
                {
                    facilityId: facilityId,
                    role: "Staff"
                },
                // Admin users - facilityId in customerData array
                {
                    role: "admin",
                    type: "Company",
                    "customerData.facilityId": facilityId
                }
            ]
        })
            .select('+permissions') // Explicitly include permissions field
            .sort({ createdAt: -1 })
            .lean(); // Use lean() for better performance

        const populatedUsers = await Promise.all(
            users.map(async (user) => {

                const userObj = { ...user };

                // Manually populate department if it exists
                if (user.department) {
                    try {
                        const departmentDoc = await departmentModel.findById(user.department);
                        if (departmentDoc) {
                            userObj.department = {
                                _id: departmentDoc._id,
                                name: departmentDoc.name
                            };
                        } else {
                            userObj.department = null;
                        }
                    } catch (depError) {
                        console.error(`  - Error populating department:`, depError);
                        userObj.department = null;
                    }
                } else {
                    console.log(`  - User ${user.fullName} (${user.role}/${user.type}) has no department assigned`);
                }

                // Ensure permissions structure exists and is valid
                if (!userObj.permissions || typeof userObj.permissions !== 'object' || Array.isArray(userObj.permissions)) {
                    userObj.permissions = {
                        levy: { create: false, read: false, update: false, delete: false, approve: false },
                        lease: { create: false, read: false, update: false, delete: false, approve: false },
                        utility: { create: false, read: false, update: false, delete: false, approve: false },
                        maintenance: { create: false, read: false, update: false, delete: false, approve: false },
                        tickets: { create: false, read: false, update: false, delete: false, approve: false },
                        booking: { create: false, read: false, update: false, delete: false, approve: false },
                        procurement: { create: false, read: false, update: false, delete: false, approve: false },
                        vas: { create: false, read: false, update: false, delete: false, approve: false },
                        visitorAccess: { create: false, read: false, update: false, delete: false, approve: false },
                        handover: { create: false, read: false, update: false, delete: false, approve: false },
                        campaigns: { create: false, read: false, update: false, delete: false, approve: false },
                        accounts: { create: false, read: false, update: false, delete: false, approve: false }
                    };
                } else {
                    // Ensure all modules exist with proper structure
                    const requiredModules = ['levy', 'lease', 'utility', 'maintenance', 'tickets', 'booking', 'procurement', 'vas', 'visitorAccess', 'handover', 'campaigns', 'accounts'];
                    const requiredPermissions = ['create', 'read', 'update', 'delete', 'approve'];

                    requiredModules.forEach(module => {
                        if (!userObj.permissions[module] || typeof userObj.permissions[module] !== 'object') {
                            userObj.permissions[module] = {};
                        }
                        requiredPermissions.forEach(permission => {
                            if (typeof userObj.permissions[module][permission] === 'undefined') {
                                userObj.permissions[module][permission] = false;
                            }
                        });
                    });
                }

                return userObj;
            })
        );

        console.log('=== FINAL USERS SUMMARY ===');
        populatedUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.fullName} (${user.role}/${user.type}) - Department: ${user.department?.name || 'None'}`);

            // Count active permissions
            let activePermissions = 0;
            Object.keys(user.permissions).forEach(module => {
                Object.keys(user.permissions[module]).forEach(permission => {
                    if (user.permissions[module][permission] === true) {
                        activePermissions++;
                    }
                });
            });
            console.log(`   Active permissions: ${activePermissions}`);
        });

        return reply.code(200).send(populatedUsers);

    } catch (err) {
        console.error('Error in get_users:', err);
        // Return error in format that makeRequest2 expects
        return reply.code(500).send({
            error: 'Error fetching users: ' + err.message
        });
    }
};

module.exports = get_users;