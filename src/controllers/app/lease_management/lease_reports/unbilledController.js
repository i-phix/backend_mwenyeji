const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getUnbilledReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            search, 
            issueType = 'All Issues', 
            period = 'Current Month',
            severity = 'All Severity',
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
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const customerModel = payservedb.Customer;

        // Helper function to generate yearMonth string
        const getYearMonth = (date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        };

        // Helper function to get array of yearMonth values in a range
        const getYearMonthsInRange = (startDate, endDate) => {
            const months = [];
            const current = new Date(startDate);
            
            while (current <= endDate) {
                months.push(getYearMonth(current));
                current.setMonth(current.getMonth() + 1);
            }
            
            return months;
        };

        // Calculate date range based on period
        const today = new Date();
        let startDate, endDate, yearMonths;

        switch (period) {
            case 'Last Month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            case 'Last 3 Months':
                startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            default: // Current Month
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                yearMonths = [getYearMonth(today)];
        }

        // Get all active leases
        const activeLeases = await leaseAgreementModel.find({
            facilityId,
            status: 'Active'
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

        // Get invoices for the period using yearMonth
        const periodInvoices = await invoiceModel.find({
            'facility.id': facilityId,
            yearMonth: { $in: yearMonths },
            status: { $in: ['Unpaid', 'Pending', 'Paid', 'Partially Paid', 'Overdue'] }
        })
        .select('client items totalAmount issueDate invoiceNumber yearMonth')
        .lean();

        // Debug log
        console.log(`Found ${periodInvoices.length} invoices for yearMonths:`, yearMonths);

        // Analyze billing issues
        const billingIssues = [];

        for (const lease of activeLeases) {
            const unit = lease.unitNumber;
            const tenant = lease.tenant;
            const expectedRent = lease.financialTerms?.monthlyRent || 0;
            
            if (expectedRent <= 0) continue;

            // Filter by search
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                const tenantName = tenant?.companyName || `${tenant?.firstName} ${tenant?.lastName}`;
                const unitName = unit?.name || '';
                
                if (!searchRegex.test(tenantName) && !searchRegex.test(unitName)) {
                    continue;
                }
            }

            // Find invoices for this tenant in the period
            // Handle both ObjectId and string comparisons
            const tenantId = lease.tenant?._id?.toString() || lease.tenant?.toString();
            
            const tenantInvoices = periodInvoices.filter(invoice => {
                const invoiceClientId = invoice.client?.clientId?.toString();
                return invoiceClientId === tenantId;
            });

            const totalBilled = tenantInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
            
            // Calculate expected rent based on number of months
            const expectedTotalRent = expectedRent * yearMonths.length;
            const shortfall = expectedTotalRent - totalBilled;

            // Determine issue type and severity
            let issue = null;
            let severityLevel = 'High';

            if (tenantInvoices.length === 0 && expectedRent > 0) {
                // Not billed at all
                issue = 'Not Billed';
                severityLevel = 'Critical';
            } else if (shortfall > 0) {
                // Under-billed
                issue = 'Under-Billed';
                severityLevel = shortfall > (expectedTotalRent * 0.5) ? 'Critical' : 'High';
            }

            // Apply filters
            if (issue && 
                (issueType === 'All Issues' || issueType === issue) &&
                (severity === 'All Severity' || severity === severityLevel)
            ) {
                const lastInvoice = tenantInvoices.length > 0 ? 
                    tenantInvoices.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))[0] : null;

                billingIssues.push({
                    id: lease._id,
                    severity: severityLevel,
                    issue,
                    unitNumber: unit?.name || 'N/A',
                    tenant: tenant?.companyName || `${tenant?.firstName} ${tenant?.lastName}`,
                    expectedRent: expectedTotalRent,
                    billedAmount: totalBilled,
                    shortfall,
                    yearMonth: yearMonths.join(', '),
                    invoiceNumber: lastInvoice?.invoiceNumber || 'N/A',
                    lastInvoiceDate: lastInvoice?.issueDate || 'Never'
                });
            }
        }

        // Sort by severity and shortfall
        billingIssues.sort((a, b) => {
            const severityOrder = { 'Critical': 0, 'High': 1 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
                return severityOrder[a.severity] - severityOrder[b.severity];
            }
            return b.shortfall - a.shortfall;
        });

        // Apply pagination
        const totalCount = billingIssues.length;
        const paginatedIssues = billingIssues.slice(
            (page - 1) * limit,
            page * limit
        );

        // Calculate summary statistics
        const totalIssues = billingIssues.length;
        const notBilledCount = billingIssues.filter(issue => issue.issue === 'Not Billed').length;
        const underBilledCount = billingIssues.filter(issue => issue.issue === 'Under-Billed').length;
        const revenueShortfall = billingIssues.reduce((sum, issue) => sum + issue.shortfall, 0);

        return reply.code(200).send({
            success: true,
            data: {
                issues: paginatedIssues,
                summary: {
                    totalIssues,
                    notBilled: notBilledCount,
                    underBilled: underBilledCount,
                    revenueShortfall: Math.round(revenueShortfall)
                },
                period: {
                    selected: period,
                    startDate,
                    endDate,
                    yearMonths
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
        console.error('Error in getUnbilledReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the unbilled/under-billed report.'
        });
    }
};

module.exports = getUnbilledReport;