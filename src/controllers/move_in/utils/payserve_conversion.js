const db = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const { ensureCommissionDue } = require('./lifecycle');

const clean = (value) => String(value || '').trim();
const normalizeEmail = (value) => clean(value).toLowerCase();

function splitName(name, fallbackEmail) {
    const parts = clean(name).split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        const local = normalizeEmail(fallbackEmail).split('@')[0] || 'MoveIn';
        return { firstName: local, lastName: 'Tenant' };
    }
    if (parts.length === 1) return { firstName: parts[0], lastName: 'Tenant' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function phoneForPayServe(phone) {
    const digits = clean(phone).replace(/\D/g, '');
    return digits ? digits.slice(-9) : `7${String(Date.now()).slice(-8)}`;
}

async function nextCustomerNumber() {
    const latest = await db.Customer.findOne({}).sort({ customerNumber: -1 }).select('customerNumber').lean();
    return Number(latest?.customerNumber || 10000) + 1;
}

async function ensurePayServeTenant({ deal, facilityId, nationalId }) {
    const email = normalizeEmail(deal.tenantEmail);
    const phoneNumber = phoneForPayServe(deal.tenantPhone);

    let tenant = await db.Customer.findOne({
        facilityId,
        $or: [
            ...(email ? [{ email }] : []),
            { phoneNumber },
        ],
    });

    if (tenant) return tenant;

    const name = splitName(deal.tenantName, email);
    tenant = await db.Customer.create({
        customerNumber: await nextCustomerNumber(),
        firstName: name.firstName,
        lastName: name.lastName,
        email: email || `movein-${deal._id}@payserve.local`,
        phoneNumber,
        idNumber: clean(nationalId) || `MOVEIN-${String(deal._id).slice(-10)}`,
        customerType: 'tenant',
        residentType: 'resident',
        facilityId,
        status: 'Active',
        combineInvoices: false,
    });

    return tenant;
}

function monthDiff(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, months || 1);
}

async function createLeaseIfReady({ deal, unit, tenant, facilityId, actorId, lease }) {
    const leaseTemplateId = lease?.leaseTemplateId;
    const currencyId = lease?.currencyId;
    const startDate = lease?.startDate || deal.agreedMoveInDate || deal.desiredMoveInDate;
    const endDate = lease?.endDate;

    if (!leaseTemplateId || !currencyId || !startDate || !endDate) {
        return {
            lease: null,
            status: 'pending',
            reason: 'Lease draft not created. currencyId, leaseTemplateId, startDate and endDate are required.',
        };
    }

    const LeaseAgreement = await getModel('LeaseAgreement', db.LeaseAgreement.schema, facilityId);
    const existing = await LeaseAgreement.findOne({
        unitNumber: unit._id,
        tenant: tenant._id,
        status: { $in: ['Active', 'Pending'] },
    });
    if (existing) {
        return { lease: existing, status: 'existing', reason: null };
    }

    const monthlyRent = Number(lease.monthlyRent || deal.agreedRentAmount || unit.moveInPrice || 0);
    const leaseDoc = await LeaseAgreement.create({
        facilityId,
        currency: currencyId,
        unitNumber: unit._id,
        tenant: tenant._id,
        landlord: unit.homeOwnerId,
        leaseTemplate: leaseTemplateId,
        leaseTerms: {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            duration: Number(lease.duration || monthDiff(startDate, endDate)),
            autoRenewal: !!lease.autoRenewal,
        },
        isNewTenant: true,
        financialTerms: {
            monthlyRent,
            paymentDueDate: Number(lease.paymentDueDate || 1),
            paymentMethods: Array.isArray(lease.paymentMethods) && lease.paymentMethods.length
                ? lease.paymentMethods
                : [{ type: 'Cash', details: { preferredCashLocation: 'Property office' }, isPrimary: true }],
            securityDeposit: Number(lease.securityDeposit || monthlyRent || 0),
            balanceBroughtForward: Number(lease.balanceBroughtForward || 0),
            taxEnabled: !!lease.taxEnabled,
            enabledTaxes: lease.enabledTaxes || [],
            escalations: lease.escalations || [],
        },
        billingCycle: {
            frequency: lease.billingFrequency || 'Monthly',
            nextInvoiceDate: lease.nextInvoiceDate ? new Date(lease.nextInvoiceDate) : new Date(startDate),
            autoSend: !!lease.autoSend,
        },
        status: lease.status || 'Pending',
        requireLandlordApproval: !!lease.requireLandlordApproval,
        createdBy: actorId || null,
        editHistory: [{
            editedBy: actorId || null,
            reason: 'Created from Move-In conversion',
            changes: { moveInDealId: deal._id },
        }],
    });

    return { lease: leaseDoc, status: 'created', reason: null };
}

async function convertDealToPayServeRental({ dealId, actorId, body = {} }) {
    const deal = await db.moveIn.MoveInDeal.findById(dealId);
    if (!deal) {
        const error = new Error('Move-In deal not found.');
        error.statusCode = 404;
        throw error;
    }

    if (deal.source !== 'payserve') {
        deal.payserveSync = deal.payserveSync || {};
        deal.status = 'rented';
        deal.lastEvent = 'standalone_rental_confirmed';
        deal.payserveSync.status = 'not_applicable';
        await deal.save();
        const commission = await ensureCommissionDue(deal, {
            baseAmount: deal.agreedRentAmount,
            notes: `Commission generated from standalone deal ${deal._id}.`,
        });
        return { deal, tenant: null, unit: null, lease: null, commission, leaseStatus: 'not_applicable' };
    }

    const facilityId = body.facilityId || deal.sourceFacilityId;
    const unitId = body.unitId || deal.sourceUnitId || deal.unitId;
    if (!facilityId || !unitId) {
        const error = new Error('facilityId and unitId are required for PayServe conversion.');
        error.statusCode = 400;
        throw error;
    }

    const UnitModel = await getModel('Unit', db.Unit.schema, facilityId);
    const unit = await UnitModel.findById(unitId);
    if (!unit) {
        const error = new Error('PayServe unit not found.');
        error.statusCode = 404;
        throw error;
    }
    if (!unit.homeOwnerId) {
        const error = new Error('PayServe unit has no landlord/home owner assigned.');
        error.statusCode = 400;
        throw error;
    }
    if (unit.tenantId && String(unit.tenantId) !== String(body.existingTenantId || '')) {
        const error = new Error('PayServe unit already has a tenant assigned.');
        error.statusCode = 409;
        throw error;
    }

    const tenant = body.existingTenantId
        ? await db.Customer.findById(body.existingTenantId)
        : await ensurePayServeTenant({ deal, facilityId, nationalId: body.nationalId });
    if (!tenant) {
        const error = new Error('PayServe tenant could not be resolved.');
        error.statusCode = 404;
        throw error;
    }

    unit.tenantId = tenant._id;
    unit.residentId = tenant._id;
    unit.listedInMoveIn = false;
    unit.moveInStatus = 'rented';
    unit.moveInLastSyncedAt = new Date();
    await unit.save();

    let leaseResult = { lease: null, status: 'pending', reason: 'Lease data was not supplied.' };
    try {
        leaseResult = await createLeaseIfReady({
            deal,
            unit,
            tenant,
            facilityId,
            actorId,
            lease: body.lease || {},
        });
    } catch (err) {
        leaseResult = { lease: null, status: 'failed', reason: err.message };
    }

    deal.payserveSync = deal.payserveSync || {};
    deal.status = 'rented';
    deal.lastEvent = 'payserve_rental_converted';
    deal.payserveSync.status = leaseResult.status === 'failed'
        ? 'failed'
        : (leaseResult.status === 'pending' ? 'pending' : 'synced');
    deal.payserveSync.residentId = tenant._id;
    deal.payserveSync.leaseId = leaseResult.lease?._id || null;
    deal.payserveSync.lastError = leaseResult.reason || null;
    deal.payserveSync.syncedAt = new Date();
    deal.notes = [deal.notes, body.notes].filter(Boolean).join('\n') || deal.notes;
    await deal.save();

    await db.moveIn.MoveInUnit.updateOne(
        { _id: deal.unitId },
        { $set: { moveInStatus: 'rented', isListed: false, activeDealId: deal._id } }
    ).catch(() => null);

    const commission = await ensureCommissionDue(deal, {
        baseAmount: body.commissionBaseAmount || deal.agreedRentAmount || unit.moveInPrice,
        ruleType: body.commissionRuleType || 'percentage_of_rent',
        ruleValue: body.commissionRuleValue ?? 10,
        payerType: body.commissionPayerType || 'landlord',
        notes: `Commission generated from PayServe conversion for deal ${deal._id}.`,
    });

    await db.moveIn.MoveInNotification.create({
        recipientId: deal.tenantId || null,
        recipientType: 'tenant',
        title: 'Rental Confirmed',
        body: `Your rental for ${deal.unitName || unit.name || 'the unit'} has been confirmed.`,
        type: 'handover',
        relatedId: deal._id,
    }).catch(() => null);

    return { deal, tenant, unit, lease: leaseResult.lease, commission, leaseStatus: leaseResult.status, leaseMessage: leaseResult.reason };
}

module.exports = {
    convertDealToPayServeRental,
};
