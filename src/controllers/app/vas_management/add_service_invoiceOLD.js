const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');
const axios = require('axios');

// Constants for account registration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms before retrying

const add_service_invoice = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { serviceId, status, customerId, amount } = request.body;

        // Models in facility-specific database (using getModel)
        const ServiceRequestModel = await getModel(
            "ServiceRequest",
            payservedb.ServiceRequest.schema,
            facilityId
        );

        const VasInvoiceModel = await getModel(
            "VasInvoice",
            payservedb.VasInvoice.schema,
            facilityId
        );

        const VasModel = await getModel(
            "ValueAddedService",
            payservedb.ValueAddedService.schema,
            facilityId
        );

        const CurrencyModel = await getModel(
            "Currency",
            payservedb.Currency.schema,
            facilityId
        );
        
        // Get GL-related models
        const GLEntryModel = await getModel(
            "GLEntry",
            payservedb.GLEntry.schema,
            facilityId
        );
        
        const GLAccountDoubleEntriesModel = await getModel(
            "GLAccountDoubleEntries",
            payservedb.GLAccountDoubleEntries.schema,
            facilityId
        );

        // Find by _id since serviceId in request is the request ID
        const serviceRequest = await ServiceRequestModel.findById(serviceId);

        if (!serviceRequest) {
            console.log('Service request not found for ID:', serviceId);
            return reply.code(404).send({
                success: false,
                error: 'Service request not found'
            });
        }

        const existingInvoice = await VasInvoiceModel.findOne({
            serviceId: serviceRequest.serviceId,
            customerId,
            status: { $nin: ['Cancelled'] }
        });

        if (existingInvoice) {
            return reply.code(409).send({
                success: false,
                error: 'Active invoice already exists'
            });
        }

        const service = await VasModel.findById(serviceRequest.serviceId);
        if (!service) {
            return reply.code(404).send({
                success: false,
                error: 'Service not found'
            });
        }

        // Get currency information from the facility-specific database
        let currencyInfo;
        
        // Try to fetch facility's default currency
        try {
            // Access the main database for Facility
            const FacilityModel = mongoose.model('Facility');
            const facility = await FacilityModel.findById(facilityId).lean();

            if (facility && facility.defaultCurrency) {
                // Get currency from facility-specific database
                currencyInfo = await CurrencyModel.findById(facility.defaultCurrency).lean();
            }
        } catch (error) {
            console.warn('Error fetching facility or currency info:', error.message);
            // We'll default to KES below if needed
        }

        // If no currency found, default to KES
        if (!currencyInfo) {
            currencyInfo = {
                _id: new mongoose.Types.ObjectId(),
                currencyName: 'Kenyan Shilling',
                currencyShortCode: 'KES',
                currencySymbol: 'KSh'
            };
        }

        // Calculate tax details with rounding
        const taxDetails = service.applicableTaxes.map(tax => ({
            taxId: tax.taxId,
            taxName: tax.taxName,
            taxRate: tax.taxRate,
            taxAmount: parseFloat(((parseFloat(amount) * tax.taxRate) / 100).toFixed(2))
        }));

        // Calculate totals with rounding
        const totalTax = parseFloat(taxDetails.reduce((sum, tax) => sum + tax.taxAmount, 0).toFixed(2));
        const subTotal = parseFloat(parseFloat(amount).toFixed(2));
        const totalAmount = parseFloat((subTotal + totalTax).toFixed(2));

        // Generate unique account number with '8' prefix for VAS invoices
        const accountNumber = await generateUniqueAccountNumber(VasInvoiceModel);

        const invoiceNumber = generateInvoiceNumber();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // Get customer details from main database
        let customerName = 'Customer';
        try {
            // Access the main database for Customer
            const CustomerModel = mongoose.model('Customer');
            const customer = await CustomerModel.findById(customerId).lean();
            if (customer) {
                customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
            }
        } catch (error) {
            console.warn('Error fetching customer info:', error.message);
            // We'll use the default 'Customer' name
        }

        // Get payment method details from facility-specific database
        const PaymentDetailsModel = await getModel(
            "FacilityPaymentDetails",
            payservedb.FacilityPaymentDetails.schema,
            facilityId
        );

        const paymentDetails = await PaymentDetailsModel.findOne({
            facility: facilityId
        }).lean();

        const paymentMethod = paymentDetails ?
            `${paymentDetails.module} - ${paymentDetails.shortCode}` :
            null;

        // Create invoice object with all necessary data
        const invoiceData = {
            invoiceNumber,
            accountNumber,
            facilityId,
            serviceId: serviceRequest.serviceId,
            customerId,
            customerInfo: {
                fullName: customerName
            },
            dueDate,
            status,
            subTotal,
            tax: totalTax,
            amount: totalAmount,
            unit: serviceRequest.unit,
            serviceName: service.serviceName,
            currency: {
                id: currencyInfo._id,
                name: currencyInfo.currencyName,
                code: currencyInfo.currencyShortCode,
                symbol: currencyInfo.currencySymbol
            },
            paymentDetails: {
                paymentMethod: paymentMethod,
                paymentStatus: 'Pending'
            },
            items: [{
                description: service.serviceName || 'Service Fee',
                unitPrice: subTotal,
                quantity: 1
            }],
            taxDetails: taxDetails.map(tax => ({
                taxId: tax.taxId,
                taxName: tax.taxName,
                taxRate: tax.taxRate,
                taxAmount: tax.taxAmount
            }))
        };

        // Create GL entries if GL accounts are configured in the service
        let invoiceGLEntryId = null;
        let taxGLEntryIds = [];
        
        // Check if service has GL configuration for invoices
        if (service.invoiceDoubleEntryAccount || 
            (service.glAccounts && service.glAccounts.invoice && 
             service.glAccounts.invoice.debit && service.glAccounts.invoice.credit)) {
            
            let debitAccountId, creditAccountId;
            
            // Get account IDs either from double entry preset or direct configuration
            if (service.invoiceDoubleEntryAccount) {
                const doubleEntryConfig = await GLAccountDoubleEntriesModel.findById(service.invoiceDoubleEntryAccount);
                
                if (doubleEntryConfig) {
                    debitAccountId = doubleEntryConfig.accountdebited;
                    creditAccountId = doubleEntryConfig.accountcredited;
                    
                    // Store the double entry ID for reference
                    invoiceData.glDoubleEntryId = service.invoiceDoubleEntryAccount;
                }
            } else if (service.glAccounts && service.glAccounts.invoice) {
                debitAccountId = service.glAccounts.invoice.debit;
                creditAccountId = service.glAccounts.invoice.credit;
            }
            
            if (debitAccountId && creditAccountId) {
                try {
                    // Create debit entry
                    const debitEntry = new GLEntryModel({
                        entryDate: new Date(),
                        accountId: debitAccountId,
                        amount: subTotal,
                        description: `Service invoice ${invoiceNumber} for ${service.serviceName}`,
                        facilityId,
                        creditAccountId: creditAccountId,
                        entryType: 'debit'
                    });
                    
                    // Create credit entry
                    const creditEntry = new GLEntryModel({
                        entryDate: new Date(),
                        accountId: creditAccountId,
                        amount: subTotal,
                        description: `Service invoice ${invoiceNumber} for ${service.serviceName}`,
                        facilityId,
                        creditAccountId: debitAccountId,
                        entryType: 'credit'
                    });
                    
                    // Save both entries and store the main entry ID in the invoice
                    const [savedDebitEntry, savedCreditEntry] = await Promise.all([
                        debitEntry.save(),
                        creditEntry.save()
                    ]);
                    
                    // Store the debit entry ID in the invoice (main reference)
                    invoiceData.invoiceGLEntryId = savedDebitEntry._id;
                    
                    console.log('Created GL entries for invoice:', {
                        invoiceNumber,
                        debitEntryId: savedDebitEntry._id,
                        creditEntryId: savedCreditEntry._id
                    });
                } catch (glError) {
                    console.error('Error creating GL entries for invoice:', {
                        error: glError.message,
                        invoiceNumber,
                        debitAccountId,
                        creditAccountId
                    });
                    // Continue with invoice creation even if GL entries fail
                }
            }
        }
        
        // Process tax GL entries if taxes apply and GL tax configuration exists
        if (taxDetails.length > 0 && totalTax > 0 && 
            (service.taxDoubleEntryAccount || 
             (service.glAccounts && service.glAccounts.tax && 
              service.glAccounts.tax.debit && service.glAccounts.tax.credit))) {
            
            let debitAccountId, creditAccountId;
            
            // Get tax account IDs either from double entry preset or direct configuration
            if (service.taxDoubleEntryAccount) {
                const taxDoubleEntryConfig = await GLAccountDoubleEntriesModel.findById(service.taxDoubleEntryAccount);
                
                if (taxDoubleEntryConfig) {
                    debitAccountId = taxDoubleEntryConfig.accountdebited;
                    creditAccountId = taxDoubleEntryConfig.accountcredited;
                }
            } else if (service.glAccounts && service.glAccounts.tax) {
                debitAccountId = service.glAccounts.tax.debit;
                creditAccountId = service.glAccounts.tax.credit;
            }
            
            if (debitAccountId && creditAccountId) {
                try {
                    // Create tax entries for each tax type
                    const taxGLEntryPromises = taxDetails.map(async (tax, index) => {
                        if (tax.taxAmount > 0) {
                            // Create debit entry for this tax
                            const taxDebitEntry = new GLEntryModel({
                                entryDate: new Date(),
                                accountId: debitAccountId,
                                amount: tax.taxAmount,
                                description: `${tax.taxName} (${tax.taxRate}%) for invoice ${invoiceNumber}`,
                                facilityId,
                                creditAccountId: creditAccountId,
                                entryType: 'debit'
                            });
                            
                            // Create credit entry for this tax
                            const taxCreditEntry = new GLEntryModel({
                                entryDate: new Date(),
                                accountId: creditAccountId,
                                amount: tax.taxAmount,
                                description: `${tax.taxName} (${tax.taxRate}%) for invoice ${invoiceNumber}`,
                                facilityId,
                                creditAccountId: debitAccountId,
                                entryType: 'credit'
                            });
                            
                            // Save both entries
                            const [savedTaxDebitEntry, savedTaxCreditEntry] = await Promise.all([
                                taxDebitEntry.save(),
                                taxCreditEntry.save()
                            ]);
                            
                            // Update tax details with GL entry ID
                            invoiceData.taxDetails[index].glEntryId = savedTaxDebitEntry._id;
                            
                            return {
                                taxName: tax.taxName,
                                debitEntryId: savedTaxDebitEntry._id,
                                creditEntryId: savedTaxCreditEntry._id
                            };
                        }
                        
                        return null;
                    });
                    
                    // Resolve all tax GL entry promises
                    const taxGLEntryResults = await Promise.all(taxGLEntryPromises);
                    
                    // Filter out null results and store the tax GL entry IDs
                    taxGLEntryIds = taxGLEntryResults
                        .filter(result => result !== null)
                        .map(result => result.debitEntryId);
                    
                    // Store the first tax debit entry ID as the main tax reference (if any)
                    if (taxGLEntryIds.length > 0) {
                        invoiceData.taxGLEntryId = taxGLEntryIds[0];
                    }
                    
                    console.log('Created GL entries for tax amounts:', {
                        invoiceNumber,
                        taxEntries: taxGLEntryResults.filter(result => result !== null)
                    });
                } catch (taxGlError) {
                    console.error('Error creating GL entries for tax:', {
                        error: taxGlError.message,
                        invoiceNumber,
                        debitAccountId,
                        creditAccountId
                    });
                    // Continue with invoice creation even if tax GL entries fail
                }
            }
        }

        // Create new VAS invoice with GL entries included
        const newVasInvoice = new VasInvoiceModel(invoiceData);
        const savedInvoice = await newVasInvoice.save();

        // Register the account in both main database and PayServe
        try {
            await addAccountDetails(accountNumber, facilityId, customerId);
            console.log('Successfully registered account details for VAS invoice:', {
                accountNumber,
                facilityId,
                customerId,
                invoiceId: savedInvoice._id
            });
        } catch (accountError) {
            console.error('Error registering account details for VAS invoice, but invoice was created:', {
                error: accountError.message,
                accountNumber,
                facilityId,
                customerId,
                invoiceId: savedInvoice._id
            });
            // We don't want to fail the entire operation if account registration fails
            // The invoice is created, but we log the error
        }

        // Include GL entry information in the response
        const response = {
            success: true,
            message: 'Invoice created successfully',
            data: savedInvoice.toObject()
        };
        
        // Add GL entry status information
        if (invoiceData.invoiceGLEntryId || taxGLEntryIds.length > 0) {
            response.data.glStatus = {
                invoiceGLEntryCreated: invoiceData.invoiceGLEntryId !== null,
                taxGLEntriesCreated: taxGLEntryIds.length > 0,
                taxGLEntriesCount: taxGLEntryIds.length
            };
        }

        return reply.code(201).send(response);

    } catch (err) {
        console.error('Error:', err);
        return reply.code(500).send({
            success: false,
            error: err.message
        });
    }
};

const generateInvoiceNumber = () => {
    const prefix = 'VAS';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${year}${month}${day}${random}`;
};

const generateUniqueAccountNumber = async (VasInvoiceModel) => {
    const prefix = '8'; // VAS invoices start with 8
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
        const accountNumber = prefix + randomDigits;

        const existing = await VasInvoiceModel.findOne({ accountNumber }).lean();
        if (!existing) {
            return accountNumber;
        }
        attempts++;
    }

    throw new Error('Unable to generate unique account number after maximum attempts');
};

/**
 * Add account details to main database and PayServe
 */
const addAccountDetails = async (accountNumber, facilityId, customerId) => {
    try {
        console.log('Starting to add account details.', {
            accountNumber,
            facilityId,
            customerId
        });

        const payload = {
            accountNumber,
            facilityId,
            customerId
        };

        // Get Account model from main database
        const AccountModel = mongoose.model('Account');

        // Add account details to account model in the main database.
        console.log('Searching for account in main database...', { accountNumber });
        const account = await AccountModel.findOne({ accountNumber });

        if (!account) {
            console.log('Account not found in main database, adding details...', {
                accountNumber,
                facilityId,
                customerId
            });

            // Create account in the database
            await AccountModel.create(payload);
            console.log('Account successfully created in main database.');
        } else {
            console.log('Account found in main database, skipping creation.');
        }

        // Add account details to PayServe with retry logic
        let attempt = 1;
        let lastError = null;

        while (attempt <= MAX_RETRIES) {
            try {
                console.log(`Sending account details to PayServe (Attempt ${attempt}/${MAX_RETRIES})...`, {
                    accountNumber,
                    facilityId,
                    customerId
                });

                const response = await axios.post('https://sandbox.payments.payserve.co.ke/v1/addAccount',
                    payload,
                    {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                // Axios throws errors for non-2xx responses, so if we're here, it's a success
                const result = response.data;
                console.log('Successfully added account details to PayServe:', {
                    accountNumber,
                    facilityId,
                    customerId,
                    result,
                    attempt
                });

                return result;

            } catch (error) {
                lastError = error;

                // Check for specific error responses with account already exists message
                if (error.response && error.response.data) {
                    if (error.response.data.message === "Account already exists") {
                        console.log('Account already exists in PayServe, treating as success:', {
                            accountNumber,
                            facilityId,
                            customerId
                        });
                        return {
                            success: true,
                            message: "Account already exists",
                            accountNumber
                        };
                    }
                }

                if (attempt === MAX_RETRIES) {
                    console.error('Final attempt to add account details to PayServe failed:', {
                        error: error.message,
                        accountNumber,
                        facilityId,
                        customerId,
                        attempt,
                        stack: error.stack,
                        response: error.response?.data
                    });
                    break;
                }

                const backoffDelay = RETRY_DELAY * Math.pow(2, attempt - 1);
                console.warn(`Attempt ${attempt} failed, retrying in ${backoffDelay}ms:`, {
                    error: error.message,
                    accountNumber,
                    nextAttempt: attempt + 1,
                    backoffDelay
                });

                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                attempt++;
            }
        }

        // If we've exhausted all retries, throw the last error
        throw new Error(`Failed to add account details to PayServe after ${MAX_RETRIES} attempts: ${
            lastError.response?.data?.message || lastError.message
        }`);

    } catch (error) {
        console.error('Error in addAccountDetails:', {
            error: error.message,
            accountNumber,
            facilityId,
            customerId,
            response: error.response?.data,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = add_service_invoice;