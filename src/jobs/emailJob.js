import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
  return transporter;
}

function renderEmailTemplate(template, data) {
  const brandColor = '#4F46E5';
  const templates = {
    password_reset: (d) => `
      <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="background: ${brandColor}; padding: 24px 32px;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">EMS — Password Reset</h1>
            </div>
            <div style="padding: 32px;">
              <p style="margin-top: 0;">You requested a password reset. Click the button below — the link expires in <strong>${d.expiresInMinutes} minutes</strong>.</p>
              <a href="${d.resetUrl}" style="display: inline-block; background: ${brandColor}; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0;">Reset Password</a>
              <p style="color: #888; font-size: 13px;">If you didn't request this, ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">EMS — Employee Management System</p>
            </div>
          </div>
        </body>
      </html>
    `,
    otp_verification: (d) => `
      <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="background: ${brandColor}; padding: 24px 32px;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">EMS — Verify Your Identity</h1>
            </div>
            <div style="padding: 32px; text-align: center;">
              <p style="margin-top: 0; text-align: left;">Your one-time password (OTP):</p>
              <div style="background: #f0f0ff; border: 2px solid ${brandColor}; border-radius: 8px; padding: 20px; margin: 16px 0; display: inline-block;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: ${brandColor};">${d.code}</span>
              </div>
              <p style="color: #888; font-size: 13px; text-align: left;">Expires in <strong>${d.expiresInMinutes} minutes</strong>. If you didn't request this, ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #aaa; font-size: 12px; margin: 0; text-align: left;">EMS — Employee Management System</p>
            </div>
          </div>
        </body>
      </html>
    `,
    account_invite: (d) => `
      <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="background: ${brandColor}; padding: 24px 32px;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">Welcome to ${d.companyName}</h1>
            </div>
            <div style="padding: 32px;">
              <p style="margin-top: 0;">Hi ${d.employeeFirstName},</p>
              <p>You've been invited to join <strong>${d.companyName}</strong> on EMS. Click the button below to activate your account and set your password.</p>
              <p style="color: #888; font-size: 13px;">This link expires on <strong>${d.expiresAt}</strong>.</p>
              <a href="${d.activationUrl}" style="display: inline-block; background: ${brandColor}; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0;">Activate Account</a>
              <p style="color: #888; font-size: 13px;">If you didn't expect this invitation, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">Need help? Contact <a href="mailto:${d.supportEmail}" style="color: ${brandColor};">${d.supportEmail}</a></p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  const templateFn = templates[template];
  if (!templateFn) throw new Error(`Unknown email template: ${template}`);
  return templateFn(data);
}

async function sendViaResend(to, subject, html) {
  const from = config.resendFrom || 'onboarding@resend.dev';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const body = await res.json();
    if (!res.ok) {
      logger.error({ type: 'resend_failed', to, status: res.status, error: body.message });
      return { success: false, error: body.message ?? 'Resend API error' };
    }
    logger.info({ type: 'email_sent_resend', to, subject, messageId: body.id });
    return { success: true, messageId: body.id };
  } catch (err) {
    logger.error({ type: 'resend_network_error', to, error: err.message });
    return { success: false, error: err.message };
  }
}

async function sendEmail(to, subject, template, data) {
  if (config.isTesting) return { success: true, devMode: true };

  const html = renderEmailTemplate(template, data);

  if (config.resendApiKey) {
    return sendViaResend(to, subject, html);
  }

  if (!config.smtpUser || !config.smtpPass) {
    logger.warn({ type: 'email_skipped', reason: 'No email provider configured' });
    return { success: false, reason: 'No email provider configured' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: `EMS <${config.smtpFrom}>`,
      to,
      subject,
      html,
    });
    logger.info({ type: 'email_sent', to, template, messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ type: 'email_failed', to, template, error: err.message });
    return { success: false, error: err.message };
  }
}

export async function enqueuePasswordResetEmail(to, resetToken, expiresInMinutes) {
  const resetUrl = `${config.frontendResetPasswordUrl}?token=${resetToken}`;
  return sendEmail(to, 'Reset Your EMS Password', 'password_reset', { resetUrl, expiresInMinutes });
}

export async function enqueueOtpEmail(to, code, expiresInMinutes) {
  return sendEmail(to, 'Your EMS OTP Code', 'otp_verification', { code, expiresInMinutes });
}

export async function sendInviteEmail(to, { employeeFirstName, companyName, activationUrl, expiresAt, supportEmail }) {
  const subject = `Activate your account for ${companyName}`;
  return sendEmail(to, subject, 'account_invite', {
    employeeFirstName,
    companyName,
    activationUrl,
    expiresAt,
    supportEmail: supportEmail || config.smtpFrom,
  });
}
