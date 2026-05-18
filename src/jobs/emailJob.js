import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const isMockProvider = config.emailProvider === 'mock';
const isSmtpProvider = config.emailProvider === 'smtp';

let transporter;

if (isSmtpProvider) {
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    auth: config.smtpUser && config.smtpPass ? {
      user: config.smtpUser,
      pass: config.smtpPass,
    } : undefined,
  });
}

function renderEmailTemplate(template, data) {
  const templates = {
    password_reset: (d) => `
      <html>
        <body>
          <h2>Reset Your Password</h2>
          <p>Click the link below to reset your password. This link expires in ${d.expiresInMinutes} minutes.</p>
          <a href="${d.resetUrl}">Reset Password</a>
          <p>If you didn't request a password reset, you can ignore this email.</p>
        </body>
      </html>
    `,
    otp_verification: (d) => `
      <html>
        <body>
          <h2>Verify Your Identity</h2>
          <p>Your one-time password (OTP) is:</p>
          <h1 style="letter-spacing: 5px; font-size: 28px; font-weight: bold;">${d.code}</h1>
          <p>This code expires in ${d.expiresInMinutes} minutes.</p>
          <p>If you didn't request this code, you can ignore this email.</p>
        </body>
      </html>
    `,
  };

  const templateFn = templates[template];
  if (!templateFn) {
    throw new Error(`Unknown email template: ${template}`);
  }

  return templateFn(data);
}

async function sendEmailDirect(to, subject, template, data) {
  if (isMockProvider) {
    logger.info({
      type: 'email_mock',
      to,
      subject,
      template,
      message: 'Email sent via mock provider',
    });
    return { success: true, mock: true };
  }

  if (!isSmtpProvider) {
    logger.warn('Email provider not configured, skipping email');
    return { success: false, reason: 'Email provider not configured' };
  }

  try {
    const html = renderEmailTemplate(template, data);
    await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      html,
    });
    logger.info({ type: 'email_sent', to, template });
    return { success: true };
  } catch (err) {
    logger.error({ type: 'email_failed', to, template, error: err.message });
    return { success: false, error: err.message };
  }
}

export async function enqueuePasswordResetEmail(to, resetToken, expiresInMinutes) {
  if (config.isTesting) {
    return { success: true, devMode: true };
  }

  const resetUrl = `${config.frontendResetPasswordUrl}?token=${resetToken}`;

  return sendEmailDirect(to, 'Reset Your Password', 'password_reset', {
    resetUrl,
    expiresInMinutes,
  });
}

export async function enqueueOtpEmail(to, code, expiresInMinutes) {
  if (config.isTesting) {
    return { success: true, devMode: true };
  }

  return sendEmailDirect(to, 'Verify Your Identity - OTP', 'otp_verification', {
    code,
    expiresInMinutes,
  });
}
