import nodemailer from 'nodemailer';
import { getBusinessSettings } from './db.js';

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASS
    && process.env.APPOINTMENT_ALERT_EMAIL
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function formatAppointmentText(appointment, settings) {
  return [
    `New appointment for ${settings.parlour_name}`,
    '',
    `Customer: ${appointment.customer_name}`,
    `Phone: ${appointment.customer_phone}`,
    `Service: ${appointment.service_name}`,
    `Date: ${appointment.date}`,
    `Time: ${appointment.time}`,
    `Price: Rs.${appointment.service_price}`,
    `Duration: ${appointment.service_duration} mins`,
    `Status: ${appointment.status}`,
    appointment.notes ? `Notes: ${appointment.notes}` : null
  ].filter(Boolean).join('\n');
}

function formatAppointmentHtml(appointment, settings) {
  const notes = appointment.notes
    ? `<tr><td style="padding:8px 0;color:#6f5962;">Notes</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.notes)}</td></tr>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;color:#2a1f25;line-height:1.5;">
      <h2 style="color:#7d2742;margin:0 0 12px;">New appointment for ${escapeHtml(settings.parlour_name)}</h2>
      <table style="border-collapse:collapse;width:100%;max-width:560px;">
        <tr><td style="padding:8px 0;color:#6f5962;">Customer</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.customer_name)}</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Phone</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.customer_phone)}</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Service</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.service_name)}</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Date</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.date)}</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Time</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.time)}</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Price</td><td style="padding:8px 0;font-weight:700;">Rs.${escapeHtml(String(appointment.service_price))}</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Duration</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(String(appointment.service_duration))} mins</td></tr>
        <tr><td style="padding:8px 0;color:#6f5962;">Status</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(appointment.status)}</td></tr>
        ${notes}
      </table>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendAppointmentNotification(appointment) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'Email notifications are not configured.' };
  }

  const settings = await getBusinessSettings();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to: process.env.APPOINTMENT_ALERT_EMAIL,
    replyTo: appointment.customer_phone ? undefined : from,
    subject: `New booking: ${appointment.customer_name} - ${appointment.service_name}`,
    text: formatAppointmentText(appointment, settings),
    html: formatAppointmentHtml(appointment, settings)
  });

  return { sent: true };
}
