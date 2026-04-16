# Complete DevOps Deployment Guide
## 3-Tier Node.js User Registration App on AWS (PostgreSQL + PM2 + Amplify)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [3-Tier Architecture Explained](#3-3-tier-architecture-explained)
4. [Local Development Setup](#4-local-development-setup)
5. [Dockerization](#5-dockerization)
6. [Database in Docker (How Companies Do It)](#6-database-in-docker-how-companies-do-it)
7. [AWS Deployment](#7-aws-deployment)
8. [Frontend Hosting on AWS Amplify](#8-frontend-hosting-on-aws-amplify)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Secrets & Security](#10-secrets--security)
11. [Monitoring & Logging](#11-monitoring--logging)
12. [PM2 Process Manager](#12-pm2-process-manager)
13. [Common Mistakes & Troubleshooting](#13-common-mistakes--troubleshooting)

---

## 1. Architecture Overview

### What We're Building

```
                          Internet
                             |
                             v
                    [ AWS Amplify ]
                     (Frontend)
                   React/HTML/CSS/JS
                             |
                     API Calls (fetch)
                             |
                             v
                    [ CloudFront / DNS ]
                             |
                             v
                    [ EC2 Instance ]
                   /       |        \
                  /        |         \
          [ Nginx ]   [ Node.js ]   [ Grafana ]
          (:80/443)  (PM2 :3000)   (:4000)
              |           |
              |      [ PostgreSQL ]
              |       (:5432)
              |
         [ Loki + Promtail ]
         (Log Aggregation)
```

### How It Works (Plain English)

1. **User visits your website** → AWS Amplify serves the frontend HTML/CSS/JS (auto-deployed from GitHub)
2. **User submits the form** → Browser sends API request to your EC2 server
3. **Nginx receives the request** → Forwards `/api/` requests to Node.js
4. **Node.js (via PM2) processes the request** → Routes → Controller → Service → Repository → PostgreSQL
5. **PostgreSQL stores the data** → Persists user registrations
6. **Promtail collects logs** → Ships container logs to Loki
7. **Grafana displays logs** → You view logs in dashboards

### Why Each Tool?

| Tool | Why? |
|------|------|
| **Docker** | Packages your app + dependencies into a portable container. "Works on my machine" problem solved. |
| **Nginx** | Reverse proxy. Handles SSL, load balancing, protects Node.js from direct exposure. |
| **PostgreSQL** | Relational database. Structured data, ACID compliant, industry standard for serious apps. |
| **PM2** | Process manager for Node.js. Auto-restarts on crash, log management, clustering. |
| **EC2** | Virtual server on AWS. Free Tier: 750 hours/month (enough for 1 server 24/7). |
| **AWS Amplify** | Frontend hosting with CI/CD built-in. Connect GitHub → auto-deploys on push. Free for first 12 months. |
| **GitHub Actions** | Automate testing + deployment. Push to main → app deploys automatically. |
| **Loki + Grafana** | See what's happening in your app. Essential for debugging production issues. |
| **AWS Secrets Manager** | Store passwords securely. Never hardcode credentials. |

### Why PostgreSQL over MongoDB?

| Aspect | PostgreSQL | MongoDB |
|--------|-----------|---------|
| Data model | Relational (tables, rows) | Document (JSON-like) |
| ACID compliance | Full | Partial |
| SQL support | Yes (industry standard) | No |
| Schema | Fixed (enforces structure) | Flexible |
| Free tier on AWS | RDS Free Tier (750hrs) | Atlas Free Tier (512MB) |
| Better for | Structured data, relationships | Unstructured data, rapid prototyping |

For a user registration system with structured data (username, phone), PostgreSQL is the right choice.

---

## 2. Prerequisites

### Accounts & Tools

1. **AWS Account** (Free Tier): https://aws.amazon.com/free/
2. **GitHub Account**: https://github.com
3. **Docker Desktop** (local): https://docs.docker.com/get-docker/
4. **Node.js 18+**: https://nodejs.org
5. **Git**: https://git-scm.com
6. **AWS CLI**: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

### Install AWS CLI & Configure

```bash
# Install AWS CLI (Ubuntu/Debian)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure with your AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

> **How to get AWS credentials**: AWS Console → IAM → Users → Your user → Security credentials → Create access key.

---

## 3. 3-Tier Architecture Explained

### What is 3-Tier Architecture?

3-tier architecture splits your application into three separate layers. Each layer has a specific job and can be modified independently.

```
┌─────────────────────────────────────────────────────┐
│              TIER 1: PRESENTATION LAYER              │
│         Routes + Middlewares (HTTP handling)         │
│         src/routes/  src/middlewares/                │
│         Receives requests, sends responses           │
├─────────────────────────────────────────────────────┤
│              TIER 2: BUSINESS LOGIC LAYER            │
│         Controllers + Services (business rules)      │
│         src/controllers/  src/services/              │
│         Validates data, applies business rules       │
├─────────────────────────────────────────────────────┤
│              TIER 3: DATA ACCESS LAYER               │
│         Models + Repositories (database)             │
│         src/models/  src/repositories/               │
│         SQL queries, data mapping                    │
└─────────────────────────────────────────────────────┘
```

### Why 3-Tier?

| Benefit | Explanation |
|---------|-------------|
| **Separation of concerns** | Each layer does one thing well |
| **Testability** | Test business logic without a database |
| **Maintainability** | Change database without touching routes |
| **Scalability** | Scale each tier independently |
| **Industry standard** | Used by most companies |

### Our Project Structure

```
src/
├── server.js                  # Entry point (Express setup)
├── config/
│   └── database.js            # PostgreSQL connection pool
├── routes/
│   └── userRoutes.js          # TIER 1: URL → Controller mapping
├── controllers/
│   └── UserController.js      # TIER 2: Request/Response handling
├── services/
│   └── UserService.js         # TIER 2: Business rules & validation
├── models/
│   └── UserModel.js           # TIER 3: Table schema definition
├── repositories/
│   └── UserRepository.js      # TIER 3: SQL queries
└── middlewares/
    └── index.js               # Logger, error handler
```

### How a Request Flows Through 3 Tiers

```
POST /api/users {username: "john", phone: "+1234567890"}
    │
    ▼
[TIER 1] userRoutes.js          → Routes to UserController.register()
    │
    ▼
[TIER 2] UserController.js      → Extracts body, calls UserService.registerUser()
    │
    ▼
[TIER 2] UserService.js         → Validates input, checks duplicates, calls UserRepository.create()
    │
    ▼
[TIER 3] UserRepository.js      → Executes INSERT INTO users ... via pg Pool
    │
    ▼
[TIER 3] PostgreSQL              → Stores data, returns new row
    │
    ▼
Response: { message: "User registered successfully", data: {...} }
```

---

## 4. Local Development Setup

### Step 1: Install Dependencies

```bash
cd ci-cd
npm install
```

### Step 2: Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=userdb
DB_USER=postgres
DB_PASSWORD=secretpassword
DB_SSL=false
```

### Step 3: Run PostgreSQL Locally

```bash
# Option A: Using Docker (recommended)
docker run -d --name pg-local \
  -e POSTGRES_DB=userdb \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=secretpassword \
  -p 5432:5432 \
  postgres:16-alpine

# Option B: Install PostgreSQL locally
# sudo apt install postgresql postgresql-contrib
```

### Step 4: Start the App

```bash
# Development (with auto-reload)
npm run dev

# Production (with PM2)
npm start
```

### Step 5: Test the API

```bash
# Register a user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"john","phone":"+1234567890"}'

# Get all users
curl http://localhost:3000/api/users

# Get user by ID
curl http://localhost:3000/api/users/1

# Delete user
curl -X DELETE http://localhost:3000/api/users/1

# Health check
curl http://localhost:3000/health
```

---

## 5. Dockerization

### Why Docker?

Without Docker: "It works on my machine but not on the server."
With Docker: "It works the same everywhere."

### Understanding the Dockerfile

Our `Dockerfile` uses a **multi-stage build**:

```
Stage 1 (builder):  npm ci → installs all dependencies (dev + prod)
Stage 2 (final):    Copy node_modules + app code → runs with PM2
```

**Key details:**
- `node:18-alpine` — Alpine Linux is tiny (~5MB), making images small
- `tini` — Prevents zombie processes in Docker
- `pm2-runtime` — PM2's container-optimized mode (no daemon, forwards signals)
- `HEALTHCHECK` — Docker automatically checks if your app is alive
- `USER nodejs` — Runs as non-root for security

### Understanding docker-compose.yml

Docker Compose orchestrates multiple containers with one command.

**Our services:**
- `app` — Node.js application (managed by PM2)
- `postgres` — PostgreSQL database
- `nginx` — Reverse proxy
- `loki` — Log storage
- `promtail` — Log collector
- `grafana` — Log visualization

### Key Docker Commands

```bash
# Build all images
docker compose build

# Start all services in background
docker compose up -d

# View running containers
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs for specific service
docker compose logs -f app
docker compose logs -f postgres

# Stop all services
docker compose down

# Stop and remove volumes (DELETES DATABASE DATA!)
docker compose down -v

# Restart a single service
docker compose restart app

# Shell into a running container
docker compose exec app sh

# Rebuild and restart after code changes
docker compose up -d --build app
```

### Run Locally with Docker Compose

```bash
# Start everything
docker compose up -d

# Check all services are healthy
docker compose ps

# Test the API
curl http://localhost:3000/health

# Open Grafana
# Visit http://localhost:4000 (admin/admin123)

# Stop everything
docker compose down
```

---

## 6. Database in Docker (How Companies Do It)

### How It Works in Our Setup

In our `docker-compose.yml`, PostgreSQL runs as its own Docker container:

```yaml
postgres:
  image: postgres:16-alpine          # Official PostgreSQL image
  container_name: user-registration-db
  volumes:
    - postgres-data:/var/lib/postgresql/data   # Persists data even if container is deleted
  environment:
    - POSTGRES_DB=userdb
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=secretpassword
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d userdb"]
```

The **app container** connects to the **postgres container** using the Docker service name as hostname:

```
App container (DB_HOST=postgres)  →  Docker network  →  postgres container (:5432)
```

This is exactly how companies do it. Key points:

| Concept | Explanation |
|---------|-------------|
| **Separate containers** | App and DB are independent containers. They communicate via Docker's internal network. |
| **Named volume** | `postgres-data` volume stores DB files on the host disk. If you `docker compose down`, data survives. `docker compose down -v` deletes it. |
| **Service name as hostname** | Inside Docker, `postgres` resolves to the DB container's IP. No need for `localhost` or real IPs. |
| **Healthcheck** | Docker checks if PostgreSQL is ready before starting the app (`depends_on: condition: service_healthy`). |
| **Init scripts** | SQL files in `scripts/db-init/` run automatically on first container start (schema + seed data). |

### Running the DB Standalone (Without the App)

Companies often run the database separately from the app, especially when multiple apps share the same DB or when developers need a local DB without the full stack.

```bash
# Start ONLY the database (with pgAdmin UI)
docker compose -f docker-compose.db.yml up -d

# DB:     localhost:5432
# pgAdmin: http://localhost:5050 (admin@admin.com / admin123)

# Stop
docker compose -f docker-compose.db.yml down
```

### Database Init Scripts

Files in `scripts/db-init/` run automatically when the PostgreSQL container starts for the **first time** (only when the data directory is empty):

| File | Purpose |
|------|---------|
| `01-schema.sql` | Creates the `users` table, indexes, and auto-update trigger for `updated_at` |
| `02-seed.sql` | Inserts sample data for development |

> **Important**: These scripts only run once. If you want to re-run them, delete the volume: `docker compose down -v` then `docker compose up -d`.

### Backup & Restore

```bash
# Backup the database
bash scripts/backup-db.sh
# Creates: ./backups/userdb_20260416_153000.sql.gz

# Restore from a backup
bash scripts/restore-db.sh ./backups/userdb_20260416_153000.sql.gz

# List all backups
ls -lh ./backups/
```

### Connecting to the DB from Your Machine

```bash
# Using psql (if installed)
docker exec -it user-registration-db psql -U postgres -d userdb

# Using pgAdmin (included in docker-compose.db.yml)
# Open http://localhost:5050
# Login: admin@admin.com / admin123
# Add server: host=postgres, port=5432, user=postgres, password=secretpassword

# Using DBeaver, DataGrip, or any SQL client
# Host: localhost, Port: 5432, DB: userdb, User: postgres
```

### Common DB Docker Commands

```bash
# Check if DB is running
docker compose ps postgres

# View DB logs
docker compose logs -f postgres

# Restart DB
docker compose restart postgres

# Connect to DB shell
docker exec -it user-registration-db psql -U postgres -d userdb

# Run a SQL query
docker exec -it user-registration-db psql -U postgres -d userdb -c "SELECT * FROM users;"

# Check DB disk usage
docker exec user-registration-db psql -U postgres -d userdb -c "SELECT pg_size_pretty(pg_database_size('userdb'));"

# Delete data and start fresh (DESTRUCTIVE)
docker compose down -v   # Removes volumes
docker compose up -d      # Re-creates everything (runs init scripts again)
```

---

## 7. AWS Deployment

### Step 1: Create an IAM User for Deployment

1. Go to AWS Console → IAM → Users → Create user
2. Username: `deploy-user`
3. Attach policies:
   - `AmazonEC2FullAccess`
   - `AmazonEC2ContainerRegistryFullAccess`
   - `AWSLambda_FullAccess` (for CodePipeline)
   - `SecretsManagerReadWrite`
   - `AWSCloudFormation_FullAccess` (for Amplify)
   - `AmplifyBackendDeployFullAccess`
4. Create access key → Save the Key ID and Secret Key

### Step 2: Launch EC2 Instance (Free Tier)

1. AWS Console → EC2 → Launch Instance
2. **Name**: `user-registration-app`
3. **AMI**: Ubuntu 22.04 LTS (Free Tier eligible)
4. **Instance type**: `t2.micro` (Free Tier — 1 vCPU, 1GB RAM)
5. **Key pair**: Create new key pair (e.g., `deploy-key`), download `.pem` file
6. **Network settings**: Allow SSH (22), HTTP (80), HTTPS (443)
7. **Storage**: 8GB gp3 (Free Tier)
8. Click "Launch instance"

> **Important**: t2.micro gives you 750 hours/month free. That's enough for 1 instance running 24/7.

### Step 3: Connect to EC2 & Set Up

```bash
# Set correct permissions on your key
chmod 400 deploy-key.pem

# SSH into your instance
ssh -i deploy-key.pem ubuntu@<EC2_PUBLIC_IP>

# Run the setup script (copy it to the server first)
# scp -i deploy-key.pem scripts/setup-ec2.sh ubuntu@<EC2_PUBLIC_IP>:~/setup.sh
# ssh -i deploy-key.pem ubuntu@<EC2_PUBLIC_IP> "bash ~/setup.sh"
```

Or manually:

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Log out and back in for docker group to take effect
exit
ssh -i deploy-key.pem ubuntu@<EC2_PUBLIC_IP>

# Verify
docker --version
docker compose version

# Clone your repo
git clone <your-repo-url> ~/app
cd ~/app
```

### Step 4: Deploy with Docker Compose

```bash
cd ~/app

# Create .env file
cp .env.example .env
nano .env  # Edit with production values

# Start everything
docker compose up -d

# Verify
docker compose ps
curl http://localhost:3000/health
```

### Step 5: Configure Security Groups

AWS Console → EC2 → Security Groups:

| Port | Source | Purpose |
|------|--------|---------|
| 22 | Your IP only | SSH access |
| 80 | Anywhere (0.0.0.0/0) | HTTP (Nginx) |
| 443 | Anywhere (0.0.0.0/0) | HTTPS (Nginx) |
| 4000 | Your IP only | Grafana (restrict!) |

> **Security tip**: Never expose port 3000 or 5432 publicly. Only Nginx (80/443) should be accessible.

### Step 6: Add Swap Memory (EC2 t2.micro has only 1GB RAM)

```bash
# On EC2:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 8. Frontend Hosting on AWS Amplify

### Why AWS Amplify?

- **Free for first 12 months** (then ~$15/month for low traffic)
- **Auto-deploys from GitHub** — push code, Amplify builds and deploys
- **Built-in CI/CD** — no need to configure build pipelines for frontend
- **Custom domains + SSL** — free SSL certificates
- **Preview environments** — every pull request gets its own URL

### Step 1: Create Amplify App

**Option A: Via AWS Console (Recommended for beginners)**

1. AWS Console → Amplify → Hosting → Get started
2. Connect GitHub repository
3. Select your repository and branch (`main`)
4. Build settings:
   - Build command: `echo "Static site"`
   - Output directory: `frontend/public`
5. Click "Save and deploy"

**Option B: Via CLI**

```bash
bash scripts/setup-amplify.sh
```

### Step 2: Configure the API URL

In the Amplify console:
1. Go to App settings → Environment variables
2. Add: `API_URL` = `http://<EC2_PUBLIC_IP>/api/users`
3. Redeploy

Or update `frontend/public/index.html` directly to point to your EC2 API.

### Step 3: Custom Domain (Optional)

1. Amplify → App settings → Domain management
2. Add custom domain (e.g., `app.yourdomain.com`)
3. Amplify provisions SSL automatically

### Step 4: Amplify Build Spec

The `frontend/amplify.yml` file tells Amplify how to build:

```yaml
buildCommand: echo 'Static site - no build needed'
startCommand: echo 'Served by Amplify hosting'
outputDirectory: public
```

Since our frontend is plain HTML/CSS/JS (no React build step), no build is needed.

---

## 9. CI/CD Pipeline

### What is CI/CD?

- **CI (Continuous Integration)**: Every push triggers automated tests
- **CD (Continuous Deployment)**: If tests pass, auto-deploy to production

### Our Pipeline Flow

```
Push to GitHub (main branch)
     |
     v
[GitHub Actions - Test]     → Run tests against PostgreSQL service
     |
     ├──→ [Deploy Frontend] → Trigger Amplify rebuild
     |
     v (tests pass)
[GitHub Actions - Build]    → Build Docker image, push to ECR
     |
     v (build succeeds)
[GitHub Actions - Deploy]   → SSH into EC2, pull new image, restart
```

### Step 1: Create Amazon ECR Repository

```bash
aws ecr create-repository --repository-name user-registration-api --region us-east-1
```

### Step 2: Set GitHub Secrets

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret access key |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `EC2_HOST` | Your EC2 public IP or domain |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Contents of your `.pem` file (paste entire key) |
| `AMPLIFY_APP_ID` | From Amplify console |

### Step 3: How the Workflow Works

`.github/workflows/deploy.yml` defines four jobs:

1. **test**: Spins up a PostgreSQL container, runs tests against it
2. **build-and-push**: Builds Docker image, pushes to Amazon ECR
3. **deploy-frontend**: Triggers Amplify to rebuild the frontend
4. **deploy-backend**: SSHs into EC2, pulls new image, restarts the app

### Step 4: Trigger a Deployment

```bash
git add .
git commit -m "Add new feature"
git push origin main

# Watch at: https://github.com/<user>/<repo>/actions
```

---

## 10. Secrets & Security

### Why Not Hardcode Secrets?

If you push `DB_PASSWORD=secretpassword` to GitHub, anyone can see it — even in private repos (forks, logs, history).

### Step 1: Store Secrets in AWS Secrets Manager

```bash
bash scripts/create-secret.sh
```

### Step 2: Use IAM Roles on EC2 (Best Practice)

Instead of access keys, create an IAM role:

1. IAM → Roles → Create role → Trusted entity: EC2
2. Attach: `AmazonEC2ContainerRegistryReadOnly`, `SecretsManagerReadWrite`
3. EC2 → Your instance → Actions → Instance settings → Attach/Replace IAM role

With IAM roles, EC2 can access AWS services WITHOUT hardcoded keys.

### Step 3: Environment Variables via Docker Compose

In production, pass secrets as environment variables in `docker-compose.yml` or a `.env` file on the EC2 server. Never commit `.env` to git.

---

## 11. Monitoring & Logging

### Why Monitoring?

When something breaks in production, you need logs to figure out why. Without monitoring, you're flying blind.

### Our Stack

| Tool | Role |
|------|------|
| **Loki** | Stores logs (log aggregation database) |
| **Promtail** | Collects logs from Docker containers, sends to Loki |
| **Grafana** | Web UI to search and visualize logs |

### Access Grafana

1. Visit `http://<EC2_PUBLIC_IP>:4000`
2. Login: `admin` / `admin123`
3. Add Loki data source:
   - Connections → Data Sources → Add data source → Loki
   - URL: `http://loki:3100`
   - Save & Test

### Useful Log Queries

```
# All logs from the Node.js app
{container="user-registration-api"}

# Only error logs
{container="user-registration-api"} |= "error"

# PostgreSQL queries
{container="user-registration-db"}

# Nginx requests
{container="user-registration-nginx"} |= "GET /api"

# PM2 process logs
{container="user-registration-api"} |= "PM2"
```

---

## 12. PM2 Process Manager

### Why PM2?

Node.js is single-threaded. If it crashes, your app goes down. PM2 solves this:

| Feature | Benefit |
|---------|---------|
| **Auto-restart** | If Node.js crashes, PM2 restarts it instantly |
| **Log management** | Separates stdout/stderr logs with timestamps |
| **Monitoring** | Built-in dashboard (`pm2 monit`) |
| **Clustering** | Run multiple instances on multi-core CPUs |
| **Zero-downtime reload** | `pm2 reload` restarts without dropping requests |

### PM2 in Docker

We use `pm2-runtime` instead of `pm2` in Docker because:
- `pm2` runs as a daemon (background process) — doesn't work well in containers
- `pm2-runtime` runs in the foreground — perfect for Docker's PID 1 requirement

### Useful PM2 Commands

```bash
# Inside the container:
docker compose exec app sh

# View running processes
npx pm2 list

# View logs
npx pm2 logs

# Monitor CPU/memory
npx pm2 monit

# Restart the app (zero downtime)
npx pm2 restart all

# View process details
npx pm2 show user-registration-api
```

### ecosystem.config.js Explained

```javascript
{
  name: "user-registration-api",    // Process name in PM2
  script: "src/server.js",          // Entry point
  instances: 1,                     // Number of processes (1 for now)
  max_memory_restart: "300M",       // Auto-restart if memory exceeds 300MB
  env_production: { PORT: 3000 },   // Production env vars
  error_file: "/var/log/pm2/error.log",  // Error log file
  out_file: "/var/log/pm2/out.log",      // Standard output log
}
```

---

## 13. Common Mistakes & Troubleshooting

### Docker Issues

| Problem | Solution |
|---------|----------|
| `Cannot connect to Docker daemon` | `sudo systemctl start docker` or add user to docker group |
| Container keeps restarting | `docker compose logs app` to see the error |
| Port already in use | `sudo lsof -i :3000` to find what's using the port |
| Out of memory on EC2 | Add swap: see Step 6 in AWS Deployment |

### PostgreSQL Issues

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED` to PostgreSQL | Check `postgres` container is running: `docker compose ps postgres` |
| `password authentication failed` | Verify DB_USER and DB_PASSWORD match in .env and docker-compose.yml |
| `database "userdb" does not exist` | The initDB() function creates it. Check logs for errors. |
| Connection pool exhausted | Increase `max` in `src/config/database.js` (default: 20) |

### AWS Issues

| Problem | Solution |
|---------|----------|
| EC2 SSH connection refused | Check security group allows port 22 from your IP |
| ECR permission denied | Check IAM user has `AmazonEC2ContainerRegistryFullAccess` |
| Amplify build fails | Check build settings: output directory = `frontend/public` |
| Amplify can't reach API | Check EC2 security group allows port 80 from anywhere |

### Node.js / PM2 Issues

| Problem | Solution |
|---------|----------|
| App works locally but not in Docker | Make sure server.js listens on `0.0.0.0` not `localhost` |
| PM2 not restarting on crash | Check `autorestart: true` in ecosystem.config.js |
| Memory leak | PM2 auto-restarts at 300MB. Check `max_memory_restart`. |

### Free Tier Cost Tips

- **EC2**: Only 1 t2.micro is free. Stop unused instances.
- **RDS**: PostgreSQL RDS Free Tier gives you 750hrs of db.t3.micro. But we use Docker PostgreSQL on EC2 (free).
- **Amplify**: Free for first 12 months. After: ~$15/month for low traffic.
- **ECR**: 500MB storage free (first 12 months).
- **Secrets Manager**: 30-day free trial, then $0.40/secret/month. Use **Parameter Store** (free) as alternative.
- **Monitor costs**: AWS Console → Billing → Cost Explorer → Set budget alerts.

---

## Quick Reference: Essential Commands

```bash
# Local development
npm install              # Install dependencies
npm run dev              # Start with nodemon auto-reload
npm start                # Start with PM2
npm test                 # Run tests

# Docker
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose logs -f app        # View app logs
docker compose exec app sh        # Shell into app container
docker compose up -d --build      # Rebuild and restart

# PM2 (inside container)
docker compose exec app npx pm2 list    # View processes
docker compose exec app npx pm2 logs    # View PM2 logs
docker compose exec app npx pm2 monit   # Live monitoring

# AWS
aws amplify list-apps                           # List Amplify apps
aws ecr describe-repositories                   # List ECR repos
aws secretsmanager get-secret-value \
  --secret-id user-registration-db \
  --query SecretString --output text | jq       # Get secret value
```

---

## Project Structure

```
ci-cd/
├── .github/workflows/
│   └── deploy.yml              # CI/CD pipeline (test → build → deploy)
├── frontend/
│   ├── public/
│   │   └── index.html          # Registration form UI
│   ├── css/
│   │   └── style.css           # Frontend styles
│   └── amplify.yml             # Amplify build configuration
├── monitoring/
│   ├── loki-config.yaml        # Loki configuration
│   └── promtail-config.yaml    # Promtail configuration
├── nginx/
│   └── nginx.conf              # Nginx reverse proxy config
├── scripts/
│   ├── db-init/
│   │   ├── 01-schema.sql       # DB schema (runs on first container start)
│   │   └── 02-seed.sql         # Sample data for development
│   ├── setup-ec2.sh            # EC2 initialization
│   ├── setup-amplify.sh        # Amplify app creation
│   ├── create-secret.sh        # AWS Secrets Manager setup
│   ├── backup-db.sh            # Database backup
│   ├── restore-db.sh           # Database restore
│   └── deploy.sh               # Deployment script
├── src/
│   ├── server.js               # App entry point
│   ├── config/
│   │   └── database.js         # PostgreSQL connection pool
│   ├── controllers/
│   │   └── UserController.js   # TIER 2: Request/Response handling
│   ├── middlewares/
│   │   └── index.js            # Logger, error handler
│   ├── models/
│   │   └── UserModel.js        # TIER 3: Table schema
│   ├── repositories/
│   │   └── UserRepository.js   # TIER 3: SQL queries
│   ├── routes/
│   │   └── userRoutes.js       # TIER 1: URL routing
│   └── services/
│       └── UserService.js      # TIER 2: Business logic
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml          # Full stack (app + db + nginx + monitoring)
├── docker-compose.db.yml       # Standalone DB + pgAdmin (for dev)
├── Dockerfile                  # App container (with PM2)
├── ecosystem.config.js         # PM2 process configuration
├── package.json
└── GUIDE.md                    # This file
```

---

## What's Next?

After completing this guide, consider learning:
- **Kubernetes (EKS)**: For orchestrating containers at scale
- **Terraform**: Infrastructure-as-code (define AWS resources in files)
- **AWS CDK**: Programmatic infrastructure with code
- **Datadog/New Relic**: Advanced monitoring with alerts
- **Redis**: For caching and session management
- **Prisma/TypeORM**: Type-safe database query builders
