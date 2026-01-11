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
- [x] **NEW: Finance Roles** - JuniorAccountant, SeniorAccountant, FinanceManager, CharteredAccountant, Founder
- [x] **NEW: Granular Finance Permissions** - 9 permission groups with 40+ discrete permissions
- [x] **Roles are templates only** - Admin can fully customize permissions for any user

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
- **URL**: https://finance-tracker-1744.preview.emergentagent.com/login
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
- [x] **Accounting-Grade PDF Design** - Clean, neutral colors (charcoal/grey), no blue, CA/GST ready
- [x] **Company Profile Page** - Comprehensive settings at `/settings/company-profile`
- [x] **Auto Receipt Numbers** - Format: RCP-YYYYMMDD-XXXX
- [x] **Cashbook Integration** - Receipts auto-create inflow transactions
- [x] **Balance Tracking** - Contract value, total received, balance remaining
- [x] **Project Finance Receipts Section** - View all receipts for a project in Project Finance Detail page

### Company Profile Fields (NEW):
**Company Identity:**
- Legal Name, Brand/Display Name, Tagline/Descriptor
- GSTIN, PAN

**Address (Structured):**
- Address Line 1, Address Line 2
- City, State, PIN Code, Country

**Contact & Digital:**
- Primary Email, Secondary Email
- Phone Number, Website URL

**Branding:**
- Logo upload, Favicon upload
- Primary Color, Secondary Color

**Document Settings:**
- Authorized Signatory Name
- Receipt Footer Note

### Receipt PDF Contents (Accounting-Grade):
- Company Name + Tagline (header)
- Full formatted address (footer)
- Contact info: Email | Phone | Website
- GSTIN (footer)
- Receipt Number, Date
- "Received From" - Customer Name, Project Name
- Project ID
- Payment Description, Mode, Account
- Amount Received (near-black, prominent)
- Contract Value, Total Received, Balance Due
- Notes (optional)
- Authorized Signatory
- Custom footer note (configurable)

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
- `GET /api/finance/company-settings` - Get company settings (21 fields)
- `POST /api/finance/company-settings` - Update company settings
- `POST /api/finance/company-settings/logo` - Upload company logo

### New Pages:
- `/settings/company-profile` - Company Profile management page (Admin only)

### Test Data:
- Multiple test receipts created for project PID-00037 (sharan - Interior Project)
- Total received: ~₹1,05,000

---

## Deferred Tasks (Post-Testing)

### P1 - After Testing Stabilization
- [ ] Python Linting Cleanup (server.py)
- [ ] Backend Refactoring (break down 15,000+ line server.py)

### P2 - Upcoming Tasks (Real-World Accounting Flow)
- [x] **Payment Schedule Editor** - ✅ COMPLETED (Jan 2026)
- [x] **Invoice Creation Flow** - ✅ COMPLETED (Jan 2026)
- [x] **Refund & Cancellation Flow** - ✅ COMPLETED (Jan 2026)
- [ ] Finance Overview Dashboard

---

## ✅ P1 Finance & Payment Core - COMPLETED Jan 2026

### Payment Schedule Editor
- View payment stages per project with Expected/Received/Status
- Edit Schedule mode for Admin/Founder only
- Add/remove/modify stages with percentage or fixed amount
- **Lock stages** that have received payments (cannot remove)
- Calculate totals against contract value
- Route: `/finance/project-finance/{project_id}` (section)

### Invoice Creation Flow (GST Projects)
- Create GST invoices for applicable projects only
- Auto-calculate CGST + SGST at 9% each (18% total)
- Adjust for advances received
- Generate professional PDF invoice
- Route: `/finance/invoices`
- API: `GET/POST /api/finance/invoices`, `GET /api/finance/invoices/{id}/pdf`

### Refund & Cancellation Flow
- **Full Refund** - Return entire amount to customer
- **Partial Refund** - Return portion, keep rest
- **Forfeited** - No refund issued (cancellation charges)
- Creates outflow transaction in cashbook
- Fully traceable with reason and notes
- Route: `/finance/refunds`
- API: `GET/POST /api/finance/refunds`

### Sidebar Finance Menu (Updated)
- Overview
- Cash Book
- Receipts
- **Invoices** (new)
- **Refunds** (new)
- **Expense Requests** (new)
- Project Finance
- Daily Closing
- Monthly Snapshot

---

## ✅ Leak-Proof Spend Control System - COMPLETED Jan 2026

A comprehensive expense authorization system ensuring every financial transaction is tracked, owned, and auditable.

### Features Implemented:
- [x] **Expense Authorization Flow** - Mandatory request/approval before cashbook entry
- [x] **Spend Ownership** - Every expense has a designated owner responsible for closure
- [x] **Refund & Return Tracking** - Track pending refunds with statuses and alerts
- [x] **Controlled Cashbook** - Entries only from approved expenses (no manual free-entry for expenses)
- [x] **Over-Budget Detection** - Flags expenses exceeding project planned budget
- [x] **Visibility Dashboard** - Money at risk, open expenses, pending refunds on Founder Dashboard
- [x] **Activity Logging** - Complete audit trail of all expense actions

### Expense Request Statuses:
| Status | Description |
|--------|-------------|
| `pending_approval` | Submitted, waiting for approver |
| `approved` | Approved, ready to be recorded in cashbook |
| `rejected` | Rejected by approver |
| `recorded` | Recorded in cashbook (transaction created) |
| `refund_pending` | Expense returned/cancelled, refund awaited |
| `closed` | Fully settled |

### New Permissions:
| Permission | Description |
|------------|-------------|
| `finance.create_expense_request` | Request expenses for approval |
| `finance.approve_expense` | Approve or reject expense requests |
| `finance.record_expense` | Record approved expenses in cashbook |
| `finance.allow_over_budget` | Approve expenses exceeding project budget |
| `finance.view_expense_requests` | View expense request list |
| `finance.track_refunds` | Track pending refunds and returns |

### New API Endpoints:
- `GET /api/finance/expense-requests` - List all expense requests (with filters)
- `GET /api/finance/expense-requests/{id}` - Get expense request details
- `POST /api/finance/expense-requests` - Create new expense request
- `PUT /api/finance/expense-requests/{id}` - Update pending request
- `POST /api/finance/expense-requests/{id}/approve` - Approve or reject
- `POST /api/finance/expense-requests/{id}/record` - Record in cashbook
- `POST /api/finance/expense-requests/{id}/mark-refund-pending` - Mark refund pending
- `POST /api/finance/expense-requests/{id}/record-refund` - Record refund received
- `POST /api/finance/expense-requests/{id}/close` - Close expense
- `PUT /api/finance/expense-requests/{id}/reassign-owner` - Reassign ownership
- `GET /api/finance/expense-requests/stats/summary` - Dashboard summary stats

### New Pages:
- `/finance/expense-requests` - Expense Requests management page

### Key Data Model (`finance_expense_requests`):
- `request_id`, `request_number` (EXP-YYYYMMDD-XXXX)
- `project_id`, `category_id`, `vendor_id` (optional)
- `amount`, `description`, `urgency`
- `status`, `is_over_budget`, `budget_info`
- `requester_id/name`, `owner_id/name`
- `approved_by/at`, `rejected_by/at`, `recorded_by/at`
- `transaction_id` (link to cashbook when recorded)
- `refund_status`, `refund_expected_amount`, `refund_received_amount`
- `activity_log` (array of actions)

---

## ✅ Accounting Roles & Permission System - COMPLETED Jan 2026

A comprehensive, admin-controlled permission system for finance operations with role templates.

### New Finance Roles (Templates Only):
| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **JuniorAccountant** | Basic data entry | View & create cashbook, NO delete/edit |
| **SeniorAccountant** | Full cashbook ops | Edit, verify, lock daily closing, invoices |
| **FinanceManager** | Full finance control | All approvals, budget overrides, write-offs |
| **CharteredAccountant** | Read-only audit | Reports, export, NO operational edits |
| **Founder** | Full visibility | Final overrides, not required for daily tasks |

### Granular Permission Groups:
| Group | Key Permissions |
|-------|-----------------|
| `finance_cashbook` | view, create, edit, delete, verify, daily_closing.lock, transaction.reverse |
| `finance_accounts` | view, create, edit, opening_balance |
| `finance_documents` | receipts.view/create/download, invoices.view/create/cancel, refunds.view/create/approve |
| `finance_project` | view, allocate_funds, vendor_mapping, cost_edit, override_budget |
| `finance_expenses` | view, create, approve, record, track_refunds |
| `finance_reports` | view, export, profit, margin, monthly_snapshot, founder_dashboard |
| `finance_masters` | categories.view/manage, vendors.view/manage, payment_schedule.view/edit/override |
| `finance_controls` | writeoff.approve, exception.mark, audit_log.view, import_data, cancellation.mark |

### API Endpoints:
- `GET /api/roles/available` - List all roles with categories
- `GET /api/roles/{role_id}/default-permissions` - Get role default permissions
- `GET /api/permissions/available` - Get all permission groups (Admin only)

### Key Principles:
- **NO hard-coded authority** - Roles are templates only
- **Admin full control** - Can modify any user's permissions freely
- **CRM untouched** - Finance permissions are completely separate
- **Backward compatibility** - Legacy finance permissions kept

### Permission Editor UI (Visual Admin Tool):
| Feature | Description |
|---------|-------------|
| **Role Dropdown** | Shows all 13 roles grouped by category (Administration, Sales, Design, Operations, Service, Finance, Leadership) |
| **Permission Counts** | Displays CRM/Finance/Total breakdown |
| **Filter Buttons** | All Permissions, CRM Only, Finance Only |
| **Checkboxes** | Toggle individual permissions on/off |
| **Reset to Defaults** | Restore role template permissions |
| **Save Button** | Persist custom permission changes |
| **Visual Styling** | Finance groups have emerald green styling to distinguish from CRM |

---

### P3 - Future Features (Accounting Phase 2)
- [x] **Account Master** - ✅ COMPLETED (Jan 2026)
- [x] **Expense Category Master** - ✅ COMPLETED (Jan 2026)
- [x] **Vendor Master** - ✅ COMPLETED (Jan 2026)
- [x] **Audit Logging** - ✅ COMPLETED (Jan 2026)
- [ ] Finance Reports (Cash Flow, P&L, Project Profitability)
- [ ] Import/Export System
- [ ] Transaction Safety (Reversal entries)
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
