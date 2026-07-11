const authenticateJWT = require("../../../../middlewares/jwt_authentication");

// Stock and Spare Endpoints
const addStockOrSpare = require("../controllers/stock_and_spare/add_new_stock");
const editStockOrSpare = require("../controllers/stock_and_spare/edit_stock");
const deleteStockOrSpare = require("../controllers/stock_and_spare/delete_stock");
const getAllStocksOrSpares = require("../controllers/stock_and_spare/get_facility_stocks");
const getStocksOrSpare = require("../controllers/stock_and_spare/get_stock");
const incrementStock = require("../controllers/stock_and_spare/increment_stock");
const decrementStock = require("../controllers/stock_and_spare/decrement_stock");
const getStockHistory = require("../controllers/stock_and_spare/get_stock_history");
const addStockRequisition = require("../controllers/stock_requisition/add_stock_requisition");
const getStockRequisition = require("../controllers/stock_requisition/get_stock_requisition_info");
const getStockRequisitions = require("../controllers/stock_requisition/get_all_stock_requisitions");

// Duty Roster Endpoints
const addDutyRoster = require("../controllers/duty_roster/add_duty_roster");
const editDutyRoster = require("../controllers/duty_roster/edit_duty_roster");
const deleteDutyRoster = require("../controllers/duty_roster/delete_duty_roster");
const getAllDutyRoster = require("../controllers/duty_roster/get_all_duty_roster");
const getDutyRoster = require("../controllers/duty_roster/get_duty_roster");

// Asset Endpoints
const addAsset = require("../controllers/assets/add_new_asset");
const editAsset = require("../controllers/assets/edit_asset");
const deleteAsset = require("../controllers/assets/delete_asset");
const getAssets = require("../controllers/assets/get_facility_assets");
const getAsset = require("../controllers/assets/get_asset");
const {
  updateAssignedStatus,
  updateMultipleAssignedStatus,
} = require("../controllers/assets/update_assigned_status");

// Inspection Certificate Endpoints
const {
  addInspectionCertificate,
  editInspectionCertificate,
  deleteInspectionCertificate,
  getInspectionCertificates,
  getInspectionCertificate,
  getAssetsByInspectionStatus,
  getInspectionAlerts,
  getInspectionStatistics,
} = require("../controllers/assets/inspection_certificates");

const {
  addDocument,
  editDocument,
  deleteDocument,
  getDocuments,
  getDocument,
  getAssetsByDocumentType,
  getDocumentStatistics,
} = require("../controllers/assets/documents");

// Service Vendor Endpoints
const addServiceVendor = require("../controllers/service_vendor/add_service_vendor");
const editServiceVendor = require("../controllers/service_vendor/edit_service_vendor");
const deleteServiceVendor = require("../controllers/service_vendor/delete_service_vendor");
const getAllServiceVendors = require("../controllers/service_vendor/get_all_service_vendors");
const getServiceVendor = require("../controllers/service_vendor/get_service_vendor");

// Maintenance Service Endpoints
const addMaintenanceService = require("../controllers/maintenance_service/add_maintenance_service");
const editMaintenanceService = require("../controllers/maintenance_service/update_maintenance_service");
const deleteMaintenanceService = require("../controllers/maintenance_service/delete_maintenance_service");
const getAllMaintenanceServices = require("../controllers/maintenance_service/get_all_maintenance_services");
const getMaintenanceService = require("../controllers/maintenance_service/get_maintenance_service");

// Requisition Endpoints
const addRequisition = require("../controllers/stock_requisition/add_requisition");
const editRequisition = require("../controllers/stock_requisition/edit_requisition");
const deleteRequisition = require("../controllers/stock_requisition/delete_requisition");
const getAllRequisitions = require("../controllers/stock_requisition/get_all_requisitions");
const getRequisition = require("../controllers/stock_requisition/get_stock_requisition");

// Work Order Endpoints
const addWorkOrder = require("../controllers/work_order/add_work_order");
const editWorkOrder = require("../controllers/work_order/edit_work_order");
const deleteWorkOrder = require("../controllers/work_order/delete_work_order");
const getAllWorkOrders = require("../controllers/work_order/get_all_work_orders");
const getWorkOrder = require("../controllers/work_order/get_work_order");

// WorkPlan Endpoints
// Master
const {
  createMasterWorkplan,
  updateMasterWorkplan,
  deleteMasterWorkplan,
  getMasterWorkplan,
  getMasterWorkplans,
} = require("../controllers/workplan/master_workplan");

// Child
const {
  createChildWorkplan,
  updateChildWorkplan,
  deleteChildWorkplan,
  getChildWorkplan,
  getChildWorkplans,
  getChildWorkplansByParent,
  updateChildWorkplanStatus,
} = require("../controllers/workplan/child_workplan");

const {
  getDutyRosterChecklist,
  getDutyRosterChecklists,
  getChecklistByDutyRoster,
  updateTaskStatus,
  addTaskToChecklist,
  removeTaskFromChecklist,
  getTodaysTasks,
  getChecklistAnalytics,
  createMissingChecklist,
} = require("../controllers/duty_roster_checklist");

// Daily Checklist imports
const {
  createParent,
  getDailyChecklist,
  getParentData,
  addReading,
  getReadingHistory,
  updateReading,
  deleteReading,
  getCurrentValues,
} = require("../controllers/daily_checklist");

async function registerRoutes(fastify) {
  const jwt = { preHandler: authenticateJWT };

  // Base Routes
  const stockBaseRoute = "/api/stockandspare";
  const dutyRosterBaseRoute = "/api/duty_roster";
  const dutyRosterChecklistBaseRoute = "/api/duty_roster_checklist";
  const assetBaseRoute = "/api/assets";
  const serviceVendorBaseRoute = "/api/service_vendor";
  const maintenanceServiceBaseRoute = "/api/maintenance_service";
  const requisitionBaseRoute = "/api/stock_requisition";
  const workOrderBaseRoute = "/api/work_order";
  const workPlanBaseRoute = "/api/work_plan";
  const dailyChecklistBaseRoute = "/api/daily_checklist";

  // Stock Routes
  fastify.post(`${stockBaseRoute}/:facilityId`, jwt, addStockOrSpare);
  fastify.put(`${stockBaseRoute}/:facilityId/:stockId`, jwt, editStockOrSpare);
  fastify.delete(
    `${stockBaseRoute}/:facilityId/:stockId`,
    jwt,
    deleteStockOrSpare,
  );
  fastify.get(`${stockBaseRoute}/:facilityId`, jwt, getAllStocksOrSpares);
  fastify.get(`${stockBaseRoute}/:facilityId/:stockId`, jwt, getStocksOrSpare);
  fastify.post(
    `${stockBaseRoute}/:facilityId/:stockId/increment`,
    jwt,
    incrementStock,
  );
  fastify.post(
    `${stockBaseRoute}/:facilityId/:stockId/decrement`,
    jwt,
    decrementStock,
  );
  fastify.get(
    `${stockBaseRoute}/:facilityId/:stockId/history`,
    jwt,
    getStockHistory,
  );
  // Stock Requisition Routes
  fastify.post(
    `${stockBaseRoute}/:facilityId/requisition`,
    jwt,
    addStockRequisition,
  );
  fastify.get(
    `${stockBaseRoute}/:facilityId/:stockId/requisition`,
    jwt,
    getStockRequisition,
  );
  fastify.get(
    `${stockBaseRoute}/:facilityId/requisition`,
    jwt,
    getStockRequisitions,
  );

  // Duty Roster Routes
  fastify.post(`${dutyRosterBaseRoute}/:facilityId`, jwt, addDutyRoster);
  fastify.put(
    `${dutyRosterBaseRoute}/:facilityId/:rosterId`,
    jwt,
    editDutyRoster,
  );
  fastify.delete(
    `${dutyRosterBaseRoute}/:facilityId/:rosterId`,
    jwt,
    deleteDutyRoster,
  );
  fastify.get(`${dutyRosterBaseRoute}/:facilityId`, jwt, getAllDutyRoster);
  fastify.get(
    `${dutyRosterBaseRoute}/:facilityId/:rosterId`,
    jwt,
    getDutyRoster,
  );

  // Duty Roster Checklist Routes
  // Get all checklists for a facility (with optional filters)
  fastify.get(
    `${dutyRosterChecklistBaseRoute}/:facilityId`,
    jwt,
    getDutyRosterChecklists,
  );

  // Get specific checklist by ID
  fastify.get(
    `${dutyRosterChecklistBaseRoute}/:facilityId/:checklistId`,
    jwt,
    getDutyRosterChecklist,
  );

  // Get checklist by duty roster ID
  fastify.get(
    `${dutyRosterChecklistBaseRoute}/:facilityId/duty-roster/:dutyRosterId`,
    jwt,
    getChecklistByDutyRoster,
  );

  // Update task status in checklist
  fastify.patch(
    `${dutyRosterChecklistBaseRoute}/:facilityId/:checklistId/task/:taskId/date/:dateId/status`,
    jwt,
    updateTaskStatus,
  );

  // Add new task to existing checklist
  fastify.post(
    `${dutyRosterChecklistBaseRoute}/:facilityId/:checklistId/task`,
    jwt,
    addTaskToChecklist,
  );

  // Remove task from checklist
  fastify.delete(
    `${dutyRosterChecklistBaseRoute}/:facilityId/:checklistId/task/:taskId`,
    jwt,
    removeTaskFromChecklist,
  );

  // Get today's tasks for a staff member
  fastify.get(
    `${dutyRosterChecklistBaseRoute}/:facilityId/staff/:staffId/today`,
    jwt,
    getTodaysTasks,
  );
  fastify.post(
    `${dutyRosterChecklistBaseRoute}/:facilityId/duty-roster/:dutyRosterId/create`,
    jwt,
    createMissingChecklist,
  );

  // ============ ESSENTIAL DAILY CHECKLIST ENDPOINTS ============

  // 1. Create empty parent/checklist
  fastify.post(
    `${dailyChecklistBaseRoute}/:facilityId/parent`,
    // jwt,
    createParent,
  );

  // 2. Get daily checklists for a facility (with optional query filters)
  fastify.get(`${dailyChecklistBaseRoute}/:facilityId`, getDailyChecklist);

  // 3. Get specific parent data from daily checklist
  fastify.get(
    `${dailyChecklistBaseRoute}/:facilityId/parent/:parentName`,
    // jwt,
    getParentData,
  );

  // ============ READINGS MANAGEMENT ============

  // 4. Add new reading (creates child if doesn't exist)
  fastify.post(
    `${dailyChecklistBaseRoute}/:facilityId/checklist/:parentId/reading`,
    // jwt,
    addReading,
  );

  // 5. Get reading history for specific child
  // Query params: ?limit=10&startDate=2025-01-01&endDate=2025-01-31
  fastify.get(
    `${dailyChecklistBaseRoute}/:facilityId/checklist/:parentId/parent/:parentName/child/:childName/history`,
    // jwt,
    getReadingHistory,
  );

  // 6. Get current values (latest readings)
  // Query params: ?parentName=B1_GENERATOR (optional)
  fastify.get(
    `${dailyChecklistBaseRoute}/:facilityId/checklist/:parentId/current`,
    // jwt,
    getCurrentValues,
  );

  // 7. Update specific reading by ID
  fastify.put(
    `${dailyChecklistBaseRoute}/:facilityId/checklist/:parentId/parent/:parentName/child/:childName/reading/:readingId`,
    jwt,
    updateReading,
  );

  // 8. Delete specific reading (soft delete)
  fastify.delete(
    `${dailyChecklistBaseRoute}/:facilityId/checklist/:parentId/parent/:parentName/child/:childName/reading/:readingId`,
    // jwt,
    deleteReading,
  );

  // Asset Routes
  fastify.post(`${assetBaseRoute}/:facilityId`, jwt, addAsset);
  fastify.put(`${assetBaseRoute}/:facilityId/:assetId`, jwt, editAsset);
  fastify.delete(`${assetBaseRoute}/:facilityId/:assetId`, jwt, deleteAsset);
  fastify.get(`${assetBaseRoute}/:facilityId`, jwt, getAssets);
  fastify.get(`${assetBaseRoute}/:facilityId/:assetId`, jwt, getAsset);
  // Assigned Status Routes
  fastify.put(
    `${assetBaseRoute}/:facilityId/:assetId/assign-status`,
    jwt,
    updateAssignedStatus,
  );
  fastify.put(
    `${assetBaseRoute}/:facilityId/bulk-assign-status`,
    jwt,
    updateMultipleAssignedStatus,
  );

  // Inspection Routes
  // Add new inspection certificate to an asset
  fastify.post(
    `${assetBaseRoute}/:facilityId/:assetId/inspection-certificate`,
    jwt,
    addInspectionCertificate,
  );

  // Edit specific inspection certificate by index
  fastify.put(
    `${assetBaseRoute}/:facilityId/:assetId/inspection-certificate/:certificateIndex`,
    jwt,
    editInspectionCertificate,
  );

  // Delete specific inspection certificate by index
  fastify.delete(
    `${assetBaseRoute}/:facilityId/:assetId/inspection-certificate/:certificateIndex`,
    jwt,
    deleteInspectionCertificate,
  );

  // Get all inspection certificates for an asset
  fastify.get(
    `${assetBaseRoute}/:facilityId/:assetId/inspection-certificates`,
    jwt,
    getInspectionCertificates,
  );

  // Get specific inspection certificate by index
  fastify.get(
    `${assetBaseRoute}/:facilityId/:assetId/inspection-certificate/:certificateIndex`,
    jwt,
    getInspectionCertificate,
  );

  // Get all assets filtered by inspection status (Passed/Failed/Pending)
  fastify.get(
    `${assetBaseRoute}/:facilityId/inspection-status/:status`,
    jwt,
    getAssetsByInspectionStatus,
  );

  // Get assets with inspection alerts (expired, pending, failed, or no certificates)
  fastify.get(
    `${assetBaseRoute}/:facilityId/inspection-alerts`,
    jwt,
    getInspectionAlerts,
  );

  // Get inspection statistics for a facility
  fastify.get(
    `${assetBaseRoute}/:facilityId/inspection-statistics`,
    jwt,
    getInspectionStatistics,
  );

  // ====== DOCUMENT MANAGEMENT ROUTES ======

  // Add new document to an asset
  fastify.post(
    `${assetBaseRoute}/:facilityId/:assetId/document`,
    jwt,
    addDocument,
  );

  // Edit specific document by index
  fastify.put(
    `${assetBaseRoute}/:facilityId/:assetId/document/:documentIndex`,
    jwt,
    editDocument,
  );

  // Delete specific document by index
  fastify.delete(
    `${assetBaseRoute}/:facilityId/:assetId/document/:documentIndex`,
    jwt,
    deleteDocument,
  );

  // Get all documents for an asset
  fastify.get(
    `${assetBaseRoute}/:facilityId/:assetId/documents`,
    jwt,
    getDocuments,
  );

  // Get specific document by index
  fastify.get(
    `${assetBaseRoute}/:facilityId/:assetId/document/:documentIndex`,
    jwt,
    getDocument,
  );

  // Get all assets filtered by document type (PDF/Image/Video)
  fastify.get(
    `${assetBaseRoute}/:facilityId/document-type/:type`,
    jwt,
    getAssetsByDocumentType,
  );

  // Get document statistics for a facility
  fastify.get(
    `${assetBaseRoute}/:facilityId/document-statistics`,
    jwt,
    getDocumentStatistics,
  );

  // Service Vendor Routes
  fastify.post(`${serviceVendorBaseRoute}/:facilityId`, jwt, addServiceVendor);
  fastify.put(
    `${serviceVendorBaseRoute}/:facilityId/:vendorId`,
    jwt,
    editServiceVendor,
  );
  fastify.delete(
    `${serviceVendorBaseRoute}/:facilityId/:vendorId`,
    jwt,
    deleteServiceVendor,
  );
  fastify.get(
    `${serviceVendorBaseRoute}/:facilityId`,
    jwt,
    getAllServiceVendors,
  );
  fastify.get(
    `${serviceVendorBaseRoute}/:facilityId/:vendorId`,
    jwt,
    getServiceVendor,
  );

  // Maintenance Service Routes
  fastify.post(
    `${maintenanceServiceBaseRoute}/:facilityId`,
    jwt,
    addMaintenanceService,
  );
  fastify.put(
    `${maintenanceServiceBaseRoute}/:facilityId/:serviceId`,
    jwt,
    editMaintenanceService,
  );
  fastify.delete(
    `${maintenanceServiceBaseRoute}/:facilityId/:serviceId`,
    jwt,
    deleteMaintenanceService,
  );
  fastify.get(
    `${maintenanceServiceBaseRoute}/:facilityId`,
    jwt,
    getAllMaintenanceServices,
  );
  fastify.get(
    `${maintenanceServiceBaseRoute}/:facilityId/:serviceId`,
    jwt,
    getMaintenanceService,
  );

  // Requisition Routes
  fastify.post(`${requisitionBaseRoute}/:facilityId`, jwt, addRequisition);
  fastify.put(
    `${requisitionBaseRoute}/:facilityId/:requisitionId`,
    jwt,
    editRequisition,
  );
  fastify.delete(
    `${requisitionBaseRoute}/:facilityId/:requisitionId`,
    jwt,
    deleteRequisition,
  );
  fastify.get(`${requisitionBaseRoute}/:facilityId`, jwt, getAllRequisitions);
  fastify.get(
    `${requisitionBaseRoute}/:facilityId/:requisitionId`,
    jwt,
    getRequisition,
  );

  // Work Order Routes
  fastify.post(`${workOrderBaseRoute}/:facilityId`, jwt, addWorkOrder);
  fastify.put(
    `${workOrderBaseRoute}/:facilityId/:workOrderId`,
    jwt,
    editWorkOrder,
  );
  fastify.delete(
    `${workOrderBaseRoute}/:facilityId/:workOrderId`,
    jwt,
    deleteWorkOrder,
  );
  fastify.get(`${workOrderBaseRoute}/:facilityId`, jwt, getAllWorkOrders);
  fastify.get(
    `${workOrderBaseRoute}/:facilityId/:workOrderId`,
    jwt,
    getWorkOrder,
  );

  // Workplan Routes
  // Master
  fastify.post(`${workPlanBaseRoute}/master/:facilityId`, createMasterWorkplan);
  fastify.put(
    `${workPlanBaseRoute}/master/:facilityId/:id`,

    updateMasterWorkplan,
  );
  fastify.delete(
    `${workPlanBaseRoute}/master/:facilityId/:id`,

    deleteMasterWorkplan,
  );
  fastify.get(`${workPlanBaseRoute}/master/:facilityId`, getMasterWorkplans);
  fastify.get(
    `${workPlanBaseRoute}/master/:facilityId/:id`,

    getMasterWorkplan,
  );

  // Child Workplan Routes
  fastify.post(
    `${workPlanBaseRoute}/child/:facilityId`,

    createChildWorkplan,
  );
  fastify.put(
    `${workPlanBaseRoute}/child/:facilityId/:id`,

    updateChildWorkplan,
  );
  fastify.delete(
    `${workPlanBaseRoute}/child/:facilityId/:id`,

    deleteChildWorkplan,
  );
  fastify.get(`${workPlanBaseRoute}/child/:facilityId`, getChildWorkplans);
  fastify.get(
    `${workPlanBaseRoute}/child/:facilityId/:id`,

    getChildWorkplan,
  );
  fastify.get(
    `${workPlanBaseRoute}/child/:facilityId/parent/:parentId`,

    getChildWorkplansByParent,
  );
  fastify.patch(
    `${workPlanBaseRoute}/child/:facilityId/:id/status`,

    updateChildWorkplanStatus,
  );
}

module.exports = { registerRoutes };
