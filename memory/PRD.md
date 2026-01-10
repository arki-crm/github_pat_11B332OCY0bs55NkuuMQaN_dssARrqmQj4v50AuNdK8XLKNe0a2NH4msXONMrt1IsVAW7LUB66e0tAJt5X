# Arkiflo - Interior Design Workflow System

## Problem Statement
Build a full-stack CRM application for an interior design company, managing the complete workflow from Pre-Sales inquiries through Project completion, with milestone tracking, user permissions, and team collaboration.

## Architecture
- **Frontend**: React 19 + TailwindCSS + Shadcn UI
- **Backend**: FastAPI (Python) - Currently monolithic server.py (~11,000 lines)
- **Database**: MongoDB
- **Authentication**: Emergent Google OAuth + Local Password Login (for testing)

## Current Status: STABLE - Manual Testing Phase
**As of January 2026**

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

### User Management & Permissions (Updated Jan 2026)
- [x] Fine-grained permission-based access control
- [x] Admin can create new users with local passwords
- [x] Admin can assign specific permissions to any user
- [x] Permission checks throughout the application
- [x] **NEW: Operation Lead role** - ground-level execution for delivery/installation/handover

### CRM Modules
- [x] Pre-Sales management
- [x] Lead management with conversion flow
- [x] **Lead actions (comments, stage updates)** - permission-based enforcement
- [x] Project management with multi-stage milestones
- [x] Files, Notes, Collaborators per project
- [x] Meetings & Calendar system
- [x] Project Financials & Payment tracking

### Additional Features
- [x] Academy module with video/PDF uploads
- [x] Warranty & Service Requests
- [x] **Warranty collaborators** - Technicians can be added to warranty requests
- [x] Global Search
- [x] Notifications system
- [x] Reports & Analytics pages
- [x] **Time-based filters** - This Month, Last Month, This Quarter on Leads & Projects

---

## Test Credentials

**Local Admin Login:**
- **URL**: https://designbooks-1.preview.emergentagent.com/login
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

## ✅ Accounting/Finance Module (Phase 1) - COMPLETED Jan 2026

A new, isolated Accounting module has been built alongside the frozen CRM.

### Features Implemented:
- [x] **Cash Book / Day Book** - Log and view daily financial transactions
- [x] **Account Management** - Bank accounts and cash-in-hand with opening balances
- [x] **Category Management** - Configurable expense categories
- [x] **Daily Closing & Locking** - Permanently lock a day's transactions
- [x] **Permission-Based Access** - Uses `finance.*` permissions, not role names
- [x] **Account Balance Cards** - Real-time balance display per account
- [x] **Day Summary** - Total In, Total Out, Net for selected date
- [x] **Date Navigation** - Navigate between days with prev/next buttons
- [x] **CRM Project Linking** - Link expenses to CRM projects (read-only integration)

---

## ✅ Project Finance Control (Phase 3) - COMPLETED Jan 2026

Project-level financial intelligence to answer: "How much can I safely take out?"

### Features Implemented:
- [x] **Vendor Mapping** - Plan costs before spending (Vendor, Category, Amount, Notes)
- [x] **Vendor Categories** - Modular, Non-Modular, Installation, Transport, Other
- [x] **Auto-Locking** - Vendor mappings locked when spending/production starts
- [x] **Actual vs Planned Comparison** - Auto-pulls from Cashbook, groups by category
- [x] **Financial Summary Card** - Contract Value, Received, Planned, Actual, Liability, Surplus
- [x] **Over-Budget Warnings** - Highlights when Actual > Planned
- [x] **Recent Transactions** - Shows Cashbook entries linked to project
- [x] **Audit Trail** - Edit history tracked for vendor mappings

### Permissions:
| Permission Key | Description |
|---------------|-------------|
| `finance.view_project_finance` | View project financial summaries |
| `finance.edit_vendor_mapping` | Add/edit/delete vendor mappings |

### Project Finance API Endpoints:
- `GET /api/finance/project-finance` - List projects with financial data
- `GET /api/finance/project-finance/{project_id}` - Project detail with summary
- `GET /api/finance/vendor-mappings/{project_id}` - Get vendor mappings
- `POST /api/finance/vendor-mappings` - Create vendor mapping
- `PUT /api/finance/vendor-mappings/{mapping_id}` - Update mapping
- `DELETE /api/finance/vendor-mappings/{mapping_id}` - Delete mapping
- `GET /api/finance/vendor-categories` - Get category list

### Finance Permissions:
| Permission Key | Description |
|---------------|-------------|
| `finance.view_dashboard` | View finance overview |
| `finance.view_cashbook` | View daily cash book |
| `finance.add_transaction` | Create new entries |
| `finance.edit_transaction` | Modify entries (unlocked days only) |
| `finance.delete_transaction` | Remove entries (unlocked days only) |
| `finance.verify_transaction` | Mark transactions as verified |
| `finance.close_day` | Lock daily entries permanently |
| `finance.view_reports` | Access financial reports |
| `finance.manage_accounts` | Add/edit bank and cash accounts |
| `finance.manage_categories` | Add/edit expense categories |

### Finance API Endpoints:
- `GET /api/accounting/accounts` - List accounts
- `POST /api/accounting/accounts` - Create account
- `GET /api/accounting/categories` - List categories  
- `POST /api/accounting/categories` - Create category
- `GET /api/accounting/transactions?date=YYYY-MM-DD` - Get transactions
- `POST /api/accounting/transactions` - Create transaction
- `GET /api/accounting/daily-summary/{date}` - Daily summary with balances
- `POST /api/accounting/close-day/{date}` - Lock day's books
- `GET /api/accounting/reports/account-balances` - Account balances report
- `GET /api/accounting/reports/category-summary` - Category summary report

### Test Data:
- **Petty Cash**: ₹47,500 (Cash-in-Hand)
- **Bank of Baroda - Current**: ₹500,000 (Company Bank Primary)
- Categories: Project Expenses, Office Expenses, Sales & Marketing, Travel/TA, Site Expenses, Miscellaneous

---

## ✅ Finance Controls & Guardrails (Phase 3 Extended) - COMPLETED Jan 2026

Financial control and visibility for the founder without complex accounting.

### Features Implemented:
- [x] **Founder Dashboard** - Read-only snapshot answering "Can I safely spend money today?"
  - Total Cash Available (all accounts)
  - Locked Commitments (vendor mappings)
  - Safe Surplus (usable amount)
  - Health Status (Healthy/Warning/Critical)
  - Top 5 Risky Projects
  - Month-to-Date Received/Spent
- [x] **Daily Closing System** - Auto-calculated from Cashbook per account
  - Opening Balance, Inflow, Outflow, Closing Balance
  - Account-wise breakdown table
  - Close Day button (locks permanently)
  - Historical closings list
- [x] **Monthly Snapshot & Freeze** - End-of-month financial capture
  - Total Inflow/Outflow/Net Change
  - Cash Position
  - Planned vs Actual comparison
  - Close Month button (read-only after)
- [x] **Project Safe Surplus Warnings** - Risk levels (Green/Amber/Red)
  - Visual warnings when Over Budget
  - No money movement from Red projects

### New Permissions:
| Permission | Admin | SeniorAccountant | Accountant |
|------------|-------|------------------|------------|
| finance.founder_dashboard | ✅ | ❌ | ❌ |
| finance.daily_closing | ✅ | ✅ | ✅ (view only) |
| finance.monthly_snapshot | ✅ | ✅ | ❌ |

### New API Endpoints:
- `GET /api/finance/founder-dashboard` - Founder snapshot
- `GET /api/finance/daily-closing?date=YYYY-MM-DD` - Daily breakdown
- `POST /api/finance/daily-closing/{date}/close` - Lock day
- `GET /api/finance/daily-closing/history` - Recent closings
- `GET /api/finance/monthly-snapshots` - List snapshots
- `GET /api/finance/monthly-snapshots/{year}/{month}` - Specific month
- `POST /api/finance/monthly-snapshots/{year}/{month}/close` - Freeze month
- `GET /api/finance/project-surplus-status` - Risk levels

---

## ✅ Accounting Governance & Decision Layer (Phase 3++) - COMPLETED Jan 2026

Turn accounting data into actionable decisions and leak prevention.

### Features Implemented:
- [x] **Safe Spend Panel** - Daily safe limit, monthly budget tracking, warnings
- [x] **Spending Approval Rules** - Soft control for high-value transactions
- [x] **Overrun Attribution** - Document reasons when actual > planned
- [x] **Cost Intelligence** - Compare with similar projects, flag abnormal entries
- [x] **Alerts & Signals** - Project overruns, low cash, pending approvals
- [x] **Decision Shortcuts** - Freeze/Unfreeze, Allow Overrun, Mark Exceptional
- [x] **Project Decisions Log** - Track all governance decisions

### Decision Shortcuts (Admin Only):
| Action | Description |
|--------|-------------|
| Freeze Spending | Block all new expenses for a project |
| Unfreeze | Re-enable spending |
| Allow Overrun | One-time approval for exceeding planned |
| Mark Exceptional | Flag project as special case |
| Explain Overrun | Record attribution for budget exceedance |

### Overrun Attribution Options:
- **Reasons**: Vendor Price Increase, Design Change Request, Site Issue, Material Upgrade, Scope Addition, Internal Miss, Market Rate Change, Emergency, Other
- **Responsible**: Vendor, Design Team, Site Team, Client Request, Management, External Factor

### New API Endpoints:
- `GET /api/finance/safe-spend` - Daily/monthly spending limits
- `GET /api/finance/alerts` - Active alerts and signals
- `GET /api/finance/approval-rules` - Spending approval rules
- `POST /api/finance/transactions/{id}/approve` - Approve transaction
- `GET /api/finance/cost-intelligence/{project_id}` - Benchmark comparison
- `GET /api/finance/overrun-reasons` - Overrun options
- `POST /api/finance/overrun-attributions` - Record attribution
- `POST /api/finance/projects/{id}/freeze-spending` - Freeze project
- `POST /api/finance/projects/{id}/allow-overrun` - Allow overrun
- `POST /api/finance/projects/{id}/mark-exceptional` - Mark exceptional

---

## ✅ Real-World Accounting & Payment Flow - COMPLETED Jan 2026

Customer payment receipts with server-side PDF generation.

### Features Implemented:
- [x] **Receipts Management** - List, create, view payment receipts
- [x] **PDF Receipt Generation** - Server-side using ReportLab (lightweight Python)
- [x] **Premium PDF Design** - Clean, corporate style with proper typography hierarchy
- [x] **Company Settings** - Configurable company name, address, GSTIN, logo, primary_color, authorized signatory
- [x] **Auto Receipt Numbers** - Format: RCP-YYYYMMDD-XXXX
- [x] **Cashbook Integration** - Receipts auto-create inflow transactions
- [x] **Balance Tracking** - Contract value, total received, balance remaining
- [x] **Project Finance Receipts Section** - View all receipts for a project in Project Finance Detail page

### Receipt PDF Contents (Premium Design):
- Company Name, Address, Email, Phone, GSTIN (from settings)
- Primary Color accent (configurable)
- Receipt Number, Date (clean two-column header)
- "Received From" - Customer Name, Project Name
- Project ID
- Payment Description, Mode, Account
- Amount Received (highlighted with primary color)
- Contract Value, Total Received, Balance Due (summary)
- Notes (optional)
- Authorized Signatory
- "This is a system-generated receipt" footer

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.view_receipts` | View payment receipts |
| `finance.add_receipt` | Create new receipts |
| `finance.issue_refund` | Cancel receipts, issue refunds |

### New API Endpoints:
- `GET /api/finance/receipts` - List all receipts
- `GET /api/finance/receipts/{receipt_id}` - Get receipt details
- `POST /api/finance/receipts` - Create receipt
- `GET /api/finance/receipts/{receipt_id}/pdf` - Download PDF receipt
- `POST /api/finance/receipts/{receipt_id}/cancel` - Cancel receipt
- `GET /api/finance/company-settings` - Get company settings
- `POST /api/finance/company-settings` - Update company settings
- `POST /api/finance/company-settings/logo` - Upload company logo

### Test Data:
- Multiple test receipts created for project PID-00037 (sharan - Interior Project)
- Total received: ~₹1,05,000

---

## Deferred Tasks (Post-Testing)

### P1 - After Testing Stabilization
- [ ] Python Linting Cleanup (server.py)
- [ ] Backend Refactoring (break down 15,000+ line server.py)

### P2 - Upcoming Tasks (Real-World Accounting Flow)
- [ ] **Payment Schedule Editor** - Modify percentages, add/rename stages per project
- [ ] **Invoice Creation Flow** - For GST-applicable projects
- [ ] **Refund & Cancellation Flow** - Full/partial refunds, project cancellations
- [ ] Finance Overview Dashboard

### P3 - Future Features (Accounting Phase 2)
- [ ] Account Masters Admin UI
- [ ] Category Masters Admin UI  
- [ ] Transaction Edit/Delete functionality
- [ ] Basic Reports UI (Daily, Project-wise, Category-wise)
- [ ] Transaction verification workflow
- [ ] Historical Cost Intelligence
- [ ] Import/Export for financial data
- [ ] Budget forecasting tools
- [ ] SMS/Email integration for critical alerts

### P3 - Future Features (CRM)
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
