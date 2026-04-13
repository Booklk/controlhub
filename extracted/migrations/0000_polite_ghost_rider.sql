CREATE TABLE "advisor_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(100) NOT NULL,
	"question_pattern" text NOT NULL,
	"keywords" json NOT NULL,
	"response_ar" text NOT NULL,
	"response_en" text,
	"related_control_ids" json,
	"related_frameworks" json,
	"applicable_portals" json,
	"priority" varchar(20) DEFAULT 'medium',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" integer,
	"action" text NOT NULL,
	"action_category" varchar(50),
	"entity_type" varchar(100),
	"entity_id" integer,
	"resource" varchar(100),
	"old_value" json,
	"new_value" json,
	"changed_fields" json,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(50),
	"request_method" varchar(10),
	"request_path" varchar(500),
	"outcome" varchar(20) DEFAULT 'success',
	"severity" varchar(20) DEFAULT 'info',
	"policy_decision" varchar(50),
	"error_message" text,
	"details" text,
	"metadata" json,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_code" varchar(50) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"description" text,
	"provider" text NOT NULL,
	"service_type" text DEFAULT 'saas' NOT NULL,
	"region" varchar(100),
	"account_id" varchar(200),
	"subscription_type" varchar(100),
	"monthly_cost" numeric(15, 2),
	"annual_cost" numeric(15, 2),
	"owner_department_id" integer,
	"responsible_user_id" integer,
	"data_classification" text DEFAULT 'internal' NOT NULL,
	"compliance_status" text DEFAULT 'compliant',
	"security_assessment_date" timestamp,
	"contract_start_date" timestamp,
	"contract_end_date" timestamp,
	"auto_renew" boolean DEFAULT false,
	"status" text DEFAULT 'active' NOT NULL,
	"sla_uptime" numeric(5, 2),
	"resource_details" json,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "cloud_services_service_code_unique" UNIQUE("service_code")
);
--> statement-breakpoint
CREATE TABLE "committee_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"meeting_id" integer,
	"votes_for" integer DEFAULT 0 NOT NULL,
	"votes_against" integer DEFAULT 0 NOT NULL,
	"votes_abstain" integer DEFAULT 0 NOT NULL,
	"voting_deadline" timestamp,
	"implementation_deadline" timestamp,
	"implementation_status" text DEFAULT 'pending',
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "committee_decisions_decision_number_unique" UNIQUE("decision_number")
);
--> statement-breakpoint
CREATE TABLE "committee_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_number" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"meeting_type" text DEFAULT 'regular' NOT NULL,
	"scheduled_date" timestamp NOT NULL,
	"start_time" varchar(10),
	"end_time" varchar(10),
	"location" varchar(300),
	"is_virtual" boolean DEFAULT false NOT NULL,
	"virtual_link" text,
	"agenda" text,
	"minutes" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_by" integer,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "committee_meetings_meeting_number_unique" UNIQUE("meeting_number")
);
--> statement-breakpoint
CREATE TABLE "committee_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(20),
	"department" varchar(200),
	"position" varchar(200),
	"committee_role" text DEFAULT 'member' NOT NULL,
	"can_approve" boolean DEFAULT false NOT NULL,
	"can_vote" boolean DEFAULT true NOT NULL,
	"join_date" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" text NOT NULL,
	"title" varchar(300) NOT NULL,
	"period" varchar(50),
	"domain_id" integer,
	"department_id" integer,
	"total_requirements" integer DEFAULT 0,
	"compliant_count" integer DEFAULT 0,
	"non_compliant_count" integer DEFAULT 0,
	"partial_count" integer DEFAULT 0,
	"compliance_rate" numeric(5, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_by" integer,
	"file_url" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_subject_id" integer NOT NULL,
	"purpose" varchar(500) NOT NULL,
	"purpose_ar" varchar(500) NOT NULL,
	"legal_basis" varchar(50) NOT NULL,
	"data_types" json NOT NULL,
	"given_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"withdrawn_at" timestamp,
	"ip_address" varchar(45),
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_satisfaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer,
	"user_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"feedback" text,
	"category" text,
	"department_id" integer,
	"agent_id" integer,
	"response_time" integer,
	"resolution_time" integer,
	"would_recommend" boolean,
	"improvement_suggestion" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"agreement_number" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"agreement_type" varchar(100),
	"party_name" varchar(200),
	"description" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"file_url" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "data_agreements_agreement_number_unique" UNIQUE("agreement_number")
);
--> statement-breakpoint
CREATE TABLE "data_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"name_en" varchar(300),
	"description" text,
	"system" varchar(200),
	"system_id" integer,
	"owner" varchar(200),
	"owner_id" integer,
	"classification" text DEFAULT 'restricted' NOT NULL,
	"data_type" text DEFAULT 'structured' NOT NULL,
	"source" varchar(200),
	"format" varchar(100),
	"update_frequency" varchar(100),
	"retention_period" varchar(100),
	"department_id" integer,
	"database_name" varchar(200),
	"schema_name" varchar(200),
	"table_name" varchar(200),
	"connection_type" varchar(100),
	"connection_string" varchar(500),
	"total_records" integer,
	"total_columns" integer,
	"last_sync_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_breaches" (
	"id" serial PRIMARY KEY NOT NULL,
	"detected_at" timestamp NOT NULL,
	"reported_at" timestamp,
	"severity" varchar(20) NOT NULL,
	"affected_records" integer NOT NULL,
	"affected_data_types" json NOT NULL,
	"description" text NOT NULL,
	"description_ar" text NOT NULL,
	"root_cause" text,
	"containment_measures" json DEFAULT '[]'::json,
	"remediation_steps" json DEFAULT '[]'::json,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"notified_sdaia" boolean DEFAULT false NOT NULL,
	"notified_affected_users" boolean DEFAULT false NOT NULL,
	"status" varchar(30) DEFAULT 'detected' NOT NULL,
	"investigation_notes" json DEFAULT '[]'::json,
	"lead_investigator" integer,
	"reported_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_name" varchar(300) NOT NULL,
	"asset_name_ar" varchar(300) NOT NULL,
	"asset_type" varchar(100) NOT NULL,
	"classification_level" varchar(50) NOT NULL,
	"impact_national" varchar(20),
	"impact_organization" varchar(20),
	"impact_individual" varchar(20),
	"impact_environment" varchar(20),
	"contains_personal_data" boolean DEFAULT false NOT NULL,
	"contains_sensitive_data" boolean DEFAULT false NOT NULL,
	"assigned_date" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiry_date" timestamp,
	"review_date" timestamp,
	"approved_by" integer,
	"data_owner" integer,
	"data_custodian" integer,
	"handling_instructions" text,
	"handling_instructions_ar" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_dictionary" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" varchar(300) NOT NULL,
	"term_en" varchar(300),
	"definition" text NOT NULL,
	"category" varchar(100),
	"data_type" varchar(100),
	"format" varchar(100),
	"allowed_values" text,
	"example" text,
	"source" varchar(200),
	"related_terms" text,
	"data_asset_id" integer,
	"column_name" varchar(200),
	"business_rule" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_flow_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_system_id" integer,
	"source_table_id" integer,
	"target_system_id" integer,
	"target_table_id" integer,
	"flow_name" varchar(200) NOT NULL,
	"flow_name_ar" varchar(200),
	"flow_type" varchar(50),
	"frequency" varchar(50),
	"transformation_rules" json,
	"data_volume" varchar(100),
	"is_active" boolean DEFAULT true,
	"last_executed_at" timestamp,
	"status" varchar(50) DEFAULT 'active',
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_lineage" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(300),
	"source_connection_id" integer,
	"source_table_id" integer,
	"source_column_id" integer,
	"source_type" varchar(50) NOT NULL,
	"target_connection_id" integer,
	"target_table_id" integer,
	"target_column_id" integer,
	"target_type" varchar(50) NOT NULL,
	"transformation_type" varchar(100),
	"transformation_logic" text,
	"data_flow_direction" varchar(20) DEFAULT 'downstream',
	"frequency" varchar(50),
	"is_active" boolean DEFAULT true,
	"last_data_flow" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"rule_name" varchar(300),
	"dimension" varchar(100),
	"target_table" varchar(200),
	"target_column" varchar(200),
	"system_name" varchar(200),
	"total_records" integer DEFAULT 0,
	"passed_records" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"score" numeric(5, 2),
	"threshold" numeric(5, 2),
	"passed" boolean DEFAULT false,
	"execution_time" integer,
	"error_message" text,
	"sample_failures" text,
	"check_type" varchar(50) DEFAULT 'automated',
	"executed_by" integer,
	"executed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"name_en" varchar(300),
	"description" text,
	"asset_id" integer,
	"dimension" varchar(100) NOT NULL,
	"rule_type" varchar(100),
	"threshold" numeric(5, 2),
	"current_score" numeric(5, 2),
	"target_table" varchar(200),
	"target_column" varchar(200),
	"sql_expression" text,
	"validation_pattern" varchar(500),
	"system_name" varchar(200),
	"severity" varchar(50) DEFAULT 'medium',
	"schedule" varchar(100) DEFAULT 'manual',
	"total_records_checked" integer DEFAULT 0,
	"failed_records" integer DEFAULT 0,
	"last_check_duration" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"last_checked" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_risks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"category" varchar(100),
	"asset_id" integer,
	"likelihood" text DEFAULT 'medium' NOT NULL,
	"impact" text DEFAULT 'medium' NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"mitigation_plan" text,
	"owner" varchar(200),
	"owner_id" integer,
	"status" text DEFAULT 'identified' NOT NULL,
	"due_date" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_stewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"email" varchar(320) NOT NULL,
	"phone" varchar(20),
	"department" varchar(200),
	"department_id" integer,
	"role" text DEFAULT 'steward' NOT NULL,
	"responsibilities" text,
	"assigned_assets" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(50) NOT NULL,
	"request_type" text NOT NULL,
	"subject_name" varchar(200) NOT NULL,
	"subject_email" varchar(320),
	"subject_phone" varchar(20),
	"subject_id_number" varchar(20),
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"source" text DEFAULT 'internal' NOT NULL,
	"assigned_to" integer,
	"due_date" timestamp,
	"completed_at" timestamp,
	"response" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "data_subject_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "database_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_name" varchar(200) NOT NULL,
	"connection_name_ar" varchar(200),
	"system_id" integer,
	"database_type" varchar(50) NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer NOT NULL,
	"database_name" varchar(200) NOT NULL,
	"username" varchar(100),
	"encrypted_password" text,
	"ssl_enabled" boolean DEFAULT false,
	"ssl_certificate" text,
	"connection_string" text,
	"schema_name" varchar(100),
	"is_read_only" boolean DEFAULT true,
	"max_connections" integer DEFAULT 5,
	"connection_timeout" integer DEFAULT 30,
	"last_tested_at" timestamp,
	"test_status" varchar(50) DEFAULT 'pending',
	"test_message" text,
	"is_active" boolean DEFAULT true,
	"description" text,
	"data_classification" varchar(50) DEFAULT 'confidential',
	"approval_status" varchar(50) DEFAULT 'pending',
	"approved_by" integer,
	"approved_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision_id" integer,
	"voting_session_id" integer,
	"member_id" integer NOT NULL,
	"vote" text NOT NULL,
	"comments" text,
	"voted_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"task_type" text DEFAULT 'regular' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" integer,
	"assigned_by" integer NOT NULL,
	"parent_task_id" integer,
	"project_id" integer,
	"referral_id" integer,
	"source_type" text DEFAULT 'manual',
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"attachments" json,
	"checklist" json,
	"tags" json,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"code" varchar(20) NOT NULL,
	"description" text,
	"manager_id" integer,
	"parent_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "digital_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_code" varchar(50) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"description" text,
	"app_type" text DEFAULT 'web' NOT NULL,
	"platform" text DEFAULT 'web' NOT NULL,
	"vendor" varchar(200),
	"version" varchar(50),
	"url" text,
	"hosting_type" text DEFAULT 'on_premise' NOT NULL,
	"owner_department_id" integer,
	"responsible_user_id" integer,
	"users_count" integer,
	"licensing_type" varchar(100),
	"license_cost" numeric(15, 2),
	"renewal_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"criticality" text DEFAULT 'medium' NOT NULL,
	"data_classification" text DEFAULT 'internal' NOT NULL,
	"integrations" json,
	"go_live_date" timestamp,
	"last_review_date" timestamp,
	"next_review_date" timestamp,
	"documentation" text,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "digital_applications_app_code_unique" UNIQUE("app_code")
);
--> statement-breakpoint
CREATE TABLE "digital_initiatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"initiative_code" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"title_en" varchar(300),
	"description" text,
	"objectives" text,
	"category" text DEFAULT 'automation' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"sponsor_id" integer,
	"manager_id" integer,
	"budget" numeric(15, 2),
	"actual_cost" numeric(15, 2),
	"start_date" timestamp,
	"target_end_date" timestamp,
	"actual_end_date" timestamp,
	"progress" integer DEFAULT 0 NOT NULL,
	"benefits_measured" text,
	"roi_target" numeric(10, 2),
	"roi_actual" numeric(10, 2),
	"affected_departments" json,
	"dependencies" json,
	"risks" text,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "digital_initiatives_initiative_code_unique" UNIQUE("initiative_code")
);
--> statement-breakpoint
CREATE TABLE "discovered_columns" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"column_name" varchar(200) NOT NULL,
	"column_name_ar" varchar(200),
	"data_type" varchar(100) NOT NULL,
	"max_length" integer,
	"precision" integer,
	"scale" integer,
	"is_nullable" boolean DEFAULT true,
	"is_primary_key" boolean DEFAULT false,
	"is_foreign_key" boolean DEFAULT false,
	"is_unique" boolean DEFAULT false,
	"is_indexed" boolean DEFAULT false,
	"default_value" text,
	"description" text,
	"business_name" varchar(300),
	"business_name_ar" varchar(300),
	"classification" varchar(50),
	"is_pii" boolean DEFAULT false,
	"sample_values" json,
	"validation_rules" json,
	"referenced_table" varchar(200),
	"referenced_column" varchar(200),
	"position" integer DEFAULT 0,
	"discovered_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_schemas" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"schema_name" varchar(200) NOT NULL,
	"schema_name_ar" varchar(200),
	"description" text,
	"tables_count" integer DEFAULT 0,
	"views_count" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"discovered_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"schema_id" integer,
	"table_name" varchar(200) NOT NULL,
	"table_name_ar" varchar(200),
	"table_type" varchar(50) DEFAULT 'table' NOT NULL,
	"description" text,
	"columns_count" integer DEFAULT 0,
	"rows_estimate" bigint,
	"size_bytes" bigint,
	"primary_key" text,
	"classification" varchar(50),
	"owner" varchar(200),
	"data_category" varchar(100),
	"business_domain" varchar(200),
	"quality_score" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"last_data_update" timestamp,
	"discovered_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"discovery_type" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"schemas_discovered" integer DEFAULT 0,
	"tables_discovered" integer DEFAULT 0,
	"columns_discovered" integer DEFAULT 0,
	"errors_count" integer DEFAULT 0,
	"error_details" json,
	"started_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp,
	"duration" integer,
	"triggered_by" integer
);
--> statement-breakpoint
CREATE TABLE "dmo_request_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"responder_id" integer NOT NULL,
	"message" text NOT NULL,
	"attachments" json,
	"is_from_dmo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dmo_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"request_type" varchar(100) NOT NULL,
	"priority" varchar(50) DEFAULT 'medium' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"steward_id" integer NOT NULL,
	"requested_by" integer NOT NULL,
	"assigned_asset_id" integer,
	"due_date" timestamp,
	"completed_at" timestamp,
	"response" text,
	"attachments" json,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"data_classification" text DEFAULT 'internal',
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(100),
	"file_size" integer,
	"file_url" text,
	"version" varchar(50) DEFAULT '1.0',
	"status" text DEFAULT 'active' NOT NULL,
	"is_confidential" boolean DEFAULT false,
	"tags" json,
	"created_by" integer,
	"review_date" timestamp,
	"expiry_date" timestamp,
	"download_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"name_en" varchar(300),
	"description" text,
	"icon" varchar(50),
	"color" varchar(20),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "domains_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "email_integration_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"api_key" varchar(128) NOT NULL,
	"created_by_id" integer NOT NULL,
	"department_id" integer,
	"default_priority" text DEFAULT 'medium',
	"default_category" text DEFAULT 'support',
	"is_active" boolean DEFAULT true,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "email_integration_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"reason" text NOT NULL,
	"escalated_from" integer,
	"escalated_to" integer NOT NULL,
	"priority" text DEFAULT 'high' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidences" (
	"id" serial PRIMARY KEY NOT NULL,
	"requirement_id" integer NOT NULL,
	"department_id" integer,
	"title" varchar(300) NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"file_url" text,
	"file_key" varchar(500),
	"file_name" varchar(300),
	"file_type" varchar(100),
	"file_size" integer,
	"submitted_by" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"expiry_date" timestamp,
	"is_expired" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "external_systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"system_type" text NOT NULL,
	"category" text NOT NULL,
	"department_id" integer,
	"api_endpoint" text,
	"ip_address" varchar(45),
	"port" integer,
	"protocol" varchar(20),
	"auth_type" varchar(50),
	"auth_credentials" text,
	"health_check_url" text,
	"last_health_check" timestamp,
	"health_status" text DEFAULT 'unknown',
	"response_time" integer,
	"description" text,
	"vendor" varchar(200),
	"version" varchar(50),
	"environment" text DEFAULT 'production',
	"criticality" text DEFAULT 'medium',
	"data_classification" text DEFAULT 'internal',
	"integration_direction" text DEFAULT 'read_only',
	"integration_scope" text,
	"sla_uptime" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"approval_status" text DEFAULT 'pending',
	"approved_by" integer,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"priority" varchar(30) DEFAULT 'medium' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"portal" varchar(50) NOT NULL,
	"submitted_by" integer,
	"submitter_name" varchar(200) NOT NULL,
	"submitter_email" varchar(200) NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_control_implementations" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_id" integer NOT NULL,
	"portal" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'not_implemented' NOT NULL,
	"notes" text,
	"evidence" text,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"framework_id" integer NOT NULL,
	"domain_id" integer NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_ar" varchar(500) NOT NULL,
	"name_en" varchar(500) NOT NULL,
	"description" text,
	"description_ar" text,
	"objective" text,
	"objective_ar" text,
	"implementation_guide" text,
	"implementation_guide_ar" text,
	"priority" varchar(20) DEFAULT 'medium',
	"applicable_portals" json,
	"tags" json,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"framework_id" integer NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"description" text,
	"description_ar" text,
	"sort_order" integer DEFAULT 0,
	"parent_domain_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "governance_frameworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_ar" varchar(300) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"description" text,
	"description_ar" text,
	"version" varchar(50),
	"issuing_body" varchar(200),
	"issuing_body_ar" varchar(200),
	"applicable_to" text,
	"total_domains" integer DEFAULT 0,
	"total_controls" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "governance_frameworks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "infrastructure_monitoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"target_type" text DEFAULT 'server' NOT NULL,
	"target_id" integer,
	"metric_type" text NOT NULL,
	"current_value" numeric(10, 2),
	"threshold_warning" numeric(10, 2),
	"threshold_critical" numeric(10, 2),
	"unit" varchar(20),
	"status" text DEFAULT 'normal' NOT NULL,
	"last_checked" timestamp,
	"alert_enabled" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infrastructure_networks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"network_type" text DEFAULT 'lan' NOT NULL,
	"subnet" varchar(50),
	"gateway" varchar(45),
	"vlan_id" integer,
	"bandwidth" varchar(50),
	"location" varchar(200),
	"status" text DEFAULT 'active' NOT NULL,
	"security_level" text DEFAULT 'medium',
	"firewall_enabled" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infrastructure_servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"hostname" varchar(200),
	"ip_address" varchar(45),
	"server_type" text DEFAULT 'physical' NOT NULL,
	"operating_system" varchar(100),
	"cpu_cores" integer,
	"ram_gb" integer,
	"storage_gb" integer,
	"location" varchar(200),
	"rack" varchar(50),
	"status" text DEFAULT 'active' NOT NULL,
	"health_score" integer DEFAULT 100,
	"last_health_check" timestamp,
	"environment" text DEFAULT 'production' NOT NULL,
	"purpose" text,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infrastructure_storage" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"storage_type" text DEFAULT 'san' NOT NULL,
	"total_capacity_tb" numeric(10, 2),
	"used_capacity_tb" numeric(10, 2),
	"raid_level" varchar(20),
	"location" varchar(200),
	"status" text DEFAULT 'active' NOT NULL,
	"performance_tier" text DEFAULT 'standard',
	"backup_enabled" boolean DEFAULT true,
	"encryption_enabled" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_code" varchar(50) NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"description" text,
	"asset_type" text DEFAULT 'hardware' NOT NULL,
	"data_classification" text DEFAULT 'public' NOT NULL,
	"assigned_department_id" integer,
	"assigned_by_id" integer,
	"assigned_at" timestamp,
	"manufacturer" varchar(100),
	"model" varchar(100),
	"serial_number" varchar(100),
	"purchase_date" timestamp,
	"warranty_expiry" timestamp,
	"location" varchar(200),
	"status" text DEFAULT 'active' NOT NULL,
	"last_maintenance_date" timestamp,
	"next_maintenance_date" timestamp,
	"maintenance_notes" text,
	"department_notes" text,
	"configuration_details" text,
	"ip_address" varchar(45),
	"criticality" text DEFAULT 'medium' NOT NULL,
	"value" numeric(15, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "it_assets_asset_code_unique" UNIQUE("asset_code")
);
--> statement-breakpoint
CREATE TABLE "it_department_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'specialist' NOT NULL,
	"job_title" varchar(100),
	"join_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"code" varchar(20) NOT NULL,
	"description" text,
	"manager_id" integer,
	"department_type" text NOT NULL,
	"color" varchar(20) DEFAULT '#1e3a5f',
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "it_departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "it_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"code" varchar(20) NOT NULL,
	"description" text,
	"department_id" integer,
	"it_department_id" integer NOT NULL,
	"manager_id" integer,
	"status" text DEFAULT 'planning' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"actual_end_date" timestamp,
	"budget" numeric(15, 2),
	"actual_cost" numeric(15, 2),
	"progress" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "it_projects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "it_referral_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_id" integer NOT NULL,
	"action" text NOT NULL,
	"performed_by_id" integer NOT NULL,
	"from_status" text,
	"to_status" text,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "it_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_number" varchar(50) NOT NULL,
	"type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"from_department_id" integer NOT NULL,
	"to_department_id" integer NOT NULL,
	"referred_by_id" integer NOT NULL,
	"assigned_to_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"response_note" text,
	"attachments" json,
	"due_date" timestamp,
	"accepted_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "it_referrals_referral_number_unique" UNIQUE("referral_number")
);
--> statement-breakpoint
CREATE TABLE "it_systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_ar" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"code" varchar(50) NOT NULL,
	"description" text,
	"system_type" text DEFAULT 'other' NOT NULL,
	"vendor" varchar(200),
	"version" varchar(50),
	"status" text DEFAULT 'active' NOT NULL,
	"responsible_department_id" integer,
	"responsible_user_id" integer,
	"go_live_date" timestamp,
	"last_maintenance_date" timestamp,
	"next_maintenance_date" timestamp,
	"criticality" text DEFAULT 'medium' NOT NULL,
	"uptime" numeric(5, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "it_systems_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "it_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_number" varchar(20) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"requester_id" integer NOT NULL,
	"assignee_id" integer,
	"department_id" integer,
	"category" text DEFAULT 'support' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"sla_deadline" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"resolution" text,
	"satisfaction" integer,
	"source" text DEFAULT 'manual',
	"source_email" varchar(255),
	"source_email_id" varchar(255),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "it_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"department_id" integer,
	"tags" json,
	"views" integer DEFAULT 0 NOT NULL,
	"helpful" integer DEFAULT 0 NOT NULL,
	"author_id" integer NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer,
	"metric_name" varchar(200) NOT NULL,
	"metric_type" text NOT NULL,
	"target_value" numeric(10, 2),
	"actual_value" numeric(10, 2),
	"unit" varchar(50),
	"period" varchar(20) NOT NULL,
	"period_date" timestamp NOT NULL,
	"trend" text,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"delegated_to" integer,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_minutes" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text,
	"attendees" json,
	"decisions" json,
	"action_items" json,
	"attachments" json,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ndmo_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" varchar(50) NOT NULL,
	"fiscal_quarter" varchar(10) NOT NULL,
	"fiscal_year" integer NOT NULL,
	"assessed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"assessed_by" integer,
	"specifications" json DEFAULT '[]'::json,
	"overall_score" integer DEFAULT 0,
	"submitted_to_ndmo" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" varchar(300) NOT NULL,
	"message" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"action_url" text,
	"entity_type" varchar(100),
	"entity_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "planner_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"portal" varchar(50) NOT NULL,
	"department_id" integer,
	"color" varchar(30) DEFAULT '#1e3a5f',
	"icon" varchar(50),
	"is_default" integer DEFAULT 0,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_buckets" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" varchar(30),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer,
	"content" text NOT NULL,
	"type" varchar(30) DEFAULT 'comment' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"bucket_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(30) DEFAULT 'not_started' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"assigned_to" integer,
	"created_by" integer,
	"due_date" timestamp,
	"start_date" timestamp,
	"completed_at" timestamp,
	"labels" json,
	"checklist" json,
	"attachments" json,
	"dependencies" json,
	"recurrence" json,
	"is_template" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(20) NOT NULL,
	"effective_date" timestamp NOT NULL,
	"content_en" text NOT NULL,
	"content_ar" text NOT NULL,
	"purposes" json DEFAULT '[]'::json,
	"data_categories" json DEFAULT '[]'::json,
	"retention_periods" json,
	"third_party_sharing" boolean DEFAULT false NOT NULL,
	"cross_border_transfers" boolean DEFAULT false NOT NULL,
	"data_subject_rights" json DEFAULT '[]'::json,
	"dpo_name" varchar(200),
	"dpo_email" varchar(320),
	"contact_address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"approved_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_name" varchar(300) NOT NULL,
	"activity_name_ar" varchar(300) NOT NULL,
	"purpose" text NOT NULL,
	"purpose_ar" text NOT NULL,
	"legal_basis" varchar(50) NOT NULL,
	"data_categories" json NOT NULL,
	"data_subject_categories" json DEFAULT '[]'::json,
	"recipients" json DEFAULT '[]'::json,
	"cross_border_transfers" json DEFAULT '[]'::json,
	"retention_period" varchar(100),
	"security_measures" json DEFAULT '[]'::json,
	"dpia_required" boolean DEFAULT false NOT NULL,
	"dpia_completed" boolean DEFAULT false NOT NULL,
	"last_reviewed" timestamp,
	"next_review" timestamp,
	"responsible" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"portal" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"color" varchar(20) DEFAULT 'default',
	"is_pinned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_controls" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_number" varchar(50) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(200),
	"subcategory" varchar(200),
	"domain" varchar(200),
	"regulatory_body" varchar(100) NOT NULL,
	"portal" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'not_started' NOT NULL,
	"completion_percentage" integer DEFAULT 0,
	"assigned_to" varchar(200),
	"evidence" text,
	"notes" text,
	"priority" varchar(30) DEFAULT 'medium',
	"due_date" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain_id" integer NOT NULL,
	"code" varchar(30) NOT NULL,
	"title_ar" varchar(500) NOT NULL,
	"title_en" varchar(500),
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"compliance_level" text DEFAULT 'mandatory' NOT NULL,
	"evidence_type" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "requirements_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "security_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_number" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"incident_type" varchar(100),
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"affected_assets" json,
	"reported_by" integer,
	"assigned_to" integer,
	"resolution" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "security_incidents_incident_number_unique" UNIQUE("incident_number")
);
--> statement-breakpoint
CREATE TABLE "security_risk_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_code" varchar(50) NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"assessment_type" text DEFAULT 'general' NOT NULL,
	"scope" text,
	"target_system_id" integer,
	"target_asset_id" integer,
	"assessor_id" integer,
	"status" text DEFAULT 'planned' NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"threat_level" text,
	"vulnerability_level" text,
	"impact_level" text,
	"likelihood" text,
	"findings" text,
	"recommendations" text,
	"remediation_plan" text,
	"remediation_deadline" timestamp,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"next_assessment_date" timestamp,
	"attachments" json,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "security_risk_assessments_assessment_code_unique" UNIQUE("assessment_code")
);
--> statement-breakpoint
CREATE TABLE "security_threats" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"threat_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_ip" varchar(45),
	"target_system" integer,
	"detected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"mitigated_at" timestamp,
	"mitigation_notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_vulnerabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"system_id" integer,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"cve_id" varchar(50),
	"discovered_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"discovered_by" integer,
	"assigned_to" integer,
	"resolved_at" timestamp,
	"resolution" text,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(500) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"device_fingerprint" varchar(100),
	"device_type" varchar(50),
	"browser" varchar(100),
	"os" varchar(100),
	"location" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"last_activity_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"login_method" varchar(50) DEFAULT 'password',
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" varchar(200),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sla_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"system_id" integer,
	"department_id" integer,
	"project_id" integer,
	"title" varchar(300) NOT NULL,
	"description" text,
	"service_type" text NOT NULL,
	"target_value" numeric(10, 2) NOT NULL,
	"target_unit" varchar(50) NOT NULL,
	"current_value" numeric(10, 2),
	"measurement_period" varchar(50),
	"penalty_clause" text,
	"penalty_amount" numeric(15, 2),
	"start_date" timestamp,
	"end_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"last_measured" timestamp,
	"compliance_status" text DEFAULT 'compliant',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_breaches" (
	"id" serial PRIMARY KEY NOT NULL,
	"sla_id" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"breach_date" timestamp NOT NULL,
	"expected_value" numeric(10, 2),
	"actual_value" numeric(10, 2),
	"impact_level" text DEFAULT 'medium',
	"description" text,
	"root_cause" text,
	"resolution" text,
	"penalty_applied" boolean DEFAULT false,
	"penalty_amount" numeric(15, 2),
	"status" text DEFAULT 'open',
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"connection_type" varchar(50) NOT NULL,
	"host" varchar(500),
	"port" integer,
	"database_name" varchar(200),
	"username" varchar(200),
	"password" text,
	"connection_string" text,
	"api_endpoint" text,
	"api_key" text,
	"auth_type" varchar(50),
	"ssl_enabled" boolean DEFAULT false,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"last_connection_test" timestamp,
	"last_discovery" timestamp,
	"auto_discovery_enabled" boolean DEFAULT true,
	"discovery_schedule" varchar(50),
	"metadata" json,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_health_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"system_id" integer NOT NULL,
	"status" text NOT NULL,
	"response_time" integer,
	"status_code" integer,
	"error_message" text,
	"checked_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"system_id" integer,
	"asset_id" integer,
	"metric_type" text NOT NULL,
	"metric_name" varchar(200) NOT NULL,
	"current_value" numeric(15, 4),
	"target_value" numeric(15, 4),
	"min_threshold" numeric(15, 4),
	"max_threshold" numeric(15, 4),
	"unit" varchar(50),
	"status" text DEFAULT 'normal' NOT NULL,
	"trend" text,
	"measurement_date" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"department_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"category" varchar(50),
	"description" text,
	"updated_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"project_id" integer,
	"department_id" integer,
	"assigned_to" integer,
	"assigned_by" integer NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"data_classification" text DEFAULT 'public' NOT NULL,
	"due_date" timestamp,
	"completed_at" timestamp,
	"estimated_hours" integer,
	"actual_hours" integer,
	"is_escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"escalated_to" integer,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"portal" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"title" varchar(500) NOT NULL,
	"subtitle" varchar(500),
	"priority" varchar(20),
	"status" varchar(50),
	"url" varchar(500),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"name" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"phone" varchar(20),
	"role" text DEFAULT 'user' NOT NULL,
	"portal" text DEFAULT 'user' NOT NULL,
	"department_id" integer,
	"it_department_id" integer,
	"job_title" varchar(200),
	"avatar" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_activated" boolean DEFAULT false NOT NULL,
	"activation_token" varchar(200),
	"activation_token_expiry" timestamp,
	"password_reset_token" varchar(200),
	"password_reset_token_expiry" timestamp,
	"last_login_at" timestamp,
	"login_attempts" integer DEFAULT 0,
	"locked_until" timestamp,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"vendor_type" text NOT NULL,
	"category" text,
	"contact_person" varchar(200),
	"contact_email" varchar(200),
	"contact_phone" varchar(50),
	"website" text,
	"address" text,
	"country" varchar(100),
	"contract_number" varchar(100),
	"contract_start_date" timestamp,
	"contract_end_date" timestamp,
	"contract_value" numeric(15, 2),
	"payment_terms" varchar(100),
	"status" text DEFAULT 'active' NOT NULL,
	"rating" integer,
	"notes" text,
	"department_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voting_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" text DEFAULT 'general' NOT NULL,
	"voting_type" text DEFAULT 'majority' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"votes_for" integer DEFAULT 0 NOT NULL,
	"votes_against" integer DEFAULT 0 NOT NULL,
	"votes_abstain" integer DEFAULT 0 NOT NULL,
	"quorum_required" integer DEFAULT 50,
	"result" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhook_id" integer NOT NULL,
	"event" varchar(100) NOT NULL,
	"payload" json,
	"response_status" integer,
	"response_body" text,
	"duration" integer,
	"success" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(500) NOT NULL,
	"events" json DEFAULT '[]'::json NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"headers" json DEFAULT '{}'::json,
	"retry_policy" json DEFAULT '{"maxRetries":3,"retryDelay":1000}'::json,
	"last_delivery_at" timestamp,
	"last_delivery_status" varchar(50),
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_decisions" ADD CONSTRAINT "committee_decisions_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_decisions" ADD CONSTRAINT "committee_decisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_data_subject_id_users_id_fk" FOREIGN KEY ("data_subject_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breaches" ADD CONSTRAINT "data_breaches_lead_investigator_users_id_fk" FOREIGN KEY ("lead_investigator") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_breaches" ADD CONSTRAINT "data_breaches_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_classifications" ADD CONSTRAINT "data_classifications_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_classifications" ADD CONSTRAINT "data_classifications_data_owner_users_id_fk" FOREIGN KEY ("data_owner") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_classifications" ADD CONSTRAINT "data_classifications_data_custodian_users_id_fk" FOREIGN KEY ("data_custodian") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_decision_id_committee_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."committee_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_voting_session_id_voting_sessions_id_fk" FOREIGN KEY ("voting_session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_member_id_committee_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."committee_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_integration_keys" ADD CONSTRAINT "email_integration_keys_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_integration_keys" ADD CONSTRAINT "email_integration_keys_department_id_it_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."it_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_assets" ADD CONSTRAINT "it_assets_assigned_department_id_it_departments_id_fk" FOREIGN KEY ("assigned_department_id") REFERENCES "public"."it_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_assets" ADD CONSTRAINT "it_assets_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_department_members" ADD CONSTRAINT "it_department_members_department_id_it_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."it_departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_department_members" ADD CONSTRAINT "it_department_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_departments" ADD CONSTRAINT "it_departments_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_projects" ADD CONSTRAINT "it_projects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_projects" ADD CONSTRAINT "it_projects_it_department_id_it_departments_id_fk" FOREIGN KEY ("it_department_id") REFERENCES "public"."it_departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_projects" ADD CONSTRAINT "it_projects_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_tickets" ADD CONSTRAINT "it_tickets_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_tickets" ADD CONSTRAINT "it_tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "it_tickets" ADD CONSTRAINT "it_tickets_department_id_it_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."it_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_member_id_committee_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."committee_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendance" ADD CONSTRAINT "meeting_attendance_delegated_to_committee_members_id_fk" FOREIGN KEY ("delegated_to") REFERENCES "public"."committee_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_meeting_id_committee_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."committee_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ndmo_assessments" ADD CONSTRAINT "ndmo_assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_boards" ADD CONSTRAINT "planner_boards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_buckets" ADD CONSTRAINT "planner_buckets_board_id_planner_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."planner_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_comments" ADD CONSTRAINT "planner_comments_task_id_planner_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."planner_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_comments" ADD CONSTRAINT "planner_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_board_id_planner_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."planner_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_bucket_id_planner_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."planner_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_notices" ADD CONSTRAINT "privacy_notices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_notices" ADD CONSTRAINT "privacy_notices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_records" ADD CONSTRAINT "processing_records_responsible_users_id_fk" FOREIGN KEY ("responsible") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_records" ADD CONSTRAINT "processing_records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_notes" ADD CONSTRAINT "quick_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_controls" ADD CONSTRAINT "regulatory_controls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_it_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."it_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_department_id_it_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."it_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_escalated_to_users_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bookmarks" ADD CONSTRAINT "user_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;