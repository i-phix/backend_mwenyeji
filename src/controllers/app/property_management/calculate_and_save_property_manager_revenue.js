const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const calculate_and_save_property_manager_revenue = async (request, reply) => {
    const { facilityId, invoiceId } = request.params;

    try {
        console.log(`[PM Revenue Single] ========== STARTING SINGLE INVOICE REVENUE ==========`);
        console.log(`[PM Revenue Single] Facility: ${facilityId}, Invoice: ${invoiceId}`);

        // Validate required parameters
        if (!facilityId || !invoiceId) {
            console.log(`[PM Revenue Single] ERROR: Missing required parameters`);
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Invoice ID are required'
            });
        }

        console.log(`[PM Revenue Single] Step 1: Getting models for facility ${facilityId}`);
        const models = {
            unit: await getModel('Unit', payservedb.Unit.schema, facilityId),
            invoice: await getModel('Invoice', payservedb.Invoice.schema, facilityId),
            propertyManagerRevenue: await getModel('PropertyManagerRevenue', payservedb.PropertyManagerRevenue.schema, facilityId),
            propertyManagerContract: await getModel('PropertyManagerContract', payservedb.PropertyManagerContract.schema, facilityId)
        };
        console.log(`[PM Revenue Single] Step 1: ✅ Models loaded successfully`);

        console.log(`[PM Revenue Single] Step 2: Getting invoice details`);
        const invoice = await models.invoice.findById(invoiceId).lean();
        if (!invoice) {
            console.log(`[PM Revenue Single] Step 2: ❌ Invoice not found: ${invoiceId}`);
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found'
            });
        }

        console.log(`[PM Revenue Single] Step 2: ✅ Invoice found:`, {
            id: invoice._id,
            number: invoice.invoiceNumber,
            type: invoice.whatFor?.invoiceType,
            status: invoice.status,
            amountPaid: invoice.amountPaid,
            unitId: invoice.unit?.id
        });

        console.log(`[PM Revenue Single] Step 3: Validating invoice type`);
        const isPropertyManagementInvoice = [
            'Property-Management',
            'PropertyManagement',
            'Property Management'
        ].includes(invoice.whatFor?.invoiceType);

        if (!isPropertyManagementInvoice) {
            console.log(`[PM Revenue Single] Step 3: ❌ Not a Property-Management invoice: ${invoice.whatFor?.invoiceType}`);
            return reply.code(400).send({
                success: false,
                error: 'This invoice is not a Property-Management invoice'
            });
        }
        console.log(`[PM Revenue Single] Step 3: ✅ Confirmed Property-Management invoice`);

        console.log(`[PM Revenue Single] Step 4: Checking invoice eligibility`);
        if (invoice.status !== 'Paid' || !invoice.amountPaid || invoice.amountPaid <= 0) {
            console.log(`[PM Revenue Single] Step 4: ❌ Invoice not eligible:`, {
                status: invoice.status,
                amountPaid: invoice.amountPaid
            });
            return reply.code(200).send({
                success: true,
                message: 'Invoice not eligible for revenue extraction - must be paid',
                data: null
            });
        }

        // ENHANCED: Check if revenue already extracted by invoice number
        console.log(`[PM Revenue Single] Step 4: Checking for existing revenue by invoice number`);
        const existingRevenue = await models.propertyManagerRevenue.findOne({
            facility: facilityId,
            'unitBreakdown.invoices.invoiceNumber': invoice.invoiceNumber
        });

        if (existingRevenue) {
            console.log(`[PM Revenue Single] Step 4: ❌ Revenue already extracted for invoice: ${invoice.invoiceNumber}`);
            return reply.code(200).send({
                success: true,
                message: `Revenue already extracted for invoice ${invoice.invoiceNumber}`,
                data: {
                    existingRecordId: existingRevenue._id,
                    invoiceNumber: invoice.invoiceNumber,
                    message: 'This invoice has already been processed'
                }
            });
        }

        // Check legacy flag as backup
        if (invoice.propertyManagerRevenueCalculated) {
            console.log(`[PM Revenue Single] Step 4: ❌ Revenue already calculated flag set for invoice: ${invoice.invoiceNumber}`);
            return reply.code(200).send({
                success: true,
                message: 'Revenue already extracted for this invoice',
                data: null
            });
        }
        console.log(`[PM Revenue Single] Step 4: ✅ Invoice eligible for processing`);

        console.log(`[PM Revenue Single] Step 5: Getting unit information`);
        const unitId = invoice.unit?.id;
        if (!unitId) {
            console.log(`[PM Revenue Single] Step 5: ❌ No unit ID found in invoice`);
            return reply.code(400).send({
                success: false,
                error: 'No unit ID found in invoice structure'
            });
        }

        const unit = await models.unit.findById(unitId).lean();
        if (!unit) {
            console.log(`[PM Revenue Single] Step 5: ❌ Unit not found: ${unitId}`);
            return reply.code(404).send({
                success: false,
                error: 'Unit not found'
            });
        }

        console.log(`[PM Revenue Single] Step 5: ✅ Unit found:`, {
            id: unit._id,
            name: unit.name,
            unitType: unit.unitType
        });

        console.log(`[PM Revenue Single] Step 6: Finding property manager contract`);
        const contract = await models.propertyManagerContract.findOne({
            facilityId: facilityId,
            units: unitId,
            status: 'Active'
        }).populate({
            path: 'propertyManager',
            model: payservedb.User,
            select: 'fullName email phoneNumber'
        }).lean();

        if (!contract) {
            console.log(`[PM Revenue Single] Step 6: ❌ No active property management contract found for unit: ${unitId}`);
            return reply.code(200).send({
                success: true,
                message: 'No active property management contract found for this unit',
                data: null
            });
        }

        console.log(`[PM Revenue Single] Step 6: ✅ Contract found:`, {
            id: contract._id,
            name: contract.contractName,
            propertyManager: contract.propertyManager?.fullName,
            unitsCount: contract.units?.length
        });

        console.log(`[PM Revenue Single] Step 7: Calculating revenue`);
        const managerRevenue = parseFloat(invoice.amountPaid);
        const ownerAmount = 0; // Property manager keeps all the management fee

        console.log(`[PM Revenue Single] Step 7: Revenue calculation:`, {
            invoiceNumber: invoice.invoiceNumber,
            contractId: contract._id,
            contractName: contract.contractName,
            propertyManager: contract.propertyManager?.fullName,
            extractedRevenue: managerRevenue,
            ownerAmount
        });

        console.log(`[PM Revenue Single] Step 8: Creating revenue record`);
        const calculationDate = new Date();
        const revenueData = {
            facility: facilityId,
            calculationDate: calculationDate,
            dateRange: {
                startDate: null,
                endDate: null
            },
            totalRevenue: Math.round(managerRevenue * 100) / 100,
            totalOwnerAmount: Math.round(ownerAmount * 100) / 100,
            totalPaidAmount: Math.round(managerRevenue * 100) / 100,
            unitsProcessed: 1,
            invoicesProcessed: 1,
            contractsProcessed: 1,
            unitBreakdown: [{
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
                totalPaid: Math.round(managerRevenue * 100) / 100,
                managerRevenue: Math.round(managerRevenue * 100) / 100,
                ownerAmount: Math.round(ownerAmount * 100) / 100,
                invoiceCount: 1,
                invoices: [{
                    invoice: invoice._id,
                    invoiceNumber: invoice.invoiceNumber, // CRITICAL: Store invoice number
                    invoiceType: invoice.whatFor?.invoiceType || 'Property-Management',
                    totalAmount: invoice.totalAmount,
                    paidAmount: Math.round(managerRevenue * 100) / 100,
                    managerCommission: Math.round(managerRevenue * 100) / 100,
                    ownerAmount: Math.round(ownerAmount * 100) / 100,
                    paymentDate: invoice.paymentDetails?.paymentDate || invoice.updatedAt || new Date(),
                    contractId: contract._id,
                    contractName: contract.contractName,
                    revenueSource: 'PropertyManagementInvoice'
                }]
            }],
            summary: {
                totalUnits: 1,
                totalInvoicesProcessed: 1,
                contractsProcessed: 1,
                calculationNote: `Property manager revenue extracted from Property-Management invoice ${invoice.invoiceNumber}. Contract: ${contract.contractName}`
            },
            status: 'calculated',
            notes: `Property manager revenue extracted from Property-Management invoice ${invoice.invoiceNumber}. Managed by: ${contract.propertyManager?.fullName || 'Unknown'} under contract: ${contract.contractName}`,
            createdBy: request.user?._id || null,
            calculationType: 'revenue_extraction',
            // CRITICAL: Store processed invoice number for enhanced duplicate prevention
            processedInvoiceNumbers: [invoice.invoiceNumber]
        };

        console.log(`[PM Revenue Single] Step 8: Revenue record prepared:`, {
            totalRevenue: revenueData.totalRevenue,
            totalPaidAmount: revenueData.totalPaidAmount,
            unitsProcessed: revenueData.unitsProcessed,
            invoicesProcessed: revenueData.invoicesProcessed,
            processedInvoiceNumbers: revenueData.processedInvoiceNumbers
        });

        console.log(`[PM Revenue Single] Step 9: Saving revenue record and updating invoice`);
        try {
            const savedRecord = await models.propertyManagerRevenue.create(revenueData);
            console.log(`[PM Revenue Single] Step 9: ✅ Revenue record saved: ${savedRecord._id}`);
            
            // Mark invoice as revenue extracted
            const updateResult = await models.invoice.updateOne(
                { _id: invoiceId },
                { 
                    $set: { 
                        propertyManagerRevenueCalculated: true,
                        propertyManagerRevenueCalculationId: savedRecord._id,
                        propertyManagerRevenueCalculationDate: new Date(),
                        propertyManagerContractId: contract._id
                    }
                }
            );

            console.log(`[PM Revenue Single] Step 9: ✅ Invoice updated:`, {
                modifiedCount: updateResult.modifiedCount,
                revenueCalculationId: savedRecord._id
            });

            console.log(`[PM Revenue Single] ========== SINGLE INVOICE REVENUE COMPLETED ==========`);

            return reply.code(200).send({
                success: true,
                message: 'Property manager revenue extracted successfully',
                data: {
                    recordId: savedRecord._id,
                    managerRevenue: savedRecord.totalRevenue,
                    ownerAmount: savedRecord.totalOwnerAmount,
                    totalPaid: savedRecord.totalPaidAmount,
                    unitId: unit._id,
                    unitName: unit.name,
                    invoiceNumber: invoice.invoiceNumber,
                    contractId: contract._id,
                    contractName: contract.contractName,
                    propertyManager: contract.propertyManager?.fullName || 'Unknown',
                    revenueType: 'Property Management Revenue',
                    calculationDate: calculationDate.toISOString(),
                    processedInvoiceNumbers: [invoice.invoiceNumber]
                }
            });

        } catch (saveError) {
            console.error('[PM Revenue Single] Step 9: ❌ Error during save operations:', saveError);
            
            // Check if it's a duplicate key error (race condition)
            if (saveError.code === 11000) {
                console.log(`[PM Revenue Single] ❌ Duplicate revenue record detected for invoice: ${invoice.invoiceNumber}`);
                return reply.code(200).send({
                    success: true,
                    message: `Revenue already extracted for invoice ${invoice.invoiceNumber} (race condition detected)`,
                    data: null
                });
            }
            
            throw saveError;
        }

    } catch (error) {
        console.error('[PM Revenue Single] ❌ CRITICAL ERROR:', error);
        console.error('[PM Revenue Single] Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            message: 'Failed to extract property manager revenue',
            error: error.message
        });
    }
};

module.exports = calculate_and_save_property_manager_revenue;