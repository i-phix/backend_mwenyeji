const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getCustomerLeases = async (request, reply) => {
    try {
        const { facilityId, customerId } = request.params;

        // Get models for the specific facility
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const customerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);

        // Fetch leases for the tenant
        const leases = await leaseAgreementModel.find({ 
            facilityId, 
            tenant: customerId 
        }).lean();

        console.log('Found leases:', leases); // Debug log

        if (!leases || leases.length === 0) {
            return reply.code(200).send({ 
                success: true,
                message: 'No lease agreements found',
                data: []
            });
        }

        // Get all unique unit and landlord IDs
        const unitIds = leases.map(lease => lease.unitNumber);
        const landlordIds = leases.map(lease => lease.landlord);

        // Fetch all landlords first (without filtering)
        const [units, allLandlords] = await Promise.all([
            unitModel.find({ _id: { $in: unitIds } }).lean(),
            customerModel.find({ 
                _id: { $in: landlordIds }
            }).lean()
        ]);

        console.log('Found all landlords:', allLandlords); // Debug log

        // Filter landlords who are home owners (case insensitive)
        const landlords = allLandlords.filter(landlord => 
            landlord.customerType.toLowerCase() === 'home owner'
        );

        console.log('Filtered home owner landlords:', landlords); // Debug log

        // Create lookup maps
        const unitMap = units.reduce((acc, unit) => {
            acc[unit._id.toString()] = unit;
            return acc;
        }, {});

        const landlordMap = landlords.reduce((acc, landlord) => {
            acc[landlord._id.toString()] = landlord;
            return acc;
        }, {});

        // Enrich lease data
        const enrichedLeases = leases.map(lease => {
            const unit = unitMap[lease.unitNumber.toString()];
            const landlord = landlordMap[lease.landlord.toString()];

            console.log('Processing lease:', {
                leaseId: lease._id,
                landlordId: lease.landlord,
                foundLandlord: landlord,
                landlordName: landlord ? `${landlord.firstName} ${landlord.lastName}` : 'N/A'
            });

            return {
                ...lease,
                unitInfo: {
                    unitName: unit?.name || 'N/A'
                },
                landlordInfo: landlord ? {
                    fullName: `${landlord.firstName} ${landlord.lastName}`,
                    phoneNumber: landlord.phoneNumber,
                    email: landlord.email,
                    customerType: landlord.customerType
                } : {
                    fullName: 'N/A',
                    phoneNumber: 'N/A',
                    email: 'N/A',
                    customerType: 'N/A'
                }
            };
        });

        return reply.code(200).send({
            success: true,
            message: 'Lease agreements retrieved successfully',
            data: enrichedLeases
        });

    } catch (err) {
        console.error('Error in getCustomerLeases:', err);
        return reply.code(500).send({ 
            success: false,
            message: err.message 
        });
    }
};

module.exports = getCustomerLeases;