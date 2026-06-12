import { prisma } from '../../plugins/prisma.js';

export async function getTenantConfig(tenantId) {
  const [tenant, config] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        legalName: true,
        displayName: true,
        country: true,
        defaultCurrency: true,
        primaryContactEmail: true,
        supportPhone: true,
        logoUrl: true,
        timezone: true,
      },
    }),
    prisma.tenantConfig.findUnique({ where: { tenantId } }),
  ]);

  if (!config && tenant) {
    const created = await prisma.tenantConfig.create({
      data: { tenantId, companyName: tenant.name, timezone: tenant.timezone },
    });
    return { tenant, config: created };
  }

  return { tenant, config };
}

export async function updateTenantFields(tenantId, data) {
  const updateData = {};
  if (data.legalName !== undefined) updateData.legalName = data.legalName;
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.country !== undefined) updateData.country = data.country;
  if (data.defaultCurrency !== undefined) updateData.defaultCurrency = data.defaultCurrency;
  if (data.primaryContactEmail !== undefined) updateData.primaryContactEmail = data.primaryContactEmail;
  if (data.supportPhone !== undefined) updateData.supportPhone = data.supportPhone;
  if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
  if (Object.keys(updateData).length === 0) return null;
  return prisma.tenant.update({ where: { id: tenantId }, data: updateData });
}

export async function updateTenantConfig(tenantId, data) {
  const updateData = {};
  if (data.company_name !== undefined) updateData.companyName = data.company_name;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.working_hours_start !== undefined) updateData.workingHoursStart = data.working_hours_start;
  if (data.working_hours_end !== undefined) updateData.workingHoursEnd = data.working_hours_end;
  if (data.invite_email_target !== undefined) {
    if (!['PERSONAL', 'WORK'].includes(data.invite_email_target)) {
      throw new Error('invite_email_target must be PERSONAL or WORK');
    }
    updateData.inviteEmailTarget = data.invite_email_target;
  }

  return prisma.tenantConfig.upsert({
    where: { tenantId },
    update: updateData,
    create: {
      tenantId,
      companyName: updateData.companyName ?? 'My Company',
      ...updateData,
    },
  });
}

export async function getEmailTemplates(tenantId) {
  let templates = await prisma.emailTemplate.findMany({
    where: { tenantId },
  });

  if (templates.length === 0) {
    const defaultTemplates = [
      {
        type: 'LEAVE_APPROVAL',
        subject: 'Your Leave Request Has Been Approved',
        body: 'Dear Employee,\n\nYour leave request has been approved.\n\nThank you.',
      },
      {
        type: 'LEAVE_REJECTION',
        subject: 'Your Leave Request Has Been Rejected',
        body: 'Dear Employee,\n\nUnfortunately, your leave request has been rejected.\n\nPlease contact your manager for more details.',
      },
      {
        type: 'ATTENDANCE_ALERT',
        subject: 'Attendance Alert',
        body: 'Dear Employee,\n\nThis is an alert regarding your attendance.\n\nPlease review your attendance records.',
      },
    ];

    for (const tpl of defaultTemplates) {
      await prisma.emailTemplate.create({
        data: {
          tenantId,
          type: tpl.type,
          subject: tpl.subject,
          body: tpl.body,
        },
      });
    }

    templates = await prisma.emailTemplate.findMany({
      where: { tenantId },
    });
  }

  return templates;
}

export async function updateEmailTemplate(tenantId, type, data) {
  return prisma.emailTemplate.upsert({
    where: {
      tenantId_type: {
        tenantId,
        type,
      },
    },
    update: {
      subject: data.subject,
      body: data.body,
    },
    create: {
      tenantId,
      type,
      subject: data.subject,
      body: data.body,
    },
  });
}

export async function getRolePermissions(tenantId) {
  const roles = await prisma.role.findMany({
    where: {
      OR: [
        { tenantId },
        { isSystem: true },
      ],
    },
    include: {
      permissions: {
        include: {
          permission: {
            select: { key: true, module: true },
          },
        },
      },
    },
  });

  const result = {};
  const customRoles = [];

  roles.forEach((role) => {
    result[role.key] = role.permissions.map((rp) => rp.permission.key);
    if (!role.isSystem && role.tenantId === tenantId) {
      customRoles.push({ key: role.key, name: role.name });
    }
  });

  return { matrix: result, customRoles };
}

export async function updateRolePermissions(tenantId, roleKey, permissions) {
  const role = await prisma.role.findFirst({
    where: {
      key: roleKey,
      OR: [
        { tenantId },
        { isSystem: true },
      ],
    },
  });

  if (!role) {
    throw new Error('Role not found');
  }

  const permissionIds = await prisma.permission.findMany({
    where: { key: { in: permissions } },
    select: { id: true },
  });

  await prisma.rolePermission.deleteMany({
    where: { roleId: role.id },
  });

  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((p) => ({
        roleId: role.id,
        permissionId: p.id,
      })),
    });
  }

  return role;
}

async function getSetting(tenantId, groupKey, settingKey, defaultVal) {
  const row = await prisma.setting.findUnique({ where: { tenantId_groupKey_settingKey: { tenantId, groupKey, settingKey } } });
  return row ? row.valueJson : defaultVal;
}

async function upsertSetting(tenantId, groupKey, settingKey, value) {
  return prisma.setting.upsert({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey, settingKey } },
    update: { valueJson: value },
    create: { tenantId, groupKey, settingKey, valueJson: value },
  });
}

export async function getBranding(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { logoUrl: true } });
  const extra = await getSetting(tenantId, 'branding', 'colors', { primary_color_hex: '#3b5cff' });
  return { logo_url: tenant?.logoUrl || null, primary_color_hex: extra?.primary_color_hex || '#3b5cff' };
}

export async function updateBranding(tenantId, data) {
  if (data.logo_url !== undefined) await prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: data.logo_url } });
  if (data.primary_color_hex) await upsertSetting(tenantId, 'branding', 'colors', { primary_color_hex: data.primary_color_hex });
  return getBranding(tenantId);
}

const DEFAULT_ATTENDANCE_RULES = {
  work_week_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  late_after: '09:30',
  half_day_threshold_minutes: 240,
  full_day_threshold_minutes: 480,
  regularization_window_days: 7,
  geo_fencing_enabled: false,
};

export async function getAttendanceRules(tenantId) {
  const val = await getSetting(tenantId, 'attendance', 'rules', DEFAULT_ATTENDANCE_RULES);
  return { ...DEFAULT_ATTENDANCE_RULES, ...val };
}

export async function updateAttendanceRules(tenantId, data) {
  const current = await getAttendanceRules(tenantId);
  const updated = { ...current, ...data };
  await upsertSetting(tenantId, 'attendance', 'rules', updated);
  return updated;
}

const DEFAULT_AUTH_SETTINGS = {
  password_min_length: 8,
  password_require_symbol: false,
  password_require_number: true,
  session_idle_timeout_minutes: 60,
  mfa_policy: 'OPTIONAL',
  sso_enabled: false,
};

export async function getAuthSettings(tenantId) {
  const val = await getSetting(tenantId, 'security', 'auth', DEFAULT_AUTH_SETTINGS);
  return { ...DEFAULT_AUTH_SETTINGS, ...val };
}

export async function updateAuthSettings(tenantId, data) {
  const current = await getAuthSettings(tenantId);
  const updated = { ...current, ...data };
  await upsertSetting(tenantId, 'security', 'auth', updated);
  return updated;
}

const DEFAULT_NOTIFICATION_PREFS = {
  channels: { in_app: true, email: true },
  events: {
    leave_approved: ['in_app', 'email'],
    leave_rejected: ['in_app', 'email'],
    leave_requested: ['in_app'],
    attendance_regularization: ['in_app', 'email'],
  },
};

export async function getNotificationPreferences(tenantId, userId) {
  const val = await prisma.setting.findUnique({ where: { tenantId_groupKey_settingKey: { tenantId, groupKey: `notifications_user_${userId}`, settingKey: 'preferences' } } });
  return val ? { ...DEFAULT_NOTIFICATION_PREFS, ...val.valueJson } : DEFAULT_NOTIFICATION_PREFS;
}

export async function updateNotificationPreferences(tenantId, userId, data) {
  const current = await getNotificationPreferences(tenantId, userId);
  const updated = { ...current, ...data };
  await prisma.setting.upsert({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: `notifications_user_${userId}`, settingKey: 'preferences' } },
    update: { valueJson: updated },
    create: { tenantId, groupKey: `notifications_user_${userId}`, settingKey: 'preferences', valueJson: updated },
  });
  return updated;
}

export async function createRole(tenantId, data) {
  const existing = await prisma.role.findFirst({ where: { key: data.key, tenantId } });
  if (existing) throw Object.assign(new Error('Role key already exists'), { code: 'DUPLICATE_ROLE_KEY', statusCode: 409 });

  const role = await prisma.role.create({ data: { tenantId, key: data.key, name: data.name, isSystem: false } });

  const permissions = data.permissions || [];
  if (permissions.length > 0) {
    const permissionRows = await prisma.permission.findMany({
      where: { key: { in: permissions } },
      select: { id: true, key: true },
    });
    if (permissionRows.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionRows.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  return { ...role, permissions };
}

export async function deleteRole(tenantId, key) {
  const role = await prisma.role.findFirst({ where: { key, tenantId } });
  if (!role) throw Object.assign(new Error('Role not found'), { code: 'NOT_FOUND', statusCode: 404 });
  const inUse = await prisma.userRole.count({ where: { roleId: role.id } });
  if (inUse > 0) throw Object.assign(new Error('Role is in use'), { code: 'ROLE_IN_USE', statusCode: 409 });
  await prisma.role.delete({ where: { id: role.id } });
  return { key, status: 'deleted' };
}

export async function assignUsersToRole(tenantId, key, userIds) {
  const role = await prisma.role.findFirst({ where: { key, tenantId } });
  if (!role) throw Object.assign(new Error('Role not found'), { code: 'NOT_FOUND', statusCode: 404 });
  await prisma.userRole.createMany({ data: userIds.map(uid => ({ userId: uid, roleId: role.id })), skipDuplicates: true });
  return { assigned: userIds };
}
