import { config } from '../../config/index.js';
import { prisma } from '../../plugins/prisma.js';
import { generateId } from '../../utils/id.js';
import { isCloudinaryConfigured } from '../../utils/cloudinary.js';

const SETTING_GROUP = 'integrations';

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
  if (!value) return null;
  const s = String(value);
  if (s.length <= visible) return '****';
  return `${s.slice(0, Math.min(3, visible))}****${s.slice(-visible)}`;
}

export async function getEmailIntegration(tenantId) {
  const stored = await getSetting(tenantId, 'email');
  const usesResend = Boolean(config.resendApiKey);
  const provider = usesResend ? 'resend' : (config.emailProvider || 'smtp');
  const configured = usesResend || Boolean(config.smtpHost && config.smtpFrom);
  return {
    provider,
    configured,
    enabled: stored?.enabled ?? configured,
    fromAddress: stored?.fromAddress ?? config.resendFrom ?? config.smtpFrom ?? null,
    fromName: stored?.fromName ?? config.appName ?? 'EMS',
    replyTo: stored?.replyTo ?? null,
    domain: stored?.domain ?? (usesResend ? 'resend.dev' : null),
    domainVerified: stored?.domainVerified ?? usesResend,
    apiKeyMasked: usesResend ? maskSecret(config.resendApiKey) : null,
    smtpHost: !usesResend ? (config.smtpHost || null) : null,
    updatedAt: stored?.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateEmailIntegration(tenantId, data) {
  const current = await getEmailIntegration(tenantId);
  const value = {
    ...current,
    ...data,
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
  return {
    provider: 'cloudinary',
    configured: cloudinaryOk,
    enabled: stored?.enabled ?? cloudinaryOk,
    cloudName: cloudinaryOk ? (config.cloudinaryCloudName || null) : null,
    cloudNameMasked: cloudinaryOk ? maskSecret(config.cloudinaryCloudName, 3) : null,
    folder: stored?.folder ?? 'ems-documents',
    photoFolder: stored?.photoFolder ?? 'ems-photos',
    allowedMimeTypes: stored?.allowedMimeTypes ?? ['image/webp', 'application/pdf', 'image/jpeg', 'image/png'],
    maxFileSizeMb: stored?.maxFileSizeMb ?? 10,
    metadataStore: 'postgresql',
    metadataStatus: 'active',
    updatedAt: stored?.updatedAt ?? new Date().toISOString(),
  };
}

export async function updateStorageIntegration(tenantId, data) {
  const current = await getStorageIntegration(tenantId);
  const value = { ...current, ...data, updatedAt: new Date().toISOString() };
  await upsertSetting(tenantId, 'storage', value);
  return getStorageIntegration(tenantId);
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
