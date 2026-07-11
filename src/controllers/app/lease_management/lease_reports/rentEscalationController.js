const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getRentEscalationTracker = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            search, 
            timeframe = 'Next 6 Months', 
            status = 'All Status',
            type = 'All Types',
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

        // Calculate date range for escalations
        const today = new Date();
        let startDate, endDate;

        switch (timeframe) {
            case 'Next 3 Months':
                startDate = today;
                endDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
                break;
            case 'Next 12 Months':
                startDate = today;
                endDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
                break;
            case 'All Upcoming':
                startDate = today;
                endDate = new Date(today.getFullYear() + 10, today.getMonth(), today.getDate()); // Far future
                break;
            default: // Next 6 Months
                startDate = today;
                endDate = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
        }

        // Get all active leases with escalations
        const leases = await leaseAgreementModel.find({
            facilityId,
            status: 'Active',
            'financialTerms.escalations': { $exists: true, $not: { $size: 0 } }
        })
        .populate({
            path: 'unitNumber',
            model: unitModel,
            select: 'name'
        })
        .populate({
            path: 'tenant',
            model: customerModel,
            select: 'firstName lastName companyName'
        })
        .lean();

        // Process escalations
        let allEscalations = [];

        leases.forEach(lease => {
            const unit = lease.unitNumber;
            const tenant = lease.tenant;
            const currentRent = lease.financialTerms?.monthlyRent || 0;

            lease.financialTerms.escalations.forEach(escalation => {
                const effectiveDate = new Date(escalation.effectiveDate);
                
                // Filter by timeframe
                if (effectiveDate >= startDate && effectiveDate <= endDate) {
                    // Filter by status
                    if (status !== 'All Status' && status.toLowerCase() !== escalation.status) {
                        return;
                    }

                    // Filter by type
                    if (type !== 'All Types' && type.toLowerCase() !== escalation.type) {
                        return;
                    }

                    // Filter by search
                    if (search) {
                        const searchRegex = new RegExp(search, 'i');
                        const tenantName = tenant?.companyName || `${tenant?.firstName} ${tenant?.lastName}`;
                        const unitName = unit?.name || '';
                        
                        if (!searchRegex.test(tenantName) && !searchRegex.test(unitName)) {
                            return;
                        }
                    }

                    // Calculate new rent and increases
                    let newRent, increase, increasePercent;

                    if (escalation.type === 'percentage') {
                        increase = (currentRent * escalation.value) / 100;
                        newRent = currentRent + increase;
                        increasePercent = escalation.value;
                    } else { // fixed amount
                        increase = escalation.value;
                        newRent = currentRent + escalation.value;
                        increasePercent = (escalation.value / currentRent) * 100;
                    }

                    const daysUntil = Math.ceil((effectiveDate - today) / (1000 * 60 * 60 * 24));

                    allEscalations.push({
                        id: escalation._id,
                        leaseId: lease._id,
                        status: escalation.status,
                        unitNumber: unit?.name || 'N/A',
                        tenant: tenant?.companyName || `${tenant?.firstName} ${tenant?.lastName}`,
                        currentRent,
                        escalationType: escalation.type.charAt(0).toUpperCase() + escalation.type.slice(1),
                        escalationValue: escalation.type === 'percentage' ? 
                            `${escalation.value}%` : `KSh ${escalation.value.toLocaleString()}`,
                        newRent: Math.round(newRent),
                        increase: Math.round(increase),
                        increasePercent: Math.round(increasePercent * 100) / 100,
                        effectiveDate: escalation.effectiveDate,
                        daysUntil: daysUntil > 0 ? daysUntil : 0,
                        action: escalation.status === 'scheduled' ? 'Pending' : 'Applied'
                    });
                }
            });
        });

        // Sort by effective date
        allEscalations.sort((a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate));

        // Apply pagination
        const totalCount = allEscalations.length;
        const paginatedEscalations = allEscalations.slice(
            (page - 1) * limit,
            page * limit
        );

        // Calculate summary statistics
        const pendingEscalations = allEscalations.filter(e => e.status === 'scheduled').length;
        const appliedThisYear = allEscalations.filter(e => 
            e.status === 'applied' && 
            new Date(e.effectiveDate).getFullYear() === today.getFullYear()
        ).length;
        
        const totalRevenueIncrease = allEscalations
            .filter(e => e.status === 'scheduled')
            .reduce((sum, e) => sum + e.increase, 0);
        
        const avgIncreasePercent = allEscalations.length > 0 ? 
            allEscalations.reduce((sum, e) => sum + e.increasePercent, 0) / allEscalations.length : 0;

        return reply.code(200).send({
            success: true,
            data: {
                escalations: paginatedEscalations,
                summary: {
                    pendingEscalations,
                    appliedThisYear,
                    totalRevenueIncrease: Math.round(totalRevenueIncrease),
                    avgIncreasePercent: Math.round(avgIncreasePercent * 100) / 100
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
        console.error('Error in getRentEscalationTracker:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the rent escalation tracker report.'
        });
    }
};

module.exports = getRentEscalationTracker;