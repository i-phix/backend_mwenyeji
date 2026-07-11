const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const save_property_manager_revenue = async (request, reply) => {
    const { facilityId } = request.params;
    const { startDate, endDate, unitIds, recalculate = false, propertyManagerId } = request.body;
    
    try {
        console.log(`[PM Revenue Bulk] ========== STARTING BULK EXTRACTION ==========`);
        console.log(`[PM Revenue Bulk] Facility: ${facilityId}`);
        console.log(`[PM Revenue Bulk] Parameters:`, {
            startDate, endDate, unitIds, recalculate, propertyManagerId
        });

        // Validate facilityId
        if (!facilityId) {
            console.log(`[PM Revenue Bulk] ERROR: No facility ID provided`);
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        console.log(`[PM Revenue Bulk] Step 1: Getting models for facility ${facilityId}`);
        // Dynamically fetch models with facility context
        const models = {
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            invoice: await getModel('Invoice', payservedb.Invoice.schema, facilityId),
            propertyManagerRevenue: await getModel('PropertyManagerRevenue', payservedb.PropertyManagerRevenue.schema, facilityId),
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId)
        };
        console.log(`[PM Revenue Bulk] Step 1: ✅ Models loaded successfully`);

        console.log(`[PM Revenue Bulk] Step 2: Finding active property management contracts`);
        // Find active property management contracts
        let contractQuery = {
            facilityId: facilityId,
            status: 'Active'
        };

        if (propertyManagerId) {
            contractQuery.propertyManager = new mongoose.Types.ObjectId(propertyManagerId);
            console.log(`[PM Revenue Bulk] Step 2: Filtering by property manager: ${propertyManagerId}`);
        }

        console.log(`[PM Revenue Bulk] Step 2: Contract query:`, contractQuery);

        const activeContracts = await models.propertyManagerContract.find(contractQuery)
            .populate({
                path: 'propertyManager',
                model: payservedb.User,
                select: 'fullName email phoneNumber'
            }).lean();
        
        console.log(`[PM Revenue Bulk] Step 2: Found ${activeContracts.length} active contracts`);
        
        if (activeContracts.length === 0) {
            console.log(`[PM Revenue Bulk] Step 2: ❌ No active property management contracts found`);
            return reply.code(200).send({
                success: true,
                message: 'No active property management contracts found',
                data: {
                    totalRevenue: 0,
                    totalOwnerAmount: 0,
                    totalPaidAmount: 0,
                    unitBreakdown: [],
                    summary: {
                        totalUnits: 0,
                        totalInvoicesProcessed: 0,
                        contractsProcessed: 0
                    }
                }
            });
        }

        // Log contract details
        activeContracts.forEach((contract, index) => {
            console.log(`[PM Revenue Bulk] Step 2: Contract ${index + 1}:`, {
                id: contract._id,
                name: contract.contractName,
                propertyManager: contract.propertyManager?.fullName || 'Unknown',
                unitsCount: contract.units?.length || 0,
                units: contract.units?.slice(0, 3) // Show first 3 units
            });
        });

        console.log(`[PM Revenue Bulk] Step 3: Getting managed unit IDs from contracts`);
        // Get all managed unit IDs from contracts
        const managedUnitIds = activeContracts.reduce((acc, contract) => {
            if (contract.units && Array.isArray(contract.units)) {
                return acc.concat(contract.units);
            }
            return acc;
        }, []);

        console.log(`[PM Revenue Bulk] Step 3: Found ${managedUnitIds.length} managed units`);
        console.log(`[PM Revenue Bulk] Step 3: Sample managed unit IDs:`, managedUnitIds.slice(0, 5));

        // Filter by specific unit IDs if provided
        const targetUnitIds = unitIds && unitIds.length > 0 
            ? managedUnitIds.filter(unitId => unitIds.includes(unitId.toString()))
            : managedUnitIds;

        console.log(`[PM Revenue Bulk] Step 3: Target units after filtering: ${targetUnitIds.length}`);

        if (targetUnitIds.length === 0) {
            console.log(`[PM Revenue Bulk] Step 3: ❌ No managed units found matching criteria`);
            return reply.code(200).send({
                success: true,
                message: 'No managed units found matching the specified criteria',
                data: {
                    totalRevenue: 0,
                    totalOwnerAmount: 0,
                    totalPaidAmount: 0,
                    unitBreakdown: [],
                    summary: {
                        totalUnits: 0,
                        totalInvoicesProcessed: 0,
                        contractsProcessed: 0
                    }
                }
            });
        }

        console.log(`[PM Revenue Bulk] Step 4: Building invoice query with enhanced duplicate prevention`);
        // Build invoice query with proper duplicate prevention
        let invoiceQuery = {
            'facility.id': new mongoose.Types.ObjectId(facilityId),
            'unit.id': { $in: targetUnitIds.map(id => new mongoose.Types.ObjectId(id)) },
            status: 'Paid',
            amountPaid: { $gt: 0 },
            $or: [
                { 'whatFor.invoiceType': 'Property-Management' },
                { 'whatFor.invoiceType': 'PropertyManagement' },
                { 'whatFor.invoiceType': 'Property Management' }
            ]
        };

        // Add date range filter
        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) {
                dateFilter.$gte = new Date(startDate);
                console.log(`[PM Revenue Bulk] Step 4: Start date filter: ${startDate}`);
            }
            if (endDate) {
                dateFilter.$lte = new Date(endDate);
                console.log(`[PM Revenue Bulk] Step 4: End date filter: ${endDate}`);
            }
            
            // Try multiple date fields for payment date
            invoiceQuery.$and = [
                {
                    $or: [
                        { 'paymentDetails.paymentDate': dateFilter },
                        { 'updatedAt': dateFilter }
                    ]
                }
            ];
        }

        // CRITICAL FIX: Properly exclude already processed invoices
        if (!recalculate) {
            console.log(`[PM Revenue Bulk] Step 4: Excluding already processed invoices (recalculate=${recalculate})`);
            
            // Add explicit exclusion of processed invoices
            const excludeProcessed = {
                $or: [
                    { propertyManagerRevenueCalculated: { $ne: true } },
                    { propertyManagerRevenueCalculated: { $exists: false } },
                    { propertyManagerRevenueCalculated: null },
                    { propertyManagerRevenueCalculated: false }
                ]
            };

            if (invoiceQuery.$and) {
                invoiceQuery.$and.push(excludeProcessed);
            } else {
                invoiceQuery.$and = [excludeProcessed];
            }
        } else {
            console.log(`[PM Revenue Bulk] Step 4: Including all invoices for recalculation (recalculate=${recalculate})`);
        }

        console.log(`[PM Revenue Bulk] Step 4: Final invoice query:`, JSON.stringify(invoiceQuery, null, 2));

        console.log(`[PM Revenue Bulk] Step 5: Fetching eligible invoices with enhanced filtering`);
        // Get eligible invoices with additional client-side filtering
        const allInvoices = await models.invoice.find(invoiceQuery)
            .sort({ 'paymentDetails.paymentDate': -1, 'updatedAt': -1 })
            .lean();

        console.log(`[PM Revenue Bulk] Step 5: Found ${allInvoices.length} potentially eligible invoices`);

        // ADDITIONAL CLIENT-SIDE FILTERING to prevent duplicates
        const eligibleInvoices = allInvoices.filter(invoice => {
            // Double-check that invoice is not already processed
            const isAlreadyProcessed = invoice.propertyManagerRevenueCalculated === true;
            
            if (isAlreadyProcessed && !recalculate) {
                console.log(`[PM Revenue Bulk] Step 5: SKIPPING already processed invoice: ${invoice.invoiceNumber} (revenueCalculated: ${invoice.propertyManagerRevenueCalculated})`);
                return false;
            }
            
            // Verify it's a paid Property-Management invoice
            const isPaid = invoice.status === 'Paid' && invoice.amountPaid > 0;
            const isPropertyManagement = [
                'Property-Management',
                'PropertyManagement',
                'Property Management'
            ].includes(invoice.whatFor?.invoiceType);
            
            if (!isPaid || !isPropertyManagement) {
                console.log(`[PM Revenue Bulk] Step 5: SKIPPING ineligible invoice: ${invoice.invoiceNumber} (paid: ${isPaid}, PM: ${isPropertyManagement})`);
                return false;
            }
            
            console.log(`[PM Revenue Bulk] Step 5: ✅ ELIGIBLE invoice: ${invoice.invoiceNumber} (revenueCalculated: ${invoice.propertyManagerRevenueCalculated || 'false'})`);
            return true;
        });

        console.log(`[PM Revenue Bulk] Step 5: After client-side filtering: ${eligibleInvoices.length} eligible invoices`);

        // Log detailed breakdown
        eligibleInvoices.forEach((invoice, index) => {
            console.log(`[PM Revenue Bulk] Step 5: Eligible Invoice ${index + 1}:`, {
                id: invoice._id,
                number: invoice.invoiceNumber,
                type: invoice.whatFor?.invoiceType,
                status: invoice.status,
                amountPaid: invoice.amountPaid,
                unitId: invoice.unit?.id,
                revenueCalculated: invoice.propertyManagerRevenueCalculated || 'false',
                paymentDate: invoice.paymentDetails?.paymentDate || invoice.updatedAt
            });
        });

        if (eligibleInvoices.length === 0) {
            console.log(`[PM Revenue Bulk] Step 5: ❌ No eligible invoices to process after filtering`);
            
            // Check if there are any unprocessed invoices at all
            const totalUnprocessedCount = await models.invoice.countDocuments({
                'facility.id': new mongoose.Types.ObjectId(facilityId),
                'unit.id': { $in: targetUnitIds.map(id => new mongoose.Types.ObjectId(id)) },
                status: 'Paid',
                amountPaid: { $gt: 0 },
                $or: [
                    { 'whatFor.invoiceType': 'Property-Management' },
                    { 'whatFor.invoiceType': 'PropertyManagement' },
                    { 'whatFor.invoiceType': 'Property Management' }
                ],
                $and: [
                    {
                        $or: [
                            { propertyManagerRevenueCalculated: { $ne: true } },
                            { propertyManagerRevenueCalculated: { $exists: false } },
                            { propertyManagerRevenueCalculated: null },
                            { propertyManagerRevenueCalculated: false }
                        ]
                    }
                ]
            });
            
            console.log(`[PM Revenue Bulk] Step 5: Database shows ${totalUnprocessedCount} unprocessed invoices`);
            
            return reply.code(200).send({
                success: true,
                message: totalUnprocessedCount > 0 ? 
                    'No eligible Property-Management invoices found after filtering - they may have already been processed' :
                    'No eligible Property-Management invoices found for revenue extraction',
                data: {
                    totalRevenue: 0,
                    totalOwnerAmount: 0,
                    totalPaidAmount: 0,
                    unitBreakdown: [],
                    summary: {
                        totalUnits: targetUnitIds.length,
                        totalInvoicesProcessed: 0,
                        contractsProcessed: activeContracts.length,
                        note: `Found ${allInvoices.length} potential invoices, but ${eligibleInvoices.length} were eligible after duplicate prevention`
                    }
                }
            });
        }

        console.log(`[PM Revenue Bulk] Step 6: Creating unit-to-contract mapping`);
        // Create unit-to-contract mapping
        const unitToContractMap = {};
        activeContracts.forEach(contract => {
            if (contract.units && Array.isArray(contract.units)) {
                contract.units.forEach(unitId => {
                    unitToContractMap[unitId.toString()] = contract;
                });
            }
        });

        console.log(`[PM Revenue Bulk] Step 6: Created mapping for ${Object.keys(unitToContractMap).length} units`);

        console.log(`[PM Revenue Bulk] Step 7: Getting unit details`);
        // Get unit details
        const units = await models.unit.find({
            _id: { $in: targetUnitIds }
        }).lean();

        const unitMap = units.reduce((map, unit) => {
            map[unit._id.toString()] = unit;
            return map;
        }, {});

        console.log(`[PM Revenue Bulk] Step 7: Loaded details for ${units.length} units`);

        console.log(`[PM Revenue Bulk] Step 8: Processing ${eligibleInvoices.length} eligible invoices`);
        
        // Process invoices and aggregate revenue
        const unitBreakdown = {};
        let totalRevenue = 0;
        let totalOwnerAmount = 0;
        let totalPaidAmount = 0;
        let processedInvoiceIds = [];
        let skippedInvoices = 0;
        let processedInvoiceNumbers = []; // ADD THIS LINE

for (const [index, invoice] of eligibleInvoices.entries()) {
    console.log(`[PM Revenue Bulk] Step 8: Processing invoice ${index + 1}/${eligibleInvoices.length}: ${invoice.invoiceNumber}`);
    
    const result = processPropertyManagementInvoice(invoice, unitMap, unitToContractMap, unitBreakdown);
    if (result) {
        totalRevenue += result.managerRevenue;
        totalOwnerAmount += result.ownerAmount;
        totalPaidAmount += result.actualRevenue;
        processedInvoiceIds.push(invoice._id);
        processedInvoiceNumbers.push(invoice.invoiceNumber); // ADD THIS LINE
        
        console.log(`[PM Revenue Bulk] Step 8: ✅ Processed ${invoice.invoiceNumber}: revenue=${result.managerRevenue}`);
    } else {
        skippedInvoices++;
        console.log(`[PM Revenue Bulk] Step 8: ❌ Skipped ${invoice.invoiceNumber}: missing unit or contract`);
    }
}

        console.log(`[PM Revenue Bulk] Step 8: Processing complete. Processed: ${processedInvoiceIds.length}, Skipped: ${skippedInvoices}`);

        // Round values
        Object.values(unitBreakdown).forEach(unit => {
            unit.totalPaid = Math.round(unit.totalPaid * 100) / 100;
            unit.managerRevenue = Math.round(unit.managerRevenue * 100) / 100;
            unit.ownerAmount = Math.round(unit.ownerAmount * 100) / 100;
        });

        // Only create revenue record if we actually processed invoices
        if (processedInvoiceIds.length === 0) {
            console.log(`[PM Revenue Bulk] Step 8: ❌ No invoices were successfully processed`);
            return reply.code(200).send({
                success: true,
                message: 'No invoices were processed - all eligible invoices have already been processed or are missing required data',
                data: {
                    totalRevenue: 0,
                    totalOwnerAmount: 0,
                    totalPaidAmount: 0,
                    unitBreakdown: [],
                    summary: {
                        totalUnits: 0,
                        totalInvoicesProcessed: 0,
                        contractsProcessed: 0
                    }
                }
            });
        }

        console.log(`[PM Revenue Bulk] Step 9: Creating revenue record`);
        // Create revenue record
        const calculationDate = new Date();
        const revenueRecord = {
    facility: facilityId,
    calculationDate: calculationDate,
    dateRange: {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
    },
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOwnerAmount: Math.round(totalOwnerAmount * 100) / 100,
    totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
    unitsProcessed: Object.keys(unitBreakdown).length,
    invoicesProcessed: processedInvoiceIds.length,
    contractsProcessed: activeContracts.length,
    unitBreakdown: Object.values(unitBreakdown),
    summary: {
        totalUnits: Object.keys(unitBreakdown).length,
        totalInvoicesProcessed: processedInvoiceIds.length,
        contractsProcessed: activeContracts.length,
        calculationNote: `Bulk property manager revenue extraction from ${processedInvoiceIds.length} Property-Management invoices. Invoice numbers: ${processedInvoiceNumbers.join(', ')}`
    },
    status: 'calculated',
    notes: `Bulk revenue extraction for ${processedInvoiceIds.length} Property-Management invoices: ${processedInvoiceNumbers.join(', ')}`,
    createdBy: request.user?._id || null,
    calculationType: 'bulk_revenue_extraction',
    // ADD THIS LINE:
    processedInvoiceNumbers: processedInvoiceNumbers || []
};

        console.log(`[PM Revenue Bulk] Step 9: Revenue record prepared:`, {
            totalRevenue: revenueRecord.totalRevenue,
            totalPaidAmount: revenueRecord.totalPaidAmount,
            unitsProcessed: revenueRecord.unitsProcessed,
            invoicesProcessed: revenueRecord.invoicesProcessed,
            contractsProcessed: revenueRecord.contractsProcessed
        });

        console.log(`[PM Revenue Bulk] Step 10: Saving revenue record and updating invoices`);
        // Save revenue record and update invoices
        try {
            const savedRecord = await models.propertyManagerRevenue.create(revenueRecord);
            console.log(`[PM Revenue Bulk] Step 10: ✅ Revenue record saved with ID: ${savedRecord._id}`);

            // Mark processed invoices as revenue extracted with proper update
            if (processedInvoiceIds.length > 0) {
                console.log(`[PM Revenue Bulk] Step 10: Updating ${processedInvoiceIds.length} invoices...`);
                
                const invoiceUpdates = processedInvoiceIds.map(id => ({
                    updateOne: {
                        filter: { _id: id },
                        update: { 
                            $set: { 
                                propertyManagerRevenueCalculated: true,
                                propertyManagerRevenueCalculationId: savedRecord._id,
                                propertyManagerRevenueCalculationDate: new Date()
                            }
                        }
                    }
                }));

                const updateResult = await models.invoice.bulkWrite(invoiceUpdates);
                console.log(`[PM Revenue Bulk] Step 10: ✅ Updated ${updateResult.modifiedCount} invoices successfully`);
            }

            console.log(`[PM Revenue Bulk] ========== BULK EXTRACTION COMPLETED SUCCESSFULLY ==========`);

            return reply.code(200).send({
    success: true,
    message: 'Property manager revenue extracted successfully',
    data: {
        recordId: savedRecord._id,
        totalRevenue: savedRecord.totalRevenue,
        totalOwnerAmount: savedRecord.totalOwnerAmount,
        totalPaidAmount: savedRecord.totalPaidAmount,
        unitsProcessed: savedRecord.unitsProcessed,
        invoicesProcessed: savedRecord.invoicesProcessed,
        contractsProcessed: savedRecord.contractsProcessed,
        unitBreakdown: savedRecord.unitBreakdown,
        summary: savedRecord.summary,
        processedInvoiceNumbers: processedInvoiceNumbers, // ADD THIS LINE
        calculationDate: calculationDate.toISOString()
    }
});

        } catch (saveError) {
            console.error('[PM Revenue Bulk] Step 10: ❌ Error during save operations:', saveError);
            throw saveError;
        }

    } catch (error) {
        console.error('[PM Revenue Bulk] ❌ CRITICAL ERROR:', error);
        console.error('[PM Revenue Bulk] Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            message: 'Failed to extract property manager revenue',
            error: error.message
        });
    }
};

/**
 * Helper function to process Property-Management invoices
 */
const processPropertyManagementInvoice = (invoice, unitMap, unitToContractMap, unitBreakdown) => {
    try {
        const unitId = invoice.unit.id.toString();
        const unit = unitMap[unitId];
        const contract = unitToContractMap[unitId];

        console.log(`[Process PM Invoice] Processing ${invoice.invoiceNumber}:`, {
            unitId,
            hasUnit: !!unit,
            hasContract: !!contract,
            unitName: unit?.name,
            contractName: contract?.contractName
        });

        if (!unit || !contract) {
            console.log(`[Process PM Invoice] ❌ Unit or contract not found for invoice ${invoice.invoiceNumber}`);
            return null;
        }

        // For Property-Management invoices, the paid amount IS the property manager's revenue
        const actualRevenue = parseFloat(invoice.amountPaid);
        const ownerAmount = 0; // Property manager keeps all the management fee

        console.log(`[Process PM Invoice] Revenue calculation for ${invoice.invoiceNumber}:`, {
            amountPaid: invoice.amountPaid,
            actualRevenue,
            ownerAmount
        });

        // Initialize unit breakdown if not exists
        if (!unitBreakdown[unitId]) {
            unitBreakdown[unitId] = {
                unit: unit._id,
                unitName: unit.name,
                contractId: contract._id,
                contractName: contract.contractName,
                propertyManager: contract.propertyManager ? {
                    id: contract.propertyManager._id,
                    fullName: contract.propertyManager.fullName,
                    email: contract.propertyManager.email,
                    phoneNumber: contract.propertyManager.phoneNumber
                } : null,
                totalPaid: 0,
                managerRevenue: 0,
                ownerAmount: 0,
                invoiceCount: 0,
                invoices: []
            };
            console.log(`[Process PM Invoice] Initialized unit breakdown for ${unit.name}`);
        }

        // Create invoice record
        const invoiceRecord = {
            invoice: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceType: invoice.whatFor?.invoiceType || 'Property-Management',
            totalAmount: invoice.totalAmount,
            paidAmount: Math.round(actualRevenue * 100) / 100,
            managerCommission: Math.round(actualRevenue * 100) / 100,
            ownerAmount: Math.round(ownerAmount * 100) / 100,
            paymentDate: invoice.paymentDetails?.paymentDate || invoice.updatedAt || new Date(),
            contractId: contract._id,
            contractName: contract.contractName,
            revenueSource: 'PropertyManagementInvoice'
        };

        // Add to breakdown
        unitBreakdown[unitId].totalPaid += actualRevenue;
        unitBreakdown[unitId].managerRevenue += actualRevenue;
        unitBreakdown[unitId].ownerAmount += ownerAmount;
        unitBreakdown[unitId].invoiceCount += 1;
        unitBreakdown[unitId].invoices.push(invoiceRecord);

        console.log(`[Process PM Invoice] ✅ Successfully processed ${invoice.invoiceNumber}:`, {
            extractedRevenue: Math.round(actualRevenue * 100) / 100,
            ownerAmount: Math.round(ownerAmount * 100) / 100,
            contractName: contract.contractName,
            propertyManager: contract.propertyManager?.fullName || 'Unknown'
        });

        return {
            managerRevenue: actualRevenue,
            ownerAmount: ownerAmount,
            actualRevenue: actualRevenue,
            unitId,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            contractId: contract._id,
            contractName: contract.contractName
        };

    } catch (error) {
        console.error(`[Process PM Invoice] ❌ Error processing Property-Management invoice ${invoice.invoiceNumber}:`, error);
        return null;
    }
};

module.exports = save_property_manager_revenue;