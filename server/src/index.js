import 'dotenv/config';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { createAppointment, db, getBusinessSettings, initDb } from './db.js';
import { handleChatMessage } from './chat.js';
import { listGoogleReviews } from './googleBusiness.js';
import { sendAppointmentNotification } from './notifications.js';

await initDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist');
const uploadsPath = process.env.UPLOADS_PATH || path.resolve(__dirname, '..', 'uploads');

const app = express();
const port = process.env.PORT || 5050;
const adminSessionToken = process.env.ADMIN_SESSION_TOKEN || randomBytes(32).toString('hex');

fs.mkdirSync(uploadsPath, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsPath,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: Number(process.env.GALLERY_UPLOAD_MAX_MB || 80) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image and video uploads are allowed.'));
  }
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use('/uploads', express.static(uploadsPath));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireAdmin(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token !== adminSessionToken) {
    return res.status(401).json({ error: 'Admin login required.' });
  }
  next();
}

app.get('/services', asyncHandler(async (_req, res) => {
  const services = await db.all('SELECT * FROM services WHERE active = 1 ORDER BY id');
  res.json(services);
}));

app.post('/services', requireAdmin, asyncHandler(async (req, res) => {
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

app.patch('/services/:id', requireAdmin, asyncHandler(async (req, res) => {
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

app.delete('/services/:id', requireAdmin, asyncHandler(async (req, res) => {
  const current = await db.get('SELECT * FROM services WHERE id = ? AND active = 1', [req.params.id]);
  if (!current) return res.status(404).json({ error: 'Service not found.' });

  await db.run('UPDATE services SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true, id: Number(req.params.id), name: current.name });
}));

app.get('/appointments', requireAdmin, asyncHandler(async (req, res) => {
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
  sendAppointmentNotification(appointment).catch((error) => {
    console.error('Appointment email notification failed:', error.message);
  });
  res.status(201).json(appointment);
}));

app.patch('/appointments/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  await db.run('UPDATE appointments SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
  res.json(appointment);
}));

app.get('/staff', requireAdmin, asyncHandler(async (_req, res) => {
  const staff = await db.all('SELECT * FROM staff WHERE active = 1 ORDER BY id');
  res.json(staff);
}));

app.post('/staff', requireAdmin, asyncHandler(async (req, res) => {
  const { name, role, phone } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role are required.' });
  const result = await db.run('INSERT INTO staff (name, role, phone) VALUES (?, ?, ?)', [name, role, phone || null]);
  const staff = await db.get('SELECT * FROM staff WHERE id = ?', [result.lastID]);
  res.status(201).json(staff);
}));

app.get('/gallery', asyncHandler(async (_req, res) => {
  const media = await db.all('SELECT * FROM gallery_media WHERE active = 1 ORDER BY created_at DESC, id DESC');
  res.json(media);
}));

app.post('/gallery', requireAdmin, upload.single('media'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image or video to upload.' });

  const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  const title = String(req.body.title || '').trim();
  const mediaUrl = `/uploads/${req.file.filename}`;
  const result = await db.run(
    'INSERT INTO gallery_media (title, media_type, url, original_name) VALUES (?, ?, ?, ?)',
    [title || null, mediaType, mediaUrl, req.file.originalname]
  );
  const item = await db.get('SELECT * FROM gallery_media WHERE id = ?', [result.lastID]);
  res.status(201).json(item);
}));

app.delete('/gallery/:id', requireAdmin, asyncHandler(async (req, res) => {
  const item = await db.get('SELECT * FROM gallery_media WHERE id = ? AND active = 1', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Gallery item not found.' });

  await db.run('UPDATE gallery_media SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true, id: Number(req.params.id), title: item.title, url: item.url });
}));

app.post('/chat/message', asyncHandler(async (req, res) => {
  const { sessionId = 'guest', message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  const result = await handleChatMessage({ sessionId, message });
  res.json(result);
}));

app.get('/dashboard/summary', requireAdmin, asyncHandler(async (_req, res) => {
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

app.patch('/business-settings', requireAdmin, asyncHandler(async (req, res) => {
  const current = await getBusinessSettings();
  const next = { ...current, ...req.body };
  const required = ['parlour_name', 'phone_number', 'whatsapp_link', 'instagram_link', 'address', 'opening_hours'];
  if (required.some((key) => !String(next[key] || '').trim())) {
    return res.status(400).json({ error: 'All business settings fields are required.' });
  }

  await db.run(
    `UPDATE business_settings
     SET parlour_name = ?, phone_number = ?, whatsapp_link = ?, instagram_link = ?,
         address = ?, opening_hours = ?, google_maps_url = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [
      next.parlour_name.trim(),
      next.phone_number.trim(),
      next.whatsapp_link.trim(),
      next.instagram_link.trim(),
      next.address.trim(),
      next.opening_hours.trim(),
      String(next.google_maps_url || '').trim()
    ]
  );
  res.json(await getBusinessSettings());
}));

app.get('/google-reviews', asyncHandler(async (_req, res) => {
  res.json(await listGoogleReviews());
}));

app.post('/admin/login', (req, res) => {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    return res.status(503).json({ error: 'Admin login is not configured.' });
  }

  const ok = req.body.username === adminUsername
    && req.body.password === adminPassword;
  if (!ok) return res.status(401).json({ error: 'Invalid admin credentials.' });
  res.json({ ok: true, token: adminSessionToken });
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
