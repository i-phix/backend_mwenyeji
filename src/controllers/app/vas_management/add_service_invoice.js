const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');
const axios = require('axios');

// Constants for account registration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms before retrying

const add_service_invoice = async (request, reply) => {
    const { facilityId } = request.params;
    const { serviceId, status, customerId, amount } = request.body;

    try {
        const invoice = await createVasInvoice({ facilityId, serviceId, status, customerId, amount });
        return reply.code(201).send({
            success: true,
            message: 'Invoice created successfully',
            data: invoice
        });
    } catch (err) {
        console.error('Error:', err);
        return reply.code(500).send({ success: false, error: err.message });
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
        throw new Error(`Failed to add account details to PayServe after ${MAX_RETRIES} attempts: ${lastError.response?.data?.message || lastError.message
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

const createVasInvoice = async ({ facilityId, serviceId, customerId, amount, status }) => {
    try {
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

        const serviceRequest = await ServiceRequestModel.findById(serviceId);

        if (!serviceRequest) {
            // ✅ Throw errors instead of calling reply
            throw new Error('Service request not found');
        }

        const service = await VasModel.findById(serviceRequest.serviceId);
        if (!service) {
            throw new Error('Service not found');
        }

        let currencyInfo;
        try {
            const FacilityModel = mongoose.model('Facility');
            const facility = await FacilityModel.findById(facilityId).lean();
            if (facility && facility.defaultCurrency) {
                currencyInfo = await CurrencyModel.findById(facility.defaultCurrency).lean();
            }
        } catch (error) {
            console.warn('Error fetching facility or currency info:', error.message);
        }

        if (!currencyInfo) {
            currencyInfo = {
                _id: new mongoose.Types.ObjectId(),
                currencyName: 'Kenyan Shilling',
                currencyShortCode: 'KES',
                currencySymbol: 'KSh'
            };
        }

        // const taxDetails = service.applicableTaxes.map(tax => ({
        //     taxId: tax.taxId,
        //     taxName: tax.taxName,
        //     taxRate: tax.taxRate,
        //     taxAmount: parseFloat(((parseFloat(amount) * tax.taxRate) / 100).toFixed(2))
        // }));

        const taxDetails = (service.applicableTaxes || []).map(tax => ({
            taxId: tax.taxId,
            taxName: tax.taxName,
            taxRate: tax.taxRate,
            taxAmount: parseFloat(((parseFloat(amount) * tax.taxRate) / 100).toFixed(2))
        }));

        const totalTax = parseFloat(taxDetails.reduce((sum, tax) => sum + tax.taxAmount, 0).toFixed(2));
        const subTotal = parseFloat(parseFloat(amount).toFixed(2));
        const totalAmount = parseFloat((subTotal + totalTax).toFixed(2));

        const accountNumber = await generateUniqueAccountNumber(VasInvoiceModel);
        const invoiceNumber = generateInvoiceNumber();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        let customerName = 'Customer';
        try {
            const CustomerModel = mongoose.model('Customer');
            const customer = await CustomerModel.findById(customerId).lean();
            if (customer) {
                customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
            }
        } catch (error) {
            console.warn('Error fetching customer info:', error.message);
        }

        const PaymentDetailsModel = await getModel(
            "FacilityPaymentDetails",
            payservedb.FacilityPaymentDetails.schema,
            facilityId
        );

        const paymentDetails = await PaymentDetailsModel.findOne({ facility: facilityId }).lean();
        const paymentMethod = paymentDetails
            ? `${paymentDetails.module} - ${paymentDetails.shortCode}`
            : null;

        const invoiceData = {
            invoiceNumber,
            accountNumber,
            facilityId,
            serviceId: serviceRequest.serviceId,
            customerId,
            customerInfo: { fullName: customerName },
            dueDate,
            status,
            subTotal,
            tax: totalTax,
            amount: totalAmount,
            // unit: serviceRequest.unit,
            unit: serviceRequest.unitId,
            serviceName: service.serviceName,
            whatFor: {
                invoiceType: 'VAS',
                description: ''
            },
            currency: {
                id: currencyInfo._id,
                name: currencyInfo.currencyName,
                code: currencyInfo.currencyShortCode,
                symbol: currencyInfo.currencySymbol
            },
            paymentDetails: {
                paymentMethod,
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

        // GL entries for invoice
        let taxGLEntryIds = [];

        if (service.invoiceDoubleEntryAccount ||
            (service.glAccounts?.invoice?.debit && service.glAccounts?.invoice?.credit)) {

            let debitAccountId, creditAccountId;

            if (service.invoiceDoubleEntryAccount) {
                const doubleEntryConfig = await GLAccountDoubleEntriesModel.findById(service.invoiceDoubleEntryAccount);
                if (doubleEntryConfig) {
                    debitAccountId = doubleEntryConfig.accountdebited;
                    creditAccountId = doubleEntryConfig.accountcredited;
                    invoiceData.glDoubleEntryId = service.invoiceDoubleEntryAccount;
                }
            } else {
                debitAccountId = service.glAccounts.invoice.debit;
                creditAccountId = service.glAccounts.invoice.credit;
            }

            if (debitAccountId && creditAccountId) {
                try {
                    const [savedDebitEntry] = await Promise.all([
                        new GLEntryModel({
                            entryDate: new Date(),
                            accountId: debitAccountId,
                            amount: subTotal,
                            description: `Service invoice ${invoiceNumber} for ${service.serviceName}`,
                            facilityId,
                            creditAccountId,
                            entryType: 'debit'
                        }).save(),
                        new GLEntryModel({
                            entryDate: new Date(),
                            accountId: creditAccountId,
                            amount: subTotal,
                            description: `Service invoice ${invoiceNumber} for ${service.serviceName}`,
                            facilityId,
                            creditAccountId: debitAccountId,
                            entryType: 'credit'
                        }).save()
                    ]);
                    invoiceData.invoiceGLEntryId = savedDebitEntry._id;
                } catch (glError) {
                    console.error('Error creating GL entries for invoice:', glError.message);
                }
            }
        }

        // GL entries for tax
        if (taxDetails.length > 0 && totalTax > 0 &&
            (service.taxDoubleEntryAccount ||
                (service.glAccounts?.tax?.debit && service.glAccounts?.tax?.credit))) {

            let debitAccountId, creditAccountId;

            if (service.taxDoubleEntryAccount) {
                const taxDoubleEntryConfig = await GLAccountDoubleEntriesModel.findById(service.taxDoubleEntryAccount);
                if (taxDoubleEntryConfig) {
                    debitAccountId = taxDoubleEntryConfig.accountdebited;
                    creditAccountId = taxDoubleEntryConfig.accountcredited;
                }
            } else {
                debitAccountId = service.glAccounts.tax.debit;
                creditAccountId = service.glAccounts.tax.credit;
            }

            if (debitAccountId && creditAccountId) {
                try {
                    const taxGLEntryResults = await Promise.all(
                        taxDetails.map(async (tax, index) => {
                            if (tax.taxAmount <= 0) return null;
                            const [savedTaxDebitEntry] = await Promise.all([
                                new GLEntryModel({
                                    entryDate: new Date(),
                                    accountId: debitAccountId,
                                    amount: tax.taxAmount,
                                    description: `${tax.taxName} (${tax.taxRate}%) for invoice ${invoiceNumber}`,
                                    facilityId,
                                    creditAccountId,
                                    entryType: 'debit'
                                }).save(),
                                new GLEntryModel({
                                    entryDate: new Date(),
                                    accountId: creditAccountId,
                                    amount: tax.taxAmount,
                                    description: `${tax.taxName} (${tax.taxRate}%) for invoice ${invoiceNumber}`,
                                    facilityId,
                                    creditAccountId: debitAccountId,
                                    entryType: 'credit'
                                }).save()
                            ]);
                            invoiceData.taxDetails[index].glEntryId = savedTaxDebitEntry._id;
                            return savedTaxDebitEntry._id;
                        })
                    );

                    taxGLEntryIds = taxGLEntryResults.filter(Boolean);
                    if (taxGLEntryIds.length > 0) {
                        invoiceData.taxGLEntryId = taxGLEntryIds[0];
                    }
                } catch (taxGlError) {
                    console.error('Error creating GL entries for tax:', taxGlError.message);
                }
            }
        }

        const newVasInvoice = new VasInvoiceModel(invoiceData);
        const savedInvoice = await newVasInvoice.save();

        try {
            await addAccountDetails(accountNumber, facilityId, customerId);
        } catch (accountError) {
            console.error('Error registering account details, invoice was still created:', accountError.message);
        }

        // ✅ Return the saved invoice object directly — no reply here
        const result = savedInvoice.toObject();

        if (invoiceData.invoiceGLEntryId || taxGLEntryIds.length > 0) {
            result.glStatus = {
                invoiceGLEntryCreated: !!invoiceData.invoiceGLEntryId,
                taxGLEntriesCreated: taxGLEntryIds.length > 0,
                taxGLEntriesCount: taxGLEntryIds.length
            };
        }

        return result; // ✅ Plain return, no reply

    } catch (err) {
        console.error('createVasInvoice error:', err);
        throw err; // ✅ Re-throw so callers can handle it
    }
};


module.exports = add_service_invoice;
module.exports.createVasInvoice = createVasInvoice;