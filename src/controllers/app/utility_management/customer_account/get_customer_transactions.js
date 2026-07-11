const axios = require('axios');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
require('dotenv').config();

const getCustomerTransactions = async (request, reply) => {
    try {
        // Get account number from URL parameter
        const { accountNumber } = request.params;
        
        // Get actual customer ID from query parameter (optional)
        const { customerId } = request.query;

        // Validate account number (from URL param)
        if (!accountNumber) {
            return reply.code(400).send({
                success: false,
                error: 'Account number is required in URL'
            });
        }

        // Get the base URL from environment variables
        const baseServiceUrl = process.env.MPESA_API_URL || 'https://sandbox.payments.payserve.co.ke/v1';
        
        if (!baseServiceUrl) {
            return reply.code(500).send({
                success: false,
                error: 'M-Pesa service URL not configured'
            });
        }

        const mpesaUrl = `${baseServiceUrl}/get_transaction_by_account_number/${accountNumber}`;

        // Forward request to the M-Pesa service using account number
        const response = await axios.get(mpesaUrl, {
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Get all transactions from M-Pesa service
        const allTransactions = response.data.transactions || [];

        let finalTransactions = allTransactions;

        // Filter transactions by customer ID if provided
        if (customerId) {
            finalTransactions = allTransactions.filter(transaction => {
                // Handle both string and ObjectId comparison
                let transactionCustomerId = transaction.customerId;
                
                // If customerId is an ObjectId object, extract the $oid value
                if (typeof transactionCustomerId === 'object' && transactionCustomerId?.$oid) {
                    transactionCustomerId = transactionCustomerId.$oid;
                }
                
                // Convert to string for comparison
                const customerIdString = String(transactionCustomerId);
                const filterCustomerIdString = String(customerId);
                
                return customerIdString === filterCustomerIdString;
            });
        }

        // Get customer model
        const customerModel = await getModel('Customer', payservedb.Customer.schema);

        // Enrich transactions with customer information
        const enrichedTransactions = await Promise.all(
            finalTransactions.map(async (transaction) => {
                let customer = null;
                
                if (transaction.customerId) {
                    try {
                        let customerIdToQuery = transaction.customerId;
                        
                        // Handle ObjectId format
                        if (typeof customerIdToQuery === 'object' && customerIdToQuery?.$oid) {
                            customerIdToQuery = customerIdToQuery.$oid;
                        }
                        
                        customer = await customerModel.findById(customerIdToQuery);
                    } catch (err) {
                        // Silent error handling - customer info will be null
                    }
                }

                return {
                    ...transaction,
                    CustomerInfo: customer
                        ? {
                            _id: customer._id,
                            fullName: `${customer.firstName} ${customer.lastName}`,
                            firstName: customer.firstName,
                            lastName: customer.lastName,
                            phoneNumber: customer.phoneNumber
                        }
                        : null
                };
            })
        );

        // Sort transactions by date (newest first)
        enrichedTransactions.sort((a, b) => {
            const dateA = a.transTime || a.createdAt;
            const dateB = b.transTime || b.createdAt;
            
            // Handle transTime format (YYYYMMDDHHMMSS)
            if (dateA && dateA.length === 14 && dateB && dateB.length === 14) {
                return dateB.localeCompare(dateA);
            }
            
            // Handle ISO date format
            return new Date(dateB) - new Date(dateA);
        });

        return reply.code(200).send({
            success: true,
            message: 'Customer transactions retrieved successfully',
            transactions: enrichedTransactions
        });

    } catch (error) {
        // Handle axios errors
        if (error.response) {
            // Handle specific M-Pesa service errors
            if (error.response.status === 404) {
                return reply.code(200).send({
                    success: true,
                    message: 'No transactions found for this account',
                    transactions: []
                });
            }
            
            return reply.code(error.response.status).send({
                success: false,
                error: error.response.data?.error || error.response.data?.message || 'Failed to fetch transactions from M-Pesa service'
            });
        }

        // Handle network/timeout errors
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return reply.code(408).send({
                success: false,
                error: 'Request timeout - M-Pesa service is taking too long to respond'
            });
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return reply.code(503).send({
                success: false,
                error: 'M-Pesa service is currently unavailable'
            });
        }

        return reply.code(502).send({
            success: false,
            error: 'Failed to communicate with M-Pesa service'
        });
    }
};

module.exports = getCustomerTransactions;