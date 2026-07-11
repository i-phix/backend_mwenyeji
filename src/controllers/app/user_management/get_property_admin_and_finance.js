const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

// const get_property_admin_and_finance = async (request, reply) => {
//     try {
//         const { facilityId } = request.params;

//         const FacilityDepartment = await getModel('FacilityDepartment', payservedb.FacilityDepartment.schema, facilityId);

//         const financeDepartment = await FacilityDepartment.findOne({ name: 'Finance', facilityId });

//         // Build query conditions
//         const query = {
//             type: 'Company',
//             $or: [
//                 // Admins
//                 {
//                     role: 'admin',
//                     'customerData.facilityId': facilityId
//                 },

//                 // Finance staff
//                 {
//                     role: 'Staff',
//                     department: financeDepartment._id,
//                     facilityId: facilityId
//                 }
//             ]
//         };


//         const users = await payservedb.User
//             .find(query)
//             .select('-password -permissions -__v');

//         return reply.code(201).send({
//             success: true,
//             message: 'Property admin and finance users retrieved successfully',
//             data: users
//         });

//     } catch (err) {
//         console.error(err);
//         return reply.code(502).send({
//             success: false,
//             error: err.message
//         });
//     }
// };

const get_property_admin_and_finance = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const FacilityDepartment = await getModel(
            'FacilityDepartment',
            payservedb.FacilityDepartment.schema,
            facilityId
        );

        const financeDepartment = await FacilityDepartment.findOne({
            name: 'Finance',
            facilityId
        });

        const operatorDepartment = await FacilityDepartment.findOne({
            name: 'Operator',
            facilityId
        });

        // Count Admin Users
        const adminCount = await payservedb.User.countDocuments({
            type: 'Company',
            role: 'admin',
            'customerData.facilityId': facilityId
        });

        // Count Finance Users (only if department exists)
        let financeCount = 0;

        if (financeDepartment) {
            financeCount = await payservedb.User.countDocuments({
                type: 'Company',
                role: 'Staff',
                department: financeDepartment._id,
                facilityId: facilityId
            });
        }

        // Count Finance Users (only if department exists)
        let operatorCount = 0;

        if (operatorDepartment) {
            operatorCount = await payservedb.User.countDocuments({
                type: 'Company',
                role: 'Staff',
                department: operatorDepartment._id,
                facilityId: facilityId
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'Admin and Finance user counts retrieved successfully',
            data: {
                adminUsers: adminCount,
                financeUsers: financeCount,
                operatorUsers: operatorCount
            }
        });

    } catch (err) {
        console.error(err);
        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_property_admin_and_finance;
