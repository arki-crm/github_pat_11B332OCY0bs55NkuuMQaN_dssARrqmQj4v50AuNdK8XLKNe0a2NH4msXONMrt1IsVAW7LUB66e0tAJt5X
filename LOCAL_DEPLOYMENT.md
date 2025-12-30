# Arkiflo CRM - Local Deployment Guide

This guide explains how to deploy Arkiflo locally for testing outside the Emergent environment.

## Prerequisites

- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB (local or Docker)

## Backend Setup

1. Navigate to backend directory:
```bash
cd /app/backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Update `.env` file for local MongoDB:
```bash
# Edit backend/.env
MONGO_URL=mongodb://localhost:27017
DB_NAME=arkiflo_local
```

5. Start the backend:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## Frontend Setup

1. Navigate to frontend directory:
```bash
cd /app/frontend
```

2. Install dependencies:
```bash
yarn install
```

3. Update `.env` for local backend:
```bash
# Edit frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8001
```

4. Start the frontend:
```bash
yarn start
```

## Setup Local Admin User

Once both services are running:

### Option 1: Via API (Recommended)
```bash
curl -X POST http://localhost:8001/api/auth/setup-local-admin
```

### Option 2: Via UI
1. Open http://localhost:3000/login
2. Click "Local Admin Login"
3. Click "Setup Local Admin"

## Login Credentials

**Email:** thaha.pakayil@gmail.com  
**Password:** password123  
**Role:** Admin (full access)

## Local Login Flow

1. Go to http://localhost:3000/login
2. Click "Local Admin Login" to expand the form
3. Enter the credentials above
4. Click "Login with Email"
5. You'll be redirected to the Dashboard with full Admin access

## Features Available

With Admin access, you can test:
- ✅ Pre-Sales workflow
- ✅ Lead management & conversion
- ✅ Project milestones (Design, Production, Delivery, Handover)
- ✅ Warranty & Service Requests
- ✅ Academy (video upload, lessons)
- ✅ User management
- ✅ Reports & Analytics
- ✅ Global Search
- ✅ Notifications

## Notes

- The local login system does **NOT** replace Google OAuth
- Both login methods work side-by-side
- Local login uses session cookies (7-day expiry)
- The local admin user has full system access

## Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running locally
- Check `MONGO_URL` in backend/.env

**CORS Errors:**
- Make sure `REACT_APP_BACKEND_URL` matches where backend is running
- Backend must be accessible from frontend origin

**Cookie Not Set:**
- Clear browser cookies and try again
- Use Chrome DevTools > Application > Cookies to verify
