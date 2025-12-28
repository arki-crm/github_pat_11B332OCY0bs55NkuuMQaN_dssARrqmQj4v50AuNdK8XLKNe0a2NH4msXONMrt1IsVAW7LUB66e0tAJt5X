# Arkiflo - Interior Design Workflow System

## Problem Statement
Build the foundational structure for a web application named "Arkiflo", designed for an interior design company workflow system. Phase 1 includes: authentication, role system, global layout, navigation sidebar, top header, and routing.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: Emergent Google OAuth

## User Personas
1. **Admin** - Full access to all pages, can manage users and assign roles
2. **Manager** - Dashboard, PreSales, Leads, Projects access
3. **PreSales** - Dashboard, PreSales access only
4. **Designer** - Dashboard, Projects access only

## Core Requirements (Static)
- [x] Google OAuth login via Emergent Auth
- [x] Role-based access control (Admin, PreSales, Designer, Manager)
- [x] First user becomes Admin automatically
- [x] Collapsible sidebar with icon-based navigation
- [x] Top header with search, profile, role badge, logout
- [x] Role-based routing with "Access Denied" toast
- [x] Clean, modern UI (Notion/Linear inspired)

## What's Been Implemented
### December 28, 2025 - MVP Foundation
- ✅ Authentication system with Emergent Google OAuth
- ✅ User model with role management
- ✅ Session management with httpOnly cookies
- ✅ Collapsible sidebar with state persistence
- ✅ Top header with user profile dropdown
- ✅ Role-based navigation filtering
- ✅ Protected routes with role validation
- ✅ Admin settings page for user role management
- ✅ Placeholder pages: Dashboard, PreSales, Leads, Academy, Settings
- ✅ Access denied toast for unauthorized routes

### December 28, 2025 - Phase 2: Projects List Dashboard
- ✅ Project data model (projectId, projectName, clientName, clientPhone, stage, collaborators, summary, timestamps)
- ✅ Projects API endpoints (GET /api/projects, GET /api/projects/:id, POST /api/projects/seed)
- ✅ My Projects page with role badge
- ✅ Filter tabs: All, Pre 10%, 10-50%, 50-100%, Completed
- ✅ Real-time search by project name, client name, or phone
- ✅ Projects table with columns: Name, Collaborators, Stage, Phone (masked), Summary, Updated
- ✅ Stage badges with color coding (gray, amber, blue, green)
- ✅ Collaborator avatar stack with initials
- ✅ Phone number masking (98****21 format)
- ✅ Role-based filtering (Designer sees only assigned projects)
- ✅ Empty state for no matching results
- ✅ Click-to-navigate to project detail page

### December 28, 2025 - Phase 3: Project Detail View
- ✅ Three-column layout (Timeline | Comments | Stages)
- ✅ Tab navigation: Overview (default), Files, Notes, Collaborators
- ✅ Extended data model: timeline array, comments array with system messages
- ✅ Timeline panel with vertical connector, status badges (Completed/Pending/Delayed)
- ✅ Activity & Comments feed with user avatars, role badges, timestamps
- ✅ Immutable comments - no edit/delete after posting
- ✅ Add comment functionality with real-time updates
- ✅ System-generated comments for stage changes
- ✅ Stage selector with visual progress indicator
- ✅ Stage change auto-updates timeline and generates system comment
- ✅ PreSales redirect to dashboard with "Access denied" toast
- ✅ Designer can only access/modify assigned projects

### December 28, 2025 - Phase 4: Files, Notes, Collaborators
- ✅ **Files Module**:
  - Upload files (images, PDFs, DOCX) with drag & drop
  - File grid with icons, names, uploader, date
  - Download files
  - Admin-only delete
  - Designer/Manager/Admin can upload
  - Empty state when no files
- ✅ **Notes Module**:
  - Notepad-style editor with title + body
  - Auto-save on typing (1s debounce)
  - Notes list sidebar (Notion-style)
  - Creator & Admin can edit, others read-only
  - Empty state
- ✅ **Collaborators Module**:
  - List collaborators with avatars, names, roles
  - Add Collaborator button (Admin/Manager)
  - Search users in dialog
  - Remove button (Admin only)
  - Empty state when no collaborators

## Pages & Routes
| Route | Page | Access |
|-------|------|--------|
| /dashboard | Dashboard | All roles |
| /presales | Pre-Sales | Admin, Manager, PreSales |
| /leads | Leads | Admin, Manager |
| /projects | Projects | Admin, Manager, Designer |
| /projects/:id | Project Details | Admin, Manager, Designer |
| /academy | Academy | Admin |
| /settings | Settings | Admin |

## Prioritized Backlog

### P0 - Next Sprint
- [ ] CRM Lead management module
- [ ] Create/Edit project functionality
- [ ] Cloud file storage integration (S3/GCS)
- [ ] Email notifications for comments/stage changes

### P1 - Future
- [ ] Pre-Sales pipeline & inquiry tracking
- [ ] Academy training content
- [ ] Dashboard analytics widgets
- [ ] Notification system

### P2 - Nice to Have
- [ ] Email integrations
- [ ] Document management
- [ ] Client portal
- [ ] Mobile responsiveness improvements

## Tech Stack
- React 19, React Router v7
- TailwindCSS, Shadcn UI, Lucide Icons
- FastAPI, Motor (async MongoDB)
- Emergent Auth (Google OAuth)

## API Endpoints
### Auth
- `GET /api/health` - Health check
- `POST /api/auth/session` - Exchange session_id for session_token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/auth/users` - List all users (Admin)
- `PUT /api/auth/users/:user_id/role` - Update user role (Admin)

### Projects
- `GET /api/projects` - List projects (with optional stage/search filters)
- `GET /api/projects/:project_id` - Get single project with timeline & comments
- `POST /api/projects/:project_id/comments` - Add comment to project
- `PUT /api/projects/:project_id/stage` - Update project stage (auto-generates system comment)
- `POST /api/projects/seed` - Seed sample projects (Admin/Manager)

### Files
- `GET /api/projects/:project_id/files` - Get project files
- `POST /api/projects/:project_id/files` - Upload file
- `DELETE /api/projects/:project_id/files/:file_id` - Delete file (Admin only)

### Notes
- `GET /api/projects/:project_id/notes` - Get project notes
- `POST /api/projects/:project_id/notes` - Create note
- `PUT /api/projects/:project_id/notes/:note_id` - Update note

### Collaborators
- `GET /api/projects/:project_id/collaborators` - Get project collaborators
- `POST /api/projects/:project_id/collaborators` - Add collaborator (Admin/Manager)
- `DELETE /api/projects/:project_id/collaborators/:user_id` - Remove collaborator (Admin only)
- `GET /api/users/available` - Get all users for adding collaborators

### December 28, 2025 - Phase 12: Calendar System & Task Management
- ✅ Task data model (id, title, description, projectId, assignedTo, assignedBy, priority, status, dueDate, autoGenerated, timestamps)
- ✅ Task CRUD API endpoints with role-based access
- ✅ Calendar Events API aggregating milestones and tasks
- ✅ Calendar page with react-big-calendar (month/week/day views)
- ✅ Filter panel (event type, project, designer, status)
- ✅ Color-coded events matching requirements
- ✅ Event click modal with details and actions
- ✅ Create Task modal with form fields
- ✅ Quick stats showing milestone/task counts
- ✅ Sidebar navigation for Calendar

## Calendar System API Endpoints

### Tasks
- `GET /api/tasks` - List tasks (filters: project_id, assigned_to, status, priority, standalone)
- `GET /api/tasks/:task_id` - Get single task
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:task_id` - Update task
- `DELETE /api/tasks/:task_id` - Delete task

### Calendar Events
- `GET /api/calendar-events` - Get unified events (filters: start_date, end_date, designer_id, project_id, event_type, status)

## Color Coding
- Milestones: Blue (#2563EB) upcoming, Green (#22C55E) completed, Red (#EF4444) delayed
- Tasks: Yellow (#EAB308) pending, Orange (#F97316) in-progress, Green (#22C55E) completed, Red (#EF4444) overdue

### December 28, 2025 - Phase 13: Meeting Scheduler System
- ✅ Meeting data model (id, title, description, projectId, leadId, scheduledBy, scheduledFor, date, startTime, endTime, location, status, timestamps)
- ✅ Meeting CRUD API endpoints with role-based access
- ✅ Project-specific meetings endpoint
- ✅ Lead-specific meetings endpoint
- ✅ Auto-missed meeting detection
- ✅ Calendar integration with meeting events
- ✅ Meetings.jsx global page with tabs, filters, stats
- ✅ MeetingModal.jsx for create/edit meetings
- ✅ MeetingCard.jsx for meeting display
- ✅ Meetings tab in ProjectDetails.jsx
- ✅ Meetings section in LeadDetails.jsx
- ✅ Sidebar navigation for Meetings

## Meeting System API Endpoints

### Meetings
- `GET /api/meetings` - List meetings (filters: project_id, lead_id, scheduled_for, status, filter_type)
- `GET /api/meetings/:meeting_id` - Get single meeting
- `POST /api/meetings` - Create meeting
- `PUT /api/meetings/:meeting_id` - Update meeting
- `DELETE /api/meetings/:meeting_id` - Delete meeting
- `GET /api/projects/:project_id/meetings` - Get project meetings
- `GET /api/leads/:lead_id/meetings` - Get lead meetings
- `POST /api/meetings/check-missed` - Check and mark missed meetings

## Meeting Color Coding
- Scheduled: Purple (#9333EA)
- Completed: Green (#22C55E)
- Missed: Red (#EF4444)
- Cancelled: Gray (#6B7280)

### December 28, 2025 - Phase 13.5: Project Financials
- ✅ Extended Project model with: projectValue, paymentSchedule, payments[]
- ✅ Default payment schedule: Booking 10%, Design Finalization 40%, Production 40%, Handover 10%
- ✅ Financials API endpoints with role-based access
- ✅ Financials tab in ProjectDetails.jsx
- ✅ Summary cards (Project Value, Total Collected, Balance Pending)
- ✅ Payment Milestones display with calculated amounts
- ✅ Payment History table with Add/Delete functionality
- ✅ Add Payment modal (Amount, Mode, Date, Reference)
- ✅ Role permissions: Admin (full), Manager (edit+add), Designer (view), PreSales (no access)

## Project Financials API Endpoints

### Financials
- `GET /api/projects/:project_id/financials` - Get financial details
- `PUT /api/projects/:project_id/financials` - Update project value (Admin/Manager)
- `POST /api/projects/:project_id/payments` - Add payment (Admin/Manager)
- `DELETE /api/projects/:project_id/payments/:payment_id` - Delete payment (Admin only)

## Financial Data Model
- Payment modes: Cash, Bank, UPI, Other
- Payment structure: id, date, amount, mode, reference, addedBy, createdAt
