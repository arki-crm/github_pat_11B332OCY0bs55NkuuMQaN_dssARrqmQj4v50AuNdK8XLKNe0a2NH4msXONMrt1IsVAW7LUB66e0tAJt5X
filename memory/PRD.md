# Arkiflo - Interior Design Workflow System

## Problem Statement
Build a full-stack CRM application for an interior design company, managing the complete workflow from Pre-Sales inquiries through Project completion, with milestone tracking, user permissions, and team collaboration.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Backend**: FastAPI (Python) - Currently monolithic server.py (~11,000 lines)
- **Database**: MongoDB
- **Authentication**: Emergent Google OAuth + Local Password Login (for testing)

## Current Status: STABLE - Manual Testing Phase
**As of December 2025**

The core CRM pipeline has been stabilized and is ready for manual end-to-end testing with real users.

---

## ✅ Verified & Stable Features

### Core Pipeline (DO NOT MODIFY)
- **Pre-Sales → Lead → Project** workflow is fully functional
- **PID (Project ID)** persists correctly throughout the lifecycle
- **Milestone progression** saves and restores correctly on navigation

### Authentication
- [x] Google OAuth login via Emergent Auth
- [x] Local email/password login for testing
- [x] Session management with httpOnly cookies

### User Management & Permissions (NEWLY VERIFIED - Dec 2025)
- [x] Fine-grained permission-based access control
- [x] Admin can create new users with local passwords
- [x] Admin can assign specific permissions to any user
- [x] Permission checks throughout the application

### CRM Modules
- [x] Pre-Sales management
- [x] Lead management with conversion flow
- [x] Project management with multi-stage milestones
- [x] Files, Notes, Collaborators per project
- [x] Meetings & Calendar system
- [x] Project Financials & Payment tracking

### Additional Features
- [x] Academy module with video/PDF uploads
- [x] Warranty & Service Requests
- [x] Global Search
- [x] Notifications system
- [x] Reports & Analytics pages

---

## Test Credentials

**Local Admin Login:**
- **URL**: https://crm-repair-4.preview.emergentagent.com/login
- **Email**: thaha.pakayil@gmail.com
- **Password**: password123
- **Access**: Full Admin permissions

**Login Flow:**
1. Go to /login
2. Click "Local Admin Login" to expand the form
3. Enter credentials above
4. Click "Login with Email"

---

## Key User Flows to Test

### 1. Pre-Sales → Lead → Project Flow
- Create a new Pre-Sales entry
- Convert Pre-Sales to Lead
- Convert Lead to Project
- Verify PID appears and persists

### 2. Project Milestone Progression
- Open any project
- Progress through Design → Production → Delivery → Handover stages
- Navigate away and return - verify progress is saved

### 3. User Management (Admin only)
- Go to Settings → Users
- Click "Create User" to add a new user with local password
- Click user row → "Manage Permissions" 
- Assign/remove specific permissions
- Test login with new user credentials

### 4. Permission-Based Access
- Create a user with limited permissions
- Login as that user
- Verify they can only access permitted features

### 5. Milestone Permission Testing (NEW)
- Create a Designer user with only `milestones.update.design` permission
- Login as Designer and verify:
  - Can update Design Finalization milestones
  - Cannot update Production/Delivery/Installation/Handover milestones
  - UI shows "You don't have permission" message for restricted groups
- Admin can manually grant additional milestone permissions

---

## Available Permissions

| Permission Key | Description |
|---------------|-------------|
| `presales.view` | View pre-sales |
| `presales.create` | Create pre-sales |
| `presales.update` | Update pre-sales |
| `presales.convert` | Convert pre-sales to leads |
| `leads.view` | View leads |
| `leads.view_all` | View all leads |
| `leads.create` | Create leads |
| `leads.update` | Update leads |
| `leads.convert` | Convert leads to projects |
| `projects.view` | View projects |
| `projects.view_all` | View all projects |
| `projects.manage_collaborators` | Manage project collaborators |
| **Milestone Permissions (NEW)** | |
| `milestones.update.design` | Update Design Finalization milestones |
| `milestones.update.production` | Update Production milestones |
| `milestones.update.delivery` | Update Delivery milestones |
| `milestones.update.installation` | Update Installation milestones |
| `milestones.update.handover` | Update Handover milestones |
| `warranty.view` | View warranty |
| `warranty.update` | Update warranty |
| `service.view` | View service requests |
| `service.view_all` | View all service requests |
| `service.create` | Create service requests |
| `service.update` | Update service requests |
| `academy.view` | View academy |
| `academy.manage` | Manage academy content |
| `admin.manage_users` | Manage users |
| `admin.assign_permissions` | Assign permissions |
| `admin.view_reports` | View reports |
| `admin.system_settings` | System settings |

---

## Deferred Tasks (Post-Testing)

### P1 - After Testing Stabilization
- [ ] Python Linting Cleanup (server.py)
- [ ] Backend Refactoring (break down 11,000+ line server.py)

### P2 - Future Features
- [ ] ProductionOpsDashboard UI implementation
- [ ] Quick Add button on main dashboard
- [ ] Drag-and-drop for stage changes
- [ ] File versioning
- [ ] Rich text (markdown) support for Notes

---

## API Quick Reference

### Auth
- `POST /api/auth/login-local` - Local password login
- `POST /api/users/create-local` - Create user with password (Admin)
- `GET /api/auth/me` - Get current user

### Permissions
- `GET /api/permissions` - List all available permissions
- `PUT /api/users/{user_id}/permissions` - Update user permissions

### Core CRM
- `GET /api/presales` - List pre-sales entries
- `GET /api/leads` - List leads
- `GET /api/projects` - List projects
- `GET /api/projects/{id}` - Project details with milestones

---

## Tech Stack
- React 19, React Router v7
- TailwindCSS, Shadcn UI, Lucide Icons
- FastAPI, Motor (async MongoDB)
- passlib + bcrypt (password hashing)
- aiofiles (async file uploads)

## 3rd Party Integrations
- **Emergent-managed Google Auth**: Production user login
- **Google Forms (Planned)**: Service request intake (backend endpoint exists, not connected)
