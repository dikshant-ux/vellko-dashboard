# Deployment Guide

Follow these instructions to host your application on a VPS using Docker.

## Prerequisites
- **Docker** and **Docker Compose** installed on your VPS.
- A public IP address or Domain Name for your VPS.

## 1. Transfer Files
Upload the entire `affiliate-signup` directory to your VPS (e.g., using `scp` or `git`).

## 2. Configuration (.env)
Create a file named `.env` in the root directory (`affiliate-signup/`) with the following content. Adjust the values as needed.

```ini
# --- PORTS ---
# The ports exposed on the host machine.
# Defaulting to 3001 and 8001 as per your request.
FRONTEND_PORT=3001
BACKEND_PORT=8001

# --- URLs ---
# Replace 'YOUR_VPS_IP_OR_DOMAIN' with your actual IP or Domain.
# This URL is used by the Frontend (Browser) to talk to the Backend.
# NOTE: If you change this, you MUST rebuild the frontend container.
NEXT_PUBLIC_API_URL=http://YOUR_VPS_IP_OR_DOMAIN:8001
FRONTEND_URL=http://YOUR_VPS_IP_OR_DOMAIN:3001

# --- INTERNAL (Docker) ---
# This is usually not needed to be changed unless you rename services
# INTERNAL_API_URL=http://backend:8000 

# --- SECRETS ---
# Random secret key for session/token encryption
AUTH_SECRET=changeme_to_a_secure_random_string

# ReCAPTCHA Key (Frontend)
NEXT_PUBLIC_APP_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI

# Cake Marketing (Backend)
CAKE_MARKETING_API_KEY=YOUR_CAKE_KEY_HERE
NEXT_PUBLIC_CAKE_MARKETING_API_KEY=YOUR_CAKE_KEY_HERE

# MongoDB (Optional custom URL if not using the internal one)
# MONGODB_URL=...
```

## 3. Deployment

Run the included deployment script to build and start the application.

```bash
# Make the script executable (run once)
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

Alternatively, you can run the docker command manually:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Explanation of Flags:
- `-f docker-compose.prod.yml`: Use the production configuration file.
- `up`: Start the services.
- `-d`: Detached mode (run in background).
- `--build`: Force rebuild images (Crucial to bake in the `NEXT_PUBLIC_API_URL`).

## 4. Verification

1. **Frontend**: Open `http://YOUR_VPS_IP:3001` in your browser.
2. **Backend**: Open `http://YOUR_VPS_IP:8001` to see the API root message.

## Troubleshooting

- **"Failed to fetch" error**: 
  - Ensure `NEXT_PUBLIC_API_URL` in `.env` matches the actual address you are visiting in the browser for the backend (including port 8001).
  - If you changed the URL in `.env`, run `docker-compose -f docker-compose.prod.yml up -d --build` again.

- **Ports already in use**:
- **500 Internal Server Error on /api/auth/session**:
  - This is often due to missing `AUTH_SECRET` or `AUTH_TRUST_HOST`.
  - The provided `docker-compose.prod.yml` now includes `AUTH_TRUST_HOST=true`.
  - Ensure `FRONTEND_URL` in your `.env` is correct (e.g., `http://YOUR_VPS_IP:3001`).
  - Run `./deploy.sh` to apply changes.
