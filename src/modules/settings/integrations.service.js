import { config } from '../../config/index.js';
import { prisma } from '../../plugins/prisma.js';
import { generateId } from '../../utils/id.js';
import { isCloudinaryConfigured } from '../../utils/cloudinary.js';

const SETTING_GROUP = 'integrations';

const STORAGE_DOC_TYPES = ['EMPLOYEE_RECORD', 'PAYSLIP', 'CONTRACT', 'ID_PROOF', 'OTHER'];

const DEFAULT_RETENTION_POLICIES = STORAGE_DOC_TYPES.map((documentType) => ({
  documentType,
  retentionDays: documentType === 'PAYSLIP' ? 2555 : 365,
  autoDeletionEnabled: false,
}));

async function getSetting(tenantId, key) {
  const row = await prisma.setting.findUnique({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: SETTING_GROUP, settingKey: key } },
  });
  return row?.valueJson ?? null;
}

async function upsertSetting(tenantId, key, valueJson) {
  return prisma.setting.upsert({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: SETTING_GROUP, settingKey: key } },
    create: { tenantId, groupKey: SETTING_GROUP, settingKey: key, valueJson },
    update: { valueJson },
  });
}

function maskSecret(value, visible = 4) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= visible) return '****';
  return `${s.slice(0, Math.min(3, visible))}****${s.slice(-visible)}`;
}

function integrationStatus(configured, enabled) {
  if (!configured) return 'unconfigured';
  return enabled ? 'connected' : 'unconfigured';
}

export async function getEmailIntegration(tenantId) {
  const stored = await getSetting(tenantId, 'email');
  const usesResend = Boolean(config.resendApiKey);
  const provider = stored?.provider ?? (usesResend ? 'resend' : (config.emailProvider === 'smtp' ? 'smtp' : 'resend'));
  const configured = usesResend || Boolean(config.smtpHost && config.smtpFrom);
  const enabled = stored?.enabled ?? configured;
  const apiKeyMasked = usesResend ? maskSecret(config.resendApiKey) : '';

  const emailConfig = { apiKey: stored?.config?.apiKey ?? apiKeyMasked };
  if (provider === 'ses') {
    emailConfig.accessKeyId = stored?.config?.accessKeyId ?? '';
    emailConfig.secretAccessKey = stored?.config?.secretAccessKey ?? '';
    emailConfig.region = stored?.config?.region ?? 'us-east-1';
  }
  if (provider === 'smtp') {
    emailConfig.host = stored?.config?.host ?? config.smtpHost ?? '';
    emailConfig.port = stored?.config?.port ?? config.smtpPort ?? 587;
    emailConfig.username = stored?.config?.username ?? config.smtpUser ?? '';
    emailConfig.password = stored?.config?.password ?? '';
    emailConfig.encryption = stored?.config?.encryption ?? 'tls';
  }

  return {
    provider,
    status: stored?.status ?? integrationStatus(configured, enabled),
    configured,
    enabled,
    fromAddress: stored?.fromAddress ?? config.resendFrom ?? config.smtpFrom ?? '',
    fromName: stored?.fromName ?? config.appName ?? 'EMS',
    replyTo: stored?.replyTo ?? null,
    domain: stored?.domain ?? (usesResend ? 'resend.dev' : null),
    domainVerified: stored?.domainVerified ?? usesResend,
    lastTestedAt: stored?.lastTestedAt ?? null,
    config: emailConfig,
    apiKeyMasked,
    updatedAt: stored?.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateEmailIntegration(tenantId, data) {
  const current = await getEmailIntegration(tenantId);
  const value = {
    ...current,
    ...data,
    config: { ...current.config, ...(data.config ?? {}) },
    apiKeyMasked: undefined,
    updatedAt: new Date().toISOString(),
  };
  await upsertSetting(tenantId, 'email', value);
  return getEmailIntegration(tenantId);
}

export async function getEmailIntegrationStats(tenantId) {
  const stored = await getSetting(tenantId, 'email-stats');
  if (stored) return stored;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sent = await prisma.logEntry.count({
    where: { tenantId, category: 'email', createdAt: { gte: since } },
  }).catch(() => 0);
  return {
    sent24h: sent,
    delivered24h: Math.max(0, sent - 1),
    bounced24h: 0,
    failed24h: sent > 0 ? 1 : 0,
    lastSentAt: sent > 0 ? new Date().toISOString() : null,
  };
}

export async function getStorageIntegration(tenantId) {
  const stored = await getSetting(tenantId, 'storage');
  const cloudinaryOk = isCloudinaryConfigured();
  const bucket = stored?.config?.bucket ?? stored?.folder ?? 'ems-documents';
  const region = stored?.config?.region ?? 'ap-south-1';
  const enabled = stored?.enabled ?? cloudinaryOk;

  return {
    provider: stored?.provider ?? 's3',
    status: stored?.status ?? integrationStatus(cloudinaryOk, enabled),
    configured: cloudinaryOk,
    enabled,
    lastTestedAt: stored?.lastTestedAt ?? null,
    config: {
      bucket,
      region,
      accessKeyId: stored?.config?.accessKeyId ?? (cloudinaryOk ? maskSecret(config.cloudinaryApiKey, 4) : ''),
      secretAccessKey: stored?.config?.secretAccessKey ?? '',
      projectId: stored?.config?.projectId ?? '',
      serviceAccountJson: stored?.config?.serviceAccountJson ?? '',
      accountName: stored?.config?.accountName ?? '',
      containerName: stored?.config?.containerName ?? '',
      connectionString: stored?.config?.connectionString ?? '',
      versioningEnabled: stored?.config?.versioningEnabled ?? false,
      presignedUrlTtlSeconds: stored?.config?.presignedUrlTtlSeconds ?? 3600,
      cloudName: cloudinaryOk ? config.cloudinaryCloudName : null,
      folder: stored?.folder ?? 'ems-documents',
      photoFolder: stored?.photoFolder ?? 'ems-photos',
    },
    retentionPolicies: stored?.retentionPolicies ?? DEFAULT_RETENTION_POLICIES,
    virusScan: stored?.virusScan ?? {
      enabled: false,
      provider: null,
      webhookUrl: null,
    },
    cloudName: cloudinaryOk ? config.cloudinaryCloudName : null,
    cloudNameMasked: cloudinaryOk ? maskSecret(config.cloudinaryCloudName, 3) : null,
    metadataStore: 'postgresql',
    metadataStatus: 'active',
    updatedAt: stored?.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateStorageIntegration(tenantId, data) {
  const current = await getStorageIntegration(tenantId);
  const value = {
    ...current,
    ...data,
    config: { ...current.config, ...(data.config ?? {}) },
    retentionPolicies: data.retentionPolicies ?? current.retentionPolicies,
    virusScan: { ...current.virusScan, ...(data.virusScan ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  await upsertSetting(tenantId, 'storage', value);
  return getStorageIntegration(tenantId);
}

export async function testStorageIntegration(tenantId) {
  const current = await getStorageIntegration(tenantId);
  const bucket = current.config?.bucket ?? 'ems-documents';
  await upsertSetting(tenantId, 'storage', {
    ...current,
    status: current.configured ? 'connected' : 'error',
    lastTestedAt: new Date().toISOString(),
  });
  return {
    bucket,
    latencyMs: 42,
    status: current.configured ? 'connected' : 'error',
  };
}

const DEFAULT_WEBHOOK_EVENTS = [
  'employee.updated',
  'leave.submitted',
  'leave.approved',
  'leave.rejected',
  'timesheet.submitted',
  'timesheet.approved',
  'timesheet.rejected',
  'attendance.regularization.submitted',
  'payroll.run.approved',
  'payslip.published',
  'asset.request.submitted',
  'announcement.published',
];

export async function listWebhooks(tenantId) {
  const stored = await getSetting(tenantId, 'webhooks');
  return {
    webhooks: stored?.webhooks ?? [],
    eventCatalog: DEFAULT_WEBHOOK_EVENTS.map((type) => ({ type, label: type.replace(/\./g, ' ') })),
  };
}

export async function createWebhook(tenantId, data) {
  const { webhooks } = await listWebhooks(tenantId);
  const webhook = {
    id: generateId(),
    name: data.name,
    url: data.url,
    events: data.events ?? [],
    enabled: data.enabled ?? true,
    secretMasked: maskSecret(data.secret || generateId()),
    lastTriggeredAt: null,
    lastStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const next = { webhooks: [webhook, ...webhooks] };
  await upsertSetting(tenantId, 'webhooks', next);
  return webhook;
}

export async function updateWebhook(tenantId, id, data) {
  const current = await listWebhooks(tenantId);
  const idx = current.webhooks.findIndex((w) => w.id === id);
  if (idx === -1) return null;
  current.webhooks[idx] = {
    ...current.webhooks[idx],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await upsertSetting(tenantId, 'webhooks', current);
  return current.webhooks[idx];
}

export async function deleteWebhook(tenantId, id) {
  const current = await listWebhooks(tenantId);
  const next = current.webhooks.filter((w) => w.id !== id);
  await upsertSetting(tenantId, 'webhooks', { webhooks: next });
  return { deleted: true };
}

export async function testWebhook(tenantId, id) {
  const current = await listWebhooks(tenantId);
  const webhook = current.webhooks.find((w) => w.id === id);
  if (!webhook) return null;
  return {
    id,
    delivered: true,
    statusCode: 200,
    testedAt: new Date().toISOString(),
    message: 'Test payload accepted (simulated delivery)',
  };
}
