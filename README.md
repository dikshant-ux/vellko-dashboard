# Vellko Affiliate Dashboard

A full-stack affiliate dashboard application with a Next.js frontend and a FastAPI backend, featuring Docker support for easy deployment.

## Features
- **Frontend**: Next.js (App Router), TailwindCSS, ShadCN UI.
- **Backend**: Python FastAPI, MongoDB.
- **Authentication**: JWT-based auth with Role-Based Access Control (RBAC).
- **Security**: 2FA support, secure password hashing.
- **Deployment**: Dockerized services (Frontend on 3001, Backend on 8001).

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local dev)
- Python 3.9+ (for local dev)

## Getting Started (Docker)

The easiest way to run the application is using Docker.

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd affiliate-signup
    ```

2.  **Environment Setup**:
    - Build arguments in `docker-compose.yml` handle most configs.
    - Ensure `.env` exists in `backend/` if you have custom secret keys.

3.  **Run with Docker**:
    ```bash
    docker-compose up --build -d
    ```

4.  **Access the App**:
    - Frontend: [http://localhost:3001](http://localhost:3001)
    - Backend API: [http://localhost:8001](http://localhost:8001)
    - API Docs: [http://localhost:8001/docs](http://localhost:8001/docs)

## Local Development

### Backend
1.  Navigate to `backend/`: `cd backend`
2.  Create virtual env: `python -m venv venv`
3.  Activate env: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4.  Install deps: `pip install -r requirements.txt`
5.  Run: `uvicorn main:app --reload` (Runs on port 8000 by default)

### Frontend
1.  Navigate to `next-app/`: `cd next-app`
2.  Install deps: `npm install`
3.  Run: `npm run dev` (Runs on port 3000 by default)

## Project Structure
- `backend/`: FastAPI application code.
- `next-app/`: Next.js frontend application.
- `docker-compose.yml`: Docker orchestration.
