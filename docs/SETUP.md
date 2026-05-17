# EMS Backend Setup Guide

## Prerequisites

- Node.js 18+ (tested on v25.9)
- npm 11+
- MySQL 8.0+ (or Docker)
- Redis 6.0+ (or Docker)

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd employee-management-system-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create `.env` file in project root:

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_URL=mysql://user:password@localhost:3306/ems_local

# Redis
REDIS_URL=redis://127.0.0.1:6379

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Session
SESSION_COOKIE_NAME=refreshToken
SESSION_MAX_AGE_DAYS=7
DEFAULT_TENANT_KEY=default

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Email (optional for development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@acme.test

# Application
APP_NAME=EMS
APP_VERSION=1.0.0
API_PREFIX=/api/v1
```

### 4. Database Setup

#### Option A: Local MySQL

```bash
# Create database and user
mysql -u root -p << EOF
CREATE DATABASE ems_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ems_user'@'localhost' IDENTIFIED BY 'ems_pass_local';
GRANT ALL ON ems_local.* TO 'ems_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

Update `.env`:
```
DATABASE_URL=mysql://ems_user:ems_pass_local@localhost:3306/ems_local
```

#### Option B: Docker

```bash
docker run --name mysql-ems \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=ems_local \
  -e MYSQL_USER=ems_user \
  -e MYSQL_PASSWORD=ems_pass_local \
  -p 3306:3306 \
  -d mysql:8.0
```

### 5. Redis Setup

#### Option A: Local Redis

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Or run manually
redis-server
```

#### Option B: Docker

```bash
docker run --name redis-ems \
  -p 6379:6379 \
  -d redis:7.0
```

### 6. Prisma Migrations

```bash
# Apply migrations
npm run db:migrate:dev

# Generate Prisma Client
npm run db:generate
```

### 7. Seed Database (Optional)

```bash
npm run db:seed
```

Creates test data including:
- Default tenant
- Test users (with different roles)
- Sample employees
- Test permissions

## Running the Application

### Development Mode

```bash
npm run dev
```

Server starts at `http://localhost:3000`
API docs available at `http://localhost:3000/docs`

### Production Build

```bash
npm run build
npm start
```

## Development Commands

### Linting

```bash
# Check for errors
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Database

```bash
# Open Prisma Studio
npm run db:studio

# Create new migration
npm run db:migrate:dev -- --name migration_name

# Reset database (development only)
npm run db:reset
```

## Project Structure

```
.
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Fastify app factory
│   ├── config/                # Configuration
│   ├── middleware/            # HTTP middleware
│   ├── modules/               # Feature modules
│   │   ├── auth/
│   │   ├── employees/
│   │   ├── attendance/
│   │   ├── leave/
│   │   └── logs/
│   ├── plugins/               # Fastify plugins
│   ├── utils/                 # Utilities
│   └── jobs/                  # Background jobs
├── prisma/
│   ├── schema.prisma          # DB schema
│   ├── migrations/            # DB migrations
│   └── seed.js                # Database seeder
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── helpers.js             # Test utilities
│   └── setup.js               # Test setup
├── docs/                      # Documentation
├── package.json
└── .env.example
```

## Testing the API

### Using cURL

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: default" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'

# Get current user
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer {accessToken}" \
  -H "X-Tenant-Key: default"
```

### Using Postman

1. Import `docs/postman/EMS.postman_collection.json`
2. Set collection variables:
   - `baseUrl`: `http://localhost:3000`
   - `tenantKey`: `default`
   - `accessToken`: (auto-populated from login)
3. Run requests from collection

### Using Swagger UI

Navigate to `http://localhost:3000/docs` after starting server.

## Common Issues

### Database Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solution:**
- Verify MySQL is running: `mysql -u root -p`
- Check DATABASE_URL in .env
- Ensure correct username/password

### Redis Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in .env
- Start Redis: `redis-server`

### Migration Failed

```
Error: P3021 Foreign key constraint failed
```

**Solution:**
```bash
# Reset database
npm run db:reset

# Reapply migrations
npm run db:migrate:dev
```

### Port Already in Use

```
Error: listen EADDRINUSE :::3000
```

**Solution:**
```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=trace npm run dev
```

### VS Code Debug Configuration

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/src/server.js",
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

## Performance Monitoring

### Check Response Times

```bash
# Watch server logs for timing
npm run dev | grep responseTime
```

### Database Query Monitoring

Enable Prisma query logging:

```env
DATABASE_URL=mysql://user:pass@localhost/ems?logQueries=true
```

## Next Steps

1. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Read [AUTHENTICATION.md](./AUTHENTICATION.md) for auth details
3. Check [API.md](./API.md) for API reference
4. Run test suite: `npm test`
5. Start developing: `npm run dev`

## Additional Resources

- [Fastify Documentation](https://www.fastify.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [JWT.io](https://jwt.io/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
