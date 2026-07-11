const jwt = require("jsonwebtoken");
const payservedb = require("payservedb");

// MongoDB-backed audit trails (stored in the default payserve_property connection).
// Replaces the previous PostgreSQL implementation — no separate database needed.
const AuditTrail = payservedb.AuditTrail;

// Extract user details from JWT token
const extractUserDetails = (authHeader) => {
    try {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        const token = authHeader.split(" ")[1];
        // Decode without verification for audit purposes
        const decoded = jwt.decode(token);

        return {
            userId: decoded?.userId || null,
            email: decoded?.email || null,
            fullName: decoded?.fullName || null,
            role: decoded?.role || null,
            phoneNumber: decoded?.phoneNumber || null,
            facilityId: decoded?.facilityId || null,
            permissions: decoded?.permissions || null,
            tokenExpiry: decoded?.exp ? new Date(decoded.exp * 1000) : null,
            tokenIssued: decoded?.iat ? new Date(decoded.iat * 1000) : null,
        };
    } catch (error) {
        console.error("Error extracting user details from JWT:", error);
        return null;
    }
};

// The AuditTrail schema requires userId/email/fullName/role when user_details
// is present — only persist it when those are available.
const sanitizeUserDetails = (details) => {
    if (!details) return undefined;
    if (details.userId && details.email && details.fullName && details.role) {
        return details;
    }
    return undefined;
};

// Extract platform information from request headers
const extractPlatform = (request) => {
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const host = request.headers.host;

    // Priority: origin > referer > host
    if (origin) {
        try {
            return new URL(origin).hostname;
        } catch (e) {
            return origin;
        }
    }

    if (referer) {
        try {
            return new URL(referer).hostname;
        } catch (e) {
            return referer;
        }
    }

    return host || "unknown";
};

// Extract device and browser information from user agent
const extractDeviceInfo = (userAgent) => {
    if (!userAgent) {
        return { browser: "unknown", os: "unknown", device: "unknown" };
    }

    let browser = "unknown";
    let os = "unknown";
    let device = "desktop";

    // Browser detection
    if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";
    else if (userAgent.includes("Opera")) browser = "Opera";

    // OS detection
    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "macOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iOS")) os = "iOS";

    // Device type detection
    if (userAgent.includes("Mobile")) device = "mobile";
    else if (userAgent.includes("Tablet")) device = "tablet";

    return { browser, os, device };
};

// Set to track recent audits and prevent duplicates
const recentAudits = new Set();

// Main audit trail function
const audit_trail = async (request, additional_data = {}) => {
    try {
        const requestId = request.id;
        const activity = additional_data.activity || "unknown";

        // Create unique identifier for this audit
        const auditKey = `${requestId}-${activity}-${request.method}-${request.url}`;

        // Check if we've already audited this exact request
        if (recentAudits.has(auditKey)) {
            console.log(
                `⚠️ DUPLICATE AUDIT PREVENTED: ${activity} for request ${requestId}`,
            );
            return null;
        }

        // Add to recent audits set
        recentAudits.add(auditKey);

        // Clean up old entries every 100 requests to prevent memory leaks
        if (recentAudits.size > 100) {
            const keysToDelete = Array.from(recentAudits).slice(0, 50);
            keysToDelete.forEach((key) => recentAudits.delete(key));
        }

        // Extract basic request information
        const timestamp = new Date();
        const method = request.method;
        const url = request.url;
        const ip_address =
            request.ip ||
            request.headers["x-forwarded-for"] ||
            request.headers["x-real-ip"] ||
            request.socket?.remoteAddress ||
            "unknown";

        // Extract authorization status and user details
        const authHeader = request.headers.authorization;
        const is_authorized = !!authHeader;
        const user_details = extractUserDetails(authHeader);

        // Extract device and browser information
        const userAgent = request.headers["user-agent"] || "";
        const device_info = extractDeviceInfo(userAgent);

        // Extract platform information
        const platform = extractPlatform(request);

        // Extract request data for POST, PUT, and PATCH methods
        let request_data = null;
        if (["POST", "PUT", "PATCH"].includes(method)) {
            request_data = request.body || null;
        }

        // Build audit log object
        const audit_log = {
            timestamp,
            method,
            url,
            ip_address,
            platform,
            is_authorized,
            user_details,
            browser: device_info.browser,
            operating_system: device_info.os,
            device_type: device_info.device,
            user_agent: userAgent,
            request_data,
            query_params: request.query || {},
            route_params: request.params || {},
            activity,
            previous_data:
                (method === "PUT" || method === "PATCH") && additional_data.previous_data
                    ? additional_data.previous_data
                    : null,
            deleted_data:
                method === "DELETE" && additional_data.deleted_data
                    ? additional_data.deleted_data
                    : null,
            custom_data: additional_data.custom_data || null,
            request_id: request.id || null,
        };

        console.log(
            `🔍 AUDIT: ${activity} | ${method} ${url} | ip=${ip_address} | user=${user_details?.email || "anonymous"}`,
        );

        // Save to MongoDB if enabled (default: true)
        if (additional_data.save_to_db !== false) {
            try {
                const doc = await AuditTrail.create({
                    ...audit_log,
                    user_details: sanitizeUserDetails(user_details),
                });
                console.log(`💾 Audit trail saved to MongoDB: ${doc._id}`);
            } catch (db_error) {
                console.error("❌ Failed to save audit trail to MongoDB:", db_error);
                // Don't throw error here to avoid breaking the main application flow
            }
        }

        return audit_log;
    } catch (error) {
        console.error("❌ Error in audit_trail function:", error);

        // Return minimal audit log in case of error
        const minimal_log = {
            timestamp: new Date(),
            activity: additional_data?.activity || "unknown",
            method: request?.method || "unknown",
            url: request?.url || "unknown",
            ip_address: request?.ip || "unknown",
            is_authorized: false,
            user_details: null,
            browser: "unknown",
            operating_system: "unknown",
            device_type: "unknown",
            user_agent: "",
            request_data: null,
            query_params: {},
            route_params: {},
            previous_data: null,
            deleted_data: null,
            custom_data: {
                error: "Failed to create complete audit log",
                error_message: error.message,
            },
            request_id: request?.id || null,
            platform: "unknown",
        };

        if (additional_data.save_to_db !== false) {
            try {
                await AuditTrail.create({
                    ...minimal_log,
                    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(minimal_log.method)
                        ? minimal_log.method
                        : "GET",
                    user_details: undefined,
                });
                console.log("💾 Minimal audit trail saved to MongoDB");
            } catch (db_error) {
                console.error("❌ Failed to save minimal audit trail:", db_error);
            }
        }

        return minimal_log;
    }
};

// Build a MongoDB query object from API filters
const buildQueryFromFilters = (filters = {}) => {
    const {
        activity,
        userId,
        facilityId,
        method,
        platform,
        startDate,
        endDate,
        isAuthorized,
        browser,
        operatingSystem,
        deviceType,
        ipAddress,
    } = filters;

    const query = {};

    if (activity) query.activity = { $regex: activity, $options: "i" };
    if (userId) query["user_details.userId"] = userId;
    if (facilityId) query["user_details.facilityId"] = facilityId;
    if (method) query.method = method.toUpperCase();
    if (platform) query.platform = { $regex: platform, $options: "i" };
    if (browser) query.browser = { $regex: browser, $options: "i" };
    if (operatingSystem)
        query.operating_system = { $regex: operatingSystem, $options: "i" };
    if (deviceType) query.device_type = { $regex: deviceType, $options: "i" };
    if (ipAddress) query.ip_address = ipAddress;

    if (isAuthorized !== undefined) {
        query.is_authorized = isAuthorized === "true" || isAuthorized === true;
    }

    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    return query;
};

// Function to get audit logs with filtering and pagination
const getAuditLogs = async (filters = {}) => {
    try {
        const {
            page = 1,
            limit = 50,
            sortBy = "timestamp",
            sortOrder = "DESC",
        } = filters;

        const query = buildQueryFromFilters(filters);

        // Validate sort column
        const validSortColumns = [
            "timestamp", "activity", "method", "platform", "is_authorized",
            "browser", "operating_system", "device_type", "ip_address",
        ];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "timestamp";
        const sortDirection = sortOrder.toUpperCase() === "ASC" ? 1 : -1;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const [logs, totalCount] = await Promise.all([
            AuditTrail.find(query)
                .sort({ [sortColumn]: sortDirection })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            AuditTrail.countDocuments(query),
        ]);

        const totalPages = Math.ceil(totalCount / limitNum);

        const parsedLogs = logs.map((log) => ({
            ...log,
            id: log._id,
            user_details: log.user_details || null,
            request_data: log.request_data || null,
            query_params: log.query_params || {},
            route_params: log.route_params || {},
            previous_data: log.previous_data || null,
            deleted_data: log.deleted_data || null,
            custom_data: log.custom_data || null,
        }));

        return {
            success: true,
            data: parsedLogs,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalCount,
                limit: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPreviousPage: pageNum > 1,
            },
            filters: {
                ...filters,
                sortBy: sortColumn,
                sortOrder: sortDirection === 1 ? "ASC" : "DESC",
            },
        };
    } catch (error) {
        console.error("❌ Error getting audit logs:", error);
        return {
            success: false,
            error: error.message,
            data: [],
            pagination: {
                currentPage: 1,
                totalPages: 0,
                totalCount: 0,
                limit: parseInt(filters.limit) || 50,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        };
    }
};

// Function to get a single audit log by ID
const getAuditLogById = async (logId) => {
    try {
        const log = await AuditTrail.findById(logId).lean();
        if (!log) {
            return { success: false, notFound: true, error: "Audit log not found" };
        }
        return {
            success: true,
            data: {
                ...log,
                id: log._id,
                user_details: log.user_details || null,
                request_data: log.request_data || null,
                query_params: log.query_params || {},
                route_params: log.route_params || {},
                previous_data: log.previous_data || null,
                deleted_data: log.deleted_data || null,
                custom_data: log.custom_data || null,
            },
        };
    } catch (error) {
        console.error("❌ Error getting audit log by id:", error);
        return { success: false, error: error.message };
    }
};

// Function to get audit log statistics
const getAuditStats = async (filters = {}) => {
    try {
        const query = buildQueryFromFilters(filters);

        const [result] = await AuditTrail.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    total_logs: { $sum: 1 },
                    authorized_requests: {
                        $sum: { $cond: [{ $eq: ["$is_authorized", true] }, 1, 0] },
                    },
                    unauthorized_requests: {
                        $sum: { $cond: [{ $eq: ["$is_authorized", false] }, 1, 0] },
                    },
                    unique_ips: { $addToSet: "$ip_address" },
                    unique_users: { $addToSet: "$user_details.userId" },
                    get_requests: { $sum: { $cond: [{ $eq: ["$method", "GET"] }, 1, 0] } },
                    post_requests: { $sum: { $cond: [{ $eq: ["$method", "POST"] }, 1, 0] } },
                    put_requests: { $sum: { $cond: [{ $eq: ["$method", "PUT"] }, 1, 0] } },
                    delete_requests: { $sum: { $cond: [{ $eq: ["$method", "DELETE"] }, 1, 0] } },
                    patch_requests: { $sum: { $cond: [{ $eq: ["$method", "PATCH"] }, 1, 0] } },
                },
            },
        ]);

        const stats = result || {
            total_logs: 0,
            authorized_requests: 0,
            unauthorized_requests: 0,
            unique_ips: [],
            unique_users: [],
            get_requests: 0,
            post_requests: 0,
            put_requests: 0,
            delete_requests: 0,
            patch_requests: 0,
        };

        return {
            success: true,
            stats: {
                totalLogs: stats.total_logs,
                authorizedRequests: stats.authorized_requests,
                unauthorizedRequests: stats.unauthorized_requests,
                uniqueIPs: (stats.unique_ips || []).filter(Boolean).length,
                uniqueUsers: (stats.unique_users || []).filter(Boolean).length,
                methodBreakdown: {
                    GET: stats.get_requests,
                    POST: stats.post_requests,
                    PUT: stats.put_requests,
                    DELETE: stats.delete_requests,
                    PATCH: stats.patch_requests,
                },
            },
        };
    } catch (error) {
        console.error("❌ Error getting audit statistics:", error);
        return {
            success: false,
            error: error.message,
            stats: null,
        };
    }
};

// Backward-compatible no-ops (previous PostgreSQL implementation)
const initializeDatabase = async () => { };
const closePool = async () => { };
const getPool = () => {
    throw new Error(
        "Audit trails now use MongoDB — use getAuditLogs/getAuditLogById instead of getPool()",
    );
};

module.exports = {
    audit_trail,
    extractUserDetails,
    extractPlatform,
    extractDeviceInfo,
    getPool,
    closePool,
    initializeDatabase,
    getAuditLogs,
    getAuditLogById,
    getAuditStats,
};
