const add_family_member = require('../controllers/resident/visitor_access/family/add_family_member');
const get_family_members = require('../controllers/resident/visitor_access/family/get_family_members');
const delete_family_member = require('../controllers/resident/visitor_access/family/delete_family_member');
const update_family_member = require('../controllers/resident/visitor_access/family/update_family_member');


const add_staff_member = require('../controllers/resident/visitor_access/staff/add_staff_member');
const get_staff_members = require('../controllers/resident/visitor_access/staff/get_staff_members');
const update_staff_member = require('../controllers/resident/visitor_access/staff/update_staff_member');
const delete_staff_member = require('../controllers/resident/visitor_access/staff/delete_staff_member');

const add_vehicle = require('../controllers/resident/visitor_access/vehicles/add_vehicle');
const get_vehicles = require('../controllers/resident/visitor_access/vehicles/get_vehicles');
const delete_vehicle = require('../controllers/resident/visitor_access/vehicles/delete_vehicle');
const handle_vehicle_status = require('../controllers/resident/visitor_access/vehicles/handle_vehicle_status');
const update_vehicle = require('../controllers/resident/visitor_access/vehicles/update_vehicle');
const get_units = require('../controllers/resident/dashboard/get_units');

const authenticateJWT = require('../middlewares/jwt_authentication');
const get_facilities = require('../controllers/resident/dashboard/get_facilities');
const get_visit_logs = require('../controllers/resident/visitor_access/visit_logs/get_visit_logs');
const get_visit_log = require('../controllers/resident/visitor_access/visit_logs/get_visit_log');
const get_visitors = require('../controllers/resident/visitor_access/visitors/get_visitors');
const accept_visit = require('../controllers/resident/visitor_access/visit_logs/accept_visit')
const deny_visit = require('../controllers/resident/visitor_access/visit_logs/deny_visit');
const add_visitor = require('../controllers/resident/visitor_access/visitors/add_visitor');
const delete_visitor = require('../controllers/resident/visitor_access/visitors/delete_visitor');
const invite_visitor = require('../controllers/resident/visitor_access/visitors/invite_visitor');
const update_visitor = require('../controllers/resident/visitor_access/visitors/update_visitor');
const handle_family_status = require('../controllers/resident/visitor_access/family/handle_family_status');
const handle_staff_status = require('../controllers/resident/visitor_access/staff/handle_staff_status');
const faq = require('../controllers/app/visitor_management/faq');

const  get_customer_contracts = require("../controllers/resident/contract_management/get_customer_contracts");
const  get_customer_invoices = require("../controllers/resident/invoice_management/get_customer_invoices");




const add_ticket = require('../controllers/resident/ticket_management/add_ticket');
const get_tickets = require('../controllers/resident/ticket_management/get_tickets');
const get_approval_tickets = require('../controllers/resident/ticket_management/get_approval_tickets');
const get_approval_ticket = require('../controllers/resident/ticket_management/get_approval_ticket');
const get_minimal_approval_ticket = require('../controllers/resident/ticket_management/get_minimal_approval_ticket');
const approve_work_order = require('../controllers/resident/ticket_management/approve_work_order');
const minimal_approve_work_order = require('../controllers/resident/ticket_management/minimal_approve_work_order');
const deny_work_order = require('../controllers/resident/ticket_management/deny_work_order');
const minimal_deny_work_order = require('../controllers/resident/ticket_management/minimal_deny_work_order');

const get_customer_leases = require("../controllers/resident/resident_leases/get_customer_leases");
const get_customer_lease_invoices = require("../controllers/resident/resident_leases/get_customer_lease_invoices");

// const get_customer_facilities = require("../controllers/resident/dashboard/get_facilities");

const upload = require('../middlewares/image_upload');

async function registerRoutes(fastify) {
    const jwt = { preHandler: authenticateJWT }

    const dashboardManagementBaseRoute = '/api/resident/dashboard'
    const residentManagementBaseRoute = '/api/resident/visitor_access'
    const contractManagementBaseRoute = '/api/resident/contract_management'
    const invoiceManagementBaseRoute = '/api/resident/invoice_management'
    const ticketManagementBaseRoute = '/api/resident/ticket_management'
    const leaseManagementBaseRoute = '/api/resident/resident_leases'

    // dashboard
    fastify.get(dashboardManagementBaseRoute + '/get_facilities', jwt, get_facilities)
    fastify.get(dashboardManagementBaseRoute + '/get_units/:customerId/:facilityId', jwt, get_units)

    //lease management
    fastify.get(leaseManagementBaseRoute + "/get_customer_leases/:facilityId/:customerId", jwt, get_customer_leases)

    //lease invoice management
    fastify.get(leaseManagementBaseRoute + "/get_customer_lease_invoices/:facilityId/:customerId", jwt, get_customer_lease_invoices)


    // resident contracts management
    fastify.get(contractManagementBaseRoute + '/get_customer_contracts/:facilityId/:customerId', jwt, get_customer_contracts)
    fastify.get(invoiceManagementBaseRoute + '/get_customer_invoices/:facilityId/:customerId', jwt, get_customer_invoices)
    
    


    fastify.get(residentManagementBaseRoute + '/family/get_family_members/:customerId', jwt, get_family_members)
    fastify.post(residentManagementBaseRoute + '/family/add_family_member/:facilityId/:customerId', jwt, add_family_member)
    fastify.post(residentManagementBaseRoute + '/family/handle_family_status/:customerId/:familyId', jwt, handle_family_status)
    fastify.post(residentManagementBaseRoute + '/family/update_family_member/:customerId/:familyId',jwt,update_family_member)
    fastify.delete(residentManagementBaseRoute + '/family/delete_family_member/:customerId/:familyId', jwt, delete_family_member)

    fastify.get(residentManagementBaseRoute + '/staff/get_staffs/:customerId', jwt, get_staff_members)
    fastify.post(residentManagementBaseRoute + '/staff/add_staff/:customerId', jwt, add_staff_member)
    fastify.post(residentManagementBaseRoute + '/staff/handle_staff_status/:customerId/:staffId', jwt, handle_staff_status)
    fastify.post(residentManagementBaseRoute + '/staff/update_staff_member/:customerId/:staffId',jwt,update_staff_member)
    fastify.delete(residentManagementBaseRoute + '/staff/delete_staff/:customerId/:staffId', jwt, delete_staff_member)

    fastify.get(residentManagementBaseRoute + '/vehicle/get_vehicles/:customerId', jwt, get_vehicles)
    fastify.post(residentManagementBaseRoute + '/vehicle/add_vehicle/:customerId', jwt, add_vehicle)
    fastify.post(residentManagementBaseRoute + '/vehicle/handle_vehicle_status/:customerId/:vehicleId', jwt, handle_vehicle_status)
    fastify.post(residentManagementBaseRoute + '/vehicles/update_vehicle/:customerId/:vehicleId',jwt,update_vehicle)
    fastify.delete(residentManagementBaseRoute + '/vehicle/delete_vehicle/:customerId/:vehicleId', jwt, delete_vehicle)


    fastify.get(residentManagementBaseRoute + '/visitor/get_visitors/:facilityId/:customerId', jwt, get_visitors)
    fastify.post(residentManagementBaseRoute + '/visitor/add_visitor/:customerId/:facilityId', jwt, add_visitor)
    fastify.post(residentManagementBaseRoute + '/visitor/invite_visitor/:customerId/:facilityId', jwt, invite_visitor)
    fastify.post(residentManagementBaseRoute + '/visitor/update_visitor/:facilityId/:visitorId', jwt, update_visitor)
    fastify.delete(residentManagementBaseRoute + '/visitor/delete_visitor/:facilityId/:visitorId', jwt, delete_visitor)

    fastify.get(residentManagementBaseRoute + '/visit_logs/get_visit_logs/:facilityId/:customerId/:userType', jwt, get_visit_logs)
    fastify.get(residentManagementBaseRoute + '/visit_logs/get_visit_log/:facilityId/:visitLogId', jwt, get_visit_log)
    fastify.get(residentManagementBaseRoute + '/visit_logs/deny_visit/:visitLogId', jwt, deny_visit)
    fastify.get(residentManagementBaseRoute + '/visit_logs/accept_visit/:visitLogId', jwt, accept_visit);
    fastify.get(residentManagementBaseRoute + '/visit_logs/get_visit_log_ql/:visitLogId', get_visit_log)
    fastify.get(residentManagementBaseRoute + '/visit_logs/deny_visit_ql/:visitLogId', deny_visit)
    fastify.get(residentManagementBaseRoute + '/visit_logs/accept_visit_ql/:visitLogId', accept_visit);

    fastify.get(residentManagementBaseRoute + '/get_faqs/:facilityId', jwt, faq)


    // ticket management
    fastify.post(
        ticketManagementBaseRoute + '/add_ticket/:customerId/:facilityId',
        {
            preHandler: [
                jwt.preHandler,
                upload.array("images", 5),
                (req, res, next) => {
                    console.log('File in middleware:', req.file);
                    console.log('Body in middleware:', req.body);
                    next();
                }
            ]
        },
        add_ticket
    );
    
    

    fastify.get(ticketManagementBaseRoute + '/get_tickets/:facilityId/:customerId', jwt, get_tickets)
    fastify.get(ticketManagementBaseRoute + '/get_approval_tickets/:facilityId/:customerId', jwt, get_approval_tickets)
    fastify.get(ticketManagementBaseRoute + '/get_approval_ticket/:facilityId/:ticketId', jwt, get_approval_ticket)
    fastify.get(ticketManagementBaseRoute + '/get_minimal_approval_ticket/:facilityId/:ticketId', get_minimal_approval_ticket)
    fastify.post(ticketManagementBaseRoute + '/approve_work_order/:facilityId/:ticketId', jwt, approve_work_order)
    fastify.post(ticketManagementBaseRoute + '/minimal_approve_work_order/:facilityId/:ticketId', minimal_approve_work_order)
    fastify.post(ticketManagementBaseRoute + '/deny_work_order/:facilityId/:ticketId', jwt, deny_work_order)
    fastify.post(ticketManagementBaseRoute + '/minimal_deny_work_order/:facilityId/:ticketId', minimal_deny_work_order)
    
}

module.exports = { registerRoutes };