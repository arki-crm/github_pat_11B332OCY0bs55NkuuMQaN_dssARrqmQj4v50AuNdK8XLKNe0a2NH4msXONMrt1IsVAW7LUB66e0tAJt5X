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
- ✅ Placeholder pages: Dashboard, PreSales, Leads, Projects, Academy, Settings
- ✅ Access denied toast for unauthorized routes

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
- [ ] Project management with status tracking
- [ ] Team assignment to projects

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
- `GET /api/health` - Health check
- `POST /api/auth/session` - Exchange session_id for session_token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/auth/users` - List all users (Admin)
- `PUT /api/auth/users/:user_id/role` - Update user role (Admin)
