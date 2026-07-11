const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Get Properties and Units for External Booking API
 * Returns all listed booking properties and their available units
 */
const get_properties = async (request, reply) => {
    try {
        // Get facility ID from query parameter (since API is open, no auth required)
        const facilityId = request.query.facility_id;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Missing facility ID',
                message: 'Please provide facility_id as a query parameter'
            });
        }

        // Get models
        const BookingProperty = await getModel('BookingProperty', payservedb.BookingProperty.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);
        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);

        // Fetch all listed booking properties
        const properties = await BookingProperty.find({
            isListed: true,
            status: 'active'
        })
            .select('propertyName propertyType basePrice currencyId amenities images description location')
            .lean();

        if (!properties || properties.length === 0) {
            return reply.code(200).send({
                success: true,
                message: 'No properties found',
                data: []
            });
        }

        // Fetch all units associated with these properties
        const propertyIds = properties.map(p => p._id);

        const units = await Unit.find({
            bookingProperty: { $in: propertyIds }
        })
            .select('name unitType floorUnitNo division bookingProperty amenities maxOccupancy')
            .lean();

        // Fetch currencies
        const currencyIds = [...new Set(properties.map(p => p.currencyId).filter(Boolean))];
        const currencies = await Currency.find({
            _id: { $in: currencyIds }
        }).lean();

        // Create currency lookup map
        const currencyMap = {};
        currencies.forEach(curr => {
            currencyMap[curr._id.toString()] = {
                code: curr.currencyShortCode,
                name: curr.currencyName,
                exchange_rate: curr.exchangeRate
            };
        });

        // Group units by property
        const propertyUnitsMap = {};
        units.forEach(unit => {
            const propId = unit.bookingProperty.toString();
            if (!propertyUnitsMap[propId]) {
                propertyUnitsMap[propId] = [];
            }
            propertyUnitsMap[propId].push(unit);
        });

        // Format response
        const formattedProperties = properties.map(property => {
            const propertyUnits = propertyUnitsMap[property._id.toString()] || [];
            const currency = currencyMap[property.currencyId?.toString()] || { code: 'USD', name: 'US Dollar', exchange_rate: 1 };

            return {
                property_id: property._id.toString(),
                property_name: property.propertyName,
                property_type: property.propertyType,
                description: property.description || '',
                location: property.location || {},
                amenities: property.amenities || [],
                images: property.images || [],
                base_price: property.basePrice || 0,
                currency: currency.code,
                currency_details: {
                    code: currency.code,
                    name: currency.name,
                    exchange_rate: currency.exchange_rate
                },
                units: propertyUnits.map(unit => ({
                    unit_id: unit._id.toString(),
                    unit_name: unit.name,
                    unit_type: unit.unitType,
                    floor_unit_no: unit.floorUnitNo || '',
                    division: unit.division || '',
                    max_occupancy: {
                        adults: unit.maxOccupancy?.adults || 2,
                        children: unit.maxOccupancy?.children || 2,
                        total: (unit.maxOccupancy?.adults || 2) + (unit.maxOccupancy?.children || 2)
                    },
                    amenities: unit.amenities || []
                }))
            };
        });

        return reply.code(200).send({
            success: true,
            message: `Retrieved ${formattedProperties.length} properties`,
            data: formattedProperties,
            meta: {
                total_properties: formattedProperties.length,
                total_units: units.length,
                facility_id: facilityId
            }
        });

    } catch (error) {
        console.error('Error in get_properties (external API):', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: 'An error occurred while fetching properties'
        });
    }
};

module.exports = get_properties;
