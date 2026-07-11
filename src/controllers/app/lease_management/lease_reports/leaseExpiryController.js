const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getLeaseExpiryPipeline = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            search, 
            timeframe = 'Next 90 Days', 
            urgency = 'All Urgency',
            page = 1, 
            limit = 10 
        } = request.query;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required.'
            });
        }

        // Get facility-specific models
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const customerModel = payservedb.Customer;

        // Calculate date ranges based on timeframe - FIX: Create new Date objects each time
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        let startDate = new Date(today);
        let endDate;

        switch (timeframe) {
            case 'Next 30 Days':
                endDate = new Date(today);
                endDate.setDate(endDate.getDate() + 30);
                break;
            case 'Next 60 Days':
                endDate = new Date(today);
                endDate.setDate(endDate.getDate() + 60);
                break;
            case 'Next 120 Days':
                endDate = new Date(today);
                endDate.setDate(endDate.getDate() + 120);
                break;
            default: // Next 90 Days
                endDate = new Date(today);
                endDate.setDate(endDate.getDate() + 90);
        }

        // Build base filter for expiring leases
        let filter = {
            facilityId,
            status: 'Active',
            'leaseTerms.endDate': { 
                $gte: startDate, 
                $lte: endDate 
            }
        };

        // Add search filter - FIX: Move database queries outside the filter
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            
            // Find matching units
            const matchingUnits = await unitModel.find({ name: searchRegex }).select('_id').lean();
            const unitIds = matchingUnits.map(unit => unit._id);
            
            // Find matching customers
            const matchingCustomers = await customerModel.find({ 
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { companyName: searchRegex }
                ]
            }).select('_id').lean();
            const customerIds = matchingCustomers.map(customer => customer._id);
            
            // Add to filter
            filter.$or = [
                { unitNumber: { $in: unitIds } },
                { tenant: { $in: customerIds } }
            ];
        }

        // Get total count BEFORE pagination and urgency filtering
        const totalBeforeUrgencyFilter = await leaseAgreementModel.countDocuments(filter);

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get expiring leases with pagination at database level
        const leases = await leaseAgreementModel.find(filter)
            .populate({
                path: 'unitNumber',
                model: unitModel,
                select: 'name'
            })
            .populate({
                path: 'tenant',
                model: customerModel,
                select: 'firstName lastName phoneNumber email companyName'
            })
            .sort({ 'leaseTerms.endDate': 1 })
            .lean();

        // Transform data and calculate urgency
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        const transformedLeases = leases.map((lease) => {
            const unit = lease.unitNumber;
            const tenant = lease.tenant;
            const endDate = new Date(lease.leaseTerms.endDate);
            const daysRemaining = Math.ceil((endDate - currentDate) / (1000 * 60 * 60 * 24));

            let urgencyLevel = 'Medium';
            if (daysRemaining <= 30) urgencyLevel = 'Critical';
            else if (daysRemaining <= 60) urgencyLevel = 'High';

            let renewalAction = 'Contact Tenant';
            if (lease.leaseTerms.autoRenewal) {
                renewalAction = 'Auto-renewal Enabled';
            } else if (daysRemaining <= 30) {
                renewalAction = 'URGENT: Renewal Needed';
            }

            return {
                id: lease._id,
                urgency: urgencyLevel,
                unitNumber: unit?.name || 'N/A',
                tenant: tenant?.companyName || `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim(),
                tenantEmail: tenant?.email || 'N/A',
                tenantPhone: tenant?.phoneNumber || 'N/A',
                leaseEnd: lease.leaseTerms.endDate,
                daysRemaining,
                monthlyRent: lease.financialTerms?.monthlyRent || 0,
                autoRenewal: lease.leaseTerms?.autoRenewal ? 'Yes' : 'No',
                renewalAction
            };
        });

        // Filter by urgency if specified (after transformation)
        let filteredLeases = transformedLeases;
        if (urgency !== 'All Urgency') {
            filteredLeases = transformedLeases.filter(lease => lease.urgency === urgency);
        }

        // Calculate urgency counts from ALL transformed leases
        const urgencyCounts = {
            critical: transformedLeases.filter(lease => lease.urgency === 'Critical').length,
            high: transformedLeases.filter(lease => lease.urgency === 'High').length,
            medium: transformedLeases.filter(lease => lease.urgency === 'Medium').length
        };

        // Apply pagination to filtered results
        const paginatedLeases = filteredLeases.slice(skip, skip + parseInt(limit));
        const totalCount = filteredLeases.length;

        return reply.code(200).send({
            success: true,
            data: {
                leases: paginatedLeases,
                urgencyCounts,
                timeframe: {
                    selected: timeframe,
                    startDate,
                    endDate
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
        console.error('Error in getLeaseExpiryPipeline:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the lease expiry pipeline report.'
        });
    }
};

module.exports = getLeaseExpiryPipeline;