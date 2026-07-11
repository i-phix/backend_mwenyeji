const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const recordWhtPayment = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            invoiceNumber,
            withheldAmount,
            taxRateId,
            taxName,
            percentage
        } = request.body;

        // --- 1. Validate required fields ---
        if (!facilityId || !invoiceNumber || withheldAmount === undefined) {
            throw new Error('Missing required fields: facilityId, invoiceNumber, withheldAmount');
        }

        if (parseFloat(withheldAmount) <= 0) {
            throw new Error('WHT amount must be greater than zero');
        }

        // --- 2. Fetch the invoice ---
        const InvoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
        if (!InvoiceModel) throw new Error('Failed to get Invoice model');

        const invoice = await InvoiceModel.findOne({ invoiceNumber }).lean();
        if (!invoice) throw new Error(`Invoice ${invoiceNumber} not found`);

        // DEBUG — remove after confirming withholdingTaxes is present
        console.log('invoice.withholdingTaxes:', JSON.stringify(invoice.withholdingTaxes));

        // --- 3. Confirm a cash payment exists for this invoice ---
        const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        if (!CashPayment) throw new Error('Failed to get CashPayment model');

        const existingPayment = await CashPayment.findOne({
            'invoice.invoiceNumber': invoiceNumber
        });

        if (!existingPayment) {
            throw new Error(
                `No payment found for invoice ${invoiceNumber}. A payment must be recorded before WHT can be applied.`
            );
        }

        const whtPayment = await getModel('InvoiceWithholdingTax', payservedb.InvoiceWithholdingTax.schema, facilityId);

        // --- 4. Check for duplicate WHT record ---
        const existingWHT = await whtPayment.findOne({
            invoiceId: invoice._id,
            facilityId: new mongoose.Types.ObjectId(facilityId)
        });

        if (existingWHT) {
            throw new Error(`WHT has already been recorded for invoice ${invoiceNumber}`);
        }

        // --- 5. Resolve WHT tax details from withholdingTaxes array ---
        let resolvedTaxRateId = taxRateId || null;
        let resolvedTaxName = taxName || 'withholding';
        let resolvedPercentage = percentage;

        if (!resolvedPercentage) {
            const whtEntry = invoice.withholdingTaxes?.find(
                (t) => t.name?.toLowerCase() === 'withholding'
            );
            if (!whtEntry) throw new Error('No withholding tax entry found on this invoice');
            resolvedPercentage = whtEntry.percentage;
            resolvedTaxRateId = resolvedTaxRateId || whtEntry._id || null;
        }

        // --- 6. Resolve customerId ---
        const customerId =
            invoice.client?.clientId ||
            invoice.customerId ||
            null;

        if (!customerId) throw new Error('Could not resolve customer from invoice');

        // --- 7. Create the WHT record ---
        const whtRecord = new whtPayment({
            invoiceId: invoice._id,
            facilityId: new mongoose.Types.ObjectId(facilityId),
            customerId: new mongoose.Types.ObjectId(customerId),
            paymentId: existingPayment._id,
            taxRateId: resolvedTaxRateId
                ? new mongoose.Types.ObjectId(resolvedTaxRateId)
                : null,
            taxName: resolvedTaxName,
            percentage: resolvedPercentage,
            taxableAmount: invoice.subTotal || invoice.totalAmount,
            withheldAmount: parseFloat(withheldAmount)
        });

        await whtRecord.save();

        return reply.code(200).send({
            success: true,
            message: 'Withholding tax recorded successfully',
            whtRecord
        });

    } catch (err) {
        console.error('Error recording WHT payment:', err);
        return reply.code(400).send({
            success: false,
            message: err.message || 'Failed to record withholding tax'
        });
    }
};

module.exports = recordWhtPayment;