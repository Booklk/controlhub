# Control Hub - JCSA Governance & Compliance Platform

## Overview

Control Hub is a comprehensive IT governance, compliance, and management platform for the Jockey Club of Saudi Arabia (JCSA). It is a full-stack web application designed for multi-portal IT operations, primarily in Arabic (RTL) with a navy/gold theme. The platform centralizes IT operations, enhances compliance with regulations like PDPL and NDMO, and provides intelligent tools for decision-making and operational efficiency within JCSA. Key capabilities include multi-portal role-based access control, IT ticket, project, and task management, compliance tracking, a data catalog, committee management, security incident management, real-time notifications, and an intelligent assistant ("SmartAssistant") with live database query capabilities. It also features a Live Command Center for real-time operational oversight and a robust IT Referrals system with SLA management and escalation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite, shadcn/ui (Radix UI, Tailwind CSS).
- **Styling**: Tailwind CSS, CSS variables, RTL-first design.
- **State Management**: TanStack React Query.
- **Key Features**: PWA support, interactive onboarding tours, global search (CommandPalette), personalized daily overview (MyDayWidget), live SLA countdowns, AI-powered smart suggestions, real-time notification center, week-over-week KPI trend analysis, PDF/Excel report generation, and an animated operations dashboard (Live Command Center).
- **Bilingual (AR/EN) i18n**: Comprehensive internationalization with language persistence.
- **SmartAssistant "مجيب"**: Enhanced with contextual typing indicators, message reactions, rich DataCards, portal-specific QuickChips, personalized greetings with live DB stats, and context-aware input. Includes "Quick Create" for tickets/tasks, "Department Comparison", "Smart Recommendations" with pattern analysis, and "Enhanced Daily Summary".
- **WelcomeBanner**: Rendered on all department dashboards and admin, featuring portal-specific quick actions, role-specific urgent stat prioritization, smart contextual messages, and bottom quick-access navigation.
- **MyDayWidget**: Rendered on all department dashboards and employee portal, providing portal-specific focus stats, color accents, and motivational messages.
- **PageOnboarding**: Expanded per-role onboarding with rich tip system and "try it now" links.
- **Daily Work Engine (SmartDailyOps)**: A 3-tab daily work engine integrated across all department portals for overview, referrals, and personal tasks.
- **Portal-Locked Sidebar**: Sidebar navigation is resolved from the user's portal identity, preventing cross-portal page navigation from hijacking sidebar content.
- **Planner Portal Isolation**: Planner API endpoints enforce portal-scoped data access.
- **Advanced Planner Analytics**: Includes WorkloadHeatmap, BurndownChart, ActivityFeed, FocusTimer, BoardTemplates, and inline quick-task creation.

### Backend
- **Runtime**: Node.js with Express.
- **Language**: TypeScript.
- **API Pattern**: RESTful JSON API.
- **Authentication**: JWT (access/refresh tokens, HS512), session management, CSRF protection, granular rate limiting. JWT tokens are stored in `sessionStorage._cht`. JWT middleware normalizes `role: 'admin'` → `role: 'system_admin'` so all backend role checks use `system_admin` exclusively.
- **Authorization**: Granular permission system (18 roles, 10 portals) with governance-hardened matrix: `archive` action for soft-delete separation, centralized external systems management, data catalog ownership isolation (DMO-only), immutable security incident records, non-deletable committee decisions, dedicated read-only `auditor` role, role-based and resource-based middlewares, strict department data isolation, state machine enforcement. Admin planner board accessible at `/admin/planner`.
- **Security**: Helmet, CORS, Zod input validation, audit logging, protected field stripping, response-level sanitization, RBAC-gated sensitive endpoints, sanitized error responses (no internal message leakage), Swagger hidden in production. Empty-title rejection on tasks, referrals, tickets, projects, vendors, KPIs, and IT assets. Soft-delete existence checks (rowCount validation). Voting sessions use DB transactions to prevent duplicate-vote race conditions.
- **Comprehensive Audit System**: Universal audit interceptor middleware for all write operations, enhanced `/api/audit-logs` with filters and analytics, and a premium admin dashboard for detailed insights and export.
- **Real-time**: WebSockets for notifications.
- **API Documentation**: Swagger/OpenAPI.
- **Email**: Nodemailer with SMTP, enhanced email queue, rich HTML templates.
- **File Processing**: Multer for uploads, XLSX/csv-parse for import, ExcelJS for export.
- **Caching**: In-memory TTL cache for dashboard stats and metrics.
- **Smart Notifications**: Assignee-targeted notifications on task create/reassign, auto-escalation for 48h+ overdue tasks (priority upgrade + escalation record + manager/director alerts), real-time SLA breach detection every 5 minutes, project-task cascade (cancel/hold propagates to linked tasks with notifications).
- **SmartAssistant**: Backend-powered intelligent assistant ("مجيب") with CSRF-protected API calls, live database queries across all tables, department-aware data isolation (DMO=5, INFRA=9, CYBER=10, DTA=11, SUPPORT=12), context-aware follow-up detection, and resilient query handling.
- **IT Referrals**: Enhanced system with SLA tracking, auto-escalation, Outlook email import, and full file attachment support.
- **FileAttachment Component**: Rebuilt with drag-and-drop, multi-file upload, file type icons, preview dialog, metadata display, and dark theme support.
- **Active Directory Integration**: Full LDAP/AD integration for Support portal, including connection setup, testing, user search, and sync.
- **Data Catalog**: Features an 8-tab layout including Systems, Assets, Connections, Flows, Schema Browser, Data Lineage, Data Quality, and Dictionary. Includes schema discovery, SVG-based Data Flow Diagrams, and Data Lineage visualization.
- **Multi-DB Support**: Supports 7 database types (MySQL, PostgreSQL, SQL Server, Oracle, MongoDB, Redis, Elasticsearch) with `testConnection` and `discoverTables` implementations.
- **External Import System**: Reusable component for importing tickets and tasks from Outlook (IMAP) and Oracle DB.
- **Training Courses**: Full CRUD for DMO training courses with portal-restricted write access.
- **Committee Decision Workflow**: Full lifecycle enforcement with role-based endpoints, duplicate vote prevention, in-app notifications, and file attachments support. Dedicated `POST /api/committee/decisions/:id/attachments` endpoint allows any committee member to add attachments to existing decisions (any status) with strict validation (URL sanitization, size/count limits), audit logging, and automatic notification to all committee members.
- **Consent Management (PDPL)**: Full consent records management for personal data subjects at `/dmo/consent-management`. Includes dashboard stats, CRUD with strict field validation, legal basis tracking, data type classification, consent withdrawal, soft-delete with audit trail, CSV export, and PDPL Article 6 compliance reference.
- **Modular Architecture**: Routes are organized into modules for better maintainability.

### Data Storage
- **Primary Database**: PostgreSQL (Neon Serverless).
- **ORM**: Drizzle ORM.
- **Object Storage**: Google Cloud Storage for file uploads.
- **Soft Deletes**: Implemented using `deletedAt` timestamps.
- **Indexes**: Optimized indexes for soft-delete patterns, email lookup, audit logs, unread notifications, overdue tasks, and resolved tickets.
- **Connection Pool**: Configured for Neon and standard PostgreSQL drivers.

## External Dependencies

- **Database**: PostgreSQL (Neon Serverless)
- **Email Service**: SMTP server (e.g., Office 365)
- **Object Storage**: Google Cloud Storage
- **External Database Connectors**: MySQL, SQL Server, Oracle, MongoDB, Redis, Elasticsearch
- **LDAP**: Optional integration for user authentication/synchronization