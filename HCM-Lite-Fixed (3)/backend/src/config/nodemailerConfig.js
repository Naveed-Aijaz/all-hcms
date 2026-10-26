
import nodemailer from 'nodemailer';

export function createMailTransport() {
  const {
    SMTP_HOST,
    SMTP_PORT = '587',
    SMTP_SECURE = 'false',
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP environment variables are not configured');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}