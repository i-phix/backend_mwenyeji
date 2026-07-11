const authenticateJWT = require('../middlewares/jwt_authentication');

const get_dashboard_data = require('../controllers/core/dashboard_management/get_dashboard_data')

// const add_water_meter = require('../controllers/core/water_management/meters/add_meter');
const add_company = require('../controllers/core/company_management/add_company')
const confirm_company_name = require('../controllers/core/company_management/confirm_company_name')
const confirm_pin_number = require('../controllers/core/company_management/confirm_pin_number')
const get_companies = require('../controllers/core/company_management/get_companies')
const get_companies_external = require('../controllers/core/company_management/get_companies_external')
const get_company = require('../controllers/core/company_management/get_company')
const disable_company = require('../controllers/core/company_management/disable_company')
const enable_company = require('../controllers/core/company_management/enable_company')
const add_new_company_to_user = require('../controllers/core/user_management/add_new_company_to_user')
const add_existing_company_to_user = require('../controllers/core/user_management/add_existing_company_to_user');
const get_company_users = require('../controllers/core/user_management/get_company_users');
const confirm_user_email = require('../controllers/core/user_management/confirm_user_email')
const get_facilities = require('../controllers/core/facility_management/get_facilities')
const get_facilities_external = require('../controllers/core/facility_management/get_facilities_external')
const get_facility = require('../controllers/core/facility_management/get_facility')
const delete_division_facilities_url = require('../controllers/core/facility_management/delete_division_facilities_url')
const add_division_facilities_url = require('../controllers/core/facility_management/add_division_facilities_url')
const add_facility = require('../controllers/core/facility_management/add_facility')
const get_units_per_facility = require('../controllers/core/unit_management/get_units_per_facility')
const add_unit = require('../controllers/core/unit_management/add_unit');
const get_unit = require('../controllers/core/unit_management/get_unit')
const import_units = require('../controllers/core/unit_management/import_units')
const update_facility_measurement = require('../controllers/core/facility_management/update_facility_measurement');
const update_total_common_area = require('../controllers/core/facility_management/update_total_common_area');
const update_lettable_area = require('../controllers/core/facility_management/update_lettable_area');
const add_lr_number = require('../controllers/core/facility_management/add_lr_number');
const delete_lr_number = require('../controllers/core/facility_management/delete_lr_number');
const update_facility_info = require('../controllers/core/facility_management/update_facility_info');
const add_asset = require('../controllers/core/facility_management/add_asset');
const delete_asset = require('../controllers/core/facility_management/delete_asset');
const add_combined_units = require('../controllers/core/unit_management/add_combined_units')
const get_combined_units = require('../controllers/core/unit_management/get_combined_units')
const delete_combine_unit = require('../controllers/core/unit_management/delete_combine_unit')
const confirm_combined_units = require('../controllers/core/unit_management/confirm_combined_units')
const add_new_unit_asset = require('../controllers/core/unit_management/add_new_unit_asset')
const get_unit_assets = require('../controllers/core/unit_management/get_unit_assets')
const update_unit_name = require('../controllers/core/unit_management/update_unit_name')
const delete_unit_asset = require('../controllers/core/unit_management/delete_unit_asset')
const update_unit = require('../controllers/core/unit_management/update_unit')
const enable_unit = require('../controllers/core/unit_management/enable_unit')
const disable_unit = require('../controllers/core/unit_management/disable_unit')
const get_sms_email_settings = require('../controllers/core/settings/email_sms/get_sms_email_settings')
const update_sms_email_settings = require('../controllers/core/settings/email_sms/update_sms_email_settings')
const get_users = require('../controllers/core/settings/users/get_users')
const add_new_user = require('../controllers/core/settings/users/add_new_user');
const delete_user = require('../controllers/core/settings/users/delete_user')
const change_password = require('../controllers/core/settings/change_password')
const get_messages = require('../controllers/core/message_management/get_messages');
const update_meter_sizes = require('../controllers/core/settings/water_meter_settings/update_meter_sizes');
const update_manufacturers = require('../controllers/core/settings/water_meter_settings/update_manufacturer');
const add_default_payment_details = require('../controllers/core/facility_management/payment_details/add_default_payment_details');
const get_default_payment_details = require('../controllers/core/facility_management/payment_details/get_default_payment_details');
const update_default_payment_details = require('../controllers/core/facility_management/payment_details/update_default_payment_details');
const update_facility_modules = require('../controllers/core/facility_management/update_facility_modules');
const get_facility_payment_details = require('../controllers/core/facility_management/facility_payment_details/controllers/get_facility_payment_details');
const release_unit = require('../controllers/core/unit_management/release_unit');
const release_unit_field = require('../controllers/core/unit_management/release_unit_field');

// Customer Obsession - Agent Management Controllers
const add_agent = require('../controllers/core/customer_obsession/agents/add_agent');
const get_agents = require('../controllers/core/customer_obsession/agents/get_agents');
const get_agent = require('../controllers/core/customer_obsession/agents/get_agent');
const update_agent = require('../controllers/core/customer_obsession/agents/update_agent');
const delete_agent = require('../controllers/core/customer_obsession/agents/delete_agent');
const get_agent_stats = require('../controllers/core/customer_obsession/agents/get_agent_stats');
const update_agent_role = require('../controllers/core/customer_obsession/agents/update_agent_role');
const update_agent_status = require('../controllers/core/customer_obsession/agents/update_agent_status');
const reset_agent_password = require('../controllers/core/customer_obsession/agents/reset_password');
const fix_agent_types = require('../controllers/core/customer_obsession/agents/fix_agent_types');

// Customer Obsession - Knowledge Base Management Controllers
const create_kb_article = require('../controllers/core/customer_obsession/knowledge_base/create_article');
const get_kb_articles = require('../controllers/core/customer_obsession/knowledge_base/get_articles');
const get_kb_article = require('../controllers/core/customer_obsession/knowledge_base/get_article');
const update_kb_article = require('../controllers/core/customer_obsession/knowledge_base/update_article');
const delete_kb_article = require('../controllers/core/customer_obsession/knowledge_base/delete_article');

// Customer Obsession - Ticket Categories Controllers
const create_category = require('../controllers/core/customer_obsession/categories/create_category');
const get_categories = require('../controllers/core/customer_obsession/categories/get_categories');
const update_category = require('../controllers/core/customer_obsession/categories/update_category');
const delete_category = require('../controllers/core/customer_obsession/categories/delete_category');

// Customer Obsession - Tickets Controllers
const get_tickets = require('../controllers/core/customer_obsession/tickets/get_tickets');

// Customer Obsession - Surveys Controllers
const get_surveys = require('../controllers/core/customer_obsession/surveys/get_surveys');

// Customer Obsession - Departments Controllers
const get_departments = require('../controllers/core/customer_obsession/departments/get_departments');
const create_department = require('../controllers/core/customer_obsession/departments/create_department');
const update_department = require('../controllers/core/customer_obsession/departments/update_department');
const delete_department = require('../controllers/core/customer_obsession/departments/delete_department');

// Customer Obsession - Roles Controllers
const get_roles = require('../controllers/core/customer_obsession/roles/get_roles');
const create_role = require('../controllers/core/customer_obsession/roles/create_role');
const update_role = require('../controllers/core/customer_obsession/roles/update_role');
const delete_role = require('../controllers/core/customer_obsession/roles/delete_role');
const get_support_levels = require('../controllers/core/customer_obsession/support_levels/get_support_levels');
const seed_support_levels = require('../controllers/core/customer_obsession/support_levels/seed_support_levels');
const update_support_level = require('../controllers/core/customer_obsession/support_levels/update_support_level');
const get_escalation_settings = require('../controllers/core/customer_obsession/support_levels/get_escalation_settings');
const update_escalation_settings = require('../controllers/core/customer_obsession/support_levels/update_escalation_settings');
const overdueTicketScheduler = require('../controllers/customer_obsession/notifications/overdueTicketScheduler');

const upload = require('../middlewares/image_upload');
const headerAuth = require('../plugins/headerAuth');

async function registerRoutes(fastify) {

  const jwt = { preHandler: authenticateJWT }



  // -- START OF WATER MANAGEMENT --
  const dashboardBaseRoute = '/api/core/dashboard_management'
  const waterBaseRoute = '/api/core/water_management'
  const companyBaseRoute = '/api/core/company_management'
  const userBaseRoute = '/api/core/user_management'
  const facilityBaseRoute = '/api/core/facility_management'
  const unitBaseRoute = '/api/core/unit_management'
  const settingsBaseRoute = '/api/core/settings'
  const messagesBaseRoute = '/api/core/messages'
  const customerObsessionBaseRoute = '/api/core/customer_obsession'
  const auditBaseRoute = '/api/core/audit'
   const { getAuditLogsController, getAuditStatsController, getAuditLogByIdController } = require('../controllers/core/auditTrails/audit_routes');

  // PAYMENT
  const paymentBaseRoute = "/api/core/payment_details";

  // DASHBOARD
  fastify.get(dashboardBaseRoute + '/get_dashboard_data', jwt, get_dashboard_data)





  // COMPANY MANAGEMENT
  fastify.get(companyBaseRoute + '/get_companies', jwt, get_companies)
  fastify.get(companyBaseRoute + '/get_companies_external', { preHandler: headerAuth }, get_companies_external);
  fastify.get(companyBaseRoute + '/confirm_company_name/:name', jwt, confirm_company_name)
  fastify.get(companyBaseRoute + '/confirm_pin_number/:companyPinNumber', jwt, confirm_pin_number)
  fastify.get(companyBaseRoute + '/get_company/:id', jwt, get_company)
  fastify.get(companyBaseRoute + '/enable_company/:id', jwt, enable_company)
  fastify.get(companyBaseRoute + '/disable_company/:id', jwt, disable_company)
  // fastify.post(companyBaseRoute + '/add_company', jwt, add_company)
  fastify.post(
    companyBaseRoute + '/add_company',
    {
      preHandler: [
        jwt.preHandler,
        upload.fields([
          { name: 'logo', maxCount: 1 },
          { name: 'taxDocument', maxCount: 1 },
          { name: 'companyCertificateDocument', maxCount: 1 },
          { name: 'IdPassportDocument', maxCount: 1 }
        ]),
        (req, res, next) => {
          console.log('Files received:', req.files);
          console.log('Body received:', req.body);
          next();
        }
      ]
    },
    add_company
  );


  // FACILITY MANAGEMENT
  fastify.get(facilityBaseRoute + '/get_facility/:id', jwt, get_facility)
  fastify.get(facilityBaseRoute + '/get_facilities', jwt, get_facilities)
  fastify.get(facilityBaseRoute + '/get_facilities_external', { preHandler: headerAuth }, get_facilities_external);
  fastify.get(facilityBaseRoute + '/delete_asset/:id', jwt, delete_asset)
  fastify.post(facilityBaseRoute + '/delete_division_facilities_url/:id', jwt, delete_division_facilities_url)
  fastify.post(facilityBaseRoute + '/add_division_facilities_url/:id', jwt, add_division_facilities_url)
  fastify.post(facilityBaseRoute + '/add_facility/:id', jwt, add_facility)
  fastify.post(facilityBaseRoute + '/update_facility_measurement/:id', jwt, update_facility_measurement)
  fastify.post(facilityBaseRoute + '/update_total_common_area/:id', jwt, update_total_common_area)
  fastify.post(facilityBaseRoute + '/update_lettable_area/:id', jwt, update_lettable_area)
  fastify.post(facilityBaseRoute + '/add_lr_number/:id', jwt, add_lr_number)
  fastify.post(facilityBaseRoute + '/delete_lr_number/:id', jwt, delete_lr_number)
  fastify.post(facilityBaseRoute + '/update_facility_info/:id', jwt, update_facility_info)
  fastify.post(facilityBaseRoute + '/update_facility_modules/:id', jwt, update_facility_modules)
  fastify.post(facilityBaseRoute + '/add_asset/:id', jwt, add_asset)





  // USER MANAGEMENT
  fastify.get(userBaseRoute + '/get_company_users', jwt, get_company_users)
  fastify.get(userBaseRoute + '/confirm_user_email/:email', jwt, confirm_user_email)
  fastify.post(userBaseRoute + '/add_a_new_company_to_user/:companyId', jwt, add_new_company_to_user)
  fastify.post(userBaseRoute + '/add_a_existing_company_to_user/:userId/:companyId', jwt, add_existing_company_to_user)



  // UNIT MANAGEMENT

  fastify.get(unitBaseRoute + '/get_units_per_facility/:facilityId', jwt, get_units_per_facility);
  fastify.get(unitBaseRoute + '/get_unit/:unitId/:facilityId', jwt, get_unit)
  fastify.get(unitBaseRoute + '/get_unit_assets/:unitId/:facilityId', jwt, get_unit_assets)
  fastify.get(unitBaseRoute + '/confirm_combined_units/:facilityId/:unitId', jwt, confirm_combined_units)
  fastify.get(unitBaseRoute + '/get_combine_units/:facilityId', jwt, get_combined_units)
  fastify.get(unitBaseRoute + '/delete_combine_unit/:unitId/:facilityId', jwt, delete_combine_unit)
  fastify.get(unitBaseRoute + '/enable_unit/:unitId/:facilityId', jwt, enable_unit)
  fastify.get(unitBaseRoute + '/disable_unit/:unitId/:facilityId', jwt, disable_unit)
  fastify.post(unitBaseRoute + '/import_units/:facilityId', jwt, import_units)
  fastify.post(unitBaseRoute + '/add_unit/:facilityId', jwt, add_unit);
  fastify.post(unitBaseRoute + '/add_combine_units/:facilityId', jwt, add_combined_units)
  fastify.post(unitBaseRoute + '/add_new_unit_asset/:unitId/:facilityId', jwt, add_new_unit_asset)
  fastify.post(unitBaseRoute + '/update_unit_name/:unitId/:facilityId', jwt, update_unit_name)
  fastify.post(unitBaseRoute + '/update_unit/:unitId/:facilityId', jwt, update_unit)
  fastify.delete(unitBaseRoute + '/delete_unit_asset/:id/:facilityId', jwt, delete_unit_asset)
  fastify.post(unitBaseRoute + '/release_unit/:unitId/:facilityId', jwt, release_unit)
  fastify.post(unitBaseRoute + '/release_unit_field/:unitId/:facilityId', jwt, release_unit_field)


  // SETTINGS
  fastify.get(settingsBaseRoute + '/get_users', jwt, get_users);
  fastify.get(settingsBaseRoute + '/delete_user/:userId', jwt, delete_user);
  fastify.post(settingsBaseRoute + '/add_new_user', jwt, add_new_user)
  fastify.get(settingsBaseRoute + '/get_sms_email_settings', jwt, get_sms_email_settings)
  fastify.post(settingsBaseRoute + '/update_meter_sizes', jwt, update_meter_sizes)
  fastify.post(settingsBaseRoute + '/update_manufacturers', jwt, update_manufacturers)
  fastify.post(settingsBaseRoute + '/update_sms_email_settings', jwt, update_sms_email_settings)
  fastify.post(settingsBaseRoute + '/change_password', jwt, change_password)


  // MESSAGES
  fastify.get(messagesBaseRoute + '/get_messages', jwt, get_messages)

  // DEFAULT PAYMENT CREDENTIALS
  fastify.get(paymentBaseRoute + '/get_default_payment_details', get_default_payment_details)
  fastify.post(paymentBaseRoute + '/add_default_payment_details', add_default_payment_details)
  fastify.put(paymentBaseRoute + '/update_default_payment_details/:id', update_default_payment_details)
  fastify.get(paymentBaseRoute + '/get_facility_payment_details/:id', jwt, get_facility_payment_details)

  // AUDIT TRAILS MANAGEMENT
  fastify.get(auditBaseRoute + '/logs', jwt, getAuditLogsController)
  fastify.get(auditBaseRoute + '/stats', jwt, getAuditStatsController)
  fastify.get(auditBaseRoute + '/logs/:logId', jwt, getAuditLogByIdController)

  // CUSTOMER OBSESSION - AGENT MANAGEMENT

  // Agent GET Routes
  fastify.get(customerObsessionBaseRoute + '/agents/get_agents', jwt, get_agents)
  fastify.get(customerObsessionBaseRoute + '/agents/get_agent/:id', jwt, get_agent)
  fastify.get(customerObsessionBaseRoute + '/agents/get_agents_by_facility/:facilityId', jwt, async (request, reply) => {
    request.query.facility_id = request.params.facilityId;
    return get_agents(request, reply);
  })
  fastify.get(customerObsessionBaseRoute + '/agents/get_agents_by_department/:department', jwt, async (request, reply) => {
    request.query.department = request.params.department;
    return get_agents(request, reply);
  })
  fastify.get(customerObsessionBaseRoute + '/agents/get_agents_by_role/:role', jwt, async (request, reply) => {
    request.query.role = request.params.role;
    return get_agents(request, reply);
  })
  fastify.get(customerObsessionBaseRoute + '/agents/get_agents_by_status/:status', jwt, async (request, reply) => {
    request.query.status = request.params.status;
    return get_agents(request, reply);
  })
  fastify.get(customerObsessionBaseRoute + '/agents/delete_agent/:id', jwt, delete_agent)

  // Agent POST Routes
  fastify.post(customerObsessionBaseRoute + '/agents/add_agent', jwt, add_agent)
  fastify.post(customerObsessionBaseRoute + '/agents/fix_agent_types', jwt, fix_agent_types)
  fastify.post(customerObsessionBaseRoute + '/agents/update_agent/:id', jwt, update_agent)
  fastify.post(customerObsessionBaseRoute + '/agents/reset_password/:id', jwt, reset_agent_password)
  fastify.post(customerObsessionBaseRoute + '/agents/update_agent_role/:id', jwt, update_agent_role)
  fastify.post(customerObsessionBaseRoute + '/agents/update_agent_status/:id', jwt, update_agent_status)

  // Agent Bulk Operations
  fastify.post(customerObsessionBaseRoute + '/agents/bulk_update_status', jwt, async (request, reply) => {
    try {
      const { agent_ids, status, reason } = request.body;

      if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
        return reply.code(400).send({
          error: 'agent_ids array is required'
        });
      }

      if (!status) {
        return reply.code(400).send({
          error: 'status is required'
        });
      }

      const results = [];
      const errors = [];

      for (const agent_id of agent_ids) {
        try {
          const mockRequest = {
            params: { id: agent_id },
            body: { status, reason },
            user: request.user
          };

          const mockReply = {
            code: (statusCode) => ({
              send: (data) => ({ statusCode, data })
            })
          };

          const result = await update_agent_status(mockRequest, mockReply);
          results.push({
            agent_id,
            success: true,
            result: result.data || result
          });
        } catch (error) {
          errors.push({
            agent_id,
            success: false,
            error: error.message
          });
        }
      }

      return reply.code(200).send({
        message: 'Bulk status update completed',
        results,
        errors,
        summary: {
          total: agent_ids.length,
          successful: results.length,
          failed: errors.length
        }
      });

    } catch (err) {
      return reply.code(502).send({ error: err.message });
    }
  })

  // Agent Statistics and Analytics
  fastify.get(customerObsessionBaseRoute + '/agents/get_agent_stats', jwt, get_agent_stats)

  // Knowledge Base Management Routes (Core Portal)
  fastify.post(customerObsessionBaseRoute + '/knowledge_base/articles', jwt, create_kb_article)
  fastify.get(customerObsessionBaseRoute + '/knowledge_base/articles', jwt, get_kb_articles)
  fastify.get(customerObsessionBaseRoute + '/knowledge_base/articles/:article_id', jwt, get_kb_article)
  fastify.put(customerObsessionBaseRoute + '/knowledge_base/articles/:article_id', jwt, update_kb_article)
  fastify.delete(customerObsessionBaseRoute + '/knowledge_base/articles/:article_id', jwt, delete_kb_article)

  // Ticket Categories Management Routes (Core Portal)
  fastify.post(customerObsessionBaseRoute + '/categories', jwt, create_category)
  fastify.get(customerObsessionBaseRoute + '/categories', jwt, get_categories)
  fastify.put(customerObsessionBaseRoute + '/categories/:category_id', jwt, update_category)
  fastify.delete(customerObsessionBaseRoute + '/categories/:category_id', jwt, delete_category)

  // Customer Tickets Routes (Core Portal - Read Only)
  fastify.get(customerObsessionBaseRoute + '/tickets/get_tickets', jwt, get_tickets)

  // Customer Surveys Routes (Core Portal - Read Only)
  fastify.get(customerObsessionBaseRoute + '/surveys/get_surveys', jwt, get_surveys)

  // Departments Routes
  fastify.get(customerObsessionBaseRoute + '/departments', jwt, get_departments)
  fastify.post(customerObsessionBaseRoute + '/departments', jwt, create_department)
  fastify.put(customerObsessionBaseRoute + '/departments/:department_id', jwt, update_department)
  fastify.delete(customerObsessionBaseRoute + '/departments/:department_id', jwt, delete_department)

  // Roles Routes
  fastify.get(customerObsessionBaseRoute + '/roles', jwt, get_roles)
  fastify.post(customerObsessionBaseRoute + '/roles', jwt, create_role)
  fastify.put(customerObsessionBaseRoute + '/roles/:role_id', jwt, update_role)
  fastify.delete(customerObsessionBaseRoute + '/roles/:role_id', jwt, delete_role)

  // Support Levels Routes
  fastify.get(customerObsessionBaseRoute + '/support-levels', jwt, get_support_levels)
  fastify.post(customerObsessionBaseRoute + '/support-levels', jwt, seed_support_levels)
  fastify.put(customerObsessionBaseRoute + '/support-levels/:id', jwt, update_support_level)

  // Escalation Settings Routes
  fastify.get(customerObsessionBaseRoute + '/escalation-settings', jwt, get_escalation_settings)
  fastify.put(customerObsessionBaseRoute + '/escalation-settings', jwt, update_escalation_settings)

  // Move-In Management Routes
  const moveInBaseRoute = '/api/core/move_in';
  const get_move_in_dashboard   = require('../controllers/core/move_in/dashboard/get_dashboard');
  const get_move_in_listings    = require('../controllers/core/move_in/listings/get_listings');
  const approve_move_in_listing = require('../controllers/core/move_in/listings/approve_listing');
  const reject_move_in_listing  = require('../controllers/core/move_in/listings/reject_listing');
  const toggle_move_in_listing  = require('../controllers/core/move_in/listings/toggle_listing');
  const override_move_in_price  = require('../controllers/core/move_in/listings/override_price');
  const get_move_in_applications   = require('../controllers/core/move_in/applications/get_applications');
  const assign_move_in_application = require('../controllers/core/move_in/applications/assign_application');
  const send_move_in_reminder      = require('../controllers/core/move_in/reminders/send_reminder');
  const get_move_in_reminders      = require('../controllers/core/move_in/reminders/get_reminders');
  const get_move_in_customers   = require('../controllers/core/move_in/customers/get_customers');
  const update_move_in_customer = require('../controllers/core/move_in/customers/update_customer');
  const reset_move_in_customer_password = require('../controllers/core/move_in/customers/reset_password');
  const suspend_move_in_customer  = require('../controllers/core/move_in/customers/suspend_customer');
  const activate_move_in_customer = require('../controllers/core/move_in/customers/activate_customer');
  const get_move_in_preferences  = require('../controllers/core/move_in/preferences/get_preferences');
  const get_move_in_landmarks    = require('../controllers/core/move_in/landmarks/get_landmarks');
  const save_move_in_landmark    = require('../controllers/core/move_in/landmarks/save_landmark');
  const delete_move_in_landmark  = require('../controllers/core/move_in/landmarks/delete_landmark');

  fastify.get(moveInBaseRoute + '/dashboard', jwt, get_move_in_dashboard);
  fastify.get(moveInBaseRoute + '/listings', jwt, get_move_in_listings);
  fastify.put(moveInBaseRoute + '/listings/approve/:id', jwt, approve_move_in_listing);
  fastify.put(moveInBaseRoute + '/listings/reject/:id', jwt, reject_move_in_listing);
  fastify.put(moveInBaseRoute + '/listings/toggle/:id', jwt, toggle_move_in_listing);
  fastify.put(moveInBaseRoute + '/listings/override_price/:id', jwt, override_move_in_price);
  fastify.get(moveInBaseRoute + '/applications', jwt, get_move_in_applications);
  fastify.put(moveInBaseRoute + '/applications/assign/:applicationId', jwt, assign_move_in_application);
  fastify.post(moveInBaseRoute + '/reminders/send', jwt, send_move_in_reminder);
  fastify.get(moveInBaseRoute + '/reminders', jwt, get_move_in_reminders);
  fastify.get(moveInBaseRoute + '/customers', jwt, get_move_in_customers);
  fastify.put(moveInBaseRoute + '/customers/reset_password/:customerId', jwt, reset_move_in_customer_password);
  fastify.put(moveInBaseRoute + '/customers/suspend/:customerId', jwt, suspend_move_in_customer);
  fastify.put(moveInBaseRoute + '/customers/activate/:customerId', jwt, activate_move_in_customer);
  fastify.put(moveInBaseRoute + '/customers/:customerId', jwt, update_move_in_customer);
  fastify.get(moveInBaseRoute + '/preferences', jwt, get_move_in_preferences);
  fastify.get(moveInBaseRoute + '/landmarks', jwt, get_move_in_landmarks);
  fastify.post(moveInBaseRoute + '/landmarks', jwt, save_move_in_landmark);
  fastify.put(moveInBaseRoute + '/landmarks/:landmarkId', jwt, save_move_in_landmark);
  fastify.delete(moveInBaseRoute + '/landmarks/:landmarkId', jwt, delete_move_in_landmark);

  // Move-In Landlord module management
  const get_move_in_landlords   = require('../controllers/core/move_in/landlords/get_landlords');
  const update_move_in_landlord = require('../controllers/core/move_in/landlords/update_landlord');
  const reset_move_in_landlord_password = require('../controllers/core/move_in/landlords/reset_password');
  const assign_move_in_module   = require('../controllers/core/move_in/landlords/assign_module');
  const revoke_move_in_module   = require('../controllers/core/move_in/landlords/revoke_module');
  fastify.get(moveInBaseRoute + '/landlords', jwt, get_move_in_landlords);
  fastify.put(moveInBaseRoute + '/landlords/reset_password/:landlordId', jwt, reset_move_in_landlord_password);
  fastify.post(moveInBaseRoute + '/landlords/assign', jwt, assign_move_in_module);
  fastify.put(moveInBaseRoute + '/landlords/revoke/:landlordId', jwt, revoke_move_in_module);
  fastify.put(moveInBaseRoute + '/landlords/:landlordId', jwt, update_move_in_landlord);

  // Move-In Audit Logs
  const get_move_in_audit_logs = require('../controllers/core/move_in/audit_logs/get_audit_logs');
  fastify.get(moveInBaseRoute + '/audit_logs', jwt, get_move_in_audit_logs);

  // Move-In Viewings (admin oversight)
  const get_move_in_viewings = require('../controllers/core/move_in/viewings/get_viewings');
  fastify.get(moveInBaseRoute + '/viewings', jwt, get_move_in_viewings);

  // Move-In Reservations (admin oversight)
  const get_move_in_reservations  = require('../controllers/core/move_in/reservations/get_reservations');
  const update_move_in_reservation = require('../controllers/core/move_in/reservations/update_reservation');
  fastify.get(moveInBaseRoute + '/reservations', jwt, get_move_in_reservations);
  fastify.put(moveInBaseRoute + '/reservations/:reservationId', jwt, update_move_in_reservation);

  // Manual escalation trigger + diagnostics (for testing/admin use)
  fastify.post(customerObsessionBaseRoute + '/escalation-settings/run-now', jwt, async (request, reply) => {
    try {
      const payservedb = require('payservedb');

      // Gather diagnostic info first
      const settings = await payservedb.Settings.findOne({
        name: 'customer_obsession_global', size: 'global'
      }).select('escalation_timer_minutes escalation_target_level').lean();

      const targetLevel = settings?.escalation_target_level ?? 3;
      const timerMinutes = settings?.escalation_timer_minutes ?? null;

      const level3Roles = await payservedb.AgentRole.find({ level: targetLevel, active: true }).select('code name').lean();
      const roleCodes = level3Roles.map(r => r.code);

      const targetAgents = roleCodes.length > 0
        ? await payservedb.Agent.find({ role: { $in: roleCodes }, status: 'active' }).select('fullName role status is_available').lean()
        : [];

      const activeTickets = await payservedb.CustomerTicket.countDocuments({
        status: { $nin: ['resolved', 'closed', 'archived', 'escalated'] }
      });

      const diagnostics = {
        settings: { escalation_timer_minutes: timerMinutes, escalation_target_level: targetLevel },
        level3_roles: level3Roles,
        available_agents: targetAgents,
        active_ticket_count: activeTickets,
        can_escalate: timerMinutes !== null && targetAgents.length > 0
      };

      if (!diagnostics.can_escalate) {
        return reply.code(200).send({ success: false, diagnostics, message: 'Escalation cannot run — see diagnostics' });
      }

      const result = await overdueTicketScheduler.runNow();
      return reply.code(200).send({ success: true, result, diagnostics });
    } catch (error) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────
  // Customer Obsession facility + customer lookups (admin-side aliases for
  // the agent endpoints; reused by the RecipientGroups member picker).
  // ─────────────────────────────────────────────────────────────────────
  const coGetFacilities = require('../controllers/customer_obsession/get_facilities');
  const coGetFacilityCustomers = require('../controllers/customer_obsession/get_customers');
  fastify.get('/api/core/customer_obsession/facilities', { preHandler: authenticateJWT }, coGetFacilities);
  fastify.get('/api/core/customer_obsession/facilities/:facilityId/customers', { preHandler: authenticateJWT }, coGetFacilityCustomers);

  // ─────────────────────────────────────────────────────────────────────
  // PR3 — Email CC Config (admin-managed always-CC list)
  // ─────────────────────────────────────────────────────────────────────
  const getEmailCcConfigs = require('../controllers/core/customer_obsession/email_cc_config/get_email_cc_configs');
  const addEmailCcConfig = require('../controllers/core/customer_obsession/email_cc_config/add_email_cc_config');
  const updateEmailCcConfig = require('../controllers/core/customer_obsession/email_cc_config/update_email_cc_config');
  const deleteEmailCcConfig = require('../controllers/core/customer_obsession/email_cc_config/delete_email_cc_config');
  const coBase = '/api/core/customer_obsession';
  fastify.get(coBase + '/email-cc-config', { preHandler: authenticateJWT }, getEmailCcConfigs);
  fastify.post(coBase + '/email-cc-config', { preHandler: authenticateJWT }, addEmailCcConfig);
  fastify.put(coBase + '/email-cc-config/:id', { preHandler: authenticateJWT }, updateEmailCcConfig);
  fastify.delete(coBase + '/email-cc-config/:id', { preHandler: authenticateJWT }, deleteEmailCcConfig);

  // ─────────────────────────────────────────────────────────────────────
  // PR4 — Auto-Reply Rules (admin-managed keyword-triggered replies)
  // ─────────────────────────────────────────────────────────────────────
  const getAutoReplyRules = require('../controllers/core/customer_obsession/auto_reply_rules/get_rules');
  const addAutoReplyRule = require('../controllers/core/customer_obsession/auto_reply_rules/add_rule');
  const updateAutoReplyRule = require('../controllers/core/customer_obsession/auto_reply_rules/update_rule');
  const deleteAutoReplyRule = require('../controllers/core/customer_obsession/auto_reply_rules/delete_rule');
  const reorderAutoReplyRules = require('../controllers/core/customer_obsession/auto_reply_rules/reorder_rules');
  fastify.get(coBase + '/auto-reply-rules', { preHandler: authenticateJWT }, getAutoReplyRules);
  fastify.post(coBase + '/auto-reply-rules', { preHandler: authenticateJWT }, addAutoReplyRule);
  fastify.put(coBase + '/auto-reply-rules/:id', { preHandler: authenticateJWT }, updateAutoReplyRule);
  fastify.delete(coBase + '/auto-reply-rules/:id', { preHandler: authenticateJWT }, deleteAutoReplyRule);
  fastify.post(coBase + '/auto-reply-rules/reorder', { preHandler: authenticateJWT }, reorderAutoReplyRules);

  // ─────────────────────────────────────────────────────────────────────
  // PR5 — Recipient Groups (admin-managed groups for agent bulk send)
  // ─────────────────────────────────────────────────────────────────────
  const getRecipientGroups = require('../controllers/core/customer_obsession/recipient_groups/get_groups');
  const getRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/get_group');
  const addRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/add_group');
  const updateRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/update_group');
  const deleteRecipientGroup = require('../controllers/core/customer_obsession/recipient_groups/delete_group');
  const addRecipientGroupMembers = require('../controllers/core/customer_obsession/recipient_groups/add_members');
  const deleteRecipientGroupMember = require('../controllers/core/customer_obsession/recipient_groups/delete_member');
  const getRecipientGroupsConfig = require('../controllers/core/customer_obsession/recipient_groups/get_config');
  fastify.get(coBase + '/recipient-groups/config', { preHandler: authenticateJWT }, getRecipientGroupsConfig);
  fastify.get(coBase + '/recipient-groups', { preHandler: authenticateJWT }, getRecipientGroups);
  fastify.get(coBase + '/recipient-groups/:id', { preHandler: authenticateJWT }, getRecipientGroup);
  fastify.post(coBase + '/recipient-groups', { preHandler: authenticateJWT }, addRecipientGroup);
  fastify.put(coBase + '/recipient-groups/:id', { preHandler: authenticateJWT }, updateRecipientGroup);
  fastify.delete(coBase + '/recipient-groups/:id', { preHandler: authenticateJWT }, deleteRecipientGroup);
  fastify.post(coBase + '/recipient-groups/:id/members', { preHandler: authenticateJWT }, addRecipientGroupMembers);
  fastify.delete(coBase + '/recipient-groups/:groupId/members/:memberId', { preHandler: authenticateJWT }, deleteRecipientGroupMember);
}

module.exports = { registerRoutes };
