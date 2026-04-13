-- Control Hub Database Indexes Migration
-- Purpose: Improve query performance for frequently accessed columns
-- Date: 2026-02-02

-- Users table indexes (High traffic table)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_portal ON users(portal);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_it_department_id ON users(it_department_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Sessions table indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Audit logs table indexes (Critical for compliance)
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);

-- Notifications table indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- IT Tickets table indexes (High traffic)
CREATE INDEX idx_it_tickets_status ON it_tickets(status);
CREATE INDEX idx_it_tickets_priority ON it_tickets(priority);
CREATE INDEX idx_it_tickets_department_id ON it_tickets(department_id);
CREATE INDEX idx_it_tickets_assignee_id ON it_tickets(assignee_id);
CREATE INDEX idx_it_tickets_requester_id ON it_tickets(requester_id);
CREATE INDEX idx_it_tickets_created_at ON it_tickets(created_at);

-- IT Projects table indexes
CREATE INDEX idx_it_projects_status ON it_projects(status);
CREATE INDEX idx_it_projects_department_id ON it_projects(department_id);
CREATE INDEX idx_it_projects_it_department_id ON it_projects(it_department_id);
CREATE INDEX idx_it_projects_manager_id ON it_projects(manager_id);
CREATE INDEX idx_it_projects_start_date ON it_projects(start_date);

-- Tasks table indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Evidences table indexes (Compliance critical)
CREATE INDEX idx_evidences_requirement_id ON evidences(requirement_id);
CREATE INDEX idx_evidences_department_id ON evidences(department_id);
CREATE INDEX idx_evidences_status ON evidences(status);
CREATE INDEX idx_evidences_submitted_by ON evidences(submitted_by);
CREATE INDEX idx_evidences_created_at ON evidences(created_at);

-- Committee decisions table indexes
CREATE INDEX idx_committee_decisions_status ON committee_decisions(status);
CREATE INDEX idx_committee_decisions_meeting_id ON committee_decisions(meeting_id);
CREATE INDEX idx_committee_decisions_created_by ON committee_decisions(created_by);

-- Committee meetings indexes
CREATE INDEX idx_committee_meetings_status ON committee_meetings(status);
CREATE INDEX idx_committee_meetings_scheduled_date ON committee_meetings(scheduled_date);

-- Requirements table indexes
CREATE INDEX idx_requirements_domain_id ON requirements(domain_id);
CREATE INDEX idx_requirements_is_active ON requirements(is_active);

-- Domains table indexes
CREATE INDEX idx_domains_code ON domains(code);

-- Voting sessions indexes
CREATE INDEX idx_voting_sessions_status ON voting_sessions(status);
CREATE INDEX idx_voting_sessions_created_by ON voting_sessions(created_by);

-- Decision votes indexes
CREATE INDEX idx_decision_votes_voting_session_id ON decision_votes(voting_session_id);
CREATE INDEX idx_decision_votes_member_id ON decision_votes(member_id);
CREATE INDEX idx_decision_votes_decision_id ON decision_votes(decision_id);

-- IT Assets indexes
CREATE INDEX idx_it_assets_status ON it_assets(status);
CREATE INDEX idx_it_assets_asset_type ON it_assets(asset_type);
CREATE INDEX idx_it_assets_assigned_department_id ON it_assets(assigned_department_id);
CREATE INDEX idx_it_assets_is_active ON it_assets(is_active);

-- Infrastructure servers indexes
CREATE INDEX idx_infrastructure_servers_status ON infrastructure_servers(status);

-- Security vulnerabilities indexes
CREATE INDEX idx_security_vulnerabilities_severity ON security_vulnerabilities(severity);
CREATE INDEX idx_security_vulnerabilities_status ON security_vulnerabilities(status);

-- KPI metrics indexes
CREATE INDEX idx_kpi_metrics_department_id ON kpi_metrics(department_id);
CREATE INDEX idx_kpi_metrics_period_start ON kpi_metrics(period_start);

-- Departments indexes
CREATE INDEX idx_departments_manager_id ON departments(manager_id);
CREATE INDEX idx_departments_parent_id ON departments(parent_id);

-- IT Departments indexes
CREATE INDEX idx_it_departments_manager_id ON it_departments(manager_id);
