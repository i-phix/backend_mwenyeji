const db = require('payservedb');

const clean = (value) => String(value || '').trim();

const toId = (value) => {
    if (!value) return null;
    return value._id || value.id || value;
};

const dateAtLocalDay = (date) => {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return d;
};

const rowDate = (row, type) => {
    if (type === 'viewing') return dateAtLocalDay(row.scheduledDate || row.createdAt);
    if (type === 'reservation') return dateAtLocalDay(row.desiredMoveInDate || row.expiresAt || row.createdAt);
    return dateAtLocalDay(row.desiredMoveInDate || row.createdAt);
};

const matchesDay = (row, type, day) => {
    if (!day || day === 'All') return true;
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const d = rowDate(row, type);
    return d ? days[d.getDay()] === String(day).toLowerCase().slice(0, 3) : false;
};

const matchesDate = (row, type, date) => {
    if (!date) return true;
    const d = rowDate(row, type);
    if (!d) return false;
    return d.toISOString().slice(0, 10) === String(date).slice(0, 10);
};

const searchMatches = (row, search) => {
    const q = clean(search).toLowerCase();
    if (!q) return true;
    return [
        row.tenantName,
        row.tenantEmail,
        row.tenantPhone,
        row.landlordName,
        row.landlordEmail,
        row.unitName,
        row.facilityName,
        row.locationText,
    ].some((value) => clean(value).toLowerCase().includes(q));
};

const upcomingSort = (type) => (a, b) => {
    const now = Date.now();
    const ad = rowDate(a, type);
    const bd = rowDate(b, type);
    const at = ad ? ad.getTime() : 0;
    const bt = bd ? bd.getTime() : 0;
    const af = at >= now;
    const bf = bt >= now;
    if (af !== bf) return af ? -1 : 1;
    if (af && bf) return at - bt;
    return bt - at;
};

const createdDescSort = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

async function landlordById(landlordId) {
    const id = toId(landlordId);
    if (!id) return null;
    return db.moveIn.MoveInLandlordUser.findById(id)
        .select('fullName email phoneNumber companyName payserveUserId')
        .lean()
        .catch(() => null);
}

async function unitById(unitId) {
    const id = toId(unitId);
    if (!id) return null;
    return db.moveIn.MoveInUnit.findById(id)
        .select('title facilityName source sourceFacilityId sourceUnitId landlordId location price listingType bedrooms bathrooms moveInStatus moveInApproval isListed')
        .lean()
        .catch(() => null);
}

function locationText(unit, row) {
    const location = unit?.location || {};
    return [
        location.area,
        location.city,
        location.county,
        location.address,
        row.facilityName || unit?.facilityName,
    ].filter(Boolean).join(', ');
}

async function reminderSummary(relatedType, ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
    if (!uniqueIds.length || !db.moveIn.MoveInReminder) return {};
    const reminders = await db.moveIn.MoveInReminder.find({
        relatedType,
        relatedId: { $in: uniqueIds },
    })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => []);

    return reminders.reduce((acc, reminder) => {
        const key = String(reminder.relatedId);
        if (!acc[key]) acc[key] = [];
        acc[key].push(reminder);
        return acc;
    }, {});
}

async function enrichRows(rows, relatedType) {
    const unitIds = [...new Set(rows.map((row) => String(row.unitId || '')).filter(Boolean))];
    const landlordIds = [...new Set(rows.map((row) => String(row.landlordId || '')).filter(Boolean))];

    const [units, landlords, remindersById] = await Promise.all([
        Promise.all(unitIds.map(unitById)),
        Promise.all(landlordIds.map(landlordById)),
        reminderSummary(relatedType, rows.map((row) => row._id)),
    ]);

    const unitMap = new Map(units.filter(Boolean).map((unit) => [String(unit._id), unit]));
    const landlordMap = new Map(landlords.filter(Boolean).map((landlord) => [String(landlord._id), landlord]));

    return rows.map((row) => {
        const unit = unitMap.get(String(row.unitId || '')) || null;
        const landlord = landlordMap.get(String(row.landlordId || '')) || null;
        const reminders = remindersById[String(row._id)] || [];
        return {
            ...row,
            landlordName: landlord?.fullName || row.landlordName || null,
            landlordEmail: landlord?.email || row.landlordEmail || null,
            landlordPhone: landlord?.phoneNumber || row.landlordPhone || null,
            landlordCompanyName: landlord?.companyName || null,
            unitDetails: unit,
            facilityName: row.facilityName || unit?.facilityName || null,
            locationText: locationText(unit, row),
            reminderCount: reminders.length,
            lastReminderAt: reminders[0]?.sentAt || reminders[0]?.createdAt || null,
            reminders,
        };
    });
}

async function filterSortPaginate({ model, relatedType, baseFilter, query, defaultLimit = 30 }) {
    const { status = 'All', search = '', day = 'All', date = '', sort = 'upcoming', page = 1, limit = defaultLimit } = query || {};
    const filter = { ...(baseFilter || {}) };
    if (status && status !== 'All') filter.status = status;

    let rows = await model.find(filter).sort({ createdAt: -1 }).lean();
    rows = await enrichRows(rows, relatedType);
    rows = rows.filter((row) => searchMatches(row, search) && matchesDay(row, relatedType, day) && matchesDate(row, relatedType, date));
    rows.sort(sort === 'created' ? createdDescSort : upcomingSort(relatedType));

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || defaultLimit);
    const total = rows.length;
    const data = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    return { data, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } };
}

module.exports = {
    enrichRows,
    filterSortPaginate,
};
