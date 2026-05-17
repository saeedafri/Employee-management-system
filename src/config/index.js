export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  logLevel: process.env.LOG_LEVEL || 'debug',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'super_secret_key_change_in_production',
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',

  // CORS
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),

  // Database
  databaseUrl: process.env.DATABASE_URL || 'mysql://localhost:3306/ems_local',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

  // Session
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'refreshToken',
  sessionMaxAgeDays: parseInt(process.env.SESSION_MAX_AGE_DAYS, 10) || 7,
  defaultTenantKey: process.env.DEFAULT_TENANT_KEY || null,

  // App
  appName: process.env.APP_NAME || 'EMS',
  appVersion: process.env.APP_VERSION || '1.0.0',
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Email
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 1025,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@acme.test',

  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTesting: process.env.NODE_ENV === 'testing',
};
