import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const isMockProvider = config.emailProvider === 'mock';
const isEtherealProvider =
  config.emailProvider === 'ethereal' ||
  (config.smtpHost || '').includes('ethereal.email');
const isSmtpProvider =
  config.emailProvider === 'smtp' ||
  config.emailProvider === 'resend' ||
  isEtherealProvider;

let transporter;

if (isSmtpProvider) {
  const port = config.smtpPort;
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port,
    secure: port === 465,
    auth: config.smtpUser && config.smtpPass
      ? { user: config.smtpUser, pass: config.smtpPass }
      : undefined,
    tls: { rejectUnauthorized: false },
  });
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
  };

  const templateFn = templates[template];
  if (!templateFn) throw new Error(`Unknown email template: ${template}`);
  return templateFn(data);
}

async function sendEmailDirect(to, subject, template, data) {
  if (isMockProvider) {
    logger.info({ type: 'email_mock', to, subject, template });
    return { success: true, mock: true };
  }

  if (!transporter) {
    logger.warn('Email provider not configured, skipping email');
    return { success: false, reason: 'Email provider not configured' };
  }

  try {
    const html = renderEmailTemplate(template, data);
    const info = await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      html,
    });

    // For Ethereal, log the preview URL so developers can inspect the email
    if (isEtherealProvider) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info({ type: 'email_ethereal_preview', to, template, previewUrl });
      console.log(`\n📧 Ethereal preview: ${previewUrl}\n`);
    } else {
      logger.info({ type: 'email_sent', to, template, messageId: info.messageId });
    }

    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error({ type: 'email_failed', to, template, error: err.message });
    return { success: false, error: err.message };
  }
}

export async function enqueuePasswordResetEmail(to, resetToken, expiresInMinutes) {
  if (config.isTesting) return { success: true, devMode: true };

  const resetUrl = `${config.frontendResetPasswordUrl}?token=${resetToken}`;
  return sendEmailDirect(to, 'Reset Your EMS Password', 'password_reset', {
    resetUrl,
    expiresInMinutes,
  });
}

export async function enqueueOtpEmail(to, code, expiresInMinutes) {
  if (config.isTesting) return { success: true, devMode: true };

  return sendEmailDirect(to, 'Your EMS OTP Code', 'otp_verification', {
    code,
    expiresInMinutes,
  });
}
