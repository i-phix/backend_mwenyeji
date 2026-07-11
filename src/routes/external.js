// External authentication middleware available but not currently used
// const { externalAuth, externalCorsConfig } = require('../middleware/external_auth');

// External Booking API Controllers
const get_properties = require('../controllers/external/booking/get_properties');
const check_availability = require('../controllers/external/booking/check_availability');
const create_booking = require('../controllers/external/booking/create_booking');
const verify_session = require('../controllers/external/booking/verify_session');
const calculate_pricing = require('../controllers/external/booking/calculate_pricing');
const get_booking_status = require('../controllers/external/booking/get_booking_status');
const payment_webhook = require('../controllers/external/booking/payment_webhook');
const mpesa_payment = require('../controllers/external/booking/mpesa_payment');

/**
 * External API Routes
 * Routes for third-party integrations (WordPress, mobile apps, etc.)
 * All routes are prefixed with /api/external
 */
async function externalRoutes(fastify, options) {
    // CORS is already configured globally in app.js, no need to register again

    // Health check endpoint (no auth required)
    fastify.get('/health', async (request, reply) => {
        return {
            success: true,
            message: 'External API is operational',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    });

    // ==================== BOOKING ENDPOINTS ====================

    /**
     * GET /api/external/booking/properties
     * Get all listed properties and their available units
     * No authentication required
     * Query: facility_id (required)
     */
    fastify.get('/booking/properties', get_properties);

    /**
     * POST /api/external/booking/check-availability
     * Check availability for a specific unit and date range
     * No authentication required
     * Body: { facility_id, property_id, unit_id, check_in_date, check_out_date, guests }
     */
    fastify.post('/booking/check-availability', check_availability);

    /**
     * POST /api/external/booking/calculate-pricing
     * Calculate detailed pricing for a booking
     * No authentication required
     * Body: { facility_id, property_id, check_in_date, check_out_date, adults, children }
     */
    fastify.post('/booking/calculate-pricing', calculate_pricing);

    /**
     * POST /api/external/booking/create
     * Create a new booking reservation
     * No authentication required
     * Body: { facility_id, property_id, unit_id, check_in_date, check_out_date, guest_info, special_requests, return_url }
     */
    fastify.post('/booking/create', create_booking);

    /**
     * POST /api/external/booking/verify-session
     * Verify a session token and retrieve booking details
     * No authentication required
     * Body: { session_token }
     */
    fastify.post('/booking/verify-session', verify_session);

    /**
     * GET /api/external/booking/:booking_reference/status
     * Get current status of a booking
     * No authentication required
     * Params: booking_reference (e.g., RES-000001)
     * Query: facility_id (required)
     */
    fastify.get('/booking/:booking_reference/status', get_booking_status);

    // ==================== PAYMENT ENDPOINTS ====================

    /**
     * POST /api/external/booking/mpesa-payment
     * Handle M-Pesa payment for booking invoices
     * Called by mpesa-production service after successful M-Pesa transaction
     * No authentication required (called by internal service)
     * Body: { accountNumber, amount, transactionCode }
     */
    fastify.post('/booking/mpesa-payment', mpesa_payment);

    // ==================== WEBHOOK ENDPOINTS ====================

    /**
     * POST /api/external/webhook/payment
     * Receive payment status updates
     * Uses HMAC-SHA256 signature verification (not Bearer token)
     * Body: { event_type, booking_reference, invoice_number, payment_data, facility_id }
     * Headers: x-webhook-signature
     */
    fastify.post('/webhook/payment', payment_webhook);

    // ==================== API DOCUMENTATION ====================

    /**
     * GET /api/external/docs
     * Get API documentation (basic info)
     */
    fastify.get('/docs', async (request, reply) => {
        return {
            success: true,
            message: 'SWAN Portfolio Booking Integration API',
            version: '1.0.0',
            documentation: 'See SWAN_API_DOCUMENTATION.md for comprehensive documentation',
            endpoints: {
                booking: {
                    get_properties: 'GET /api/external/booking/properties',
                    check_availability: 'POST /api/external/booking/check-availability',
                    calculate_pricing: 'POST /api/external/booking/calculate-pricing',
                    create_booking: 'POST /api/external/booking/create',
                    verify_session: 'POST /api/external/booking/verify-session',
                    get_status: 'GET /api/external/booking/:booking_reference/status',
                    mpesa_payment: 'POST /api/external/booking/mpesa-payment'
                },
                webhooks: {
                    payment_webhook: 'POST /api/external/webhook/payment'
                }
            },
            authentication: {
                type: 'None',
                note: 'API is currently open and does not require authentication'
            },
            support: {
                email: 'support@payserve.com',
                documentation: 'https://docs.payserve.com/external-api'
            }
        };
    });
}

module.exports = externalRoutes;
