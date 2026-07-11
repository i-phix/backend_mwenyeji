const axios = require('axios');
require('dotenv').config();

const get_consumption_history = async (req, res) => {
    try {
        const { meterId } = req.params;

        if (!meterId) {
            return res.status(400).send({ error: 'Meter ID is required' });
        }

        const baseUrl = process.env.POWER_METER_SERVICE_RESIDENT_URL;
        if (!baseUrl) {
            return res.status(500).send({ error: 'Power Meter Service URL not configured' });
        }

        const response = await axios.get(`${baseUrl}/get_power_meter_consumption/${meterId}`);

        return res.status(200).send({
            message: 'Meter consumption history fetched successfully',
            data: response.data.data
        });
    } catch (error) {
        console.error('Error forwarding get_consumption_history request:', error);

        if (error.response) {
            return res
                .status(error.response.status)
                .send({ error: error.response.data.error || 'Failed to fetch consumption history' });
        }

        return res.status(502).send({ error: 'Failed to communicate with Power Meter Service' });
    }
};

module.exports = get_consumption_history;
