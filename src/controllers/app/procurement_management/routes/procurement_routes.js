const authenticateJWT = require('../../../../middlewares/jwt_authentication');
const upload = require('../../../../middlewares/file_upload');

// Supplier Endpoints
const add_supplier = require('../controllers/suppliers/add_supplier');
const editSupplier = require('../controllers/suppliers/edit_supplier');
const getSupplier = require('../controllers/suppliers/get_supplier');
const getAllSuppliers = require('../controllers/suppliers/get_all_suppliers');

// Purchase Orders Endpoints
const addPurchaseOrder = require('../controllers/purchase_orders/add_purchase_order');
const editPurchaseOrder = require('../controllers/purchase_orders/edit_purchase_order');
const getPurchaseOrder = require('../controllers/purchase_orders/get_purchase_order');
const getAllPurchaseOrders = require('../controllers/purchase_orders/get_all_purchase_orders');
const approvePurchaseOrder = require('../controllers/purchase_orders/approve_purchase_order');

// Purchase Requests Endpoints
const addPurchaseRequest = require('../controllers/purchase_requests/add_purchase_request');
const editPurchaseRequest = require('../controllers/purchase_requests/edit_purchase_request');
const getPurchaseRequest = require('../controllers/purchase_requests/get_purchase_request');
const getAllPurchaseRequests = require('../controllers/purchase_requests/get_all_purchase_requests');
const approvePurchaseRequest = require('../controllers/purchase_requests/approve_purchase_request');

// Approval workflow controllers
const createApprovalWorkflow = require('../controllers/approval_workflows/add_approval_workflows');
const getAllApprovalWorkflows = require('../controllers/approval_workflows/get_all_approval_workflows');
const getApprovalWorkflowById = require('../controllers/approval_workflows/get_approval_workflow_by_id');
const updateApprovalWorkflow = require('../controllers/approval_workflows/edit_approval_workflows');
const deleteApprovalWorkflow = require('../controllers/approval_workflows/delete_approval_workflows');

// Quotations Endpoints
const addRFQ = require('../controllers/request_for_quotations/add_rfq');
const editRFQ = require('../controllers/request_for_quotations/edit_rfq');
const getRFQ = require('../controllers/request_for_quotations/get_rfq');
const getAllRFQs = require('../controllers/request_for_quotations/get_all_rfqs');
const getSuppliersRFQs = require('../controllers/request_for_quotations/get_suppliers_rfqs');
const getRFQById = require('../controllers/request_for_quotations/get_rfqs_by_id');
// const getRFQRespsonse = require('../controllers/request_for_quotations/get_rfq_responses');
const approveRFQ = require('../controllers/request_for_quotations/approve_rfq');
// const rejectRFQ = require('../controllers/request_for_quotations/reject_rfq');


// Quotations  Response Endpoints
const addRFQResponse = require('../controllers/response_for_rfqs/add_rfq_response');
const editRFQResponse = require('../controllers/response_for_rfqs/edit_rfq_response');
const getRFQResponseById = require('../controllers/response_for_rfqs/get_rfq_response_by_id');
const getAllRFQResponses = require('../controllers/response_for_rfqs/get_rfq_responses');
const getAllRFQRespons = require('../controllers/response_for_rfqs/get_rfq_responses_by_supplier');
const awardRFQResponse = require('../controllers/response_for_rfqs/award_rfq');

// Payements Awarding Endpoints
const addDeliveryTimeMark = require('../controllers/po_payement_grading/add_delivery_time_mark');
const deleteDeliveryTimeMark = require('../controllers/po_payement_grading/delete_delivery_time_mark');
const editDeliveryTimeMark = require('../controllers/po_payement_grading/edit_delivery_time_mark');
const getDeliveryTimeMarks = require('../controllers/po_payement_grading/get_delivery_time_marks');

const addPaymentTermMark = require('../controllers/po_payement_grading/add_payment_term_mark');
const deletePaymentTermMark = require('../controllers/po_payement_grading/delete_payment_term_mark');
const editPaymentTermMark = require('../controllers/po_payement_grading/edit_payment_term_mark');
const getPaymentTermMarks = require('../controllers/po_payement_grading/get_payment_term_marks');


// Goods Received Notes Endpoints
const addGrn = require('../controllers/goods_received_note/add_grn');
const getAllGrns = require('../controllers/goods_received_note/get_all_grns');
const editGrn = require('../controllers/goods_received_note/edit_grn');
const getGrn = require('../controllers/goods_received_note/get_grn');
const grnApproval = require('../controllers/goods_received_note/approve_grn');

async function registerRoutes(fastify) {
  const jwt = { preHandler: authenticateJWT };

  // Base Routes
  const supplierBaseRoute = '/api/app/suppliers';
  const purchaseOrderBaseRoute = '/api/app/purchase-orders';
  const purchaseRequestBaseRoute = '/api/app/purchase-requests';
  const rfqBaseRoute = '/api/app/quotations';
  const rfqReponseBaseRoute = '/api/app/rfq-responses';
  const approvalWorkflowBaseRoute = '/api/app/approval-workflows';
  const paymentGradingBaseRoute = '/api/app/procurement_management/controllers/po_payment_grading';
  const grnBaseRoute = '/api/app/procurement_management/controllers/goods_received_note';

  // Supplier Routes
  fastify.post(
    `${supplierBaseRoute}/add/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.any()]
    },
    add_supplier
  );

  fastify.get(
    `${supplierBaseRoute}/all/:facilityId`,
    jwt,
    getAllSuppliers
  );

  fastify.get(
    `${supplierBaseRoute}/details/:facilityId/:supplierId`,
    jwt,
    getSupplier
  );

  fastify.put(
    `${supplierBaseRoute}/update/:facilityId/:supplierId`,
    {
      preHandler: [authenticateJWT, upload.array('documents')]
    },
    editSupplier
  );

  // Purchase Order Routes
  fastify.post(
    `${purchaseOrderBaseRoute}/add/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    addPurchaseOrder
  );

  fastify.get(
    `${purchaseOrderBaseRoute}/all/:facilityId`,
    jwt,
    getAllPurchaseOrders
  );

  fastify.get(
    `${purchaseOrderBaseRoute}/details/:facilityId/:purchaseOrderId`,
    jwt,
    getPurchaseOrder
  );

  fastify.put(
    `${purchaseOrderBaseRoute}/update/:facilityId/:purchaseOrderId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    editPurchaseOrder
  );

  fastify.put(
    `${purchaseOrderBaseRoute}/approve/:facilityId/:purchaseOrderId`,
    jwt,
    approvePurchaseOrder
  );

  // fastify.put(
  //   `${purchaseOrderBaseRoute}/reject/:facilityId/:poId`,
  //   jwt,
  //   rejectPurchaseOrder
  // );

  // Purchase Request Routes
  fastify.post(
    `${purchaseRequestBaseRoute}/add/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    addPurchaseRequest
  );

  fastify.get(
    `${purchaseRequestBaseRoute}/all/:facilityId`,
    jwt,
    getAllPurchaseRequests
  );

  fastify.get(
    `${purchaseRequestBaseRoute}/details/:facilityId/:purchaseRequestId`,
    jwt,
    getPurchaseRequest
  );

  fastify.put(
    `${purchaseRequestBaseRoute}/update/:facilityId/:purchaseRequestId`,
    jwt,
    editPurchaseRequest
  );

  fastify.put(
    `${purchaseRequestBaseRoute}/approve/:facilityId/:purchaseRequestId`,
    jwt,
    approvePurchaseRequest
  );

  // fastify.put(
  //   `${purchaseRequestBaseRoute}/reject/:facilityId/:prId`,
  //   jwt,
  //   rejectPurchaseRequest
  // );


  // RFQ Routes
  fastify.post(
    `${rfqBaseRoute}/add/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    addRFQ
  );

  fastify.get(
    `${rfqBaseRoute}/all/:facilityId`,
    jwt,
    getAllRFQs
  );
  fastify.get(
    `${rfqBaseRoute}/suppliers/:supplierId`,
    jwt,
    getSuppliersRFQs
  );

  fastify.get(
    `${rfqBaseRoute}/details/:facilityId/:rfqId`,
    jwt,
    getRFQ
  );

  fastify.get(
    `${rfqBaseRoute}/by_id/:rfqId`,
    jwt,
    getRFQById
  );

  fastify.put(
    `${rfqBaseRoute}/update/:facilityId/:rfqId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    editRFQ
  );

  fastify.put(
    `${rfqBaseRoute}/approve/:rfqId`,
    jwt,
    approveRFQ
  );

  // fastify.put(
  //   `${rfqBaseRoute}/reject/:facilityId/:rfqId`,
  //   jwt,
  //   rejectRFQ
  // );




  // RFQ RESPONSES Routes
  fastify.post(
    `${rfqReponseBaseRoute}/add/:facilityId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    addRFQResponse
  );

  fastify.get(
    `${rfqReponseBaseRoute}/all/:facilityId`,
    jwt,
    getAllRFQs
  );
  fastify.get(
    `${rfqReponseBaseRoute}/suppliers/:supplierId`,
    jwt,
    getSuppliersRFQs
  );

  fastify.get(
    `${rfqReponseBaseRoute}/details/:facilityId/:rfqId`,
    jwt,
    getRFQ
  );

  fastify.get(
    `${rfqReponseBaseRoute}/by_id/:rfqId`,
    jwt,
    getRFQById
  );

  fastify.put(
    `${rfqReponseBaseRoute}/update/:facilityId/:rfqId`,
    {
      preHandler: [authenticateJWT, upload.array('attachments')]
    },
    editRFQ
  );
  fastify.get(
    `${rfqReponseBaseRoute}/all_responses/:facilityId`,
    jwt,
    getAllRFQResponses
  );

  fastify.post(
    `${rfqReponseBaseRoute}/award/:facilityId`,
    jwt,
    awardRFQResponse
  );


  //Approval Workflows

  fastify.post(
    `${approvalWorkflowBaseRoute}/add/:facilityId`,
    jwt,
    createApprovalWorkflow
  );

  fastify.get(
    `${approvalWorkflowBaseRoute}/all/:facilityId`,
    jwt,
    getAllApprovalWorkflows
  );

  fastify.get(
    `${approvalWorkflowBaseRoute}/details/:facilityId/:workflowId`,
    jwt,
    getApprovalWorkflowById
  );

  fastify.put(
    `${approvalWorkflowBaseRoute}/update/:facilityId/:workflowId`,
    jwt,
    updateApprovalWorkflow
  );

  fastify.delete(
    `${approvalWorkflowBaseRoute}/delete/:facilityId/:workflowId`,
    jwt,
    deleteApprovalWorkflow
  );

  //payments grading 

  fastify.post(
    `${paymentGradingBaseRoute}/add_delivery_time_mark/:facilityId`,
    jwt,
    addDeliveryTimeMark
  );

  fastify.get(
    `${paymentGradingBaseRoute}/get_all_delivery_time_marks/:facilityId`,
    jwt,
    getDeliveryTimeMarks
  );

  fastify.put(
    `${paymentGradingBaseRoute}/edit_delivery_time_mark/:facilityId/:deliveryTimeMarkId`,
    jwt,
    editDeliveryTimeMark
  );

  fastify.delete(
    `${paymentGradingBaseRoute}/delete_delivery_time_mark/:facilityId/:deliveryTimeMarkId`,
    jwt,
    deleteDeliveryTimeMark
  );

  // Ppayments terms

  fastify.post(
    `${paymentGradingBaseRoute}/add_payment_term_mark/:facilityId`,
    jwt,
    addPaymentTermMark
  );

  fastify.get(
    `${paymentGradingBaseRoute}/get_all_payment_term_mark/:facilityId`,
    jwt,
    getPaymentTermMarks
  );

  fastify.put(
    `${paymentGradingBaseRoute}/edit_payment_term_mark/:facilityId/:paymentTermMarkId`,
    jwt,
    editPaymentTermMark
  );

  fastify.delete(
    `${paymentGradingBaseRoute}/delete_payment_term_mark/:facilityId/:paymentTermMarkId`,
    jwt,
    deletePaymentTermMark
  );

}

module.exports = { registerRoutes };