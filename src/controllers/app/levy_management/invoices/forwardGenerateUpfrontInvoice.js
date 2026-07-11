const axios = require('axios');
require('dotenv').config();

/**
 * Forward upfront invoice generation request to Invoice Service
 */
const forwardGenerateUpfrontInvoice = async (params) => {
    try {
        const {
            facilityId,
            contractId,
            billingPeriods,
            upfrontAmount,
            collectionFrequency
        } = params;

        // Basic validation
        if (!facilityId) {
            throw new Error('facilityId is required');
        }

        if (!contractId) {
            throw new Error('contractId is required');
        }

        if (!billingPeriods || !Array.isArray(billingPeriods) || billingPeriods.length === 0) {
            throw new Error('billingPeriods must be a non-empty array');
        }

        if (!upfrontAmount || isNaN(upfrontAmount) || parseFloat(upfrontAmount) <= 0) {
            throw new Error('upfrontAmount must be a positive number');
        }

        if (!collectionFrequency) {
            throw new Error('collectionFrequency is required');
        }

        // Get the Invoice Service base URL from environment variables
        const invoiceServiceUrl = process.env.INVOICE_SERVICE_NEW_URL;
        
        if (!invoiceServiceUrl) {
            throw new Error('Invoice Service URL not configured');
        }

        console.log('Forwarding upfront invoice generation request:', {
            facilityId,
            contractId,
            billingPeriods,
            upfrontAmount,
            collectionFrequency
        });

        // Forward request to Invoice Service
        const response = await axios.post(
            `${invoiceServiceUrl}/generate-upfront-invoice`,
            {
                facilityId,
                contractId,
                billingPeriods,
                upfrontAmount,
                collectionFrequency
            },
            {
                timeout: 30000, // 30 second timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Upfront invoice generated successfully:', response.data);

        return {
            success: true,
            data: response.data.data,
            message: 'Upfront invoice generated successfully'
        };

    } catch (error) {
        console.error('Error forwarding upfront invoice generation request:', error);
        
        // Handle axios errors
        if (error.response) {
            throw new Error(error.response.data.error || 'Failed to generate upfront invoice');
        }
        
        // Handle other errors
        throw new Error(error.message || 'Failed to communicate with Invoice Service');
    }
};

module.exports = forwardGenerateUpfrontInvoice;