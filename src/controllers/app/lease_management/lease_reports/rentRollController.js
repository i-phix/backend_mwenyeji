const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getRentRollReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { search, status, date, page = 1, limit = 10 } = request.query;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required.'
            });
        }

        // ✅ Convert facilityId string to ObjectId
        const facilityObjectId = new mongoose.Types.ObjectId(facilityId);

        // Get facility-specific models
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const customerModel = payservedb.Customer;

        // Build filter
        let filter = { facilityId: facilityObjectId };

        if (status && status !== 'All Status') {
            filter.status = status;
        } else {
            filter.status = { $in: ['Active', 'Pending'] };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const matchedUnits = await unitModel.find({ name: searchRegex }).select('_id');
            const matchedTenants = await customerModel.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { companyName: searchRegex }
                ]
            }).select('_id');

            filter.$or = [
                { unitNumber: { $in: matchedUnits.map(u => u._id) } },
                { tenant: { $in: matchedTenants.map(t => t._id) } }
            ];
        }

        // Pagination setup
        const skip = (page - 1) * limit;

        // Fetch leases with populated references
        const leases = await leaseAgreementModel.find(filter)
            .populate({
                path: 'unitNumber',
                model: unitModel,
                select: 'name floorUnitNo building'
            })
            .populate({
                path: 'tenant',
                model: customerModel,
                select: 'firstName lastName phoneNumber email companyName'
            })
            .populate({
                path: 'landlord',
                model: customerModel,
                select: 'firstName lastName'
            })
            .sort({ 'leaseTerms.startDate': -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Count for pagination
        const totalCount = await leaseAgreementModel.countDocuments(filter);

        // Transform data for frontend
        const transformedLeases = await Promise.all(leases.map(async (lease) => {
            const unit = lease.unitNumber;
            const tenant = lease.tenant;

            // Get building name
            let buildingName = 'N/A';
            if (unit && unit.building) {
                const building = await payservedb.Building.findById(unit.building).select('name').lean();
                buildingName = building?.name || 'N/A';
            }

            return {
                id: lease._id,
                unitNumber: unit?.name || 'N/A',
                floor: unit?.floorUnitNo || 'N/A',
                building: buildingName,
                tenant: tenant?.companyName || `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim(),
                tenantContact: tenant?.phoneNumber || tenant?.email || 'N/A',
                monthlyRent: lease.financialTerms?.monthlyRent || 0,
                securityDeposit: lease.financialTerms?.securityDeposit || 0,
                leaseStart: lease.leaseTerms?.startDate,
                leaseEnd: lease.leaseTerms?.endDate,
                duration: lease.leaseTerms?.duration || 0,
                paymentDueDate: lease.financialTerms?.paymentDueDate || 1,
                autoRenewal: lease.leaseTerms?.autoRenewal ? 'Yes' : 'No',
                status: lease.status
            };
        }));

        // ✅ Compute summary using MongoDB aggregation
        const summaryAgg = await leaseAgreementModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalActiveLeases: { $sum: 1 },
                    totalMonthlyRent: { $sum: '$financialTerms.monthlyRent' },
                    totalDeposits: { $sum: '$financialTerms.securityDeposit' },
                    avgRent: { $avg: '$financialTerms.monthlyRent' }
                }
            }
        ]);

        // Fallback summary if aggregation returns empty
        const summaryData = summaryAgg[0] || {
            totalActiveLeases: 0,
            totalMonthlyRent: 0,
            totalDeposits: 0,
            avgRent: 0
        };

        // ✅ Return final structured response
        return reply.code(200).send({
            success: true,
            data: {
                leases: transformedLeases,
                summary: {
                    totalActiveLeases: summaryData.totalActiveLeases,
                    monthlyRentTotal: summaryData.totalMonthlyRent,
                    totalDepositsHeld: summaryData.totalDeposits,
                    avgRentPerUnit: Math.round(summaryData.avgRent || 0)
                },
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (err) {
        console.error('Error in getRentRollReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the rent roll report.'
        });
    }
};

module.exports = getRentRollReport;
