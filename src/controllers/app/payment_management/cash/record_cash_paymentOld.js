const mongoose = require('mongoose');
const payservedb = require('payservedb');
const utilityDb = require('../../../../middlewares/utilityDb');
const { getModel } = require('../../../../utils/getModel');
const { v4: uuidv4 } = require('uuid');

/**
 * Maps UI-friendly payment method to schema-compatible format
 * @param {String} methodFromUI - Payment method from UI
 * @returns {String} Schema-compatible payment method
 */
const mapPaymentMethod = (methodFromUI) => {
    if (!methodFromUI) return 'cash';
    
    const method = methodFromUI.toLowerCase();
    
    switch (method) {
        case 'cash':
            return 'cash';
        case 'bank transfer':
        case 'bank-transfer':
            return 'bank-transfer';
        case 'cheque':
        case 'check':
            return 'cheque';
        default:
            console.log(`Unknown payment method format: ${methodFromUI}, defaulting to 'cash'`);
            return 'cash';
    }
};

/**
 * Records a new cash payment
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} Response with new payment or error
 */
const recordCashPayment = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            invoiceNumber,
            amount,
            receiptNumber,
            paymentMethod,
            paymentDate,
            notes,
            currencyId,
            checkNumber,
            bankName,
            transferReference,
            // START: Destructure WHT payload from request body
            withholdingTax
            // END: Destructure WHT payload from request body
        } = request.body;

        console.log("REQUEST BODY", request.body);

        const user = request.user;
        
        if (!facilityId || !invoiceNumber || !amount || !receiptNumber || !paymentDate) {
            throw new Error('Missing required fields');
        }

        if (parseFloat(amount) <= 0) {
            throw new Error('Payment amount must be greater than zero');
        }

        const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        if (!CashPayment) throw new Error('Failed to get CashPayment model');
        
        const existingPayment = await CashPayment.findOne({ receiptNumber });
        if (existingPayment) {
            throw new Error(`Receipt number ${receiptNumber} already exists`);
        }

        let InvoiceModel;
        let invoice;
        let isWaterInvoice = false;
        let isVasInvoice = false;

        if (invoiceNumber.startsWith('WTR')) {
            isWaterInvoice = true;
            InvoiceModel = await utilityDb.getModel('WaterInvoice');
            if (!InvoiceModel) throw new Error('Failed to get WaterInvoice model');
            invoice = await InvoiceModel.findOne({ invoiceNumber });
        } else if (invoiceNumber.startsWith('VAS')) {
            isVasInvoice = true;
            InvoiceModel = await getModel('VasInvoice', payservedb.VasInvoice.schema, facilityId);
            if (!InvoiceModel) throw new Error('Failed to get VasInvoice model');
            invoice = await InvoiceModel.findOne({ invoiceNumber });
        } else {
            InvoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
            if (!InvoiceModel) throw new Error('Failed to get Invoice model');
            invoice = await InvoiceModel.findOne({ invoiceNumber });
        }

        if (!invoice) {
            throw new Error(`Invoice ${invoiceNumber} not found`);
        }

        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
        if (!Currency) throw new Error('Failed to get Currency model');
        
        let currency;
        if (currencyId) {
            currency = await Currency.findById(currencyId);
            if (!currency) {
                throw new Error('Specified currency not found');
            }
        } else {
            let currencyId;
            
            if (isWaterInvoice) {
                let currencyIdToUse = null;
                
                if (invoice.currency && typeof invoice.currency === 'object') {
                    if (invoice.currency._id) {
                        currencyIdToUse = invoice.currency._id;
                    } else if (invoice.currency.id) {
                        currencyIdToUse = invoice.currency.id;
                    } else {
                        if (invoice.currency.code || invoice.currency.currencyShortCode) {
                            const currencyCode = invoice.currency.code || invoice.currency.currencyShortCode;
                            currency = await Currency.findOne({ currencyShortCode: currencyCode });
                            if (!currency) {
                                console.log(`Creating temporary currency record for: ${currencyCode}`);
                                const tempCurrency = new Currency({
                                    currencyName: invoice.currency.name || currencyCode,
                                    currencyShortCode: currencyCode,
                                    symbol: invoice.currency.symbol || currencyCode
                                });
                                currency = await tempCurrency.save();
                            }
                        }
                    }
                } else if (invoice.currency) {
                    currencyIdToUse = invoice.currency;
                } else if (invoice.currencyId) {
                    currencyIdToUse = invoice.currencyId;
                }
                
                if (currencyIdToUse && !currency) {
                    try {
                        currency = await Currency.findById(currencyIdToUse);
                    } catch (currencyErr) {
                        console.log('Error finding currency by ID:', currencyErr.message);
                    }
                }
                
                if (!currency) {
                    const defaultCurrency = await Currency.findOne({ currencyShortCode: 'KES' });
                    if (defaultCurrency) {
                        currency = defaultCurrency;
                    } else {
                        throw new Error('No currency specified and no default currency found');
                    }
                }
            } else {
                const currencyIdToUse = invoice.currency && (invoice.currency.id || invoice.currency._id);
                
                if (currencyIdToUse) {
                    currency = await Currency.findById(currencyIdToUse);
                    if (!currency) {
                        console.log('Failed to find currency with ID:', currencyIdToUse);
                        console.log('Available invoice currency data:', JSON.stringify(invoice.currency));
                        throw new Error('Invoice currency not found');
                    }
                }
            }
        }

        const Facility = payservedb.Facility;
        const facility = await Facility.findById(facilityId);
        if (!facility) {
            throw new Error(`Facility not found with ID: ${facilityId}`);
        }

        const paymentReference = `CASH-${uuidv4().substring(0, 8)}`;
        const schemaPaymentMethod = mapPaymentMethod(paymentMethod || 'Cash');
        
        let paymentData;
        
        if (isWaterInvoice) {
            let customerInfo = null;
            
            if (invoice.customerId) {
                try {
                    let customer = null;
                    
                    try {
                        customer = await payservedb.Customer.findById(invoice.customerId);
                    } catch (directErr) {
                        try {
                            const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
                            customer = await CustomerModel.findById(invoice.customerId);
                        } catch (modelErr) {
                            try {
                                const CustomerModel = await getModel('Customer', payservedb.Customer.schema);
                                customer = await CustomerModel.findById(invoice.customerId);
                            } catch (noFacilityErr) {
                                console.log('Failed to get customer info:', noFacilityErr.message);
                            }
                        }
                    }
                    
                    if (customer) {
                        customerInfo = {
                            fullName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                            firstName: customer.firstName || 'Customer',
                            lastName: customer.lastName || 'N/A'
                        };
                    }
                } catch (customerErr) {
                    console.log('Error fetching customer:', customerErr.message);
                }
            }
            
            if (!customerInfo) {
                customerInfo = {
                    fullName: 'Water Customer',
                    firstName: 'Water',
                    lastName: 'Customer'
                };
            }
            
            paymentData = {
                paymentReference,
                invoice: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    accountNumber: invoice.accountNumber || invoice.unitName || 'N/A'
                },
                client: {
                    clientId: invoice.customerId || new mongoose.Types.ObjectId(),
                    firstName: customerInfo.firstName,
                    lastName: customerInfo.lastName
                },
                facility: {
                    id: facility._id,
                    name: facility.name
                },
                paymentAmount: parseFloat(amount),
                currency: {
                    id: currency._id,
                    name: currency.currencyName || currency.name,
                    code: currency.currencyShortCode || currency.code
                },
                paymentDate: new Date(paymentDate),
                receivedBy: new mongoose.Types.ObjectId(user._id),
                receiptNumber,
                paymentMethod: schemaPaymentMethod,
                paymentDetails: {
                    checkNumber,
                    bankName,
                    transferReference,
                    notes
                },
                approvalStatus: 'Pending',
                reconciliationStatus: 'Pending',
                metadata: {
                    createdBy: new mongoose.Types.ObjectId(user._id),
                    source: 'manual',
                    invoiceType: 'water',
                    deviceInfo: {
                        deviceId: request.headers['user-agent'] || 'Unknown',
                        ipAddress: request.ip || 'Unknown'
                    }
                }
            };
        } else {
            paymentData = {
                paymentReference,
                invoice: {
                    invoiceId: invoice._id,
                    invoiceNumber: invoice.invoiceNumber,
                    accountNumber: invoice.accountNumber,
                    totalAmount: invoice.totalAmount
                },
                client: {
                    clientId: invoice.client?.clientId || invoice.customerId,
                    firstName: invoice.client?.firstName || invoice.customerInfo?.fullName?.split(' ')[0] || 'Client',
                    lastName: invoice.client?.lastName || invoice.customerInfo?.fullName?.split(' ')[1] || ''
                },
                facility: {
                    id: facility._id,
                    name: facility.name
                },
                paymentAmount: parseFloat(amount),
                currency: {
                    id: currency._id,
                    name: currency.currencyName || currency.name,
                    code: currency.currencyShortCode || currency.code
                },
                paymentDate: new Date(paymentDate),
                receivedBy: new mongoose.Types.ObjectId(user._id),
                receiptNumber,
                paymentMethod: schemaPaymentMethod,
                paymentDetails: {
                    checkNumber,
                    bankName,
                    transferReference,
                    notes
                },
                approvalStatus: 'Pending',
                reconciliationStatus: 'Pending',
                metadata: {
                    createdBy: new mongoose.Types.ObjectId(user._id),
                    source: 'manual',
                    invoiceType: isVasInvoice ? 'vas' : 'regular',
                    deviceInfo: {
                        deviceId: request.headers['user-agent'] || 'Unknown',
                        ipAddress: request.ip || 'Unknown'
                    }
                }
            };
        }

        const invoiceCurrencyCode = isWaterInvoice ? 
            (currency.currencyShortCode || currency.code) : 
            (invoice.currency?.code || currency.currencyShortCode || currency.code);
            
        if ((currency.currencyShortCode || currency.code) !== invoiceCurrencyCode) {
            paymentData.exchangeRate = {
                rate: 1,
                originalCurrency: {
                    code: currency.currencyShortCode || currency.code,
                    amount: parseFloat(amount)
                }
            };
        }

        const newPayment = new CashPayment(paymentData);
        await newPayment.save();

        // START: Create InvoiceWithholdingTax record if WHT was included in the payment
        if (withholdingTax && withholdingTax.withheldAmount > 0) {
            try {
                const InvoiceWithholdingTax = await getModel(
                    'InvoiceWithholdingTax',
                    payservedb.InvoiceWithholdingTax.schema,
                    facilityId
                );

                if (!InvoiceWithholdingTax) {
                    console.warn('InvoiceWithholdingTax model not found — skipping WHT record creation');
                } else {
                    // Resolve the customer ID from the invoice
                    const customerId =
                        invoice.client?.clientId ||
                        invoice.customerId ||
                        null;

                    // taxableAmount = total invoice amount minus VAT (i.e. the base/sub-total)
                    const taxableAmount = invoice.subTotal || invoice.totalAmount || 0;

                    const whtRecord = new InvoiceWithholdingTax({
                        invoiceId:      invoice._id,
                        facilityId:     new mongoose.Types.ObjectId(facilityId),
                        customerId:     customerId ? new mongoose.Types.ObjectId(customerId) : undefined,
                        paymentId:      newPayment._id,
                        taxRateId:      withholdingTax.taxRateId,
                        taxName:        withholdingTax.taxName || 'withholding',
                        percentage:     withholdingTax.percentage,
                        taxableAmount:  taxableAmount,
                        withheldAmount: parseFloat(withholdingTax.withheldAmount),
                        currency: {
                            id:   currency._id,
                            name: currency.currencyName || currency.name,
                            code: currency.currencyShortCode || currency.code
                        }
                    });

                    await whtRecord.save();
                    console.log(`WHT record created for invoice ${invoiceNumber}: ${whtRecord._id}`);
                }
            } catch (whtErr) {
                // Log but do not fail the payment — WHT record failure should not roll back a saved payment
                console.error('Failed to create InvoiceWithholdingTax record:', whtErr.message);
            }
        }
        // END: Create InvoiceWithholdingTax record if WHT was included in the payment

        const responseMessage = isWaterInvoice ? 
            'Water invoice cash payment recorded successfully. Pending approval.' :
            'Cash payment recorded successfully. Pending approval.';

        return reply.code(200).send({
            success: true,
            message: responseMessage,
            payment: newPayment
        });
    } catch (err) {
        console.error('Error recording cash payment:', err);
        return reply.code(400).send({
            success: false,
            message: err.message || 'Failed to record cash payment'
        });
    }
};

module.exports = recordCashPayment;