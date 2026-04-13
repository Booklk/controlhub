-- Control Hub Soft Delete Migration
-- Purpose: Add deletedAt columns for soft delete pattern
-- Date: 2026-02-02

-- Users table (Core entity)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- IT Projects table
ALTER TABLE it_projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_it_projects_deleted_at ON it_projects(deleted_at);

-- IT Tickets table
ALTER TABLE it_tickets ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_it_tickets_deleted_at ON it_tickets(deleted_at);

-- Tasks table
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);

-- Evidences table (Compliance critical)
ALTER TABLE evidences ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_evidences_deleted_at ON evidences(deleted_at);

-- Documents table
ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_documents_deleted_at ON documents(deleted_at);

-- Committee decisions table
ALTER TABLE committee_decisions ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_committee_decisions_deleted_at ON committee_decisions(deleted_at);

-- Requirements table
ALTER TABLE requirements ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_requirements_deleted_at ON requirements(deleted_at);

-- IT Assets table
ALTER TABLE it_assets ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE NULL;
CREATE INDEX idx_it_assets_deleted_at ON it_assets(deleted_at);
