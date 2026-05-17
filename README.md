# Employee Management System (EMS) Backend

Production-grade Employee Management System backend built with Fastify, Prisma, and MySQL.

## Features

- ✅ User authentication with JWT access tokens and refresh token rotation
- ✅ Session management with secure HttpOnly cookies
- ✅ Role-based access control (RBAC) with 5 member types
- ✅ Admin and employee login modes
- ✅ Audit logging for all mutations
- ✅ Comprehensive error handling
- ✅ API documentation with Swagger/OpenAPI
- 🔜 Multi-factor authentication (MFA)
- 🔜 Employee lifecycle management
- 🔜 Attendance tracking
- 🔜 Leave management
- 🔜 Resignations
- 🔜 Holiday calendar

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **ORM**: Prisma
- **Database**: MySQL 8
- **Cache**: Redis
- **Job Queue**: BullMQ
- **Password Hashing**: Argon2id
- **JWT**: jose
- **Validation**: Zod
- **Testing**: Vitest
- **Logging**: Pino
- **API Docs**: Swagger/OpenAPI

## Local Setup

### Prerequisites

1. **Node.js 20+** and npm 11+
```bash
node --version  # v25.9.0+
npm --version   # 11.12.0+
```

2. **MySQL 8** locally
```bash
mysql --version  # Ver 9.4.0
```

3. **Redis** running locally
```bash
redis-cli ping  # PONG
```

### MySQL Setup

Create the database and user:

```bash
mysql -u root << 'EOF'
CREATE DATABASE IF NOT EXISTS ems_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ems_user'@'localhost' IDENTIFIED BY 'ems_pass_local';
GRANT ALL PRIVILEGES ON ems_local.* TO 'ems_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

Or if your root has a password:

```bash
mysql -u root -p << 'EOF'
CREATE DATABASE IF NOT EXISTS ems_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ems_user'@'localhost' IDENTIFIED BY 'ems_pass_local';
GRANT ALL PRIVILEGES ON ems_local.* TO 'ems_user'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### Installation

1. **Clone and install**
```bash
cd /Users/mohdsaeedafri/All-Code-Base/EMS
npm install
```

2. **Set up environment**
```bash
cp .env.example .env
# Edit .env if needed (optional - defaults work for local dev)
```

3. **Run migrations**
```bash
npm run db:migrate:dev
```

4. **Seed database**
```bash
npm run db:seed
```

### Running the Server

**Development (with hot reload)**
```bash
npm run dev
```

**Production**
```bash
npm run start
```

Server runs at `http://localhost:3000`

API docs at `http://localhost:3000/docs`

## Seed Data

After seeding, the following test users are available (password: `ChangeMe123!`):

| Email | Role | Tenant |
|-------|------|--------|
| `superadmin@acme.test` | SUPER_ADMIN | Acme Corp |
| `hr@acme.test` | HR_ADMIN | Acme Corp |
| `aman@acme.test` | MANAGER | Acme Corp |
| `priya@acme.test` | EMPLOYEE | Acme Corp |

## API Structure

All endpoints are prefixed with `/api/v1`.

### Authentication Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/auth/login` | No | Login with email/password |
| `POST` | `/auth/admin/login` | No | Admin login (SUPER_ADMIN/HR_ADMIN only) |
| `POST` | `/auth/refresh` | Yes | Refresh access token |
| `POST` | `/auth/logout` | Yes | Logout current session |
| `POST` | `/auth/logout-all` | Yes | Logout from all devices |
| `GET` | `/auth/me` | Yes | Get current user profile |
| `GET` | `/auth/sessions` | Yes | List user's sessions |
| `DELETE` | `/auth/sessions/:sessionId` | Yes | Revoke specific session |

### Response Format

**Success**
```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```

**Error**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { },
    "requestId": "req-id"
  }
}
```

## Security

- Passwords hashed with Argon2id (no plaintext storage)
- Refresh tokens hashed with SHA-256 before DB storage
- Access tokens signed with HS256, expire in 15 minutes
- Refresh tokens rotate on each use (token reuse = session revocation)
- HttpOnly, Secure, SameSite=Strict cookies
- Admin login endpoint restricted to admins only
- All mutations logged to audit_logs table
- Role-based authorization enforced on every protected route

## Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Linting & Formatting

```bash
# Lint
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Database

### Prisma Studio

```bash
npm run db:studio
```

Opens interactive database browser at `http://localhost:5555`

### Migrations

```bash
# Create new migration
npm run db:migrate:dev -- --name my_migration_name

# Apply migrations to production
npm run db:migrate:prod
```

### Schema

The Prisma schema defines 23 models covering:
- Multi-tenancy (Tenant, User isolation)
- Authentication (User, Session, PasswordResetToken, OtpChallenge)
- Authorization (Role, Permission, RolePermission, UserRole)
- Employees (Employee, Department, EmployeeDocument)
- Attendance (AttendanceRecord, AttendanceRegularizationRequest)
- Leave (LeaveType, LeaveBalance, LeaveRequest)
- Organization (Holiday, Resignation)
- Cross-cutting (AuditLog, Notification, SavedView, Setting)

See `prisma/schema.prisma` for full schema definition.

## Architecture

```
src/
├── server.js              # Entry point
├── app.js                 # Fastify factory
├── config/                # Environment config
├── plugins/               # Fastify plugins (swagger, prisma, redis, etc.)
├── middleware/            # Request middleware (auth, error handling)
├── modules/               # Feature modules (auth, employees, etc.)
│   └── auth/
│       ├── auth.routes.js
│       ├── auth.controller.js
│       ├── auth.service.js
│       ├── auth.repository.js
│       ├── auth.validator.js
│       └── auth.policy.js
└── utils/                 # Shared utilities (response, token, hash, etc.)
```

## Module Structure

Each module follows this pattern:

- **routes.js**: Route definitions and Fastify registration
- **controller.js**: HTTP request handling, response formatting
- **service.js**: Business logic and orchestration
- **repository.js**: Database queries via Prisma
- **validator.js**: Zod schemas for request validation
- **policy.js**: Authorization logic

This clean separation enables:
- Easy testing (mock service layer)
- Clear responsibility boundaries
- Reusable services across endpoints
- Centralized data access

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Implement the feature following module structure**

3. **Add tests**
   ```bash
   npm run test -- my.test.js
   ```

4. **Lint and format**
   ```bash
   npm run lint:fix && npm run format
   ```

5. **Commit with clear message**
   ```bash
   git commit -m "feat(auth): implement login APIs and session foundation"
   ```

6. **Push and create PR**
   ```bash
   git push origin feat/my-feature
   ```

## Postman Collection

API collection available at `docs/postman/EMS.postman_collection.json`

Import into Postman to test all endpoints with pre-configured environment variables.

## GitHub

This project is hosted at:
```
https://github.com/saeedafri/employee-management-system-backend
```

To push to GitHub (first time):

1. Ensure you're logged into GitHub CLI:
   ```bash
   gh auth login
   ```

2. Create the repository:
   ```bash
   gh repo create saeedafri/employee-management-system-backend \
     --private \
     --source=. \
     --remote=origin \
     --push
   ```

3. Future pushes:
   ```bash
   git push origin main
   ```

## License

MIT
