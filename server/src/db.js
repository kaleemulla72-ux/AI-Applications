import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'beauty-parlour.sqlite');

export const db = await open({
  filename: dbPath,
  driver: sqlite3.Database
});

await db.exec('PRAGMA foreign_keys = ON');

export async function initDb() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      description TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      staff_id INTEGER,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      parlour_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      whatsapp_link TEXT NOT NULL,
      instagram_link TEXT NOT NULL,
      address TEXT NOT NULL,
      opening_hours TEXT NOT NULL,
      google_maps_url TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS gallery_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      media_type TEXT NOT NULL,
      url TEXT NOT NULL,
      original_name TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureBusinessSettingsColumns();

  await seedServices();
  await seedStaff();
  await seedBusinessSettings();
}

async function ensureBusinessSettingsColumns() {
  const columns = await db.all('PRAGMA table_info(business_settings)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('google_maps_url')) {
    await db.run('ALTER TABLE business_settings ADD COLUMN google_maps_url TEXT');
  }
}

async function seedServices() {
  const existing = await db.get('SELECT COUNT(*) as count FROM services');
  if (existing.count) return;

  const services = [
    ['Haircut', 500, 45, 'A neat haircut with basic styling and consultation.'],
    ['Facial', 1200, 60, 'Refreshing facial cleanup for a soft, bright look.'],
    ['Threading', 150, 15, 'Eyebrow and upper-lip threading with clean finishing.'],
    ['Waxing', 800, 45, 'Smooth waxing service with gentle aftercare.'],
    ['Hair Spa', 1500, 75, 'Deep conditioning hair spa for shine and softness.'],
    ['Party Makeup', 3500, 90, 'Glam makeup for parties, receptions, and special events.'],
    ['Bridal Makeup', 12000, 180, 'Complete bridal makeup package with draping and hairstyling.'],
    ['Mehendi', 1000, 60, 'Beautiful mehendi designs for occasions and celebrations.']
  ];

  const stmt = await db.prepare('INSERT INTO services (name, price, duration, description) VALUES (?, ?, ?, ?)');
  for (const service of services) await stmt.run(service);
  await stmt.finalize();
}

async function seedStaff() {
  const existing = await db.get('SELECT COUNT(*) as count FROM staff');
  if (existing.count) return;

  await db.run('INSERT INTO staff (name, role, phone) VALUES (?, ?, ?)', [
    'Linaz Team',
    'Beauty Specialist',
    '+91 98765 43210'
  ]);
}

async function seedBusinessSettings() {
  await db.run(
    `INSERT OR IGNORE INTO business_settings
      (id, parlour_name, phone_number, whatsapp_link, instagram_link, address, opening_hours, google_maps_url)
     VALUES
      (1, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'Linaz Beauty Parlour',
      '+91 98765 43210',
      'https://wa.me/919876543210',
      'https://instagram.com/linazbeautyparlour',
      'Main Road, Hyderabad, Telangana',
      'Mon-Sat: 10:00 AM - 8:00 PM, Sun: 11:00 AM - 5:00 PM',
      'https://maps.app.goo.gl/VqzRGafkd6t3LWMVA'
    ]
  );
}

export async function getBusinessSettings() {
  return db.get('SELECT * FROM business_settings WHERE id = 1');
}

export async function createAppointment({ name, phone, serviceId, date, time, notes = null }) {
  const service = await db.get('SELECT * FROM services WHERE id = ? AND active = 1', [serviceId]);
  if (!service) {
    const error = new Error('Selected service is unavailable.');
    error.status = 400;
    throw error;
  }

  const existing = await db.get(
    `SELECT id FROM appointments
     WHERE service_id = ? AND date = ? AND time = ? AND status IN ('pending', 'confirmed')`,
    [serviceId, date, time]
  );
  if (existing) {
    const error = new Error('That slot is already booked. Please choose another time.');
    error.status = 409;
    throw error;
  }

  await db.run(
    `INSERT INTO customers (name, phone)
     VALUES (?, ?)
     ON CONFLICT(phone) DO UPDATE SET name = excluded.name`,
    [name, phone]
  );

  const customer = await db.get('SELECT id FROM customers WHERE phone = ?', [phone]);
  const result = await db.run(
    'INSERT INTO appointments (customer_id, service_id, date, time, notes) VALUES (?, ?, ?, ?, ?)',
    [customer.id, serviceId, date, time, notes]
  );

  return db.get(
    `SELECT a.*, c.name as customer_name, c.phone as customer_phone,
            s.name as service_name, s.price as service_price, s.duration as service_duration
     FROM appointments a
     JOIN customers c ON c.id = a.customer_id
     JOIN services s ON s.id = a.service_id
     WHERE a.id = ?`,
    [result.lastID]
  );
}
