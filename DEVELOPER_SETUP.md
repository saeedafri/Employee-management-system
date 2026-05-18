# EMS Backend - Developer Setup & Installation Guide

**Last Updated**: May 18, 2026  
**Node Version Required**: >=20.0.0  
**Database**: MySQL 8.0+  
**Cache**: Redis 6.0+  

---

## Prerequisites

### System Requirements

- **OS**: macOS, Linux, or Windows (with WSL2)
- **Node.js**: 20.0.0 or higher
- **npm**: 10.0.0 or higher
- **Git**: Latest stable version

### External Services

- **Email**: Brevo SMTP account (free tier available)
- **Database Hosting**: Local MySQL or cloud MySQL (AWS RDS, Azure MySQL, etc.)
- **Cache**: Local Redis or Redis Cloud

---

## Quick Start (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/company/ems-backend.git
cd ems-backend
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your local settings
nano .env
```

### 3. Database Setup

```bash
# Run migrations
npm run db:migrate:dev

# Seed test data
npm run db:seed
```

### 4. Start Development Server

```bash
npm run dev
# Server runs on http://localhost:3000
# Docs available at http://localhost:3000/docs
```

---

## Detailed Setup Instructions

### Step 1: Install Dependencies

```bash
# Install Node.js (macOS with Homebrew)
brew install node@20

# Verify installation
node --version    # v20.x.x
npm --version     # 10.x.x
```

### Step 2: Clone & Configure Repository

```bash
git clone https://github.com/company/ems-backend.git
cd ems-backend
npm install
```

### Step 3: Environment Variables

Create `.env` file in root directory:

```env
# Node Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database (local MySQL)
DATABASE_URL="mysql://root:password@localhost:3306/employee-management"

# Redis (local)
REDIS_URL="redis://127.0.0.1:6379"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production-at-least-32-chars"
ACCESS_TOKEN_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# CORS Configuration
CORS_ORIGIN="http://localhost:3000,http://localhost:3001,http://localhost:5173"

# Email Provider (Brevo)
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="your-brevo-email@smtp-brevo.com"
SMTP_PASS="your-brevo-api-key"
SMTP_FROM="ems-noreply@company.com"

# API Configuration
APP_NAME="EMS"
APP_VERSION="1.0.0"
API_PREFIX="/api/v1"

# Session Management
SESSION_COOKIE_NAME="refreshToken"
SESSION_MAX_AGE_DAYS=7

# Password Reset
RESET_PASSWORD_TOKEN_TTL_MINUTES=30
RESET_PASSWORD_RATE_LIMIT_MAX=5
FRONTEND_RESET_PASSWORD_URL="http://localhost:5173/reset-password"
```

### Step 4: Local Database Setup

#### Option A: Local MySQL (macOS with Homebrew)

```bash
# Install MySQL
brew install mysql@8.0
brew services start mysql@8.0

# Login as root (default: no password)
mysql -u root

# Create database and user
CREATE DATABASE `employee-management` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ems_user'@'localhost' IDENTIFIED BY 'securepassword123';
GRANT ALL PRIVILEGES ON `employee-management`.* TO 'ems_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Update .env
DATABASE_URL="mysql://ems_user:securepassword123@localhost:3306/employee-management"
```

#### Option B: Docker MySQL

```bash
docker run --name ems-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=employee-management \
  -p 3306:3306 \
  -d mysql:8.0

# Update .env
DATABASE_URL="mysql://root:rootpass@localhost:3306/employee-management"
```

#### Option C: Cloud MySQL (AWS RDS / Azure MySQL)

Use your cloud provider's connection string:

```env
DATABASE_URL="mysql://admin:password@ems-db.c12345.us-east-1.rds.amazonaws.com:3306/employee-management"
```

### Step 5: Redis Setup

#### Option A: Local Redis (macOS with Homebrew)

```bash
brew install redis
brew services start redis

# Verify
redis-cli ping  # Should return: PONG

# Update .env
REDIS_URL="redis://127.0.0.1:6379"
```

#### Option B: Docker Redis

```bash
docker run --name ems-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Update .env
REDIS_URL="redis://127.0.0.1:6379"
```

#### Option C: Cloud Redis (Redis Cloud)

```env
REDIS_URL="redis://:password@redis-12345.cloud.redislabs.com:12345"
```

### Step 6: Brevo Email Configuration

1. **Create Brevo Account**
   - Visit: https://www.brevo.com/
   - Sign up for free tier

2. **Get SMTP Credentials**
   - Login to Brevo dashboard
   - Navigate to: SMTP & API → SMTP
   - Copy SMTP Host, Port, Username, Password

3. **Add Verified Sender**
   - Go to: Senders & Signatures
   - Add your email address (e.g., noreply@company.com)
   - Verify the email via link sent to that address
   - Update SMTP_FROM in .env

### Step 7: Database Migrations

```bash
# Run pending migrations
npm run db:migrate:dev

# Create new migration
npm run db:migrate:dev -- --name migration_name

# View Prisma schema
npm run db:studio
```

### Step 8: Seed Test Data

```bash
# Development data (5 tenants, 100 employees)
npm run db:seed

# Large demo data (10 tenants, 500 employees)
npm run db:seed:large

# Production data (realistic dataset)
npm run db:seed:production

# Seed specific test user for email testing
npm run seed:test-email-user -- --email your-email@company.com --mfa
```

### Step 9: Start Development Server

```bash
# Watch mode (auto-restart on file changes)
npm run dev

# Production mode
npm run start

# Output:
# ℹ Server started
# ℹ App Name: EMS
# ℹ Port: 3000
# ℹ Environment: development
# ℹ Docs URL: http://localhost:3000/docs
```

---

## Development Workflow

### Project Structure

```
ems-backend/
├── src/
│   ├── app.js                 # Fastify app creation
│   ├── server.js              # Server entry point
│   ├── config/                # Configuration management
│   ├── middleware/            # Auth, logging, error handling
│   ├── plugins/               # Fastify plugins (Prisma, Swagger, etc.)
│   ├── modules/               # Feature modules
│   │   ├── auth/              # Authentication (3 endpoints)
│   │   ├── employees/         # Employee management (3 endpoints)
│   │   ├── departments/       # Departments (4 endpoints)
│   │   ├── leave/             # Leave management (6 endpoints)
│   │   ├── attendance/        # Attendance (6 endpoints)
│   │   ├── holidays/          # Holidays (4 endpoints)
│   │   ├── reports/           # Reports (8 endpoints)
│   │   ├── export/            # Data export (4 endpoints)
│   │   ├── auditLogs/         # Audit (4 endpoints)
│   │   └── settings/          # Settings (6 endpoints)
│   ├── jobs/                  # BullMQ async jobs
│   │   ├── emailJob.js        # Email processing
│   │   └── exportJob.js       # Export processing
│   ├── utils/                 # Utilities
│   └── services/              # Business logic
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Database migrations
│   └── seed.js                # Seed script
├── tests/
│   ├── integration/           # Integration tests
│   ├── unit/                  # Unit tests
│   └── helpers.js             # Test utilities
├── .env                       # Environment variables
├── .env.example               # Example env file
├── package.json               # Dependencies
└── README.md                  # Project documentation
```

### Code Style

```bash
# Format code
npm run format

# Check linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/integration/leave.routes.test.js

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Database Debugging

```bash
# Open Prisma Studio (visual DB inspector)
npm run db:studio
# Opens at http://localhost:5555

# Generate Prisma client
npx prisma generate

# Reset database (careful!)
npx prisma migrate reset
```

### Common Development Tasks

#### Add New API Endpoint

1. Create route file: `src/modules/feature/feature.routes.js`
2. Create controller: `src/modules/feature/feature.controller.js`
3. Create service: `src/modules/feature/feature.service.js`
4. Create repository: `src/modules/feature/feature.repository.js`
5. Create validator: `src/modules/feature/feature.validator.js`
6. Register in `src/app.js`
7. Add test file: `tests/integration/feature.routes.test.js`

#### Add Database Field

```bash
# Edit prisma/schema.prisma
# Add field to model

# Create migration
npm run db:migrate:dev -- --name add_field_name

# Update repository/service code
```

#### Debug Failing Test

```bash
# Run single test with verbose output
npm test -- tests/integration/auth.routes.test.js --reporter spec

# Debug with Node inspector
node --inspect node_modules/.bin/mocha tests/integration/auth.routes.test.js
# Open chrome://inspect in Chrome
```

#### Monitor Redis Queue

```bash
# Install Bull UI (optional)
npm install --save-dev @bull-board/express @bull-board/ui

# View queue status
redis-cli
KEYS bullmq:*
LLEN bullmq:email:*
```

---

## Troubleshooting

### Issue: "Cannot find module 'dotenv'"

```bash
npm install dotenv
```

### Issue: "ECONNREFUSED 127.0.0.1:3306" (MySQL connection error)

```bash
# Check if MySQL is running
mysql -u root -p

# If not running, start it
brew services start mysql@8.0

# Or use Docker
docker start ems-mysql
```

### Issue: "Connection refused on port 6379" (Redis error)

```bash
# Check if Redis is running
redis-cli ping

# If not running, start it
brew services start redis

# Or use Docker
docker start ems-redis
```

### Issue: "OTP email not being sent"

```bash
# Check SMTP credentials in .env
# Test email delivery
npm run email:test -- --to your-email@company.com

# Check Redis queue for email jobs
redis-cli
LLEN bullmq:email:failed
```

### Issue: "Migration failed"

```bash
# Check migration status
npx prisma migrate status

# Reset database (destructive!)
npx prisma migrate reset

# Or rollback specific migration
npx prisma migrate resolve --rolled-back migration_name
```

---

## IDE Setup

### VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "Prisma.prisma",
    "eamodio.gitlens",
    "ms-vscode.thunder-client",
    "gitpod.workspace-full"
  ]
}
```

### VS Code Settings (.vscode/settings.json)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "node_modules": true,
    ".git": true
  }
}
```

---

## Performance Optimization (Development)

### Database Query Monitoring

```javascript
// In src/config/index.js
export const config = {
  isDevelopment: process.env.NODE_ENV === 'development',
  dbQueryLogging: true,  // Logs all queries with duration
  // ...
};
```

### Memory Profiling

```bash
# Start server with memory profiling
node --inspect src/server.js

# Open chrome://inspect in Chrome
# Click "inspect" next to your Node process
# Use Memory & Performance tabs
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/my-feature

# Create pull request on GitHub
# Link to issue: "Closes #123"

# After review, merge and delete branch
git switch main
git pull
git branch -d feature/my-feature
```

---

## Support & Resources

- **Fastify Docs**: https://www.fastify.io/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **BullMQ Docs**: https://docs.bullmq.io
- **Zod Validation**: https://zod.dev
- **JWT.io**: https://jwt.io

---

## Next Steps

1. ✅ Run `npm install` and set up `.env`
2. ✅ Set up local MySQL and Redis
3. ✅ Run `npm run db:seed`
4. ✅ Start dev server: `npm run dev`
5. ✅ View API docs: http://localhost:3000/docs
6. ✅ Run tests: `npm test`

Happy developing! 🚀
