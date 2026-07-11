const db = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { ensureMoveInLandlordForPayServeUser } = require('../../landlord/move_in/context');

const clean = (value) => String(value || '').trim();

const toArray = (value) => {
    if (Array.isArray(value)) {
        return value.map(clean).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value.split(',').map(clean).filter(Boolean);
    }
    return [];
};

const toImageArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (typeof item === 'string') {
                return { url: clean(item), category: 'Other', label: '' };
            }
            return {
                url: clean(item?.url),
                category: clean(item?.category) || 'Other',
                label: clean(item?.label),
            };
        })
        .filter((item) => item.url);
};

const required = (value) => value !== undefined && value !== null && clean(value) !== '';

function buildCompleteness({ unit, facility }) {
    const checks = [
        { key: 'owner', label: 'Linked landlord', complete: !!unit.homeOwnerId },
        { key: 'price', label: 'Monthly price', complete: required(unit.moveInPrice) },
        { key: 'location', label: 'Location', complete: required(unit.moveInLocationAddress || facility?.location?.address || facility?.location?.city || facility?.name) },
        { key: 'description', label: 'Description', complete: required(unit.moveInDescription) },
        { key: 'photos', label: 'Photos', complete: Array.isArray(unit.moveInImages) && unit.moveInImages.length > 0 },
    ];
    const completed = checks.filter((item) => item.complete).length;
    return {
        completed,
        total: checks.length,
        percent: Math.round((completed / checks.length) * 100),
        missing: checks.filter((item) => !item.complete).map((item) => item.key),
        missingLabels: checks.filter((item) => !item.complete).map((item) => item.label),
    };
}

async function getFacilityAndUnit({ facilityId, unitId }) {
    const facility = await db.Facility.findById(facilityId).lean();
    if (!facility) {
        const error = new Error('Facility not found.');
        error.statusCode = 404;
        throw error;
    }

    const UnitModel = await getModel('Unit', db.Unit.schema, facilityId);
    const unit = unitId ? await UnitModel.findById(unitId) : null;
    if (unitId && !unit) {
        const error = new Error('Unit not found.');
        error.statusCode = 404;
        throw error;
    }

    return { facility, UnitModel, unit };
}

async function resolvePayServeLandlordForUnit({ facilityId, unit }) {
    if (!unit?.homeOwnerId) {
        const error = new Error('This unit has no linked landlord/home owner. Assign the unit owner before listing it on Move-In.');
        error.statusCode = 400;
        throw error;
    }

    const landlord = await db.User.findOne({
        type: 'Landlord',
        isEnabled: { $ne: false },
        customerData: {
            $elemMatch: {
                facilityId,
                customerId: unit.homeOwnerId,
                isEnabled: { $ne: false },
            },
        },
    }).select('_id fullName email phoneNumber type isEnabled').lean();

    if (!landlord) {
        const error = new Error('No active PayServe landlord account is linked to this unit owner. Link the landlord account before publishing this unit to Move-In.');
        error.statusCode = 400;
        throw error;
    }

    return ensureMoveInLandlordForPayServeUser(landlord._id);
}

function mapUnitForMoveIn({ unit, facility }) {
    const completeness = buildCompleteness({ unit, facility });
    return {
        ...unit,
        source: 'payserve',
        facilityId: facility._id,
        facilityName: facility.name,
        facilityLocation: facility.location || null,
        moveInLocationAddress: unit.moveInLocationAddress || facility.location?.address || '',
        moveInLocationCity: unit.moveInLocationCity || facility.location?.city || '',
        moveInLocationCounty: unit.moveInLocationCounty || facility.location?.county || '',
        moveInCoordinates: unit.moveInCoordinates || null,
        moveInApproval: unit.moveInApproval || null,
        moveInStatus: unit.moveInStatus || 'draft',
        listedInMoveIn: !!unit.listedInMoveIn,
        completeness,
    };
}

module.exports = {
    buildCompleteness,
    clean,
    getFacilityAndUnit,
    mapUnitForMoveIn,
    resolvePayServeLandlordForUnit,
    toArray,
    toImageArray,
};
