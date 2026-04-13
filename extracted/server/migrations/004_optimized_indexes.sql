-- Control Hub Optimized Indexes
-- Filtered indexes for soft-delete patterns and case-insensitive lookups
-- Date: 2026-03-19

-- Filtered indexes for soft-delete queries (PostgreSQL partial indexes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_active ON it_tickets(department_id, status) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_active ON tasks(department_id, status) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_due_active ON tasks(due_date, status) WHERE deleted_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_sla_active ON it_tickets(department_id, sla_deadline, status) WHERE deleted_at IS NULL AND sla_deadline IS NOT NULL;

-- Case-insensitive email lookup (used in login)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- Audit logs - timestamp range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_created_desc ON audit_logs(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_severity ON audit_logs(severity, created_at DESC) WHERE severity IN ('high', 'critical');

-- Notifications - faster unread count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;

-- Tasks - overdue query optimization  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_overdue ON tasks(assigned_to, due_date) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');

-- Tickets - resolution time analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_resolved ON it_tickets(department_id, created_at, updated_at) WHERE status IN ('closed', 'resolved') AND deleted_at IS NULL;
