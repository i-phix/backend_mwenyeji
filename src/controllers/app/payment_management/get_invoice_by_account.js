const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Get invoice details by facility ID and account number
 * 
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} - Promise resolving to the invoice details
 */
const get_invoice_by_account = async (request, reply) => {
    console.log('=== Start: get_invoice_by_account ===');
    console.log(`Request params: ${JSON.stringify(request.params)}`);

    try {
        const { facilityId, accountNumber } = request.params;

        if (!facilityId || !accountNumber) {
            console.log('Error: Missing required parameters');
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and account number are required'
            });
        }

        // Get invoice type based on account number prefix
        const prefix = accountNumber.charAt(0);
        let invoiceModel;
        let invoiceType;

        try {
            console.log(`Determining invoice type from prefix: ${prefix}`);
            switch (prefix) {
                case '5':
                case '6':
                    invoiceModel = await getModel(
                        "Invoice",
                        payservedb.Invoice.schema,
                        facilityId
                    );
                    invoiceType = 'invoice';
                    console.log('Using Invoice model');
                    break;
                case '7':
                    invoiceModel = await getModel(
                        "WaterInvoice",
                        payservedb.WaterInvoice.schema,
                        facilityId
                    );
                    invoiceType = 'waterinvoice';
                    console.log('Using WaterInvoice model');
                    break;
                case '8':
                    invoiceModel = await getModel(
                        "VasInvoice",
                        payservedb.VasInvoice.schema,
                        facilityId
                    );
                    invoiceType = 'vasinvoice';
                    console.log('Using VasInvoice model');
                    break;
                default:
                    console.log(`Error: Invalid account number prefix: ${prefix}`);
                    return reply.code(400).send({
                        success: false,
                        error: 'Invalid account number prefix'
                    });
            }
        } catch (error) {
            console.error('Error getting invoice model:', error);
            return reply.code(500).send({
                success: false,
                error: 'Error accessing facility database'
            });
        }

        // Find the invoice in facility database
        console.log(`Finding invoice with accountNumber: ${accountNumber} in facility: ${facilityId}`);
        const invoice = await invoiceModel.findOne({ accountNumber });
        if (!invoice) {
            console.log(`Error: Invoice not found for account: ${accountNumber} in facility: ${facilityId}`);
            return reply.code(404).send({
                success: false,
                error: 'Invoice not found'
            });
        }

        console.log(`Found invoice: ${invoice.invoiceNumber}`);

        // Calculate current balance based on invoice type
        let currentBalance;
        
        if (invoiceType === 'vasinvoice') {
            // For VAS invoices which use 'amount' field instead of 'totalAmount'
            const totalAmount = invoice.amount;
            const amountPaid = invoice.amountPaid || 0;
            currentBalance = totalAmount - amountPaid;
            
            console.log(`VAS Invoice balance - amount: ${totalAmount}, amountPaid: ${amountPaid}, calculatedBalance: ${currentBalance}`);
        } else {
            // For standard invoices
            // Calculate total amount due including stored balanceBroughtForward
            const totalAmountDue = invoice.totalAmount + (invoice.balanceBroughtForward > 0 ? invoice.balanceBroughtForward : 0);
            
            // Calculate total payments including any applied credit (negative balanceBroughtForward)
            const totalPayments = invoice.amountPaid || 0;
            const creditApplied = invoice.balanceBroughtForward < 0 ? Math.abs(invoice.balanceBroughtForward) : 0;
            
            // Final balance = what's owed minus what's paid (including credits)
            currentBalance = totalAmountDue - totalPayments - creditApplied;
            
            console.log(`Calculated balance - totalAmount: ${invoice.totalAmount}, balanceBroughtForward: ${invoice.balanceBroughtForward}, amountPaid: ${invoice.amountPaid}, calculatedBalance: ${currentBalance}`);
        }

        // Get customer details if applicable
        let customerDetails = null;
        
        try {
            // Try to get customer information from different possible sources
            let customerId = null;
            
            // Check all possible locations for customer ID
            if (invoice.customerId) {
                customerId = invoice.customerId;
                console.log(`Found customerId directly on invoice: ${customerId}`);
            } else if (invoice.client?.clientId) {
                customerId = invoice.client.clientId;
                console.log(`Found customerId in client.clientId: ${customerId}`);
            } else if (invoice.customer?.id) {
                customerId = invoice.customer.id;
                console.log(`Found customerId in customer.id: ${customerId}`);
            }
            
            if (customerId) {
                // Customer model is in the main database
                const Customer = payservedb.Customer;
                let customer = null;
                
                // Try multiple approaches to find the customer
                try {
                    // First try direct findById if it's a valid ObjectId
                    if (mongoose.Types.ObjectId.isValid(customerId.toString())) {
                        customer = await Customer.findById(customerId.toString()).lean();
                        if (customer) {
                            console.log(`Found customer by ID: ${customer._id}`);
                        }
                    }
                    
                    // If not found, try string comparison
                    if (!customer) {
                        customer = await Customer.findOne({ _id: customerId.toString() }).lean();
                        if (customer) {
                            console.log(`Found customer by string _id: ${customer._id}`);
                        }
                    }
                    
                    // Additional backup query to try finding by ObjectId
                    if (!customer && mongoose.Types.ObjectId.isValid(customerId.toString())) {
                        customer = await Customer.findOne({
                            _id: new mongoose.Types.ObjectId(customerId.toString())
                        }).lean();
                        
                        if (customer) {
                            console.log(`Found customer using explicit ObjectId: ${customer._id}`);
                        }
                    }
                    
                    if (customer) {
                        // Create a standardized customer details object
                        customerDetails = {
                            id: customer._id || customerId,
                            name: formatCustomerName(customer),
                            phoneNumber: customer.phoneNumber || customer.phone,
                            email: customer.email
                        };
                        
                        console.log(`Standardized customer details: ${JSON.stringify(customerDetails)}`);
                    } else {
                        console.log(`No customer found for ID: ${customerId}`);
                    }
                    
                } catch (customerFindError) {
                    console.log(`Error searching for customer: ${customerFindError.message}`);
                }
            } else if (invoice.customerInfo) {
                // For invoices which may store customer info directly
                customerDetails = {
                    id: invoice.customerInfo.id || invoice.customerInfo._id,
                    name: invoice.customerInfo.name || invoice.customerInfo.fullName || 
                          `${invoice.customerInfo.firstName || ''} ${invoice.customerInfo.lastName || ''}`.trim(),
                    phoneNumber: invoice.customerInfo.phone || invoice.customerInfo.phoneNumber,
                    email: invoice.customerInfo.email
                };
                console.log(`Using embedded customer info: ${JSON.stringify(customerDetails)}`);
            } else if (invoice.customer) {
                // Some invoices might have customer data directly embedded
                customerDetails = {
                    id: invoice.customer.id || invoice.customer._id,
                    name: invoice.customer.name || 
                          `${invoice.customer.firstName || ''} ${invoice.customer.lastName || ''}`.trim(),
                    phoneNumber: invoice.customer.phoneNumber || invoice.customer.phone,
                    email: invoice.customer.email
                };
                console.log(`Using directly embedded customer: ${JSON.stringify(customerDetails)}`);
            }
            
            // If no customer details found yet, try to look up by any available identifiers
            if (!customerDetails) {
                const Customer = payservedb.Customer;
                
                // Check if we have a phone number on the invoice
                if (invoice.customerPhone || invoice.phone || invoice.phoneNumber) {
                    const phoneToSearch = invoice.customerPhone || invoice.phone || invoice.phoneNumber;
                    console.log(`Trying to find customer by phone: ${phoneToSearch}`);
                    
                    const customerByPhone = await Customer.findOne({
                        $or: [
                            { phoneNumber: phoneToSearch },
                            { phone: phoneToSearch }
                        ]
                    }).lean();
                    
                    if (customerByPhone) {
                        customerDetails = {
                            id: customerByPhone._id,
                            name: formatCustomerName(customerByPhone),
                            phoneNumber: customerByPhone.phoneNumber || customerByPhone.phone,
                            email: customerByPhone.email
                        };
                        console.log(`Found customer by phone: ${JSON.stringify(customerDetails)}`);
                    }
                }
                
                // Check if we have an email on the invoice
                if (!customerDetails && (invoice.customerEmail || invoice.email)) {
                    const emailToSearch = invoice.customerEmail || invoice.email;
                    console.log(`Trying to find customer by email: ${emailToSearch}`);
                    
                    const customerByEmail = await Customer.findOne({ email: emailToSearch }).lean();
                    
                    if (customerByEmail) {
                        customerDetails = {
                            id: customerByEmail._id,
                            name: formatCustomerName(customerByEmail),
                            phoneNumber: customerByEmail.phoneNumber || customerByEmail.phone,
                            email: customerByEmail.email
                        };
                        console.log(`Found customer by email: ${JSON.stringify(customerDetails)}`);
                    }
                }
            }
        } catch (error) {
            console.log('Error fetching customer details:', error.message);
            // Continue without customer details
        }

        // Format the invoice data for response
        const invoiceData = {
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            accountNumber: invoice.accountNumber,
            facilityId: facilityId,
            invoiceType: invoiceType,
            status: invoice.status,
            createdAt: invoice.createdAt,
            dueDate: invoice.dueDate,
            totalAmount: invoiceType === 'vasinvoice' ? invoice.amount : invoice.totalAmount,
            amountPaid: invoice.amountPaid || 0,
            balance: currentBalance,
            currency: invoice.currency || { code: 'KES' },
            paymentStatus: invoice.paymentDetails?.paymentStatus || 'Pending',
            lastPaymentDate: invoice.paymentDetails?.paymentDate || invoice.lastPaymentDate,
            lastTransactionId: invoice.paymentDetails?.transactionId || invoice.lastTransactionId,
            customer: customerDetails,
            reconciliationHistory: invoice.reconciliationHistory || []
        };

        // For lease invoices, include property information
        if (invoice.whatFor?.invoiceType === 'Lease' && invoice.unit) {
            invoiceData.property = {
                unitName: invoice.unit.name,
                unitId: invoice.unit._id || invoice.unit.id,
                propertyId: invoice.property?._id || invoice.property?.id,
                propertyName: invoice.property?.name
            };
        }

        // For water invoices, include meter reading information
        if (invoiceType === 'waterinvoice' && invoice.meterReadings) {
            invoiceData.meterReadings = {
                current: invoice.meterReadings.currentReading,
                previous: invoice.meterReadings.previousReading,
                consumption: invoice.meterReadings.consumption
            };
        }

        // For VAS invoices, include service information
        if (invoiceType === 'vasinvoice' && invoice.serviceId) {
            try {
                const vasServiceModel = await getModel(
                    "ValueAddedService",
                    payservedb.ValueAddedService.schema,
                    facilityId
                );
                
                const service = await vasServiceModel.findById(invoice.serviceId);
                if (service) {
                    invoiceData.service = {
                        id: service._id,
                        name: service.name,
                        description: service.description,
                        type: service.type
                    };
                }
            } catch (error) {
                console.log('Error fetching VAS service details:', error.message);
            }
        }

        // Include account information if available
        try {
            // Get the Account model from payservedb package
            const Account = payservedb.Account;
            
            // Find the account in main database
            const account = await Account.findOne({ accountNumber }).lean();
            if (account) {
                invoiceData.account = {
                    id: account._id,
                    accountNumber: account.accountNumber,
                    amount: account.amount || currentBalance
                };
            }
        } catch (accountError) {
            console.log('Error fetching account information:', accountError.message);
            // Continue without account information
        }

        console.log('Invoice details retrieved successfully');
        console.log('=== End: get_invoice_by_account ===');

        return reply.code(200).send({
            success: true,
            data: invoiceData
        });

    } catch (error) {
        console.error('Error retrieving invoice:', error);
        console.error('Error stack:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error retrieving invoice'
        });
    } finally {
        console.log('=== End: get_invoice_by_account ===');
    }
};

/**
 * Helper function to format customer name consistently
 * 
 * @param {Object} customer - The customer object
 * @returns {String} - Formatted customer name
 */
function formatCustomerName(customer) {
    if (customer.name) {
        return customer.name;
    }
    
    // If we have firstName and lastName, combine them
    if (customer.firstName || customer.lastName) {
        return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    
    // If we have first and last as separate properties
    if (customer.first || customer.last) {
        return `${customer.first || ''} ${customer.last || ''}`.trim();
    }
    
    // Last resort - just return whatever ID we have
    return customer._id ? customer._id.toString() : 'Unknown';
}

module.exports = get_invoice_by_account;