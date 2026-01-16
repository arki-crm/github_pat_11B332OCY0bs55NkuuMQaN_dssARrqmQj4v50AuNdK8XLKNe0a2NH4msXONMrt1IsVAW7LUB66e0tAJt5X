# 🚀 ARKIFLO - Deployment Guide

**Simple Docker Deployment for Contabo VPS (or any Ubuntu server)**

---

## 📋 What You'll Deploy

| Service | Description |
|---------|-------------|
| **Frontend** | React app served via Nginx (Port 80) |
| **Backend** | Python FastAPI server (Port 8001) |
| **MongoDB** | Database with authentication enabled |

---

## ⚙️ Prerequisites

### 1. Server Requirements
- Ubuntu 22.04 (recommended)
- Minimum 2GB RAM, 20GB disk
- Root or sudo access

### 2. Install Docker & Docker Compose

SSH into your Contabo server and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Allow running without sudo (optional, requires re-login)
sudo usermod -aG docker $USER
```

---

## 🚀 Deployment (4 Simple Commands)

### Step 1: Get the Code

```bash
# Clone or copy your project to the server
git clone YOUR_REPOSITORY_URL arkiflo
cd arkiflo
```

### Step 2: Configure Environment

```bash
# Copy environment templates
cp .env.example .env
```

### Step 3: Edit Passwords & URL

Open `.env` and change these values:

```bash
nano .env
```

```env
# CHANGE THESE PASSWORDS (use strong passwords!)
MONGO_ROOT_PASSWORD=YourStrongRootPassword123!
MONGO_APP_PASSWORD=YourStrongAppPassword456!

# SET YOUR SERVER IP OR DOMAIN
REACT_APP_BACKEND_URL=http://YOUR_SERVER_IP
```

**Example with real values:**
```env
MONGO_ROOT_PASSWORD=xK9#mP2$vL8@nQ4wR7
MONGO_APP_PASSWORD=hJ6!bN3%cM9&dF5gT2
REACT_APP_BACKEND_URL=http://123.45.67.89
```

Save and exit (Ctrl+X, Y, Enter).

### Step 4: Deploy!

```bash
docker compose up -d
```

**That's it!** 🎉

Your app is now running at: `http://YOUR_SERVER_IP`

---

## ✅ Verify Deployment

```bash
# Check all services are running
docker compose ps

# Expected output:
# NAME               STATUS          PORTS
# arkiflo_mongo      Up (healthy)    27017
# arkiflo_backend    Up (healthy)    8001
# arkiflo_frontend   Up (healthy)    80, 443

# Check backend health
curl http://localhost:8001/api/health

# View logs if something is wrong
docker compose logs -f
```

---

## 🔐 MongoDB Security

### User Accounts

| User | Purpose | Access |
|------|---------|--------|
| `admin` | Database administration, backups | Full admin |
| `arkiflo_app` | Application database access | readWrite on `arkiflo` only |

### Where Credentials Are Stored

| File | Contains |
|------|----------|
| `.env` (root) | All credentials for docker-compose |

### Changing Passwords

**⚠️ IMPORTANT: To change passwords after first deployment:**

1. Stop services:
   ```bash
   docker compose down
   ```

2. Delete MongoDB data (WARNING: loses all data!):
   ```bash
   docker volume rm arkiflo_mongo_data
   ```

3. Update `.env` with new passwords

4. Restart:
   ```bash
   docker compose up -d
   ```

**For production password rotation without data loss**, use MongoDB shell commands.

---

## 📁 Data Persistence

All data persists across container restarts:

| Data | Location | Docker Volume |
|------|----------|---------------|
| Database | MongoDB storage | `arkiflo_mongo_data` |
| File uploads | `/app/uploads` | `arkiflo_uploads` |
| Backups | `/app/backups` | `arkiflo_backups` |

### View volumes:
```bash
docker volume ls
```

### Backup data manually:
```bash
# Backup MongoDB
docker exec arkiflo_mongo mongodump \
  --username admin \
  --password YOUR_ROOT_PASSWORD \
  --authenticationDatabase admin \
  --out /dump

# Copy dump from container
docker cp arkiflo_mongo:/dump ./backup_$(date +%Y%m%d)
```

---

## 🔄 Redeployment (Updates)

When you have code updates:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build
```

**Note:** Your data is safe. Only code is updated.

---

## 💾 Backup & Restore

### Automatic Backups
The app creates daily backups automatically at midnight.
Backups are stored in the `arkiflo_backups` volume.

### Access Backup Files
```bash
# List backups
docker exec arkiflo_backend ls -la /app/backups

# Copy backup to host
docker cp arkiflo_backend:/app/backups ./local_backups
```

### Manual Database Backup
```bash
# Create backup
docker exec arkiflo_mongo mongodump \
  --username admin \
  --password YOUR_ROOT_PASSWORD \
  --authenticationDatabase admin \
  --archive=/data/db/backup_$(date +%Y%m%d).archive

# Copy to host
docker cp arkiflo_mongo:/data/db/backup_*.archive ./
```

### Restore Database
```bash
# Copy backup file to container
docker cp backup_20240115.archive arkiflo_mongo:/data/db/

# Restore
docker exec arkiflo_mongo mongorestore \
  --username admin \
  --password YOUR_ROOT_PASSWORD \
  --authenticationDatabase admin \
  --archive=/data/db/backup_20240115.archive
```

---

## 🌐 Domain & SSL (Optional)

### Using a Domain Name

1. Point your domain to your server IP (DNS A record)
2. Update `.env`:
   ```env
   REACT_APP_BACKEND_URL=https://app.yourdomain.com
   ```
3. Rebuild frontend:
   ```bash
   docker compose up -d --build frontend
   ```

### Adding SSL (HTTPS)

For free SSL with Let's Encrypt, add Certbot:

```bash
# Install Certbot
sudo apt install certbot -y

# Stop frontend temporarily
docker compose stop frontend

# Get certificate
sudo certbot certonly --standalone -d app.yourdomain.com

# Certificates will be in /etc/letsencrypt/live/app.yourdomain.com/
```

Then update `frontend/nginx.conf` to use SSL certificates.

---

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Common issues:
# - MongoDB not ready: Wait 30 seconds, try again
# - Wrong credentials: Check .env matches
```

### MongoDB authentication failed
```bash
# Check MongoDB logs
docker compose logs mongo

# Verify credentials match between .env files
# If first time: just fix .env and restart
# If data exists: must reset volume (loses data)
```

### Frontend shows blank page
```bash
# Check if backend is healthy
curl http://localhost:8001/api/health

# Check frontend logs
docker compose logs frontend

# Rebuild frontend
docker compose up -d --build frontend
```

### Can't connect to database
```bash
# Test MongoDB connection
docker exec -it arkiflo_mongo mongosh \
  --username admin \
  --password YOUR_ROOT_PASSWORD \
  --authenticationDatabase admin
```

### View all logs
```bash
docker compose logs -f --tail=100
```

---

## 📊 Service Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart backend

# View running containers
docker compose ps

# View resource usage
docker stats
```

---

## 🗑️ Complete Cleanup (Danger!)

**WARNING: This deletes ALL data!**

```bash
# Stop and remove everything
docker compose down -v

# Remove all volumes
docker volume rm arkiflo_mongo_data arkiflo_uploads arkiflo_backups
```

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start app | `docker compose up -d` |
| Stop app | `docker compose down` |
| View logs | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Rebuild | `docker compose up -d --build` |
| Check status | `docker compose ps` |

---

## ✅ Deployment Checklist

- [ ] Docker & Docker Compose installed
- [ ] `.env` file created with strong passwords
- [ ] Server IP/domain configured in `.env`
- [ ] `docker compose up -d` successful
- [ ] All 3 services showing "healthy"
- [ ] Can access app in browser
- [ ] Can login to application
- [ ] Tested file upload works
- [ ] Backup location accessible

---

**Need help?** Check the logs first: `docker compose logs -f`
