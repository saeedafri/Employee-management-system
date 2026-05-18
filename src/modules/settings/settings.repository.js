import { prisma } from '../../plugins/prisma.js';

export async function getTenantConfig(tenantId) {
  let config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
  });

  if (!config) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, timezone: true },
    });

    config = await prisma.tenantConfig.create({
      data: {
        tenantId,
        companyName: tenant.name,
        timezone: tenant.timezone,
      },
    });
  }

  return config;
}

export async function updateTenantConfig(tenantId, data) {
  const updateData = {};
  if (data.company_name !== undefined) updateData.companyName = data.company_name;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.working_hours_start !== undefined) updateData.workingHoursStart = data.working_hours_start;
  if (data.working_hours_end !== undefined) updateData.workingHoursEnd = data.working_hours_end;

  return prisma.tenantConfig.upsert({
    where: { tenantId },
    update: updateData,
    create: {
      tenantId,
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

  roles.forEach((role) => {
    result[role.key] = role.permissions.map((rp) => rp.permission.key);
  });

  return result;
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
