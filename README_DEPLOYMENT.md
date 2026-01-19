# 🚀 ARKIFLO - Complete Deployment Guide

**Step-by-step deployment for Contabo VPS (Ubuntu 22.04)**

This guide is written for non-technical users. Follow each step exactly as shown.

---

## 📋 Table of Contents

1. [Server Prerequisites](#1-server-prerequisites)
2. [One-time Server Setup](#2-one-time-server-setup)
3. [Project Setup](#3-project-setup)
4. [Environment Configuration](#4-environment-configuration)
5. [Deployment Commands](#5-deployment-commands)
6. [Post-Deployment Verification](#6-post-deployment-verification)
7. [Common Errors & Fixes](#7-common-errors--fixes)
8. [Re-deploy / Update Flow](#8-re-deploy--update-flow)
9. [Backup & Restore](#9-backup--restore)
10. [Quick Reference](#10-quick-reference)

---

## 1. Server Prerequisites

### Operating System
- **Required:** Ubuntu 22.04 LTS (recommended)
- Also works on: Ubuntu 20.04, Debian 11/12

### Minimum Hardware
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB |
| CPU | 1 vCPU | 2 vCPU |

### Ports to Open

You must open these ports in your Contabo firewall/security settings:

| Port | Protocol | Purpose |
|------|----------|---------|
| **22** | TCP | SSH access (already open) |
| **80** | TCP | HTTP (website) |
| **443** | TCP | HTTPS (secure website) |

> **Note:** Port 27017 (MongoDB) should NOT be opened to public. It's only accessible internally.

### How to Open Ports on Contabo

1. Log in to Contabo Control Panel
2. Go to your VPS → "Firewall" or "Network"
3. Add rules for ports 80 and 443
4. Save changes

---

## 2. One-time Server Setup

### Step 2.1: Connect to Your Server

Open your terminal (Mac/Linux) or PowerShell (Windows) and connect:

```bash
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with your actual Contabo server IP address.

Example:
```bash
ssh root@123.45.67.89
```

Enter your password when prompted.

---

### Step 2.2: Update the System

Run these commands one by one:

```bash
# Update package list
sudo apt update

# Upgrade all packages
sudo apt upgrade -y
```

This may take 2-5 minutes.

---

### Step 2.3: Install Docker

```bash
# Download Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh

# Run the installation script
sudo sh get-docker.sh

# Clean up
rm get-docker.sh
```

---

### Step 2.4: Install Docker Compose

```bash
# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y
```

---

### Step 2.5: Verify Installation

Run these commands to confirm everything is installed:

```bash
# Check Docker version
docker --version
```
Expected output: `Docker version 24.x.x` or higher

```bash
# Check Docker Compose version
docker compose version
```
Expected output: `Docker Compose version v2.x.x` or higher

```bash
# Test Docker is working
sudo docker run hello-world
```
Expected output: "Hello from Docker!" message

---

### Step 2.6: (Optional) Run Docker Without Sudo

This lets you run docker commands without typing `sudo` every time:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Apply changes (or log out and log back in)
newgrp docker
```

---

## 3. Project Setup

### Step 3.1: Navigate to Home Directory

```bash
cd ~
```

---

### Step 3.2: Clone the Repository

Replace `YOUR_GITHUB_REPO_URL` with your actual repository URL:

```bash
git clone YOUR_GITHUB_REPO_URL arkiflo
```

Example:
```bash
git clone https://github.com/yourusername/arkiflo.git arkiflo
```

---

### Step 3.3: Enter Project Directory

```bash
cd arkiflo
```

---

### Step 3.4: Understand the Folder Structure

```
arkiflo/
├── docker-compose.yml      ← Main Docker configuration
├── mongo-init.js           ← MongoDB user creation script
├── .env.example            ← Environment template (ROOT - COPY THIS)
├── backend/
│   ├── Dockerfile          ← Backend container config
│   ├── .env.example        ← Backend env template (reference only)
│   ├── server.py           ← Main backend code
│   └── requirements.txt    ← Python dependencies
├── frontend/
│   ├── Dockerfile          ← Frontend container config
│   ├── nginx.conf          ← Web server configuration
│   ├── .env.example        ← Frontend env template (reference only)
│   └── src/                ← React source code
├── README_DEPLOYMENT.md    ← This file
└── validate-deployment.sh  ← Deployment verification script
```

---

## 4. Environment Configuration

### Step 4.1: Create the Environment File

You only need to create ONE `.env` file in the root folder:

```bash
cp .env.example .env
```

---

### Step 4.2: Edit the Environment File

Open the file for editing:

```bash
nano .env
```

You will see this content:

```env
# ============ MONGODB CREDENTIALS ============
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_123

MONGO_APP_USER=arkiflo_app
MONGO_APP_PASSWORD=CHANGE_THIS_APP_PASSWORD_456

# ============ FRONTEND ============
REACT_APP_BACKEND_URL=http://YOUR_SERVER_IP_OR_DOMAIN
```

---

### Step 4.3: Configure Each Variable

#### Understanding the Variables

| Variable | What It Is | Example Value |
|----------|------------|---------------|
| `MONGO_ROOT_USER` | Admin username for database | `admin` (keep as is) |
| `MONGO_ROOT_PASSWORD` | Admin password for database | `MyStr0ng!Pass#2024` |
| `MONGO_APP_USER` | App username for database | `arkiflo_app` (keep as is) |
| `MONGO_APP_PASSWORD` | App password for database | `App$ecure#Pass456` |
| `REACT_APP_BACKEND_URL` | Your server's public URL | `http://123.45.67.89` |

---

### Step 4.4: Fill In Your Values

Replace the placeholder values with your own:

```env
# ============ MONGODB CREDENTIALS ============
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=MyStr0ng!Pass#2024

MONGO_APP_USER=arkiflo_app
MONGO_APP_PASSWORD=App$ecure#Pass456

# ============ FRONTEND ============
REACT_APP_BACKEND_URL=http://123.45.67.89
```

> ⚠️ **IMPORTANT PASSWORD RULES:**
> - Use at least 16 characters
> - Include uppercase, lowercase, numbers, and symbols
> - Do NOT use these example passwords - create your own!
> - Do NOT use spaces in passwords

---

### Step 4.5: Save and Exit

1. Press `Ctrl + X` to exit
2. Press `Y` to confirm save
3. Press `Enter` to confirm filename

---

### Step 4.6: Verify Your Configuration

```bash
cat .env
```

Make sure:
- ✅ Both passwords are changed from defaults
- ✅ Server IP is correct (no http:// typos)
- ✅ No extra spaces or quotes around values

---

## 5. Deployment Commands

### Step 5.1: Build and Start All Services

This single command does everything:

```bash
docker compose up -d --build
```

**What this does:**
- Downloads required images (MongoDB, Python, Node.js, Nginx)
- Builds your backend and frontend containers
- Creates the database with authentication
- Starts all services in the background

**Expected output:**
```
[+] Building 120.5s (25/25) FINISHED
[+] Running 4/4
 ✔ Network arkiflo_arkiflo_network  Created
 ✔ Volume "arkiflo_mongo_data"      Created
 ✔ Volume "arkiflo_uploads"         Created
 ✔ Volume "arkiflo_backups"         Created
 ✔ Container arkiflo_mongo          Started
 ✔ Container arkiflo_backend        Started
 ✔ Container arkiflo_frontend       Started
```

> ⏱️ **First build takes 3-10 minutes.** This is normal.

---

### Step 5.2: Wait for Services to Start

Wait 30 seconds for all services to initialize:

```bash
sleep 30
```

---

### Step 5.3: Check Service Status

```bash
docker compose ps
```

**Expected output (all should show "Up" and "healthy"):**
```
NAME                STATUS              PORTS
arkiflo_mongo       Up (healthy)        0.0.0.0:27017->27017/tcp
arkiflo_backend     Up (healthy)        0.0.0.0:8001->8001/tcp
arkiflo_frontend    Up (healthy)        0.0.0.0:80->80/tcp
```

---

## 6. Post-Deployment Verification

### Step 6.1: Verify Backend is Running

```bash
curl http://localhost:8001/api/health
```

**Expected output:**
```json
{"status":"healthy","timestamp":"2024-01-16T12:00:00.000000+00:00"}
```

If you see this, the backend is working! ✅

---

### Step 6.2: Verify Frontend is Running

```bash
curl -I http://localhost:80
```

**Expected output (first line):**
```
HTTP/1.1 200 OK
```

If you see "200 OK", the frontend is working! ✅

---

### Step 6.3: Verify MongoDB Authentication

```bash
docker exec arkiflo_mongo mongosh --eval "db.adminCommand('ping')" --quiet
```

**Expected output:**
```
{ ok: 1 }
```

If you see `{ ok: 1 }`, MongoDB is working! ✅

---

### Step 6.4: Verify Login API Works

Test the login endpoint to confirm database connectivity:

```bash
curl -X POST http://localhost:8001/api/auth/local-login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_SEED_ADMIN_EMAIL","password":"YOUR_SEED_ADMIN_PASSWORD"}'
```

Replace with your actual credentials from `.env`. Example:
```bash
curl -X POST http://localhost:8001/api/auth/local-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"YourSecurePassword123!"}'
```

**Expected output:**
```json
{"success":true,"message":"Login successful","user":{...}}
```

If you see `"success": true`, the database and authentication are working! ✅

---

### Step 6.5: Access Your Application

Open your web browser and go to:

```
http://YOUR_SERVER_IP
```

Example:
```
http://123.45.67.89
```

You should see the Arkiflo login page! 🎉

---

### Step 6.5: Run Automated Verification (Optional)

```bash
chmod +x validate-deployment.sh
./validate-deployment.sh
```

This script checks everything automatically and reports pass/fail.

---

## 7. Common Errors & Fixes

### Error: "docker: command not found"

**Cause:** Docker is not installed.

**Fix:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

---

### Error: "permission denied while trying to connect to Docker"

**Cause:** User doesn't have Docker permissions.

**Fix:**
```bash
sudo usermod -aG docker $USER
# Then log out and log back in, or run:
newgrp docker
```

---

### Error: "port is already allocated" or "address already in use"

**Cause:** Another service is using port 80 or 8001.

**Fix:**
```bash
# Find what's using port 80
sudo lsof -i :80

# Stop the service (example: Apache)
sudo systemctl stop apache2
sudo systemctl disable apache2

# Or kill the process directly
sudo kill -9 $(sudo lsof -t -i:80)
```

---

### Error: "MongoDB authentication failed"

**Cause:** Wrong password or database not initialized properly.

**Fix (if first time deploying):**
```bash
# Stop everything
docker compose down

# Remove the database volume (WARNING: deletes all data!)
docker volume rm arkiflo_mongo_data

# Check your .env passwords are correct
cat .env

# Start fresh
docker compose up -d --build
```

---

### Error: Backend keeps restarting

**Cause:** Usually a MongoDB connection issue.

**Fix:**
```bash
# Check backend logs
docker compose logs backend --tail=50

# Look for error messages about:
# - "authentication failed" → Check .env passwords
# - "connection refused" → MongoDB not ready, wait and retry
```

---

### Error: Frontend shows blank page

**Cause:** Backend URL misconfigured or backend not running.

**Fix:**
```bash
# 1. Check backend is healthy
curl http://localhost:8001/api/health

# 2. Check REACT_APP_BACKEND_URL in .env is correct
cat .env | grep REACT_APP

# 3. Rebuild frontend if you changed .env
docker compose up -d --build frontend
```

---

### Error: "Cannot connect to server" in browser

**Cause:** Firewall blocking ports.

**Fix:**
1. Check Contabo firewall settings (ports 80, 443 must be open)
2. Check Ubuntu firewall:
```bash
# Check UFW status
sudo ufw status

# Allow ports if UFW is active
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 8. Re-deploy / Update Flow

### When You Have Code Updates

Follow these steps to deploy new code changes:

#### Step 8.1: Navigate to Project Folder

```bash
cd ~/arkiflo
```

#### Step 8.2: Pull Latest Code from GitHub

```bash
git pull origin main
```

(Replace `main` with your branch name if different)

#### Step 8.3: Rebuild and Restart

```bash
docker compose down
docker compose up -d --build
```

#### Step 8.4: Verify Everything Works

```bash
docker compose ps
curl http://localhost:8001/api/health
```

---

### Quick Update (Single Command)

For quick updates without full rebuild:

```bash
cd ~/arkiflo && git pull && docker compose down && docker compose up -d --build
```

---

## 9. Backup & Restore

### Automatic Backups

The application creates automatic daily backups at midnight. These are stored inside the Docker volume.

### View Backup Files

```bash
docker exec arkiflo_backend ls -la /app/backups
```

### Create Manual Backup

```bash
# Create backup
docker exec arkiflo_backend python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json
import os
from datetime import datetime

async def backup():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client['arkiflo']
    
    backup_dir = f'/app/backups/manual_{datetime.now().strftime(\"%Y%m%d_%H%M%S\")}'
    os.makedirs(backup_dir, exist_ok=True)
    
    collections = await db.list_collection_names()
    for coll in collections:
        docs = await db[coll].find({}, {'_id': 0}).to_list(100000)
        with open(f'{backup_dir}/{coll}.json', 'w') as f:
            json.dump(docs, f, default=str)
    print(f'Backup created: {backup_dir}')

asyncio.run(backup())
"
```

### Copy Backup to Your Computer

```bash
# Copy all backups to current directory
docker cp arkiflo_backend:/app/backups ./my_backups
```

### Download Backup via SCP (from your local computer)

```bash
scp -r root@YOUR_SERVER_IP:~/arkiflo/backups ./local_backups
```

---

## 10. Quick Reference

### Essential Commands

| Task | Command |
|------|---------|
| Start application | `docker compose up -d` |
| Stop application | `docker compose down` |
| Restart application | `docker compose restart` |
| Rebuild and start | `docker compose up -d --build` |
| View all logs | `docker compose logs -f` |
| View backend logs | `docker compose logs -f backend` |
| View frontend logs | `docker compose logs -f frontend` |
| View MongoDB logs | `docker compose logs -f mongo` |
| Check status | `docker compose ps` |
| Check disk usage | `docker system df` |

### Service URLs

| Service | Internal URL | External URL |
|---------|--------------|--------------|
| Frontend | http://localhost:80 | http://YOUR_IP |
| Backend API | http://localhost:8001 | http://YOUR_IP/api |
| MongoDB | mongodb://localhost:27017 | Not exposed |

### File Locations

| What | Location |
|------|----------|
| Application code | `~/arkiflo/` |
| Environment config | `~/arkiflo/.env` |
| Docker config | `~/arkiflo/docker-compose.yml` |
| Logs | `docker compose logs` |
| Uploaded files | Docker volume `arkiflo_uploads` |
| Backups | Docker volume `arkiflo_backups` |
| Database | Docker volume `arkiflo_mongo_data` |

---

## ✅ Deployment Checklist

Use this checklist to verify your deployment:

- [ ] Server meets minimum requirements (2GB RAM, 20GB disk)
- [ ] Docker installed and working (`docker --version`)
- [ ] Docker Compose installed (`docker compose version`)
- [ ] Repository cloned to `~/arkiflo`
- [ ] `.env` file created with YOUR passwords (not defaults!)
- [ ] `docker compose up -d --build` completed successfully
- [ ] All 3 containers showing "healthy" in `docker compose ps`
- [ ] Backend health check returns "healthy"
- [ ] Can access application in web browser
- [ ] Can log in to the application
- [ ] Ports 80 and 443 open in firewall

---

## 🆘 Need Help?

1. **Check logs first:**
   ```bash
   docker compose logs -f --tail=100
   ```

2. **Check container status:**
   ```bash
   docker compose ps
   ```

3. **Restart everything:**
   ```bash
   docker compose down && docker compose up -d
   ```

4. **Full reset (WARNING: loses database):**
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Application:** Arkiflo - Interior Design Workflow System
