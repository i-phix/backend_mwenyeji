const authenticateJWT = require("../middlewares/jwt_authentication");
const get_list_of_companies = require("../controllers/app/user_management/get_list_of_companies");
const get_list_of_facilities = require("../controllers/app/user_management/get_list_of_facilities");
const get_units_for_facility = require("../controllers/app/facility_management/get_units_for_facility");
const get_divisions = require("../controllers/app/facility_management/get_divisions");
const get_facilities = require("../controllers/app/facility_management/get_facilities");
const finish_onboarding = require("../controllers/app/facility_management/finish_onboarding");
const add_new_unit_asset = require("../controllers/app/unit_management/add_new_unit_asset");
const get_unit = require("../controllers/app/unit_management/get_unit");
const get_unit_occupants = require("../controllers/app/unit_management/get_unit_occupants");
const get_unit_assets = require("../controllers/app/unit_management/get_unit_assets");
const delete_unit_asset = require("../controllers/app/unit_management/delete_unit_asset");
const update_unit = require("../controllers/app/unit_management/update_unit");
const get_facility_units = require("../controllers/app/unit_management/get_facility_units");
const upload_unit_documents = require("../controllers/app/unit_management/upload_unit_documents");
const get_unit_documents = require("../controllers/app/unit_management/get_unit_documents");
const get_unit_statement_of_accounts = require("../controllers/app/unit_management/get_unit_statement_of_accounts");
const get_unit_invoices = require("../controllers/app/unit_management/get_unit_invoices");
const get_app_move_in_units = require("../controllers/app/move_in/get_units");
const upsert_app_move_in_listing = require("../controllers/app/move_in/upsert_listing");
const submit_app_move_in_listing = require("../controllers/app/move_in/submit_listing");
const convert_app_move_in_deal = require("../controllers/app/move_in/convert_deal");

//property management
const get_property_managed_units = require("../controllers/app/property_management/get_property_managed_units");
const get_property_managed_invoices = require("../controllers/app/property_management/invoices/get_property_managed_invoices");
const get_property_manager_revenue = require("../controllers/app/property_management/get_property_manager_revenue");
const save_property_manager_revenue = require("../controllers/app/property_management/save_property_manager_revenue");
const calculate_and_save_property_manager_revenue = require("../controllers/app/property_management/calculate_and_save_property_manager_revenue");
const get_property_managed_customers = require("../controllers/app/property_management/get_property_managed_customers");
const create_property_manager_contract = require("../controllers/app/property_management/contracts/create_property_manager_contract");
const get_property_manager_contracts = require("../controllers/app/property_management/contracts/get_property_manager_contracts");
const get_property_manager_contract = require("../controllers/app/property_management/contracts/get_property_manager_contract_by_id");
const terminate_property_manager_contract = require("../controllers/app/property_management/contracts/terminate_property_manager_contract");
const edit_property_manager_contract = require("../controllers/app/property_management/contracts/edit_property_manager_contract");

// user management
const add_user = require("../controllers/app/user_management/add_user");
const get_users = require("../controllers/app/user_management/get_users");
const get_property_admin_and_finance = require("../controllers/app/user_management/get_property_admin_and_finance");
const update_user = require("../controllers/app/user_management/update_user");
const delete_user = require("../controllers/app/user_management/delete_user");
// user management end

const update_facility = require("../controllers/app/settings_management/update_facility");
const get_company_information = require("../controllers/app/settings_management/get_company_information");
const add_document_type = require("../controllers/app/settings_management/add_document_type");
const get_document_types = require("../controllers/app/settings_management/get_document_types");
const add_faq = require("../controllers/app/settings_management/add_faq");
const get_faqs = require("../controllers/app/settings_management/get_faqs");
const get_offline_faqs = require("../controllers/app/settings_management/get_faqs");
const add_privacy_policy = require("../controllers/app/settings_management/add_privacy_policy");
const get_privacy_policy = require("../controllers/app/settings_management/get_privacy_policy");
const add_terms_and_conditions = require("../controllers/app/settings_management/add_terms_and_conditions");
const get_terms_and_conditions = require("../controllers/app/settings_management/get_terms_and_conditions");
const add_community_guidelines = require("../controllers/app/settings_management/add_community_guidelines");
const get_community_guidelines = require("../controllers/app/settings_management/get_community_guidelines");
const update_invoice_payment = require("../controllers/app/settings_management/update_invoice_payment");

const add_new_customer = require("../controllers/app/customer_management/add_new_customer");
const resend_credentials = require("../controllers/app/customer_management/resend_credentials");
const import_customers = require("../controllers/app/customer_management/import_customers");
const import_kra_pins = require("../controllers/app/customer_management/import_kra_pins");
const get_customers = require("../controllers/app/customer_management/get_customers");
const get_customer = require("../controllers/app/customer_management/get_customer");
const enable_customer = require("../controllers/app/customer_management/enable_customer");
const disable_customer = require("../controllers/app/customer_management/disable_customer");
const update_customer = require("../controllers/app/customer_management/update_customer");
const change_user_type = require("../controllers/app/customer_management/change_user_type");
const update_nextofkin = require("../controllers/app/customer_management/update_nextofkin");
const add_nextofkin = require("../controllers/app/customer_management/add_nextofkin");
const upload_customer_documents = require("../controllers/app/customer_management/upload_customer_documents");
const get_customer_documents = require("../controllers/app/customer_management/get_customer_documents");
const get_statement_of_accounts = require("../controllers/app/customer_management/get_statement_of_accounts");
const get_customer_units = require("../controllers/app/customer_management/get_customer_units");
const deactivate_customer = require("../controllers/app/customer_management/deactivate_customer");
const deactivate_landlord = require("../controllers/app/customer_management/deactivate_landlord");
const add_unoccupied_unit_to_customer = require("../controllers/app/customer_management/add_unoccupied_unit_to_customer");
const add_family_member_to_customer = require("../controllers/app/customer_management/add_family_member_to_customer");
const get_family_members_for_customer = require("../controllers/app/customer_management/get_family_members_for_customer");
const add_vehicle_to_customer = require("../controllers/app/customer_management/add_vehicle_to_customer");
const get_vehicles_for_customer = require("../controllers/app/customer_management/get_vehicles_for_customer");
const add_staff_to_customer = require("../controllers/app/customer_management/add_staff_to_customer");
const get_staff_for_customer = require("../controllers/app/customer_management/get_staff_for_customer");
const handle_family_status = require("../controllers/app/customer_management/handle_family_status");
const handle_vehicle_status = require("../controllers/app/customer_management/handle_vehicle_status");
const handle_staff_status = require("../controllers/app/customer_management/handle_staff_status");
const delete_family = require("../controllers/app/customer_management/delete_family");
const delete_vehicle = require("../controllers/app/customer_management/delete_vehicle");
const delete_staff = require("../controllers/app/customer_management/delete_staff");
const move_customer = require("../controllers/app/customer_management/move_customer");
const get_landlord_unpaid_invoices = require("../controllers/app/unit_management/get_landlord_unpaid_invoices");
const get_customer_phone_number = require("../controllers/app/customer_management/get_customer_number");

const visitor_pre_registration = require("../controllers/app/visitor_management/visitor_pre_registration");
const delivery_registration = require("../controllers/app/visitor_management/delivery_registration");
const add_guard = require("../controllers/app/visitor_management/guard_management/add_guard");
const get_facility_guards = require("../controllers/app/visitor_management/guard_management/get_facility_guards");
const get_guard_time = require("../controllers/app/visitor_management/guard_management/get_guard_time");
const edit_facility_guard = require("../controllers/app/visitor_management/guard_management/edit_facility_guard");
const delete_facility_guard = require("../controllers/app/visitor_management/guard_management/delete_facility_guard");
const disable_facility_guard = require("../controllers/app/visitor_management/guard_management/disable_facility_guard");
const add_entry_and_exit = require("../controllers/app/visitor_management/entry_and_exit_management/add_entry_and_exit");
const get_entries_and_exits_for_facility = require("../controllers/app/visitor_management/entry_and_exit_management/get_entries_and_exits_for_facility");
const edit_entries_and_exits_for_facility = require("../controllers/app/visitor_management/entry_and_exit_management/edit_entries_and_exits_for_facility");
const delete_entries_and_exits_for_facility = require("../controllers/app/visitor_management/entry_and_exit_management/delete_entries_and_exits_for_facility");
const disable_entries_and_exits_for_facility = require("../controllers/app/visitor_management/entry_and_exit_management/disable_entries_and_exits_for_facility");
const get_facility_visitors = require("../controllers/app/visitor_management/get_facility_visitors");
const get_visitor_logs = require("../controllers/app/visitor_management/get_visitor_logs");
const get_waiting_list = require("../controllers/app/visitor_management/get_waiting_list");
const search_by_otp = require("../controllers/app/visitor_management/search_by_otp");
const delete_visitor = require("../controllers/app/visitor_management/delete_visitor");
const request_visit_confirmation = require("../controllers/app/visitor_management/request_visit_confirmation");

const add_levy_type = require("../controllers/app/levy_management/add_levy_type");
const get_levy_types = require("../controllers/app/levy_management/get_levy_types");
const delete_levy_type = require("../controllers/app/levy_management/delete_levy_type");
const getLevy = require("../controllers/app/levy_management/get_levy");

const get_visit_log = require("../controllers/app/visitor_management/get_visit_log");
const exit_visit_log = require("../controllers/app/visitor_management/exit_visit");

const add_levy = require("../controllers/app/levy_management/add_levy");
const get_levies = require("../controllers/app/levy_management/get_levies");
const edit_levy = require("../controllers/app/levy_management/edit_levy");
const edit_levy_type = require("../controllers/app/levy_management/edit_levy_type");
const delete_levy = require("../controllers/app/levy_management/delete_levy");
const disable_levy = require("../controllers/app/levy_management/disable_levy");
const add_or_update_tax_rate = require("../controllers/app/settings_management/add_or_update_tax_rate");
const add_sms_settings = require("../controllers/app/settings_management/add_sms_settings");
const get_sms_settings = require("../controllers/app/settings_management/get_sms_settings");

// Email settings
const add_email_settings = require("../controllers/app/settings_management/add_email_settings");
const get_email_settings = require("../controllers/app/settings_management/get_email_settings");
const get_tax_rates = require("../controllers/app/settings_management/get_tax_rates");
const delete_tax_rate = require("../controllers/app/settings_management/delete_tax_rate");
const add_levy_settings = require("../controllers/app/levy_management/add_levy_invoice_settings");
const show_levy_settings = require("../controllers/app/levy_management/show_levy_invoice_settings");
const edit_levy_settings = require("../controllers/app/levy_management/edit_levy_invoice_settings");
const add_currency = require("../controllers/app/settings_management/add_currency");
const delete_currency = require("../controllers/app/settings_management/delete_currency");
const get_currencies = require("../controllers/app/settings_management/get_currencies");
const edit_currency = require("../controllers/app/settings_management/edit_currency");
const add_department = require("../controllers/app/settings_management/add_department");
const delete_department = require("../controllers/app/settings_management/delete_department");
const get_departments = require("../controllers/app/settings_management/get_departments");
const update_department = require("../controllers/app/settings_management/update_department");

const add_reminder = require("../controllers/app/levy_management/reminders/add_reminder");
const add_penalty = require("../controllers/app/levy_management/penalty/add_penalty");
const update_penalty_status = require("../controllers/app/levy_management/penalty/update_penalty_status");
const update_reminder_status = require("../controllers/app/levy_management/reminders/update_reminder_status");
const delete_reminder = require("../controllers/app/levy_management/reminders/delete_reminder");
const delete_penalty = require("../controllers/app/levy_management/penalty/delete_penalty");
// const add_reminder = require("../controllers/app/settings_management/add_reminder");
// const add_penalty = require("../controllers/app/settings_management/add_penalty");

const getBankDetailsForLevy = require("../controllers/app/settings_management/get_bank_details_for_levy");
const getBillerAddressForLevy = require("../controllers/app/settings_management/get_biller_address_for_levy");
const getFacilityPaymentDetails = require("../controllers/app/settings_management/get_facility_payment_details");

//bank details settings management
const get_bank_details = require("../controllers/app/settings_management/get_bank_details");
const add_bank_details = require("../controllers/app/settings_management/add_bank_details");
const update_bank_details = require("../controllers/app/settings_management/update_bank_details");
const delete_bank_details = require("../controllers/app/settings_management/delete_bank_details");
const get_bank_details_by_id = require("../controllers/app/settings_management/get_bank_details_by_id");

//Invoice Schedules settings management
const add_invoice_schedule = require("../controllers/app/settings_management/add_facility_invoice_schedule");
const update_invoice_schedule = require("../controllers/app/settings_management/update_facility_schedule");
const get_invoice_schedules = require("../controllers/app/settings_management/get_facility_invoice_scehdules");

// biller details settings management
const get_biller_addresses = require("../controllers/app/settings_management/get_biller_addresses");
const add_biller_address = require("../controllers/app/settings_management/add_biller_address");
const update_biller_address = require("../controllers/app/settings_management/update_biller_address");
const delete_biller_address = require("../controllers/app/settings_management/delete_biller_address");
const get_biller_address_by_id = require("../controllers/app/settings_management/get_biller_address_by_id");
const get_default_biller_address = require("../controllers/app/settings_management/get_default_biller_addresses");

//Zoho integration settings management
const add_zoho_config = require("../controllers/app/settings_management/add_zoho_config");
const get_zoho_config = require("../controllers/app/settings_management/get_zoho_config");
const update_zoho_config = require("../controllers/app/settings_management/update_zoho_config");
const delete_zoho_config = require("../controllers/app/settings_management/delete_zoho_config");
const test_zoho_connection = require("../controllers/app/settings_management/test_zoho_connection");
const get_zoho_stats = require("../controllers/app/settings_management/get_zoho_stats");

// QuickBooks integration settings management
const add_quickbooks_config = require("../controllers/app/settings_management/add_quickbooks_config");
const get_quickbooks_config = require("../controllers/app/settings_management/get_quickbooks_config");
const update_quickbooks_config = require("../controllers/app/settings_management/update_quickbooks_config");
const connect_quickbooks = require("../controllers/app/settings_management/connect_quickbooks");
const disconnect_quickbooks = require("../controllers/app/settings_management/disconnect_quickbooks");
const quickbooks_callback = require("../controllers/app/settings_management/quickbooks_callback");


//vas management
const add_new_value_added_service = require("../controllers/app/vas_management/add_new_value_added_service");
const get_value_added_services = require("../controllers/app/vas_management/get_value_added_services");
const add_vas_vendor = require("../controllers/app/vas_management/add_vas_vendor");
const delete_vas_vendor = require("../controllers/app/vas_management/delete_vas_vendor");
const update_vas_vendor = require("../controllers/app/vas_management/update_vas_vendor");
const get_vas_vendors = require("../controllers/app/vas_management/get_vas_vendors");
const add_service_request = require("../controllers/app/vas_management/add_service_request");
const assign_service_request = require("../controllers/app/vas_management/assign_service_request");
const get_vendor_request_page = require("../controllers/app/vas_management/get_vendor_request_page");
const get_pm_request_page = require("../controllers/app/vas_management/get_pm_request_page");
const vendor_approve_service_request = require("../controllers/app/vas_management/vendor_approve_service_request");
const pm_approve_quote = require("../controllers/app/vas_management/pm_approve_quote");
const pm_deny_quote = require("../controllers/app/vas_management/pm_deny_quote");
const vendor_deny_service_request = require("../controllers/app/vas_management/vendor_deny_service_request");
const get_resident_request_page = require("../controllers/app/vas_management/get_resident_request_page");
const resident_approve_service_request = require("../controllers/app/vas_management/resident_approve_service_request");
const resident_deny_service_request = require("../controllers/app/vas_management/resident_deny_service_request");
const resident_approve_service_request_authenticated = require("../controllers/app/vas_management/resident_approve_service_request_authenticated");
const resident_deny_service_request_authenticated = require("../controllers/app/vas_management/resident_deny_service_request_authenticated");
const add_service_invoice = require("../controllers/app/vas_management/add_service_invoice");
const get_service_invoices_by_customer = require("../controllers/app/vas_management/get_service_invoices_by_customer");
const delete_value_added_service = require("../controllers/app/vas_management/delete_value_added_service");
const get_service_requests_by_customer = require("../controllers/app/vas_management/get_service_requests_by_customer");
const get_facility_service_requests = require("../controllers/app/vas_management/get_facility_service_requests");
const get_customer_type = require("../controllers/app/vas_management/get_customer_type");
const assign_work_order = require("../controllers/app/vas_management/assign_work_order");
const get_work_orders = require("../controllers/app/vas_management/get_work_orders");
const get_vas_invoices = require("../controllers/app/vas_management/get_vas_invoices");
const get_vas_invoice_by_id = require("../controllers/app/vas_management/get_vas_invoice_by_id");
const update_service_request = require("../controllers/app/vas_management/update_service_request");

const create_unit_management_template = require("../controllers/app/vas_management/unit_management_templates/create_unit_management_template.js");
const get_unit_management_templates = require("../controllers/app/vas_management/get_unit_management_templates");
const get_unit_management_template = require("../controllers/app/vas_management/unit_management_templates/get_unit_management_template.js");
const update_unit_management_template = require("../controllers/app/vas_management/unit_management_templates/update_unit_management_template.js");
const delete_unit_management_template = require("../controllers/app/vas_management/unit_management_templates/delete_unit_management_template.js");
const get_unit_management_data_for_template = require("../controllers/app/vas_management/unit_management_templates/get_unit_management_data_for_template.js");
const assign_template_to_service_request = require("../controllers/app/vas_management/unit_management_templates/assign_template_to_service_request.js");

const get_facility_reminders = require("../controllers/app/levy_management/reminders/get_facility_reminders");
const get_facility_penalties = require("../controllers/app/levy_management/penalty/get_facility_penalties");

const add_contract = require("../controllers/app/levy_management/contracts/add_contract");
const get_contracts = require("../controllers/app/levy_management/contracts/get_contracts");
const get_facility_active_contracts = require("../controllers/app/levy_management/contracts/get_facility_active_levy_contracts");
const get_contract = require("../controllers/app/levy_management/contracts/get_contract");
const edit_contract = require("../controllers/app/levy_management/contracts/edit_contract");
const terminate_levy_contract = require("../controllers/app/levy_management/contracts/terminate_levy_contract");
const delete_contract = require("../controllers/app/levy_management/contracts/delete_contract");
const disable_contract = require("../controllers/app/levy_management/contracts/disable_contract");

const allow_visit = require("../controllers/app/visitor_management/allow_visit");
const allow_visitor = require("../controllers/app/visitor_management/allow_visitor");
const confirm_qr_data = require("../controllers/app/visitor_management/confirm_qr_data");
const manual_entry = require("../controllers/app/visitor_management/manual_entry");
const allow_verified_visitor = require("../controllers/app/visitor_management/allow_verified_visitor");



// Invoice

// ++++++++++++++++++++++++++++++++++++++++++++++++++++
// ++++++ Controllers not registered to a route +++++++
// ++++++++++++++++++++++++++++++++++++++++++++++++++++
const get_invoice = require("../controllers/app/levy_management/invoices/get_invoice");
const create_invoice = require("../controllers/app/levy_management/invoices/create_invoice");
const delete_invoice = require("../controllers/app/levy_management/invoices/delete_invoice");
const get_facility_invoices = require("../controllers/app/levy_management/invoices/get_facility_invoices");
const get_lease_invoices = require("../controllers/app/levy_management/invoices/get_lease_invoices");
const get_single_lease_invoice = require("../controllers/app/levy_management/invoices/get_single_lease_invoice");
const exportLevyInvoices = require("../controllers/app/levy_management/invoices/exportLevyInvoices");
const mark_invoice_viewed = require("../controllers/app/payment_management/mark_invoice_viewed");
const get_withholdingtax_records = require("../controllers/app/levy_management/invoices/get_withholdingtax_records");

//Payment management
const get_cash_payments = require("../controllers/app/payment_management/cash/get_cash_payments");
const approve_cash_payment = require("../controllers/app/payment_management/cash/approve_cash_payment");
const reject_cash_payment = require("../controllers/app/payment_management/cash/reject_cash_payment");
const check_pending_cash_payment = require("../controllers/app/payment_management/cash/check_pending_cash_payment");
const void_cash_payment = require("../controllers/app/payment_management/cash/void_cash_payment");
const record_cash_payment = require("../controllers/app/payment_management/cash/record_cash_payment");
const record_wht = require("../controllers/app/payment_management/record_wht");
const create_credit_note = require("../controllers/app/payment_management/create_credit_note");
const create_debit_note = require("../controllers/app/payment_management/create_debit_note");
const transfer_credit = require("../controllers/app/payment_management/transfer_credit");
const get_unpaid_invoices = require("../controllers/app/payment_management/get_unpaid_invoices");
const apply_overpayment = require("../controllers/app/payment_management/apply_overpayment");
const get_credit_invoices = require("../controllers/app/payment_management/get_credit_invoices");
const get_invoice_reconciliation = require("../controllers/app/payment_management/get_invoice_reconciliation");
const resend_invoice_notification = require("../controllers/app/payment_management/resend_invoice_notification");
const get_property_managers = require("../controllers/app/payment_management/get_property_managers");
const send_invoice_to_manager = require("../controllers/app/payment_management/send_invoice_to_manager");
const void_invoice = require("../controllers/app/payment_management/void_invoice");
const cancel_invoice = require("../controllers/app/payment_management/cancel_invoice");
const get_invoice_by_account = require("../controllers/app/payment_management/get_invoice_by_account");

const add_lease_agreement = require("../controllers/app/lease_management/lease_agreements/add_lease_agreement");
const get_facility_lease_agreements_count = require("../controllers/app/lease_management/lease_agreements/get_facility_active_leases");
const get_lease = require("../controllers/app/lease_management/lease_agreements/get_lease");
const get_leases = require("../controllers/app/lease_management/lease_agreements/get_leases");
const update_lease = require("../controllers/app/lease_management/lease_agreements/update_lease");
const upload_lease_document = require("../controllers/app/lease_management/document_management/upload_lease_document");
const get_lease_documents = require("../controllers/app/lease_management/lease_agreements/get_lease_documents");
const terminate_lease = require("../controllers/app/lease_management/lease_agreements/terminate_lease");
const delete_lease = require("../controllers/app/lease_management/lease_agreements/delete_lease");
const update_lease_status = require("../controllers/app/lease_management/lease_agreements/update_lease_status");
const renew_lease = require("../controllers/app/lease_management/lease_agreements/renew_lease");

const create_lease_template = require("../controllers/app/lease_management/lease_templates/create_lease_template");
const get_lease_templates = require("../controllers/app/lease_management/lease_templates/get_lease_templates");
const get_lease_template = require("../controllers/app/lease_management/lease_templates/get_lease_template");
const update_lease_template = require("../controllers/app/lease_management/lease_templates/update_lease_template");
const delete_lease_template = require("../controllers/app/lease_management/lease_templates/delete_lease_template");
const get_lease_data_for_template = require("../controllers/app/lease_management/lease_templates/get_lease_data_for_template");

const create_lease_penalty = require("../controllers/app/lease_management/lease_penalties/create_lease_penalty");
const get_lease_penalty = require("../controllers/app/lease_management/lease_penalties/get_single_penalty");
const get_lease_penalties = require("../controllers/app/lease_management/lease_penalties/get_lease_penalties");
const update_lease_penalty = require("../controllers/app/lease_management/lease_penalties/update_lease_penalty");
const toggle_lease_penalty_status = require("../controllers/app/lease_management/lease_penalties/penalty_status");

const create_lease_reminder = require("../controllers/app/lease_management/lease_reminders/create_lease_reminder");
const get_lease_reminders = require("../controllers/app/lease_management/lease_reminders/get_lease_reminders");
const get_lease_reminder = require("../controllers/app/lease_management/lease_reminders/get_single_reminder");
const update_lease_reminder = require("../controllers/app/lease_management/lease_reminders/update_lease_reminder");
const toggle_lease_reminder_status = require("../controllers/app/lease_management/lease_reminders/reminder_status");

// Combined invoices
const get_facility_combined_invoices = require("../controllers/app/combined_invoices/get_facility_combined_invoices");
// const get_tenant_combined_invoice = require("../controllers/app/combined_invoices/get_tenant_combined_invoice");
const view_combined_invoice = require("../controllers/app/combined_invoices/view_combined_invoice");


// invoice triggers 
const generate_tenant_invoice = require("../controllers/app/lease_management/lease_agreements/generate_tenant_invoice");
const generate_facility_invoices = require("../controllers/app/lease_management/lease_agreements/generate_facility_invoices");

// Leases Reports 
const get_rent_roll_report = require("../controllers/app/lease_management/lease_reports/rentRollController");
const get_lease_expiry_pipeline = require("../controllers/app/lease_management/lease_reports/leaseExpiryController");
const get_rent_escalation_tracker = require("../controllers/app/lease_management/lease_reports/rentEscalationController");
const get_unbilled_report = require("../controllers/app/lease_management/lease_reports/unbilledController");
const get_lease_monthly_report = require("../controllers/app/lease_management/lease_reports/get_lease_monthly_report.js");

// Levy Reports 
const get_collections_vs_budget_report = require("../controllers/app/levy_management/reports/getLevyCollectionVsBudget");
const get_levy_compliance_report = require("../controllers/app/levy_management/reports/getLevyCollectionVsBudget");
const get_levy_againg_report = require("../controllers/app/levy_management/reports/getLevyAgingReport");
const get_reconciliation_report = require("../controllers/app/levy_management/reports/getLevyReconciliationReport");
const get_levy_monthly_report = require("../controllers/app/levy_management/reports/get_levy_monthly_report");
const get_current_approvals = require("../controllers/app/levy_management/reports/get_current_approvals");
const get_all_invoie_approvals = require("../controllers/app/levy_management/reports/get_all_approvals");
const approve_manual_invoice = require("../controllers/app/levy_management/reports/process_approval");

const get_lease_balances = require("../controllers/app/lease_management/lease_balances/get_lease_balances");
const get_levy_balances = require("../controllers/app/levy_management/get_levy_balances");

const create_ticket = require("../controllers/app/ticket_management/create_ticket");
const get_tickets = require("../controllers/app/ticket_management/get_tickets");
const get_ticket = require("../controllers/app/ticket_management/get_ticket");
const close_ticket = require("../controllers/app/ticket_management/close_ticket");
const cancel_ticket = require("../controllers/app/ticket_management/cancel_ticket");
const reopen_ticket = require("../controllers/app/ticket_management/reopen_ticket");
const mark_ticket_as_read = require("../controllers/app/ticket_management/mark_ticket_as_read");
const assign_ticket = require("../controllers/app/ticket_management/assign_ticket");
const get_assigned_tickets = require("../controllers/app/ticket_management/get_assigned_tickets");
const approve_ticket = require("../controllers/app/ticket_management/approve_ticket");
const approve_complaint = require("../controllers/app/ticket_management/approve_complaint");
const get_ticket_landlord = require("../controllers/app/ticket_management/get_ticket_landlord");
const finish_review = require("../controllers/app/ticket_management/finish_review");
const ticket_reports = require("../controllers/app/ticket_management/ticket_reports");

const create_move_in_handover = require("../controllers/app/handover_management/create_move_in_handover");
const create_move_out_handover = require("../controllers/app/handover_management/create_move_out_handover");
const get_all_handovers = require("../controllers/app/handover_management/get_all_handovers");
const get_handover = require("../controllers/app/handover_management/get_handover");
const get_handover_share_link = require("../controllers/app/handover_management/get_handover_share_link");
const download_handover_pdf = require("../controllers/app/handover_management/public/download_handover_pdf");
const update_handover = require("../controllers/app/handover_management/update_handover");
const delete_handover = require("../controllers/app/handover_management/delete_handover");
const compare_handovers = require("../controllers/app/handover_management/compare_handovers");
const upload_handover_images = require("../controllers/app/handover_management/upload_handover_images");
const send_handover_email = require("../controllers/app/handover_management/send_handover_email");
const send_handover_sms = require("../controllers/app/handover_management/send_handover_sms");

const get_all_inspection_settings = require("../controllers/app/handover_management/handover_inspection/get_all_inspection_settings");
const get_inspection_settings_by_id = require("../controllers/app/handover_management/handover_inspection/get_inspection_settings_by_id");
const add_inspection_settings = require("../controllers/app/handover_management/handover_inspection/add_inspection_settings");
const update_inspection_settings = require("../controllers/app/handover_management/handover_inspection/update_inspection_settings");
const delete_inspection_settings = require("../controllers/app/handover_management/handover_inspection/delete_inspection_settings");
// const upload_excel_template = require('../controllers/app/handover_management/handover_inspection/upload_excel_template');
const get_default_inspection_settings = require("../controllers/app/handover_management/handover_inspection/get_default_inspection_settings");
const set_default_inspection_settings = require("../controllers/app/handover_management/handover_inspection/set_default_inspection_settings");
const get_inspection_settings_by_category = require("../controllers/app/handover_management/handover_inspection/get_inspection_settings_by_category");
const get_unit_inspection_items = require("../controllers/app/handover_management/handover_inspection/get_unit_inspection_items");
const get_units_with_move_in = require("../controllers/app/handover_management/get_units_with_move_in");

// Inspection Categories
const add_inspection_category = require("../controllers/app/handover_management/handover_inspection/add_inspection_category");
const get_inspection_categories = require("../controllers/app/handover_management/handover_inspection/get_inspection_categories");
const update_inspection_category = require("../controllers/app/handover_management/handover_inspection/update_inspection_category");
const delete_inspection_category = require("../controllers/app/handover_management/handover_inspection/delete_inspection_category");

// Handover Reports
const get_handover_summary_report = require("../controllers/app/handover_management/reports/handoverSummaryController");
const get_inventory_comparison_report = require("../controllers/app/handover_management/reports/inventoryComparisonController");
const get_meter_readings_report = require("../controllers/app/handover_management/reports/meterReadingsController");
const get_handover_completion_report = require("../controllers/app/handover_management/reports/completionMetricsController");

const get_invoice_by_id = require("../controllers/app/levy_management/invoices/get_invoice_by_id");
//offline invoice
const get_public_invoice = require("../controllers/app/settings_management/get_public_invoice");
const get_public_combined_invoice = require("../controllers/app/combined_invoices/get_public_combined_invoice");
const get_unauthenticated_invoice = require("../controllers/app/levy_management/invoices/get_unauthenticated_invoice");
const get_unauthenticated_company_information = require("../controllers/app/settings_management/get_unauthenticated_company_information");
const get_unauthenticated_customer_information = require("../controllers/app/settings_management/get_unauthenticated_customer_information");
const { createShortUrl } = require("../utils/url_shortener/short_url");
const redirectShortUrl = require("../utils/url_shortener/redirect");

const add_campaign = require("../controllers/app/campaign_management/add_campaign");
const get_campaigns = require("../controllers/app/campaign_management/get_campaigns");
const get_campaign = require("../controllers/app/campaign_management/get_campaign");
const update_campaign = require("../controllers/app/campaign_management/update_campaign");

const block_property_dates = require("../controllers/app/booking_management/block_property_dates");
const create_booking_property = require("../controllers/app/booking_management/create_booking_property");
const get_all_units_and_booking_properties = require("../controllers/app/booking_management/get_all_units_and_booking_properties");
const get_booking_property = require("../controllers/app/booking_management/get_booking_property");
const toggle_property_listing = require("../controllers/app/booking_management/toggle_property_listing");
const update_booking_property = require("../controllers/app/booking_management/update_booking_property");
const get_booking_blocked_dates = require("../controllers/app/booking_management/get_booking_blocked_dates");
const get_facility_paybills = require("../controllers/app/booking_management/get_facility_paybills");

const get_all_booking_invoices = require("../controllers/app/booking_management/booking_invoice/get_all_booking_invoices.js");
const get_booking_invoice_details = require("../controllers/app/booking_management/booking_invoice/get_booking_invoice_details");
const update_booking_invoice_payment = require("../controllers/app/booking_management/booking_invoice/update_booking_invoice_payment");

const calculate_booking_price = require("../controllers/app/booking_management/booking_reservation/calculate_booking_price");
const check_available_dates = require("../controllers/app/booking_management/booking_reservation/check_available_dates");
const create_reservation = require("../controllers/app/booking_management/booking_reservation/create_reservation");
const get_all_reservations = require("../controllers/app/booking_management/booking_reservation/get_all_reservations");
const get_booking_dashboard_stats = require("../controllers/app/booking_management/booking_reservation/get_booking_dashboard_stats");
const get_reservation = require("../controllers/app/booking_management/booking_reservation/get_reservation");
const update_booking_status = require("../controllers/app/booking_management/booking_reservation/update_booking_status");
const checkout_reservation = require("../controllers/app/booking_management/booking_reservation/checkout_reservation");
const get_reservation_trend = require("../controllers/app/booking_management/booking_reservation/get_reservation_trend");
const calculate_revenue_trends = require("../controllers/app/booking_management/booking_reservation/calculate_revenue_trends");
const record_checkout_for_revenue = require("../controllers/app/booking_management/booking_reservation/record_checkout_for_revenue");

// -- START OF WATER METER SETTINGS --

const add_water_meter_settings = require("../controllers/app/settings_management/add_water_meter_settings");
const get_water_meter_settings = require("../controllers/app/settings_management/get_water_meter_settings");
const update_water_meter_settings = require("../controllers/app/settings_management/update_water_meter_settings");

// cron
const get_cronjobs = require("../controllers/app/cronjob_management/get_cronjobs");

const upload = require("../middlewares/image_upload");
const headerAuth = require('../plugins/headerAuth');

async function registerRoutes(fastify) {
  const jwt = { preHandler: authenticateJWT };
  const jwt_authentication = require('jsonwebtoken');

  // -- START OF WATER MANAGEMENT --
  const userManagementBaseRoute = "/api/app/user_management";
  const facilityManagementBaseRoute = "/api/app/facility_management";
  const unitManagementBaseRoute = "/api/app/unit_management";
  const appMoveInBaseRoute = "/api/app/move_in";
  const customerManagementBaseRoute = "/api/app/customer_management";
  const visitorManagementBaseRoute = "/api/app/visitor_management";
  const guardManagementBaseRoute = "/api/app/guard_management";
  const accessManagementBaseRoute = "/api/app/entry_and_exit_management";
  const levyManagementBaseRoute = "/api/app/levy_management";
  const faqManagementBaseRoute = "/api/app/faq_management";
  const leaseManagementBaseRoute = "/api/app/lease_management";
  const combinedInvoicesBaseRoute = "/api/app/combined_invoices";
  const handoverManagementBaseRoute = "/api/app/handover_management";
  const ticketManagementBaseRoute = "/api/app/ticket_management";
  const settingsManagementBaseRoute = "/api/app/settings_management";
  const vasManagementBaseRoute = "/api/app/vas_management";
  const paymentManagementBaseRoute = "/api/app/payment_management";
  const campaignManagementBaseRoute = "/api/app/campaign_management";
  const bookingManagementBaseRoute = "/api/app/booking_management";
  const cronManagementBaseRoute = "/api/app/cronjob_management";
  const propertyManagementBaseRoute = "/api/app/property_management";

  fastify.get(
    cronManagementBaseRoute + "/get_cronjobs/:facilityId",
    jwt,
    get_cronjobs,
  );

  fastify.post(
    leaseManagementBaseRoute +
    "/lease_agreements/add_lease_agreement/:facilityId",
    jwt,
    add_lease_agreement,
  );
  fastify.get(
    leaseManagementBaseRoute +
    "/lease_agreements/get_facility_active_leases/:facilityId",
    { preHandler: headerAuth },
    get_facility_lease_agreements_count,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_invoice_by_id/:facilityId/:invoiceId",
    jwt,
    get_invoice_by_id,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_facility_invoices/:facilityId",
    jwt,
    get_facility_invoices,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_withholdingtax_records/:facilityId",
    jwt,
    get_withholdingtax_records,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_lease_invoices/:facilityId",
    jwt,
    get_lease_invoices,
  );
  fastify.get(
    levyManagementBaseRoute +
    "/invoices/get_single_lease_invoice/:facilityId/:invoiceId",
    jwt,
    get_single_lease_invoice,
  );

  fastify.get(
    levyManagementBaseRoute +
    "/invoices/export/:facilityId",
    jwt,
    exportLevyInvoices,
  );

  fastify.delete(
    levyManagementBaseRoute + "/delete_invoice/:facilityId/:invoiceId",

    delete_invoice,
  );
  fastify.get(
    leaseManagementBaseRoute +
    "/lease_agreements/get_lease/:facilityId/:leaseId",
    jwt,
    get_lease,
  );
  fastify.get(
    leaseManagementBaseRoute + "/lease_agreements/get_leases/:facilityId",
    jwt,
    get_leases,
  );
  fastify.put(
    leaseManagementBaseRoute +
    "/lease_agreements/update_lease/:facilityId/:leaseId",
    jwt,
    update_lease,
  );
  fastify.get(
    "/api/app/lease_management/lease_agreements/get_documents/:facilityId/:leaseId",
    jwt,
    get_lease_documents,
  );
  fastify.post(
    leaseManagementBaseRoute +
    "/lease_agreements/terminate_lease/:facilityId/:leaseId",
    jwt,
    terminate_lease,
  );
  fastify.delete(
    leaseManagementBaseRoute +
    "/lease_agreements/delete_lease/:facilityId/:leaseId",
    jwt,
    delete_lease,
  );
  fastify.put(
    leaseManagementBaseRoute +
    "/lease_agreements/update_lease_status/:facilityId/:leaseId",
    jwt,
    update_lease_status,
  );
  // In the routes file, add this within the registerRoutes function
  fastify.post(
    leaseManagementBaseRoute +
    "/lease_agreements/renew_lease/:facilityId/:leaseId",
    jwt,
    renew_lease,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_templates/get_lease_templates/:facilityId",
    jwt,
    get_lease_templates,
  );
  fastify.get(
    leaseManagementBaseRoute +
    "/lease_templates/get_lease_template/:facilityId/:templateId",
    jwt,
    get_lease_template,
  );
  fastify.post(
    leaseManagementBaseRoute +
    "/lease_templates/create_lease_template/:facilityId",
    jwt,
    create_lease_template,
  );
  fastify.post(
    leaseManagementBaseRoute +
    "/lease_templates/update_lease_template/:facilityId/:templateId",
    jwt,
    update_lease_template,
  );
  fastify.delete(
    leaseManagementBaseRoute +
    "/lease_templates/delete_lease_template/:facilityId/:templateId",
    jwt,
    delete_lease_template,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_templates/get_lease_data_for_template/:facilityId/:leaseId",
    jwt,
    get_lease_data_for_template,
  );

  // lease penalties
  fastify.post(
    leaseManagementBaseRoute +
    "/lease_penalties/create_lease_penalty/:facilityId",
    jwt,
    create_lease_penalty,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_penalties/get_lease_penalties/:facilityId",
    jwt,
    get_lease_penalties,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_penalties/get_single_penalty/:facilityId/:penaltyId",
    jwt,
    get_lease_penalty,
  );

  fastify.put(
    leaseManagementBaseRoute +
    "/lease_penalties/update_lease_penalty/:facilityId/:penaltyId",
    jwt,
    update_lease_penalty,
  );

  fastify.patch(
    leaseManagementBaseRoute +
    "/lease_penalties/penalty_status/:facilityId/:penaltyId",
    jwt,
    toggle_lease_penalty_status,
  );

  // lease reminders
  fastify.post(
    leaseManagementBaseRoute +
    "/lease_reminders/create_lease_reminder/:facilityId",
    jwt,
    create_lease_reminder,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_reminders/get_lease_reminders/:facilityId",
    jwt,
    get_lease_reminders,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_reminders/get_single_reminder/:facilityId/:reminderId",
    jwt,
    get_lease_reminder,
  );

  fastify.put(
    leaseManagementBaseRoute +
    "/lease_reminders/update_lease_reminder/:facilityId/:reminderId",
    jwt,
    update_lease_reminder,
  );

  fastify.patch(
    leaseManagementBaseRoute +
    "/lease_reminders/reminder_status/:facilityId/:reminderId",
    jwt,
    toggle_lease_reminder_status,
  );


  // combined invoices

  fastify.get(
    combinedInvoicesBaseRoute +
    "/get_facility_invoices/:facilityId",
    jwt,
    get_facility_combined_invoices,
  );

  // fastify.get(
  //   combinedInvoicesBaseRoute +
  //   "/lease_reminders/get_single_reminder/:facilityId/:reminderId",
  //   jwt,
  //   get_tenant_combined_invoice,
  // );

  fastify.get(
    combinedInvoicesBaseRoute +
    "/get_single_invoice/:facilityId/:combinedInvoiceId",
    jwt,
    view_combined_invoice,
  );


  // Generate on Demand Invoices for a Tenant

  fastify.post(
    leaseManagementBaseRoute + "/lease_agreements/generate_tenant_invoice",
    jwt,
    generate_tenant_invoice,
  );

  fastify.post(
    leaseManagementBaseRoute +
    "/lease_agreements/generate_facility_invoices/:facilityId",
    jwt,
    generate_facility_invoices,
  );

  // Lease reports

  fastify.get(
    leaseManagementBaseRoute + "/lease_reports/rent-roll/:facilityId",
    jwt,
    get_rent_roll_report,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_reports/expiry-pipeline/:facilityId",
    jwt,
    get_lease_expiry_pipeline,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_reports/rent-escalation/:facilityId",
    jwt,
    get_rent_escalation_tracker,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/lease_reports/unbilled/:facilityId",
    jwt,
    get_unbilled_report,
  );

  fastify.get(
    leaseManagementBaseRoute +
    "/:facilityId/lease-agreements/monthly-summary",
    jwt,
    get_lease_monthly_report,
  );


  // Levy reports

  fastify.get(
    levyManagementBaseRoute + "/levy_reports/collection_vs_budget/:facilityId",
    jwt,
    get_collections_vs_budget_report,
  );
  fastify.get(
    levyManagementBaseRoute + "/levy_reports/levy_facility_compliance/:facilityId",
    jwt,
    get_levy_compliance_report,
  );
  fastify.get(
    levyManagementBaseRoute + "/levy_reports/levy_aging/:facilityId",
    jwt,
    get_levy_againg_report,
  );
  fastify.get(
    levyManagementBaseRoute + "/levy_reports/levy_reconciliation/:facilityId",
    jwt,
    get_reconciliation_report,
  );
  fastify.get(
    levyManagementBaseRoute + "/:facilityId/levy-contracts/monthly-summary",
    jwt,
    get_levy_monthly_report,
  );

  // Get most recent approval entry for a facility and invoice type
  fastify.get(
    levyManagementBaseRoute + "/invoice-approvals/:facilityId/:invoiceType/current",
    jwt,
    get_current_approvals,
  );

  // Get all approval entries for a facility (with optional filters)
  fastify.get(
    levyManagementBaseRoute + "/invoice-approvals/:facilityId",
    jwt,
    get_all_invoie_approvals,
  );

  // Approve or reject invoice generation
  fastify.post(
    levyManagementBaseRoute + "/invoice-approvals/:approvalId/action",
    jwt,
    approve_manual_invoice,
  );

  // Lease balances
  fastify.get(
    leaseManagementBaseRoute +
    "/lease_balances/get_lease_balances/:facilityId",
    jwt,
    get_lease_balances,
  );
  // Lease balances

  // Levy balances
  fastify.get(
    levyManagementBaseRoute +
    "/get_levy_balances/:facilityId",
    jwt,
    get_levy_balances,
  );
  // Levy balances

  // user management
  fastify.get(
    userManagementBaseRoute + "/get_list_of_companies",
    jwt,
    get_list_of_companies,
  );
  fastify.get(
    userManagementBaseRoute + "/get_list_of_facilities",
    jwt,
    get_list_of_facilities,
  );
  fastify.post(
    userManagementBaseRoute + "/add_user/:facilityId",
    jwt,
    add_user,
  );
  fastify.get(
    userManagementBaseRoute + "/get_users/:facilityId",
    jwt,
    get_users,
  );
  fastify.get(userManagementBaseRoute + "/get_property_admin_and_finance/:facilityId", { preHandler: headerAuth }, get_property_admin_and_finance);
  fastify.post(
    userManagementBaseRoute + "/update_user/:facilityId/:userId",
    jwt,
    update_user,
  );
  fastify.delete(
    userManagementBaseRoute + "/delete_user/:facilityId",
    jwt,
    delete_user,
  );

  // facility management
  fastify.get(
    facilityManagementBaseRoute + "/get_facilities/:companyId",
    jwt,
    get_facilities,
  );
  fastify.post(
    facilityManagementBaseRoute + "/finish_onboarding/:facilityId",
    jwt,
    finish_onboarding,
  );
  fastify.get(
    facilityManagementBaseRoute + "/get_divisions/:facilityId",
    jwt,
    get_divisions,
  );
  fastify.get(
    facilityManagementBaseRoute + "/get_units_for_facility/:facilityId",
    jwt,
    get_units_for_facility,
  );

  //property management
  fastify.get(
    propertyManagementBaseRoute + "/get_property_managed_units/:facilityId",
    jwt,
    get_property_managed_units,
  );

  fastify.get(
    propertyManagementBaseRoute + "/invoices/get_property_managed_invoices/:facilityId",
    jwt,
    get_property_managed_invoices,
  );

  fastify.get(
    propertyManagementBaseRoute + "/get_property_manager_revenue/:facilityId",
    jwt,
    get_property_manager_revenue,
  );

  fastify.post(
    propertyManagementBaseRoute + "/save_property_manager_revenue/:facilityId",
    jwt,
    save_property_manager_revenue,
  );

  fastify.post(
    propertyManagementBaseRoute + "/calculate_and_save_property_manager_revenue/:facilityId/:invoiceId",
    jwt,
    calculate_and_save_property_manager_revenue,
  );

  fastify.get(
    propertyManagementBaseRoute + "/get_property_managed_customers/:facilityId",
    jwt,
    get_property_managed_customers,
  );

  fastify.post(
    propertyManagementBaseRoute + "/contracts/create_property_manager_contract/:facilityId",
    jwt,
    create_property_manager_contract,
  );

  fastify.get(
    propertyManagementBaseRoute + "/contracts/get_property_manager_contracts/:facilityId",
    jwt,
    get_property_manager_contracts,
  );

  fastify.get(
    propertyManagementBaseRoute + "/contracts/get_property_manager_contract/:facilityId/:contractId",
    jwt,
    get_property_manager_contract,
  );

  fastify.put(
    propertyManagementBaseRoute + "/contracts/terminate_property_manager_contract/:facilityId/:contractId",
    jwt,
    terminate_property_manager_contract,
  );
  fastify.put(
    propertyManagementBaseRoute + "/contracts/edit_property_manager_contract/:facilityId/:contractId",
    jwt,
    edit_property_manager_contract,
  );


  // unit management
  fastify.get(
    unitManagementBaseRoute + "/get_unit/:facilityId/:unitId",
    jwt,
    get_unit,
  );
  fastify.get(
    unitManagementBaseRoute + "/get_unit_occupants/:facilityId/:unitId",
    jwt,
    get_unit_occupants,
  );
  fastify.get(
    unitManagementBaseRoute + "/get_unit_assets/:unitId",
    jwt,
    get_unit_assets,
  );
  fastify.get(
    unitManagementBaseRoute + "/get_facility_units/:facilityId",
    jwt,
    get_facility_units,
  );
  fastify.delete(
    unitManagementBaseRoute + "/delete_unit_asset/:unitId",
    jwt,
    delete_unit_asset,
  );
  fastify.post(
    unitManagementBaseRoute + "/add_new_unit_asset/:unitId",
    jwt,
    add_new_unit_asset,
  );
  fastify.post(
    unitManagementBaseRoute + "/update_unit/:facilityId/:unitId",
    jwt,
    update_unit,
  );
  fastify.post(
    unitManagementBaseRoute + "/upload_unit_documents/:facilityId/:unitId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("file"),
        (req, res, next) => {
          next();
        },
      ],
    },
    upload_unit_documents,
  );
  fastify.get(
    unitManagementBaseRoute + "/get_unit_documents/:facilityId/:unitId",
    jwt,
    get_unit_documents,
  );
  fastify.get(
    unitManagementBaseRoute +
    "/get_unit_statement_of_accounts/:facilityId/:customerId/:unitId",
    jwt,
    get_unit_statement_of_accounts,
  );
  fastify.get(unitManagementBaseRoute + "/get_unit_invoices/:facilityId/:unitId", jwt, get_unit_invoices);
  fastify.get(unitManagementBaseRoute + "/get_landlord_unpaid_invoices/:facilityId/:customerId", jwt, get_landlord_unpaid_invoices);

  // Move-In integration for PayServe-managed facility units
  fastify.get(
    appMoveInBaseRoute + "/units/:facilityId",
    jwt,
    get_app_move_in_units,
  );
  fastify.put(
    appMoveInBaseRoute + "/units/:facilityId/:unitId/listing",
    jwt,
    upsert_app_move_in_listing,
  );
  fastify.put(
    appMoveInBaseRoute + "/units/:facilityId/:unitId/submit",
    jwt,
    submit_app_move_in_listing,
  );
  fastify.put(
    appMoveInBaseRoute + "/:facilityId/deals/:dealId/convert",
    jwt,
    convert_app_move_in_deal,
  );
  fastify.put(
    appMoveInBaseRoute + "/deals/:dealId/convert",
    jwt,
    convert_app_move_in_deal,
  );

  // customer management
  fastify.get(
    customerManagementBaseRoute + "/get_customers/:facilityId",
    jwt,
    get_customers,
  );
  fastify.get(
    customerManagementBaseRoute + "/get_customer/:customerId",
    jwt,
    get_customer,
  );
  fastify.get(
    customerManagementBaseRoute + "/enable_customer/:customerId",
    jwt,
    enable_customer,
  );
  fastify.get(
    customerManagementBaseRoute + "/disable_customer/:customerId",
    jwt,
    disable_customer,
  );
  fastify.get(
    customerManagementBaseRoute + "/get_customer_units/:facilityId/:customerId",
    jwt,
    get_customer_units,
  );
  fastify.get(
    customerManagementBaseRoute +
    "/get_family_members_for_customer/:customerId",
    jwt,
    get_family_members_for_customer,
  );
  fastify.get(
    customerManagementBaseRoute + "/get_vehicles_for_customer/:customerId",
    jwt,
    get_vehicles_for_customer,
  );
  fastify.get(
    customerManagementBaseRoute + "/get_staff_for_customer/:customerId",
    jwt,
    get_staff_for_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/add_new_customer/:facilityId",
    jwt,
    add_new_customer,
  );

  fastify.post(
    customerManagementBaseRoute + "/import_kra_pins/:facilityId",
    {
      preHandler: [authenticateJWT, upload.single('file')]
    },
    import_kra_pins
  );

  fastify.post(
    customerManagementBaseRoute + "/resend_credentials/:customerId/:facilityId",
    jwt,
    resend_credentials,
  );
  fastify.post(
    customerManagementBaseRoute + "/import_customers/:facilityId",
    jwt,
    import_customers,
  );
  fastify.post(
    customerManagementBaseRoute + "/update_customer/:customerId",
    jwt,
    update_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/change_user_type/:customerId/:facilityId",
    jwt,
    change_user_type,
  );
  fastify.post(
    customerManagementBaseRoute + "/update_nextofkin/:customerId/:nextofkinId",
    jwt,
    update_nextofkin,
  );
  fastify.post(
    customerManagementBaseRoute + "/add_nextofkin/:customerId",
    jwt,
    add_nextofkin,
  );
  fastify.post(
    customerManagementBaseRoute +
    "/add_unoccupied_unit_to_customer/:facilityId/:customerId",
    jwt,
    add_unoccupied_unit_to_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/deactivate_customer/:facilityId/:unitId",
    jwt,
    deactivate_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/deactivate_landlord/:facilityId",
    jwt,
    deactivate_landlord,
  );
  fastify.post(
    customerManagementBaseRoute + "/add_family_member_to_customer/:customerId",
    jwt,
    add_family_member_to_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/add_vehicle_to_customer/:customerId",
    jwt,
    add_vehicle_to_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/add_staff_to_customer/:customerId",
    jwt,
    add_staff_to_customer,
  );
  fastify.post(
    customerManagementBaseRoute + "/handle_family_status/:customerId/:familyId",
    jwt,
    handle_family_status,
  );
  fastify.delete(
    customerManagementBaseRoute + "/delete_family/:customerId/:familyId",
    jwt,
    delete_family,
  );
  fastify.post(
    customerManagementBaseRoute +
    "/handle_vehicle_status/:customerId/:vehicleId",
    jwt,
    handle_vehicle_status,
  );
  fastify.delete(
    customerManagementBaseRoute + "/delete_vehicle/:customerId/:vehicleId",
    jwt,
    delete_vehicle,
  );
  fastify.post(
    customerManagementBaseRoute + "/handle_staff_status/:customerId/:staffId",
    jwt,
    handle_staff_status,
  );
  fastify.delete(
    customerManagementBaseRoute + "/delete_staff/:customerId/:staffId",
    jwt,
    delete_staff,
  );
  fastify.post(
    customerManagementBaseRoute +
    "/upload_customer_documents/:facilityId/:customerId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("file"),
        (req, res, next) => {
          next();
        },
      ],
    },
    upload_customer_documents,
  );
  fastify.get(
    customerManagementBaseRoute +
    "/get_customer_documents/:facilityId/:customerId",
    jwt,
    get_customer_documents,
  );
  fastify.get(
    customerManagementBaseRoute +
    "/get_statement_of_accounts/:facilityId/:customerId",
    jwt,
    get_statement_of_accounts,
  );
  fastify.post(
    customerManagementBaseRoute + "/move_customer/:facilityId",
    jwt,
    move_customer,
  );

  // visitor management
  fastify.get(
    visitorManagementBaseRoute + "/get_visitor_log/:visitLogId",
    jwt,
    get_visit_log,
  );
  fastify.get(
    visitorManagementBaseRoute + "/get_visitor_logs/:facilityId",
    jwt,
    get_visitor_logs,
  );
  fastify.get(
    visitorManagementBaseRoute + "/get_waiting_list/:facilityId",
    jwt,
    get_waiting_list,
  );
  fastify.get(
    visitorManagementBaseRoute + "/search_by_otp/:visitationCode",
    jwt,
    search_by_otp,
  );
  fastify.get(
    visitorManagementBaseRoute + "/delete_visitor/:visitorId",
    jwt,
    delete_visitor,
  );
  fastify.post(
    visitorManagementBaseRoute + "/request_visit_confirmation",
    jwt,
    request_visit_confirmation,
  );
  fastify.get(
    visitorManagementBaseRoute + "/get_facility_visitors/:facilityId",
    jwt,
    get_facility_visitors,
  );
  fastify.post(
    visitorManagementBaseRoute + "/visitor_pre_registration/:facilityId",
    jwt,
    visitor_pre_registration,
  );
  fastify.post(
    visitorManagementBaseRoute + "/delivery_registration/:facilityId",
    jwt,
    delivery_registration,
  );
  fastify.post(
    visitorManagementBaseRoute + "/exit_visit_log/:facilityId/:visitLogId",
    jwt,
    exit_visit_log,
  );
  fastify.post(
    visitorManagementBaseRoute + "/allow_visit/:visitLogId",
    jwt,
    allow_visit,
  );
  fastify.post(
    visitorManagementBaseRoute + "/allow_visitor/:facilityId/:visitLogId",
    jwt,
    allow_visitor,
  );
  fastify.post(
    visitorManagementBaseRoute + "/confirm_qr_data/:facilityId",
    jwt,
    confirm_qr_data,
  );
  fastify.post(
    visitorManagementBaseRoute + "/manual_entry/:facilityId",
    jwt,
    manual_entry,
  );
  fastify.post(
    visitorManagementBaseRoute + "/allow_verified_visitor/:facilityId",
    jwt,
    allow_verified_visitor,
  );

  // guard management
  fastify.get(
    guardManagementBaseRoute + "/get_facility_guards/:facilityId",
    jwt,
    get_facility_guards,
  );
  fastify.get(
    visitorManagementBaseRoute + "/get_visit_log/:facilityId/:visitLogId",
    jwt,
    get_visit_log,
  );
  fastify.get(
    guardManagementBaseRoute + "/get_guard_time",
    jwt,
    get_guard_time,
  );
  fastify.post(
    guardManagementBaseRoute + "/add_guard/:facilityId",
    jwt,
    add_guard,
  );
  fastify.post(
    guardManagementBaseRoute + "/edit_facility_guard/:facilityId/:guardId",
    jwt,
    edit_facility_guard,
  );
  fastify.delete(
    guardManagementBaseRoute + "/delete_facility_guard/:facilityId/:guardId",
    jwt,
    delete_facility_guard,
  );
  fastify.patch(
    guardManagementBaseRoute + "/disable_facility_guard/:facilityId/:guardId",
    jwt,
    disable_facility_guard,
  );

  // access management
  fastify.get(
    accessManagementBaseRoute +
    "/get_entries_and_exits_for_facility/:facilityId",
    jwt,
    get_entries_and_exits_for_facility,
  );
  fastify.post(
    accessManagementBaseRoute +
    "/edit_entries_and_exits_for_facility/:facilityId/:accessId",
    jwt,
    edit_entries_and_exits_for_facility,
  );
  fastify.post(
    accessManagementBaseRoute + "/add_entry_and_exit/:facilityId",
    jwt,
    add_entry_and_exit,
  );
  fastify.delete(
    accessManagementBaseRoute +
    "/delete_entries_and_exits_for_facility/:facilityId/:accessId",
    jwt,
    delete_entries_and_exits_for_facility,
  );
  fastify.patch(
    accessManagementBaseRoute +
    "/disable_entries_and_exits_for_facility/:facilityId/:accessId",
    jwt,
    disable_entries_and_exits_for_facility,
  );

  // Levy Management
  fastify.get(
    levyManagementBaseRoute + "/get_levies/:facilityId",
    jwt,
    get_levies,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_contracts/:facilityId",
    jwt,
    get_contracts,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_active_contracts/:facilityId",
    { preHandler: headerAuth },
    get_facility_active_contracts,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_contract/:facilityId/:contractId",
    jwt,
    get_contract,
  );
  fastify.post(
    levyManagementBaseRoute + "/add_contract/:facilityId",
    jwt,
    add_contract,
  );
  fastify.put(
    levyManagementBaseRoute + "/edit_contract/:facilityId/:contractId",
    jwt,
    edit_contract,
  );
  fastify.patch(
    levyManagementBaseRoute + "/terminate_levy_contract/:facilityId/:contractId",
    jwt,
    terminate_levy_contract,
  );
  fastify.delete(
    levyManagementBaseRoute + "/delete_contract/:facilityId/:contractId",
    jwt,
    delete_contract,
  );
  fastify.post(
    levyManagementBaseRoute + "/disable_contract/:facilityId/:contractId",
    jwt,
    disable_contract,
  );

  fastify.post(
    levyManagementBaseRoute + "/add_levy/:facilityId",
    jwt,
    add_levy,
  );
  fastify.put(
    levyManagementBaseRoute + "/edit_levy/:facilityId/:levyId",
    jwt,
    edit_levy,
  );
  fastify.delete(
    levyManagementBaseRoute + "/delete_levy/:facilityId/:levyId",
    jwt,
    delete_levy,
  );
  fastify.post(
    levyManagementBaseRoute + "/disable_levy/:facilityId/:levyId",
    jwt,
    disable_levy,
  );

  fastify.post(
    levyManagementBaseRoute + "/add_levy_type/:facilityId",
    jwt,
    add_levy_type,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_levy_types/:facilityId",
    jwt,
    get_levy_types,
  );
  fastify.put(
    levyManagementBaseRoute + "/edit_levy_type/:facilityId/:levyTypeId",
    jwt,
    edit_levy_type,
  );
  fastify.delete(
    levyManagementBaseRoute + "/delete_levy_type/:facilityId/:levyTypeId",
    jwt,
    delete_levy_type,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_company_information/:facilityId",
    jwt,
    get_company_information,
  );

  //update facility settings
  fastify.post(
    settingsManagementBaseRoute + "/update_facility/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("image"),
        (req, res, next) => {
          next();
        },
      ],
    },
    update_facility,
  );

  fastify.post(
    settingsManagementBaseRoute + "/add_document_type/:facilityId",
    jwt,
    add_document_type,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_document_types/:facilityId",
    jwt,
    get_document_types,
  );
  fastify.post(
    settingsManagementBaseRoute + "/add_faq",
    jwt,
    add_faq,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_faqs",
    jwt,
    get_faqs,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_offline_faqs",
    get_offline_faqs,
  );
  fastify.post(
    settingsManagementBaseRoute + "/add_privacy_policy",
    jwt,
    add_privacy_policy,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_privacy_policy",
    get_privacy_policy,
  );
  fastify.post(
    settingsManagementBaseRoute + "/add_terms_and_conditions",
    jwt,
    add_terms_and_conditions,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_terms_and_conditions",
    get_terms_and_conditions,
  );
  fastify.post(
    settingsManagementBaseRoute + "/add_community_guidelines/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("file"),
        (req, res, next) => {
          console.log("File in middleware:", req.file);
          console.log("Body in middleware:", req.body);
          next();
        },
      ],
    },
    add_community_guidelines,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_community_guidelines/:facilityId",
    jwt,
    get_community_guidelines,
  );


  // Add new tax rate
  fastify.post(
    settingsManagementBaseRoute + "/add_or_update_tax_rate/:facilityId",
    jwt,
    add_or_update_tax_rate,
  );
  // Update invoice payment
  fastify.post(
    settingsManagementBaseRoute + "/update_invoice_payment/:accountNumber",
    update_invoice_payment,
  );
  // Update existing tax rate
  fastify.put(
    settingsManagementBaseRoute + "/add_or_update_tax_rate/:facilityId/:taxId",
    jwt,
    add_or_update_tax_rate,
  );
  //add sms settings
  fastify.post(
    settingsManagementBaseRoute + "/add_sms_settings/:facilityId",
    jwt,
    add_sms_settings,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_sms_settings/:facilityId",
    get_sms_settings,
  );
  //add_email_settings
  fastify.post(
    settingsManagementBaseRoute + "/add_email_settings/:facilityId",
    jwt,
    add_email_settings,
  );
  fastify.get(
    settingsManagementBaseRoute + "/get_email_settings/:facilityId",
    get_email_settings,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_tax_rates/:facilityId",
    jwt,
    get_tax_rates,
  );
  fastify.delete(
    settingsManagementBaseRoute + "/delete_tax_rate/:facilityId/:taxId",
    jwt,
    delete_tax_rate,
  );

  // CURRENCY SETTINGS

  fastify.post(
    settingsManagementBaseRoute + "/add_currency/:facilityId",
    jwt,
    add_currency,
  );

  fastify.delete(
    settingsManagementBaseRoute + "/delete_currency/:facilityId/:currencyId",
    jwt,
    delete_currency,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_currencies/:facilityId",
    jwt,
    get_currencies,
  );

  fastify.put(
    settingsManagementBaseRoute + "/edit_currency/:facilityId/:currencyId",
    jwt,
    edit_currency,
  );


  // DEPARTMENT SETTINGS


  fastify.post(
    settingsManagementBaseRoute + "/add_department/:facilityId",
    jwt,
    add_department,
  );

  fastify.delete(
    settingsManagementBaseRoute + "/delete_department/:facilityId/:departmentId",
    jwt,
    delete_department,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_departments/:facilityId",
    jwt,
    get_departments,
  );

  fastify.put(
    settingsManagementBaseRoute + "/edit_department/:facilityId/:departmentId",
    jwt,
    update_department,
  );

  // WATER METER SETTINGS

  fastify.post(
    settingsManagementBaseRoute + "/add-meter-settings/:facilityId",
    jwt,
    add_water_meter_settings,
  );

  fastify.put(
    settingsManagementBaseRoute + "/update-settings/:facilityId",
    jwt,
    update_water_meter_settings,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get-meter-settings/:facilityId",
    jwt,
    get_water_meter_settings,
  );

  // Getting a Meter settings no jwt for service
  fastify.get(
    settingsManagementBaseRoute + "/get-meter-settings/service/:facilityId",
    get_water_meter_settings,
  );

  //Bank details settings management
  fastify.get(
    settingsManagementBaseRoute + "/get_bank_details/:facilityId",
    jwt,
    get_bank_details,
  );

  fastify.post(
    settingsManagementBaseRoute + "/add_bank_details/:facilityId",
    jwt,
    add_bank_details,
  );

  fastify.put(
    settingsManagementBaseRoute + "/update_bank_details/:facilityId/:bankDetailsId",
    jwt,
    update_bank_details,
  );

  fastify.delete(
    settingsManagementBaseRoute + "/delete_bank_details/:facilityId/:bankDetailsId",
    jwt,
    delete_bank_details,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_bank_details_by_id/:facilityId/:bankDetailsId",
    jwt,
    get_bank_details_by_id,
  );

  // ZOHO INTEGRATION SETTINGS MANAGEMENT

  fastify.post(
    settingsManagementBaseRoute + "/add_zoho_config/:facilityId",
    jwt,
    add_zoho_config,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_zoho_config/:facilityId",
    // jwt,
    get_zoho_config,
  );

  fastify.put(
    settingsManagementBaseRoute + "/update_zoho_config/:facilityId",
    jwt,
    update_zoho_config,
  );

  fastify.delete(
    settingsManagementBaseRoute + "/delete_zoho_config/:facilityId",
    jwt,
    delete_zoho_config,
  );

  fastify.post(
    settingsManagementBaseRoute + "/test_zoho_connection/:facilityId",
    jwt,
    test_zoho_connection,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_zoho_stats/:facilityId",
    jwt,
    get_zoho_stats,
  );


  // QUICKBOOKS INTEGRATION SETTINGS MANAGEMENT

  fastify.post(
    settingsManagementBaseRoute + "/add_quickbooks_config/:facilityId",
    jwt,
    add_quickbooks_config,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_quickbooks_config/:facilityId",
    // jwt,
    get_quickbooks_config,
  );

  fastify.put(
    settingsManagementBaseRoute + "/update_quickbooks_config/:facilityId",
    jwt,
    update_quickbooks_config,
  );

  // OAuth connection routes
  fastify.get(
    settingsManagementBaseRoute + "/connect_quickbooks/:facilityId",
    // No JWT needed - will redirect to QuickBooks
    connect_quickbooks,
  );

  fastify.post(
    settingsManagementBaseRoute + "/disconnect_quickbooks/:facilityId",
    jwt,
    disconnect_quickbooks,
  );

  // OAuth callback route (NO JWT - public endpoint for QuickBooks to redirect back)
  fastify.get(
    "/api/quickbooks/callback",
    quickbooks_callback,
  );

  // Bank details for levy
  fastify.get(
    settingsManagementBaseRoute + "/get_bank_details_for_levy/:facilityId/:bankDetailsId",
    jwt,
    getBankDetailsForLevy,
  );

  // Biller Address Management  
  fastify.get(
    settingsManagementBaseRoute + "/get_biller_addresses/:facilityId",
    jwt,
    get_biller_addresses,
  );

  fastify.post(
    settingsManagementBaseRoute + "/add_biller_address/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("digitalSignature"),
        (req, res, next) => {
          console.log("File in middleware:", req.file);
          console.log("Body in middleware:", req.body);
          next();
        },
      ],
    },
    add_biller_address,
  );

  fastify.get(
    settingsManagementBaseRoute + "/get_biller_address_by_id/:facilityId/:billerAddressId",
    jwt,
    get_biller_address_by_id,
  );

  fastify.get('/api/public/default_biller_address/:facilityId', get_default_biller_address);

  fastify.delete(
    settingsManagementBaseRoute + "/delete_biller_address/:facilityId/:billerAddressId",
    jwt,
    delete_biller_address,
  );

  fastify.put(
    settingsManagementBaseRoute + "/update_biller_address/:facilityId/:billerAddressId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("logo"),
        (req, res, next) => {
          next();
        },
      ],
    },
    update_biller_address,
  );

  // Invoice Schedule settings management
  fastify.get(
    settingsManagementBaseRoute + "/get_invoice_schedules/:facilityId",
    jwt,
    get_invoice_schedules,
  );

  fastify.post(
    settingsManagementBaseRoute + "/add_invoice_schedule/:facilityId",
    jwt,
    add_invoice_schedule,
  );
  fastify.put(
    settingsManagementBaseRoute + "/edit_schedule_date/:scheduleId",
    jwt,
    update_invoice_schedule,
  );


  // Biller address for levy
  fastify.get(
    settingsManagementBaseRoute + "/get_biller_address_for_levy/:facilityId/:billerAddressId",
    jwt,
    getBillerAddressForLevy,
  );

  fastify.post(
    levyManagementBaseRoute + "/reminders/add_reminder/:facilityId",
    jwt,
    add_reminder,
  );
  fastify.post(
    levyManagementBaseRoute + "/penalty/add_penalty/:facilityId",
    jwt,
    add_penalty,
  );

  fastify.get(
    levyManagementBaseRoute + "/get_facility_reminders/:facilityId/:module",
    jwt,
    get_facility_reminders,
  );
  fastify.get(
    levyManagementBaseRoute + "/get_facility_penalties/:facilityId/:module",
    jwt,
    get_facility_penalties,
  );
  fastify.put(
    levyManagementBaseRoute +
    "/penalty/update_penalty_status/:facilityId/:penaltyId",
    jwt,
    update_penalty_status,
  );
  fastify.put(
    levyManagementBaseRoute +
    "/reminders/update_reminder_status/:facilityId/:reminderId",
    jwt,
    update_reminder_status,
  );
  fastify.delete(
    levyManagementBaseRoute + "/penalty/delete_penalty/:facilityId/:penaltyId",
    jwt,
    delete_penalty,
  );
  fastify.delete(
    levyManagementBaseRoute +
    "/reminders/delete_reminder/:facilityId/:reminderId",
    jwt,
    delete_reminder,
  );
  fastify.post(
    levyManagementBaseRoute + "/add_levy_settings/:facilityId",
    jwt,
    add_levy_settings,
  );

  fastify.get(
    levyManagementBaseRoute + "/show_levy_settings/:facilityId",
    jwt,
    show_levy_settings,
  );

  fastify.put(
    levyManagementBaseRoute + "/edit_levy_settings/:facilityId",
    jwt,
    edit_levy_settings,
  );
  // -- END OF LEVY MANAGEMENT --

  //Value added services
  fastify.post(
    vasManagementBaseRoute + "/add_new_value_added_service/:facilityId",
    jwt,
    add_new_value_added_service,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_value_added_services/:facilityId",
    jwt,
    get_value_added_services,
  );
  fastify.post(
    vasManagementBaseRoute + "/add_vas_vendor/:facilityId",
    jwt,
    add_vas_vendor,
  );
  fastify.delete(
    vasManagementBaseRoute + "/delete_vas_vendor/:facilityId/:vendorId",
    jwt,
    delete_vas_vendor,
  );
  fastify.post(
    vasManagementBaseRoute + "/update_vas_vendor/:facilityId/:vendorId",
    jwt,
    update_vas_vendor,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_vas_vendors/:facilityId",
    jwt,
    get_vas_vendors,
  );
  fastify.post(
    vasManagementBaseRoute + "/add_service_request/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("attachment"),
        (req, res, next) => {
          console.log("File in middleware:", req.file);
          console.log("Body in middleware:", req.body);
          next();
        },
      ],
    },
    add_service_request,
  );
  fastify.post(
    vasManagementBaseRoute + "/assign_service_request/:facilityId",
    jwt,
    assign_service_request,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_vendor_request_page",
    get_vendor_request_page,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_pm_request_page",
    get_pm_request_page,
  );
  fastify.post(
    vasManagementBaseRoute + "/vendor_approve_service_request",
    vendor_approve_service_request,
  );
  fastify.post(
    vasManagementBaseRoute + "/vendor_deny_service_request",
    vendor_deny_service_request,
  );
  fastify.post(
    vasManagementBaseRoute + "/pm_approve_quote",
    pm_approve_quote,
  );
  fastify.post(
    vasManagementBaseRoute + "/pm_deny_quote",
    pm_deny_quote,
  );
  fastify.get('/dev/test-pm-token', async (request, reply) => {
    const token = jwt_authentication.sign(
      {
        r: '6a12e9cf2cefac9d2e62fd3f',
        f: '6a0b052a70f0c2354627a64f',
        role: 'pm',
      },
      process.env.VENDOR_TOKEN_SECRET,
      { expiresIn: '1d' }
    );
    return reply.send({
      token,
      url: `${process.env.FACILITY_FRONTEND_URL}/facility/value_added_services/pm-quote?token=${token}`
    });
  });
  fastify.get('/dev/test-token', async (request, reply) => {
    try {
      const token = jwt_authentication.sign(
        {
          r: '6a12e9cf2cefac9d2e62fd3f',
          // v: '69ae966644619ccbb3f5a335',
          f: '6a0b052a70f0c2354627a64f',
        },
        process.env.VENDOR_TOKEN_SECRET,
        { expiresIn: '1d' }
      );

      return reply.send({ token, url: `http://localhost:3000/facility/value_added_services/approve?token=${token}` });

    } catch (err) {
      console.error('TEST TOKEN ERROR:', err.message); // check your terminal
      return reply.code(500).send({ error: err.message }); // shows actual error in browser
    }
  });
  fastify.get(
    vasManagementBaseRoute + "/get_resident_request_page",
    get_resident_request_page,
  );
  fastify.post(
    vasManagementBaseRoute + "/resident_approve_service_request",
    resident_approve_service_request,
  );
  fastify.post(
    vasManagementBaseRoute + "/resident_deny_service_request",
    resident_deny_service_request,
  );
  fastify.get('/dev/test-resident-token', async (request, reply) => {
    const token = jwt_authentication.sign(
      {
        r: '6a12e9cf2cefac9d2e62fd3f',
        f: '6a0b052a70f0c2354627a64f',
      },
      process.env.RESIDENT_TOKEN_SECRET,
      { expiresIn: '1d' }
    );
    return reply.send({ token, url: `http://localhost:3001/resident/value_added_services/quote?token=${token}` });
  });
  fastify.post(
    vasManagementBaseRoute + "/resident_approve_service_request_authenticated/:facilityId",
    jwt,
    resident_approve_service_request_authenticated,
  );
  fastify.post(
    vasManagementBaseRoute + "/resident_deny_service_request_authenticated/:facilityId",
    jwt,
    resident_deny_service_request_authenticated,
  );
  fastify.post(
    vasManagementBaseRoute + "/add_service_invoice/:facilityId",
    jwt,
    add_service_invoice,
  );
  fastify.get(
    vasManagementBaseRoute +
    "/get_service_invoices_by_customer/:facilityId/:customerId",
    jwt,
    get_service_invoices_by_customer,
  );
  fastify.delete(
    vasManagementBaseRoute +
    "/delete_value_added_service/:facilityId/:serviceId",
    jwt,
    delete_value_added_service,
  );
  fastify.get(
    vasManagementBaseRoute +
    "/get_service_requests_by_customer/:facilityId/:customerId",
    jwt,
    get_service_requests_by_customer,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_customer_type/:customerId",
    jwt,
    get_customer_type,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_facility_service_requests/:facilityId",
    jwt,
    get_facility_service_requests,
  );
  fastify.get(
    vasManagementBaseRoute + "/get_work_orders/:facilityId",
    jwt,
    get_work_orders,
  );
  //all invoices
  fastify.get(
    vasManagementBaseRoute + "/get_vas_invoices/:facilityId",
    jwt,
    get_vas_invoices,
  );
  //single invoice
  fastify.get(
    vasManagementBaseRoute + "/get_vas_invoice_by_id/:facilityId/:invoiceId",
    jwt,
    get_vas_invoice_by_id,
  );
  fastify.post(
    vasManagementBaseRoute + "/update_service_request/:facilityId",
    jwt,
    update_service_request,
  );
  fastify.post(
    vasManagementBaseRoute + "/assign_work_order/:facilityId",
    jwt,
    assign_work_order,
  );
  // Replace/add these routes in your app.js routes file:

  // Unit Management Templates Routes
  fastify.get(
    vasManagementBaseRoute +
    "/unit_management_templates/get_unit_management_templates/:facilityId",
    jwt,
    get_unit_management_templates,
  );

  fastify.get(
    vasManagementBaseRoute +
    "/unit_management_templates/get_template/:facilityId/:templateId",
    jwt,
    get_unit_management_template,
  );

  fastify.post(
    vasManagementBaseRoute +
    "/unit_management_templates/create_template/:facilityId",
    jwt,
    create_unit_management_template,
  );

  fastify.put(
    vasManagementBaseRoute +
    "/unit_management_templates/update_template/:facilityId/:templateId",
    jwt,
    update_unit_management_template,
  );

  fastify.delete(
    vasManagementBaseRoute +
    "/unit_management_templates/delete_template/:facilityId/:templateId",
    jwt,
    delete_unit_management_template,
  );

  fastify.get(
    vasManagementBaseRoute +
    "/unit_management_templates/get_unit_management_data_for_template/:facilityId/:managementId",
    jwt,
    get_unit_management_data_for_template,
  );

  fastify.post(
    vasManagementBaseRoute +
    "/unit_management_templates/assign_template_to_service_request/:facilityId/:requestId",
    jwt,
    assign_template_to_service_request,
  );

  fastify.post(
    "/upload_lease_document/:facilityId/:leaseId",
    {
      preHandler: [
        jwt.preHandler,
        upload.single("document"),
        (req, res, next) => {
          console.log("File in middleware:", req.file);
          console.log("Body in middleware:", req.body);
          next();
        },
      ],
    },
    upload_lease_document,
  );

  // Ticket Management
  fastify.post(
    ticketManagementBaseRoute + "/create_ticket/:userId/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.array("images", 5),
        (req, res, next) => {
          console.log("File in middleware:", req.files);
          console.log("Body in middleware:", req.body);
          next();
        },
      ],
    },
    create_ticket,
  );

  fastify.get(
    ticketManagementBaseRoute + "/get_tickets/:facilityId",
    jwt,
    get_tickets,
  );
  fastify.get(
    ticketManagementBaseRoute + "/get_ticket/:facilityId/:ticketId",
    jwt,
    get_ticket,
  );
  fastify.put(ticketManagementBaseRoute + "/mark_ticket_as_read/:facilityId/:ticketId", jwt, mark_ticket_as_read);
  fastify.post(ticketManagementBaseRoute + "/assign_ticket/:facilityId/:ticketId", jwt, assign_ticket);
  fastify.get(ticketManagementBaseRoute + "/get_assigned_tickets/:facilityId/:userId", jwt, get_assigned_tickets);
  fastify.post(ticketManagementBaseRoute + "/approve_ticket/:facilityId/:ticketId", jwt, approve_ticket);
  fastify.post(
    ticketManagementBaseRoute + "/close_ticket/:ticketId/:facilityId",
    jwt,
    close_ticket,
  );
  fastify.post(ticketManagementBaseRoute + "/cancel_ticket/:facilityId/:ticketId", jwt, cancel_ticket);
  fastify.post(ticketManagementBaseRoute + "/reopen_ticket/:facilityId/:ticketId", jwt, reopen_ticket);
  fastify.post(
    ticketManagementBaseRoute + "/approve_complaint/:facilityId/:ticketId",
    jwt,
    approve_complaint,
  );
  fastify.get(
    ticketManagementBaseRoute + "/get_ticket_landlord/:facilityId/:customerId",
    jwt,
    get_ticket_landlord,
  );
  fastify.post(
    ticketManagementBaseRoute + "/finish_review/:ticketId/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.fields([
          { name: "images", maxCount: 5 },
          { name: "costAttachment", maxCount: 1 },
        ]),
        (req, res, next) => {
          next();
        },
      ],
    },
    finish_review,
  );
  fastify.get(
    ticketManagementBaseRoute + "/ticket_reports/:facilityId",
    jwt,
    ticket_reports,
  );

  //handover management
  // Get units that have move-in handovers (for move-out creation)
  fastify.get(
    handoverManagementBaseRoute + "/units_with_move_in/:facilityId",
    jwt,
    get_units_with_move_in,
  );
  fastify.post(
    handoverManagementBaseRoute + "/move_in_handover/:facilityId",
    jwt,
    create_move_in_handover,
  );
  fastify.post(
    handoverManagementBaseRoute + "/move_out_handover/:facilityId",
    jwt,
    create_move_out_handover,
  );
  fastify.put(
    handoverManagementBaseRoute + "/update_handover/:facilityId/:handoverId",
    jwt,
    update_handover,
  );
  fastify.get(
    handoverManagementBaseRoute + "/get_handover/:facilityId/:handoverId",
    jwt,
    get_handover,
  );
  fastify.get(
    handoverManagementBaseRoute + "/public/handover_pdf/:facilityId/:handoverId",
    download_handover_pdf,
  );
  fastify.get(
    handoverManagementBaseRoute + "/share_link/:facilityId/:handoverId",
    jwt,
    get_handover_share_link,
  );
  fastify.post(
    handoverManagementBaseRoute + "/send_email/:facilityId/:handoverId",
    jwt,
    send_handover_email,
  );
  fastify.post(
    handoverManagementBaseRoute + "/send_sms/:facilityId/:handoverId",
    jwt,
    send_handover_sms,
  );
  fastify.get(
    handoverManagementBaseRoute + "/get_all_handovers/:facilityId",
    jwt,
    get_all_handovers,
  );
  fastify.get(
    handoverManagementBaseRoute + "/compare_handovers/:facilityId/:handoverId",
    jwt,
    compare_handovers,
  );
  fastify.delete(
    handoverManagementBaseRoute + "/delete_handover/:facilityId/:handoverId",
    jwt,
    delete_handover,
  );

  // Upload handover images
  fastify.post(
    handoverManagementBaseRoute + "/upload_images/:facilityId/:handoverId",
    {
      preHandler: [
        jwt.preHandler,
        upload.array("images", 10),
        (req, res, next) => {
          next();
        },
      ],
    },
    upload_handover_images,
  );

  //inspection checklist
  fastify.get(
    handoverManagementBaseRoute + "/get_all_inspection_settings/:facilityId",
    jwt,
    get_all_inspection_settings,
  );
  fastify.get(
    handoverManagementBaseRoute +
    "/get_default_inspection_settings/:facilityId",
    jwt,
    get_default_inspection_settings,
  );
  fastify.get(
    handoverManagementBaseRoute +
    "/get_inspection_settings_by_id/:facilityId/:inspectionId",
    jwt,
    get_inspection_settings_by_id,
  );
  fastify.get(
    handoverManagementBaseRoute +
    "/get_inspection_settings_by_category/:facilityId/:inspectionId",
    jwt,
    get_inspection_settings_by_category,
  );
  // Get unit-specific inspection items (for handover creation)
  fastify.get(
    handoverManagementBaseRoute + "/get_unit_inspection_items/:facilityId/:unitId",
    jwt,
    get_unit_inspection_items,
  );
  fastify.post(
    handoverManagementBaseRoute + "/add_inspection_settings/:facilityId",
    {
      preHandler: [
        jwt.preHandler,
        upload.array("images", 5),
        (req, res, next) => {
          next();
        },
      ],
    },
    add_inspection_settings,
  );
  // fastify.post(handoverManagementBaseRoute +
  //   '/upload_excel_template/:facilityId',
  //   { preHandler: upload.single('excelFile') }, jwt,
  //   upload_excel_template
  // );
  fastify.put(
    handoverManagementBaseRoute +
    "/update_inspection_settings/:facilityId/:inspectionId",
    {
      preHandler: [
        jwt.preHandler,
        upload.array("images", 5),
        (req, res, next) => {
          console.log("Update inspection settings - FormData processed");
          next();
        },
      ],
    },
    update_inspection_settings,
  );
  fastify.put(
    handoverManagementBaseRoute +
    "/set_default_inspection_settings/:facilityId/:inspectionId",
    jwt,
    set_default_inspection_settings,
  );
  fastify.delete(
    handoverManagementBaseRoute +
    "/delete_inspection_settings/:facilityId/:inspectionId",
    jwt,
    delete_inspection_settings,
  );

  // Inspection Categories
  fastify.post(
    handoverManagementBaseRoute +
    "/handover_inspection/add_inspection_category/:facilityId",
    jwt,
    add_inspection_category,
  );
  fastify.get(
    handoverManagementBaseRoute +
    "/handover_inspection/get_inspection_categories/:facilityId",
    jwt,
    get_inspection_categories,
  );
  fastify.put(
    handoverManagementBaseRoute +
    "/handover_inspection/update_inspection_category/:facilityId/:categoryId",
    jwt,
    update_inspection_category,
  );
  fastify.delete(
    handoverManagementBaseRoute +
    "/handover_inspection/delete_inspection_category/:facilityId/:categoryId",
    jwt,
    delete_inspection_category,
  );

  // Handover Reports
  fastify.get(
    handoverManagementBaseRoute + "/reports/handover-summary/:facilityId",
    jwt,
    get_handover_summary_report,
  );
  fastify.get(
    handoverManagementBaseRoute + "/reports/inventory-comparison/:facilityId",
    jwt,
    get_inventory_comparison_report,
  );
  fastify.get(
    handoverManagementBaseRoute + "/reports/meter-readings/:facilityId",
    jwt,
    get_meter_readings_report,
  );
  fastify.get(
    handoverManagementBaseRoute + "/reports/completion-metrics/:facilityId",
    jwt,
    get_handover_completion_report,
  );

  //payment management
  fastify.get(
    paymentManagementBaseRoute + "/cash/get_cash_payments/:facilityId",
    jwt,
    get_cash_payments,
  );
  fastify.get(
    paymentManagementBaseRoute + "/cash/check_pending_payment/:facilityId/:invoiceId",
    jwt,
    check_pending_cash_payment,
  );
  fastify.post(
    paymentManagementBaseRoute +
    "/cash/approve_cash_payment/:facilityId/:paymentId",
    jwt,
    approve_cash_payment,
  );
  fastify.post(
    paymentManagementBaseRoute +
    "/cash/reject_cash_payment/:facilityId/:paymentId",
    jwt,
    reject_cash_payment,
  );
  fastify.post(
    paymentManagementBaseRoute +
    "/cash/void_cash_payment/:facilityId/:paymentId",
    jwt,
    void_cash_payment,
  );
  fastify.post(
    paymentManagementBaseRoute + "/cash/record_cash_payment/:facilityId",
    jwt,
    record_cash_payment,
  );
  fastify.post(
    paymentManagementBaseRoute + "/record_wht/:facilityId",
    jwt,
    record_wht,
  );
  fastify.get(
    paymentManagementBaseRoute + "/get_property_managers/:facilityId",
    jwt,
    get_property_managers,
  );

  fastify.post(
    paymentManagementBaseRoute + "/send_to_manager/:facilityId/:invoiceId",
    jwt,
    send_invoice_to_manager,
  );
  // Add credit and debit note management
  fastify.post(
    paymentManagementBaseRoute + "/credit_note/:facilityId",
    jwt,
    create_credit_note,
  );

  fastify.post(
    paymentManagementBaseRoute + "/debit_note/:facilityId",
    jwt,
    create_debit_note,
  );

  fastify.post(
    paymentManagementBaseRoute + "/transfer_credit/:facilityId",
    jwt,
    transfer_credit,
  );
  // Overpayment management routes

  fastify.get(
    paymentManagementBaseRoute + "/get_unpaid_invoices/:facilityId/:clientId",
    jwt,
    get_unpaid_invoices,
  );
  fastify.post(
    paymentManagementBaseRoute + "/apply_overpayment/:facilityId",
    jwt,
    apply_overpayment,
  );

  fastify.get(
    paymentManagementBaseRoute + "/get_credit_invoices/:facilityId/:clientId",
    jwt,
    get_credit_invoices,
  );

  fastify.get(
    paymentManagementBaseRoute + "/get_invoice_reconciliation/:facilityId",
    jwt,
    get_invoice_reconciliation,
  );

  fastify.post(
    campaignManagementBaseRoute + "/add_campaign/:facilityId",
    jwt,
    add_campaign,
  );

  fastify.get(
    campaignManagementBaseRoute + "/get_campaigns/:facilityId",
    jwt,
    get_campaigns,
  );
  fastify.get(
    campaignManagementBaseRoute + "/get_campaign/:facilityId/:campaignId",
    jwt,
    get_campaign,
  );
  fastify.post(
    campaignManagementBaseRoute + "/update_campaign/:facilityId/:campaignId",
    jwt,
    update_campaign,
  );

  //offline invoice
  // Universal public invoice endpoint supporting both levy and lease invoices
  fastify.get(
    "/api/public/invoice/:facilityId/:invoiceId/:type?",
    get_public_invoice,
  );

  fastify.get(
    "/api/public/combined_invoice/:facilityId/:invoiceId/:combined",
    get_public_combined_invoice,
  );

  // Company information endpoint for unauthenticated access
  fastify.get(
    "/api/public/company_information/:facilityId",
    get_unauthenticated_company_information,
  );

  //get_unauthenticated_customer_information
  fastify.get(
    "/api/public/customer_information/:customerId",
    get_unauthenticated_customer_information,
  );

  // PUBLIC ROUTES FOR UNIVERSAL INVOICE PAGE (NO JWT)
  fastify.get(
    "/api/public/bank_details_for_levy/:facilityId/:bankDetailsId",
    getBankDetailsForLevy
  );
  fastify.get(
    "/api/public/biller_address_for_levy/:facilityId/:billerAddressId",
    getBillerAddressForLevy
  );
  fastify.get(
    "/api/public/facility_payment_details/:facilityId/:paymentMethodId",
    getFacilityPaymentDetails
  );
  fastify.get(
    "/api/public/levy/:facilityId/:levyId",
    getLevy
  );
  fastify.get(
    "/api/public/contract/:facilityId/:contractId",
    get_contract
  );
  fastify.get(
    "/api/public/lease/:facilityId/:leaseId",
    get_lease
  );


  // Booking Property Management
  fastify.post(
    bookingManagementBaseRoute + "/create_booking_property/:facilityId",
    jwt,
    create_booking_property,
  );

  fastify.put(
    bookingManagementBaseRoute +
    "/update_booking_property/:facilityId/:propertyId",
    jwt,
    update_booking_property,
  );

  fastify.get(
    bookingManagementBaseRoute + "/get_all_units_and_booking_properties/:facilityId",
    jwt,
    get_all_units_and_booking_properties,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/get_booking_property/:facilityId/:propertyId",
    jwt,
    get_booking_property,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/get_booking_blocked_dates/:facilityId/:propertyId",
    jwt,
    get_booking_blocked_dates,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/get_facility_paybills/:facilityId",
    jwt,
    get_facility_paybills,
  );

  fastify.post(
    bookingManagementBaseRoute +
    "/block_property_dates/:facilityId/:propertyId",
    jwt,
    block_property_dates,
  );

  fastify.patch(
    bookingManagementBaseRoute +
    "/toggle_property_listing/:facilityId/:propertyId",
    jwt,
    toggle_property_listing,
  );

  // Booking Invoice Management
  fastify.get(
    bookingManagementBaseRoute +
    "/booking_invoice/get_all_booking_invoices/:facilityId",
    jwt,
    get_all_booking_invoices,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_invoice/get_booking_invoice_details/:facilityId/:invoiceId",
    jwt,
    get_booking_invoice_details,
  );
  fastify.patch(
    bookingManagementBaseRoute +
    "/booking_invoice/update_booking_invoice_payment/:facilityId/:invoiceId",
    jwt,
    update_booking_invoice_payment,
  );

  // Booking Reservation Management
  fastify.post(
    bookingManagementBaseRoute +
    "/booking_reservation/calculate_booking_price/:facilityId",
    jwt,
    calculate_booking_price,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_reservation/check_available_dates/:facilityId/:propertyId",
    jwt,
    check_available_dates,
  );

  fastify.post(
    bookingManagementBaseRoute +
    "/booking_reservation/create_reservation/:facilityId",
    jwt,
    create_reservation,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_reservation/get_all_reservations/:facilityId",
    jwt,
    get_all_reservations,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_reservation/get_booking_dashboard_stats/:facilityId",
    jwt,
    get_booking_dashboard_stats,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_reservation/get_reservation/:facilityId/:reservationId",
    jwt,
    get_reservation,
  );

  fastify.patch(
    bookingManagementBaseRoute +
    "/booking_reservation/update_booking_status/:facilityId/:reservationId",
    jwt,
    update_booking_status,
  );

  fastify.post(
    bookingManagementBaseRoute +
    "/booking_reservation/checkout_reservation/:facilityId/:reservationId",
    jwt,
    checkout_reservation,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_reservation/get_reservation_trend/:facilityId",
    jwt,
    get_reservation_trend,
  );

  fastify.get(
    bookingManagementBaseRoute +
    "/booking_reservation/calculate_revenue_trends/:facilityId",
    jwt,
    calculate_revenue_trends,
  );

  fastify.post(
    bookingManagementBaseRoute +
    "/booking_reservation/record_checkout_for_revenue/:facilityId",
    jwt,
    record_checkout_for_revenue,
  );

  fastify.get(
    paymentManagementBaseRoute +
    "/get_invoice_by_account/:facilityId/:accountNumber",
    jwt,
    get_invoice_by_account,
  );

  fastify.post(
    paymentManagementBaseRoute + "/resend_invoice_notification/:facilityId",
    jwt,
    resend_invoice_notification,
  );

  fastify.post(
    paymentManagementBaseRoute + "/void_invoice/:facilityId/:invoiceId",
    jwt,
    void_invoice,
  );
  fastify.post(
    paymentManagementBaseRoute + "/cancel_invoice/:facilityId/:invoiceId",
    jwt,
    cancel_invoice,
  );

  fastify.put(
    paymentManagementBaseRoute + "/mark_invoice_viewed/:invoiceId",
    mark_invoice_viewed,
  );

  // Redirect short URLs
  fastify.get("/s/:code", async (request, reply) => {
    const { code } = request.params;

    try {
      // Look up the original URL in Redis (same pattern as levy management service)
      const redisKey = `url:short:${code}`;
      const longUrl = await fastify.redis.get(redisKey);

      if (longUrl) {
        // Redirect to the original URL
        return reply.redirect(301, longUrl);
      }

      // URL not found
      return reply.code(404).send({
        error: "Short URL not found",
      });
    } catch (error) {
      request.log.error("Error redirecting short URL:", error);
      return reply.code(500).send({
        error: "Internal server error",
      });
    }
  });
}

module.exports = { registerRoutes };
