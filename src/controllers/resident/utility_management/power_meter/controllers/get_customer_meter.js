const axios = require('axios');
require('dotenv').config();

const get_customer_meter = async (req, res) => {
    try {
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).send({ error: 'Customer ID is required' });
        }

        const baseUrl = process.env.POWER_METER_SERVICE_RESIDENT_URL;
        if (!baseUrl) {
            return res.status(500).send({ error: 'Power Meter Service URL not configured' });
        }

        const response = await axios.get(`${baseUrl}/get_power_meter/${customerId}`);

        return res.status(200).send({
            message: 'Customer meters fetched successfully',
            data: response.data.data,
            count: response.data.count
        });
    } catch (error) {
        console.error('Error forwarding get_customer_meter request:', error);

        if (error.response) {
            return res
                .status(error.response.status)
                .send({ error: error.response.data.error || 'Failed to fetch customer meters' });
        }

        return res.status(502).send({ error: 'Failed to communicate with Power Meter Service' });
    }
};

module.exports = get_customer_meter;
