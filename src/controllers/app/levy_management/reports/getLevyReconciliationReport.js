const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const getLevyReconciliationReport = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            search,
            status = 'All',
            period = 'Current Month',
            discrepancyOnly = false,
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
        // Get facility-specific models
        const levyModel = await getModel('Levy', payservedb.Levy.schema, facilityId);
        const levyContractModel = await getModel('LevyContract', payservedb.LevyContract.schema, facilityId);
        const invoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const levyTypeModel = await getModel('LevyType', payservedb.LevyType.schema, facilityId);
        const clientModel = await getModel('Customer', payservedb.Customer.schema, facilityId);


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
                startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            case 'Last 6 Months':
                startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                yearMonths = getYearMonthsInRange(startDate, endDate);
                break;
            default: // Current Month
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                yearMonths = [getYearMonth(today)];
        }

        // Get all active contracts
        let contractFilter = {
            facilityId,
            status: 'Active'
        };

        const contracts = await levyContractModel.find(contractFilter)
            .populate({
                path: 'levyId',
                model: levyModel,
                select: 'levyName levyType',
                populate: {
                    path: 'levyType',
                    model: levyTypeModel,
                    select: 'name'
                }
            })
            .populate({
                path: 'unitId',
                model: unitModel,
                select: 'unitNumber'
            })
            .populate({
                path: 'customerId',
                model: clientModel,
                select: 'firstName lastName'
            })
            .lean();

        // Process each contract for each month in the period
        const reconciliationReports = [];

        for (const contract of contracts) {
            if (!contract.levyId || contract.levyId.disabled) continue;

            // Apply search filter
            if (search) {
                const searchLower = search.toLowerCase();
                const tenantName = `${contract.customerId?.firstName || ''} ${contract.customerId?.lastName || ''}`.toLowerCase();
                const unitNumber = contract.unitId?.unitNumber?.toLowerCase() || '';
                const levyName = contract.levyId?.levyName?.toLowerCase() || '';

                if (!tenantName.includes(searchLower) &&
                    !unitNumber.includes(searchLower) &&
                    !levyName.includes(searchLower)) {
                    continue;
                }
            }

            for (const yearMonth of yearMonths) {
                // Expected amount per contract per month
                const contractAmount = contract.amount || 0;

                // Get all invoices for this contract and month
                const invoices = await invoiceModel.find({
                    'facility.id': facilityId,
                    'client.clientId': contract.customerId?._id,
                    'whatFor.invoiceType': contract.levyId?.levyName,
                    yearMonth: yearMonth
                }).select('totalAmount amountPaid status createdAt').lean();

                // Calculate totals
                const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
                const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
                const discrepancy = totalInvoiced - contractAmount;

                // Determine reconciliation status
                let reconciliationStatus;
                if (invoices.length === 0) {
                    reconciliationStatus = 'Not Invoiced';
                } else if (Math.abs(discrepancy) < 1) { // Allow for rounding differences
                    reconciliationStatus = 'Matched';
                } else if (totalInvoiced < contractAmount) {
                    reconciliationStatus = 'Under-Invoiced';
                } else {
                    reconciliationStatus = 'Matched'; // Over-invoiced is still considered matched
                }

                // Find last invoice date
                const lastInvoiceDate = invoices.length > 0
                    ? invoices.reduce((latest, inv) => {
                        const invDate = new Date(inv.createdAt);
                        return invDate > latest ? invDate : latest;
                    }, new Date(0))
                    : null;

                const reportItem = {
                    contractId: contract._id,
                    contractName: contract.levyContractName || `Contract ${contract._id.toString().slice(-6)}`,
                    unitNumber: contract.unitId?.unitNumber || 'N/A',
                    tenant: `${contract.customerId?.firstName || ''} ${contract.customerId?.lastName || ''}`.trim() || 'N/A',
                    levyName: contract.levyId?.levyName || 'N/A',
                    yearMonth: yearMonth,
                    contractAmount: Math.round(contractAmount),
                    totalInvoiced: Math.round(totalInvoiced),
                    totalPaid: Math.round(totalPaid),
                    discrepancy: Math.round(discrepancy),
                    invoiceCount: invoices.length,
                    lastInvoiceDate: lastInvoiceDate ? lastInvoiceDate.toISOString() : 'Never',
                    status: reconciliationStatus
                };

                reconciliationReports.push(reportItem);
            }
        }

        // Apply status filter
        let filteredReports = reconciliationReports;
        if (status !== 'All') {
            filteredReports = reconciliationReports.filter(report => report.status === status);
        }

        // Apply discrepancy filter
        if (discrepancyOnly === 'true' || discrepancyOnly === true) {
            filteredReports = filteredReports.filter(report =>
                report.status !== 'Matched'
            );
        }

        // Sort by discrepancy (highest first) and status
        filteredReports.sort((a, b) => {
            // Prioritize Not Invoiced, then Under-Invoiced, then Matched
            const statusOrder = { 'Not Invoiced': 0, 'Under-Invoiced': 1, 'Matched': 2 };
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;

            // Then sort by absolute discrepancy
            return Math.abs(b.discrepancy) - Math.abs(a.discrepancy);
        });

        // Calculate summary statistics
        const totalContracts = new Set(filteredReports.map(r => r.contractId.toString())).size;
        const matchedContracts = new Set(
            filteredReports.filter(r => r.status === 'Matched').map(r => r.contractId.toString())
        ).size;
        const underInvoiced = new Set(
            filteredReports.filter(r => r.status === 'Under-Invoiced').map(r => r.contractId.toString())
        ).size;
        const notInvoiced = new Set(
            filteredReports.filter(r => r.status === 'Not Invoiced').map(r => r.contractId.toString())
        ).size;

        const expectedRevenue = filteredReports.reduce((sum, report) => sum + report.contractAmount, 0);
        const actualInvoiced = filteredReports.reduce((sum, report) => sum + report.totalInvoiced, 0);
        const totalDiscrepancy = actualInvoiced - expectedRevenue;

        // Apply pagination
        const totalCount = filteredReports.length;
        const skip = (page - 1) * limit;
        const paginatedReports = filteredReports.slice(skip, skip + parseInt(limit));

        return reply.code(200).send({
            success: true,
            data: {
                reconciliation: paginatedReports,
                summary: {
                    totalContracts,
                    matchedContracts,
                    underInvoiced,
                    notInvoiced,
                    expectedRevenue: Math.round(expectedRevenue),
                    actualInvoiced: Math.round(actualInvoiced),
                    totalDiscrepancy: Math.round(totalDiscrepancy)
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
        console.error('Error in getLevyReconciliationReport:', err.stack);
        return reply.code(500).send({
            success: false,
            error: 'An error occurred while generating the levy reconciliation report.'
        });
    }
};

module.exports = getLevyReconciliationReport;