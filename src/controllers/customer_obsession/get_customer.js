const payservedb = require('payservedb');
const logger = require('../../../config/winston');
const { getModel } = require('../../utils/getModel');

async function get_customer(request, reply) {
    try {
        const agent = request.user;
        const { customerId, facilityId } = request.params;

        if (!customerId) {
            return reply.code(400).send({
                success: false,
                error: 'Customer ID is required'
            });
        }

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        // First try to get customer from facility-specific database
        let customer = null;

        try {
            const CustomerModel = await getModel('Customer', payservedb.Customer.schema, facilityId);
            customer = await CustomerModel.findById(customerId)
                .select('customerNumber firstName lastName fullName name email phoneNumber phone unitId address preferences idNumber')
                .lean();
            console.log(`Customer from facility DB (${facilityId}) for ID ${customerId}:`, customer);
        } catch (facilityDbError) {
            console.log(`Failed to get customer from facility DB:`, facilityDbError.message);
        }

        // If not found in facility DB, try main database
        if (!customer) {
            customer = await payservedb.Customer.findById(customerId)
                .select('customerNumber firstName lastName fullName name email phoneNumber phone unitId address preferences idNumber')
                .lean();
            console.log(`Customer from main DB for ID ${customerId}:`, customer);
        }

        if (!customer) {
            return reply.code(404).send({
                success: false,
                error: 'Customer not found'
            });
        }

        // Format customer data
        const formattedCustomer = {
            _id: customer._id,
            customerNumber: customer.customerNumber,
            firstName: customer.firstName,
            lastName: customer.lastName,
            fullName: customer.fullName || customer.name || `${customer.firstName} ${customer.lastName}`,
            name: customer.fullName || customer.name || `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phoneNumber || customer.phone,
            phoneNumber: customer.phoneNumber || customer.phone,
            unitId: customer.unitId,
            address: customer.address,
            preferences: customer.preferences,
            idNumber: customer.idNumber
        };

        logger.info(`Agent ${agent.agent?.agent_id} retrieved customer ${customerId}`);

        return reply.code(200).send({
            success: true,
            data: formattedCustomer
        });

    } catch (error) {
        logger.error(`Error retrieving customer: ${error.message}`);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve customer'
        });
    }
}

module.exports = get_customer;