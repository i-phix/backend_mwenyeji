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
	if (!methodFromUI) return 'cash'; // Default to cash
	
	// Handle capitalized or differently formatted payment methods
	const method = methodFromUI.toLowerCase();
	
	// Map from UI format to schema format
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
			transferReference
		} = request.body;
		
		// Get user making the request (assuming auth middleware sets this)
		const user = request.user;
		
		// Validate required fields
		if (!facilityId || !invoiceNumber || !amount || !receiptNumber || !paymentDate) {
			throw new Error('Missing required fields');
		}
		
		// Validate amount is positive
		if (parseFloat(amount) <= 0) {
			throw new Error('Payment amount must be greater than zero');
		}
		
		// Check if receipt number already exists to prevent duplicates
		const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
		if (!CashPayment) throw new Error('Failed to get CashPayment model');
		
		const existingPayment = await CashPayment.findOne({ receiptNumber });
		if (existingPayment) {
			throw new Error(`Receipt number ${receiptNumber} already exists`);
		}
		
		// Determine invoice type based on prefix and get the appropriate model
		let InvoiceModel;
		let invoice;
		let isWaterInvoice = false;
		let isVasInvoice = false;
		
		if (invoiceNumber.startsWith('WTR')) {
			// Water invoice - use utility database
			isWaterInvoice = true;
			InvoiceModel = await utilityDb.getModel('WaterInvoice');
			if (!InvoiceModel) throw new Error('Failed to get WaterInvoice model');
			
			// Find water invoice by invoiceNumber
			invoice = await InvoiceModel.findOne({ invoiceNumber });
		} else if (invoiceNumber.startsWith('VAS')) {
			// VAS invoice - use payservedb
			isVasInvoice = true;
			InvoiceModel = await getModel('VasInvoice', payservedb.VasInvoice.schema, facilityId);
			if (!InvoiceModel) throw new Error('Failed to get VasInvoice model');
			
			invoice = await InvoiceModel.findOne({ invoiceNumber });
		} else {
			// Regular invoice - use payservedb
			InvoiceModel = await getModel('Invoice', payservedb.Invoice.schema, facilityId);
			if (!InvoiceModel) throw new Error('Failed to get Invoice model');
			
			invoice = await InvoiceModel.findOne({ invoiceNumber });
		}
		
		if (!invoice) {
			throw new Error(`Invoice ${invoiceNumber} not found`);
		}
		
		// Get currency information
		const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
		if (!Currency) throw new Error('Failed to get Currency model');
		
		let currency;
		if (currencyId) {
			currency = await Currency.findById(currencyId);
			if (!currency) {
				throw new Error('Specified currency not found');
			}
		} else {
			// Handle currency retrieval differently for water invoices vs regular invoices
			let currencyId;
			
			if (isWaterInvoice) {
				// For water invoices, currency might be stored differently
				let currencyIdToUse = null;
				
				// Check if currency is already an object with currency data
				if (invoice.currency && typeof invoice.currency === 'object') {
					if (invoice.currency._id) {
						currencyIdToUse = invoice.currency._id;
					} else if (invoice.currency.id) {
						currencyIdToUse = invoice.currency.id;
					} else {
						// Currency object doesn't have ID, find by code instead
						if (invoice.currency.code || invoice.currency.currencyShortCode) {
							const currencyCode = invoice.currency.code || invoice.currency.currencyShortCode;
							currency = await Currency.findOne({ currencyShortCode: currencyCode });
							if (!currency) {
								// Create a temporary currency record if none exists
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
					// Currency is stored as ID string
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
					// Default to facility's default currency or KES for water invoices
					const defaultCurrency = await Currency.findOne({ currencyShortCode: 'KES' });
					if (defaultCurrency) {
						currency = defaultCurrency;
					} else {
						throw new Error('No currency specified and no default currency found');
					}
				}
			} else {
				// For regular/VAS invoices
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
		
		// Get facility details
		const Facility = payservedb.Facility;
		const facility = await Facility.findById(facilityId);
		if (!facility) {
			throw new Error(`Facility not found with ID: ${facilityId}`);
		}
		
		// Generate payment reference if not provided
		const paymentReference = `CASH-${uuidv4().substring(0, 8)}`;
		
		// Map payment method to schema-compatible format
		const schemaPaymentMethod = mapPaymentMethod(paymentMethod || 'Cash');
		
		// Create payment data - handle different invoice structures
		let paymentData;
		
		if (isWaterInvoice) {
			// Handle water invoice structure - need to fetch customer info
			let customerInfo = null;
			
			if (invoice.customerId) {
				try {
					// Try to get customer information from payservedb
					let customer = null;
					
					// Method 1: Try direct payservedb.Customer access
					try {
						customer = await payservedb.Customer.findById(invoice.customerId);
					} catch (directErr) {
						// Method 2: Try getModel approach
						try {
							const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
							customer = await CustomerModel.findById(invoice.customerId);
						} catch (modelErr) {
							// Method 3: Try without facilityId
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
			
			// If we couldn't get customer info, create default values
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
			// Handle regular/VAS invoice structure
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
		
		// Handle currency conversion if needed
		const invoiceCurrencyCode = isWaterInvoice ? 
		(currency.currencyShortCode || currency.code) : 
		(invoice.currency?.code || currency.currencyShortCode || currency.code);
		
		if ((currency.currencyShortCode || currency.code) !== invoiceCurrencyCode) {
			// Default to 1:1 exchange rate if not specified
			// In production, you might want to fetch current exchange rates
			paymentData.exchangeRate = {
				rate: 1, // Default exchange rate
				originalCurrency: {
					code: currency.currencyShortCode || currency.code,
					amount: parseFloat(amount)
				}
			};
		}
		
		// Create and save the payment record
		const newPayment = new CashPayment(paymentData);
		await newPayment.save();
		
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