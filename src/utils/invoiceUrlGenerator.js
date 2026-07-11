// src/utils/invoiceUrlGenerator.js

/**
 * Generates a public-facing URL for an invoice
 * @param {string} facilityId - The facility ID
 * @param {string} invoiceId - The invoice ID
 * @param {string} invoiceType - The invoice type (levy or lease)
 * @returns {string} The full URL to the invoice page
 */
function generateInvoiceUrl(facilityId, invoiceId, invoiceType = '') {
    // Get the base URL from environment variables
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    
    // Generate the URL matching the frontend route pattern
    return `${baseUrl}/invoice/${facilityId}/${invoiceId}/${invoiceType}`;
}

/**
 * Attempts to create a short URL for an invoice, but falls back to the full URL
 * @param {Object} mainDb - Main database connection for URL shortening
 * @param {string} facilityId - The facility ID
 * @param {string} invoiceId - The invoice ID
 * @param {string} invoiceType - The invoice type (levy or lease)
 * @returns {Promise<string>} The shortened or full URL
 */
async function createShortInvoiceUrl(mainDb, facilityId, invoiceId, invoiceType = '') {
    try {
        // Import the URL shortener utility
        const { createShortUrl } = require('./url_shortener/short_url');
        
        // Generate the long URL
        const longUrl = generateInvoiceUrl(facilityId, invoiceId, invoiceType);
        
        // Create a short URL
        const shortCode = await createShortUrl(longUrl);
        
        // Get base URL
        const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        
        // Return the short URL
        return `${baseUrl}/s/${shortCode}`;
    } catch (error) {
        // Log the error
        console.error('Failed to create short invoice URL:', error);
        
        // Fall back to the full URL
        return generateInvoiceUrl(facilityId, invoiceId, invoiceType);
    }
}

/**
 * Updates an invoice with its public URL
 * @param {Object} Invoice - The Invoice model
 * @param {string} invoiceId - The invoice ID
 * @param {string} url - The invoice URL
 * @returns {Promise<boolean>} Success status
 */
async function updateInvoiceWithUrl(Invoice, invoiceId, url) {
    try {
        const result = await Invoice.findByIdAndUpdate(
            invoiceId,
            { 
                $set: { 
                    invoiceUrl: url,
                    updatedAt: new Date()
                } 
            }
        );
        
        return !!result;
    } catch (error) {
        console.error('Failed to update invoice with URL:', error);
        return false;
    }
}

module.exports = {
    generateInvoiceUrl,
    createShortInvoiceUrl,
    updateInvoiceWithUrl
};