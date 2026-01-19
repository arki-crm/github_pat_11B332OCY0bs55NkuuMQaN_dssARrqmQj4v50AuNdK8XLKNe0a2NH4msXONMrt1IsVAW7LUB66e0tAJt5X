# Google OAuth Setup Guide for Arkiflo

This guide walks you through setting up Google OAuth for direct authentication (no Emergent middleman).

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., "Arkiflo Production")
4. Click **Create**

## Step 2: Enable Google+ API (Optional but recommended)

1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API" and enable it
3. Also enable "Google Identity" if available

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill in required fields:
   - **App name**: Arkiflo
   - **User support email**: your-email@domain.com
   - **Developer contact email**: your-email@domain.com
4. Click **Save and Continue**
5. **Scopes**: Add `email`, `profile`, `openid` → Save
6. **Test users**: Add your email(s) for testing
7. Click **Save and Continue** until done

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Choose **Web application**
4. Name: "Arkiflo Web Client"
5. **Authorized JavaScript origins**: 
   ```
   http://YOUR_SERVER_IP
   ```
   (Add `https://YOUR_DOMAIN` if using SSL)

6. **Authorized redirect URIs** (CRITICAL - must match exactly):
   ```
   http://YOUR_SERVER_IP/api/auth/google/callback
   ```
   (Add `https://YOUR_DOMAIN/api/auth/google/callback` if using SSL)

7. Click **Create**
8. **Copy the Client ID and Client Secret** - you'll need these!

## Step 5: Configure Your .env File

In your server's `/root/arkiflo/.env` file, add:

```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-YourSecretHere
```

## Step 6: Rebuild and Restart

```bash
cd ~/arkiflo
docker compose down
docker compose up -d --build
```

## Step 7: Test Google Login

1. Go to `http://YOUR_SERVER_IP`
2. Click "Continue with Google"
3. You should be redirected to Google's consent screen
4. After consent, you'll be redirected to `/dashboard`

## Troubleshooting

### "redirect_uri_mismatch" Error
- The redirect URI in Google Console MUST match exactly
- Check for http vs https
- Check for trailing slashes
- Must be: `http://YOUR_SERVER_IP/api/auth/google/callback`

### "access_denied" Error  
- User not in test users list (if app not published)
- Go to OAuth consent screen → Add test users

### "invalid_client" Error
- Wrong Client ID or Secret
- Check for copy/paste errors (no extra spaces)

### Login redirects to blank page
- Check FRONTEND_URL matches your server IP
- Check nginx is proxying /api correctly

## Going to Production

When ready to allow any Google user to login:

1. Go to **OAuth consent screen**
2. Click **PUBLISH APP**
3. Complete Google's verification (may take days/weeks)

Until published, only test users can login.

---

## Quick Reference

| Variable | Example Value |
|----------|---------------|
| GOOGLE_CLIENT_ID | `123456-abc.apps.googleusercontent.com` |
| GOOGLE_CLIENT_SECRET | `GOCSPX-xxxxx` |
| Redirect URI | `http://YOUR_IP/api/auth/google/callback` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/google/login` | GET | Initiates OAuth flow |
| `/api/auth/google/callback` | GET | Handles Google's response |
| `/api/auth/local-login` | POST | Email/password login (still works) |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/logout` | POST | Logout |
