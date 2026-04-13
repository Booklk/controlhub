-- Control Hub Performance Indexes - MySQL Compatible
-- Additional indexes for improved query performance
-- Date: 2026-02-02
-- 
-- NOTE: MySQL does not support "IF NOT EXISTS" for indexes.
-- Run these one at a time or use a migration tool like Drizzle.
-- Use: CREATE INDEX idx_name ON table(column);
-- To check if index exists first, use information_schema query.

-- Composite indexes for common query patterns
-- Users
CREATE INDEX idx_users_portal_role ON users(portal, role);
CREATE INDEX idx_users_dept_active ON users(department_id, is_active);
CREATE INDEX idx_users_it_dept_active ON users(it_department_id, is_active);

-- Sessions composite indexes
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_active_expires ON sessions(is_active, expires_at);
CREATE INDEX idx_sessions_token ON sessions(token(255));

-- Audit logs composite indexes for compliance reporting
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action_date ON audit_logs(action, created_at);

-- Notifications composite for unread count
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- IT Tickets composite for dashboard queries
CREATE INDEX idx_tickets_dept_status ON it_tickets(department_id, status);
CREATE INDEX idx_tickets_assignee_status ON it_tickets(assignee_id, status);
CREATE INDEX idx_tickets_priority_status ON it_tickets(priority, status);
CREATE INDEX idx_tickets_created_status ON it_tickets(created_at, status);

-- IT Projects composite
CREATE INDEX idx_projects_dept_status ON it_projects(department_id, status);
CREATE INDEX idx_projects_it_dept_status ON it_projects(it_department_id, status);
CREATE INDEX idx_projects_dates ON it_projects(start_date, end_date);

-- Tasks composite
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_due_status ON tasks(due_date, status);

-- Evidences composite for compliance
CREATE INDEX idx_evidences_req_status ON evidences(requirement_id, status);
CREATE INDEX idx_evidences_dept_status ON evidences(department_id, status);
CREATE INDEX idx_evidences_submitter_date ON evidences(submitted_by, created_at);

-- Committee decisions composite
CREATE INDEX idx_decisions_meeting_status ON committee_decisions(meeting_id, status);
CREATE INDEX idx_decisions_creator_date ON committee_decisions(created_by, created_at);

-- Voting sessions composite
CREATE INDEX idx_voting_decision_status ON voting_sessions(decision_id, status);

-- Decision votes composite
CREATE INDEX idx_votes_session_member ON decision_votes(voting_session_id, member_id);

-- Data assets composite
CREATE INDEX idx_data_assets_dept_status ON data_assets(department_id, status);
CREATE INDEX idx_data_assets_steward ON data_assets(data_steward_id);

-- Department referrals composite
CREATE INDEX idx_referrals_from_to ON department_referrals(from_department_id, to_department_id);
CREATE INDEX idx_referrals_status_date ON department_referrals(status, created_at);
