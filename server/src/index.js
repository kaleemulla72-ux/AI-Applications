import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { createAppointment, db, getBusinessSettings, initDb } from './db.js';
import { handleChatMessage } from './chat.js';

await initDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');

const app = express();
const port = process.env.PORT || 5050;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

app.get('/services', asyncHandler(async (_req, res) => {
  const services = await db.all('SELECT * FROM services WHERE active = 1 ORDER BY id');
  res.json(services);
}));

app.post('/services', asyncHandler(async (req, res) => {
  const { name, price, duration, description } = req.body;
  if (!name || !price || !duration || !description) {
    return res.status(400).json({ error: 'Name, price, duration, and description are required.' });
  }
  const result = await db.run(
    'INSERT INTO services (name, price, duration, description) VALUES (?, ?, ?, ?)',
    [name, Number(price), Number(duration), description]
  );
  const service = await db.get('SELECT * FROM services WHERE id = ?', [result.lastID]);
  res.status(201).json(service);
}));

app.patch('/services/:id', asyncHandler(async (req, res) => {
  const current = await db.get('SELECT * FROM services WHERE id = ? AND active = 1', [req.params.id]);
  if (!current) return res.status(404).json({ error: 'Service not found.' });

  const next = { ...current, ...req.body };
  if (!next.name || !next.price || !next.duration || !next.description) {
    return res.status(400).json({ error: 'Name, price, duration, and description are required.' });
  }

  await db.run(
    'UPDATE services SET name = ?, price = ?, duration = ?, description = ? WHERE id = ?',
    [next.name, Number(next.price), Number(next.duration), next.description, req.params.id]
  );
  const service = await db.get('SELECT * FROM services WHERE id = ?', [req.params.id]);
  res.json(service);
}));

app.get('/appointments', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const where = req.query.today === 'true' ? 'WHERE a.date = ?' : '';
  const params = req.query.today === 'true' ? [today] : [];
  const appointments = await db.all(
    `SELECT a.*, c.name as customer_name, c.phone as customer_phone,
            s.name as service_name, s.price as service_price, s.duration as service_duration,
            st.name as staff_name
     FROM appointments a
     JOIN customers c ON c.id = a.customer_id
     JOIN services s ON s.id = a.service_id
     LEFT JOIN staff st ON st.id = a.staff_id
     ${where}
     ORDER BY a.date ASC, a.time ASC`,
    params
  );
  res.json(appointments);
}));

app.post('/appointments', asyncHandler(async (req, res) => {
  const { name, phone, serviceId, date, time, notes } = req.body;
  if (!name || !phone || !serviceId || !date || !time) {
    return res.status(400).json({ error: 'Name, phone, service, date, and time are required.' });
  }
  const appointment = await createAppointment({ name, phone, serviceId, date, time, notes });
  res.status(201).json(appointment);
}));

app.patch('/appointments/:id/status', asyncHandler(async (req, res) => {
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  await db.run('UPDATE appointments SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
  res.json(appointment);
}));

app.get('/staff', asyncHandler(async (_req, res) => {
  const staff = await db.all('SELECT * FROM staff WHERE active = 1 ORDER BY id');
  res.json(staff);
}));

app.post('/staff', asyncHandler(async (req, res) => {
  const { name, role, phone } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role are required.' });
  const result = await db.run('INSERT INTO staff (name, role, phone) VALUES (?, ?, ?)', [name, role, phone || null]);
  const staff = await db.get('SELECT * FROM staff WHERE id = ?', [result.lastID]);
  res.status(201).json(staff);
}));

app.post('/chat/message', asyncHandler(async (req, res) => {
  const { sessionId = 'guest', message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const result = await handleChatMessage({ sessionId, message });
  res.json(result);
}));

app.get('/dashboard/summary', asyncHandler(async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const [todayBookings, upcomingBookings, expectedRevenue, cancelledBookings] = await Promise.all([
    db.get("SELECT COUNT(*) as count FROM appointments WHERE date = ? AND status != 'cancelled'", [today]),
    db.get("SELECT COUNT(*) as count FROM appointments WHERE date >= ? AND status IN ('pending', 'confirmed')", [today]),
    db.get(`SELECT COALESCE(SUM(s.price), 0) as total
            FROM appointments a JOIN services s ON s.id = a.service_id
            WHERE a.date >= ? AND a.status IN ('pending', 'confirmed', 'completed')`, [today]),
    db.get("SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'")
  ]);
  res.json({
    todayBookings: todayBookings.count,
    upcomingBookings: upcomingBookings.count,
    expectedRevenue: expectedRevenue.total,
    cancelledBookings: cancelledBookings.count
  });
}));

app.get('/business-settings', asyncHandler(async (_req, res) => {
  res.json(await getBusinessSettings());
}));

app.patch('/business-settings', asyncHandler(async (req, res) => {
  const current = await getBusinessSettings();
  const next = { ...current, ...req.body };
  await db.run(
    `UPDATE business_settings
     SET parlour_name = ?, phone_number = ?, whatsapp_link = ?, instagram_link = ?,
         address = ?, opening_hours = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [next.parlour_name, next.phone_number, next.whatsapp_link, next.instagram_link, next.address, next.opening_hours]
  );
  res.json(await getBusinessSettings());
}));

app.post('/admin/login', (req, res) => {
  const ok = req.body.username === (process.env.ADMIN_USERNAME || 'admin')
    && req.body.password === (process.env.ADMIN_PASSWORD || 'admin123');
  if (!ok) return res.status(401).json({ error: 'Invalid admin credentials.' });
  res.json({ ok: true });
});

app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.accepts('html')) return res.sendFile(path.join(clientDistPath, 'index.html'));
  return next();
});

app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

app.listen(port, () => {
  console.log(`Beauty parlour API running on http://localhost:${port}`);
});
