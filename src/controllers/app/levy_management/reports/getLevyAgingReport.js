const payservedb = require('payservedb'); 
const { getModel } = require('../../../../utils/getModel');

const getLevyAgingReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { 
            search, 
            agingBucket = 'All', 
            minAmount = 0,
            riskLevel = 'All',
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
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const customerModel = payservedb.Customer;

        // Get all active levy contracts
        const contracts = await levyContractModel.find({
            facilityId,
            status: 'Active'
        })
        .populate({
            path: 'levyId',
            model: levyModel,
            select: 'levyName'
        })
        .populate({
            path: 'unitId',
            model: unitModel,
            select: 'name'
        })
        .populate({
            path: 'customerId',
            model: customerModel,
            select: 'firstName lastName companyName'
        })
        .lean();

        // Fetch all unpaid or partially paid invoices for this facility
        const unpaidInvoices = await invoiceModel.find({
            'facility.id': facilityId,
            status: { $in: ['Unpaid', 'Overdue', 'Partially Paid'] }
        })
        .select('client invoiceNumber issueDate dueDate totalAmount amountPaid whatFor')
        .lean();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const agingData = [];

        for (const contract of contracts) {
            const customerId = contract.customerId?._id?.toString() || contract.customerId?.toString();

            // Match invoices where:
            // - The client matches this contract’s customer
            // - The invoice type is either 'Contract' or matches the levy name
            const contractInvoices = unpaidInvoices.filter(invoice => {
                const invoiceClientId = invoice.client?.clientId?.toString();
                const invoiceType = invoice.whatFor?.invoiceType;
                return (
                    invoiceClientId === customerId &&
                    (invoiceType === 'Contract' || invoiceType === contract.levyId?.levyName)
                );
            });

            if (contractInvoices.length === 0) continue;

            let current = 0, days30 = 0, days60 = 0, days90 = 0, over90 = 0;
            let oldestInvoiceDate = null;

            contractInvoices.forEach(invoice => {
                const outstanding = (invoice.totalAmount || 0) - (invoice.amountPaid || 0);
                if (outstanding <= 0) return;

                const dueDate = new Date(invoice.dueDate);
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

                if (!oldestInvoiceDate || new Date(invoice.issueDate) < oldestInvoiceDate) {
                    oldestInvoiceDate = new Date(invoice.issueDate);
                }

                // Categorize by aging bucket
                if (daysOverdue < 0) current += outstanding;
                else if (daysOverdue <= 30) days30 += outstanding;
                else if (daysOverdue <= 60) days60 += outstanding;
                else if (daysOverdue <= 90) days90 += outstanding;
                else over90 += outstanding;
            });

            const totalOutstanding = current + days30 + days60 + days90 + over90;

            if (totalOutstanding < parseFloat(minAmount)) continue;

            // Apply search filter
            if (search) {
                const searchRegex = new RegExp(search, 'i');
                const tenant = contract.customerId;
                const unit = contract.unitId;
                const tenantName = tenant?.companyName || `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim();
                const unitName = unit?.name || '';

                if (!searchRegex.test(tenantName) && !searchRegex.test(unitName)) continue;
            }

            const unit = contract.unitId;
            const tenant = contract.customerId;

            agingData.push({
                id: contract._id,
                contractName: contract.contractName,
                unitNumber: unit?.name || 'N/A',
                tenant: tenant?.companyName || `${tenant?.firstName || ''} ${tenant?.lastName || ''}`.trim(),
                levyName: contract.levyId?.levyName || 'N/A',
                totalOutstanding: Math.round(totalOutstanding),
                current: Math.round(current),
                days30: Math.round(days30),
                days60: Math.round(days60),
                days90: Math.round(days90),
                over90: Math.round(over90),
                oldestInvoice: oldestInvoiceDate
            });
        }

        // Filter by aging bucket
        let filteredAging = agingData;
        if (agingBucket !== 'All') {
            filteredAging = agingData.filter(entry => {
                switch (agingBucket) {
                    case 'Current': return entry.current > 0;
                    case '1-30 Days': return entry.days30 > 0;
                    case '31-60 Days': return entry.days60 > 0;
                    case '61-90 Days': return entry.days90 > 0;
                    case 'Over 90 Days': return entry.over90 > 0;
                    default: return true;
                }
            });
        }

        // Filter by risk level
        if (riskLevel !== 'All') {
            filteredAging = filteredAging.filter(entry => {
                if (riskLevel === 'Critical')
                    return entry.over90 > 0 || entry.totalOutstanding > 50000;
                if (riskLevel === 'High Risk')
                    return entry.days60 > 0 || entry.days90 > 0;
                return true;
            });
        }

        // Sort by total outstanding descending
        filteredAging.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

        // Summary totals
        const totalOutstanding = filteredAging.reduce((sum, e) => sum + e.totalOutstanding, 0);
        const currentSum = filteredAging.reduce((sum, e) => sum + e.current, 0);
        const days30Sum = filteredAging.reduce((sum, e) => sum + e.days30, 0);
        const days60Sum = filteredAging.reduce((sum, e) => sum + e.days60, 0);
        const days90Sum = filteredAging.reduce((sum, e) => sum + e.days90, 0);
        const over90Sum = filteredAging.reduce((sum, e) => sum + e.over90, 0);
        const criticalAccounts = filteredAging.filter(e => e.over90 > 0 || e.totalOutstanding > 50000).length;
        const highRiskAccounts = filteredAging.filter(e => e.days60 > 0 || e.days90 > 0).length;

        // Pagination
        const totalCount = filteredAging.length;
        const skip = (page - 1) * limit;
        const paginatedAging = filteredAging.slice(skip, skip + parseInt(limit));

        return reply.code(200).send({
            success: true,
            data: {
                aging: paginatedAging,
                summary: {
                    totalOutstanding: Math.round(totalOutstanding),
                    current: Math.round(currentSum),
                    days30: Math.round(days30Sum),
                    days60: Math.round(days60Sum),
                    days90: Math.round(days90Sum),
                    over90: Math.round(over90Sum),
                    criticalAccounts,
                    highRiskAccounts
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
        console.error('Error in getLevyAgingReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the levy aging report.'
        });
    }
};

module.exports = getLevyAgingReport;
