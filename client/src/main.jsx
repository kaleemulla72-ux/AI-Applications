import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CalendarCheck,
  Check,
  Clock,
  Pencil,
  Trash2,
  Instagram,
  LayoutDashboard,
  MessageCircle,
  Phone,
  Plus,
  Scissors,
  Send,
  Sparkles,
  UserRound,
  X
} from 'lucide-react';
import './styles.css';

const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = import.meta.env.VITE_API_URL
  || (isLocalHost ? 'http://localhost:5050' : `${window.location.protocol}//${window.location.hostname}:5050`);

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function App() {
  const [view, setView] = useState('home');
  return (
    <>
      {view === 'home' ? <CustomerApp onAdmin={() => setView('admin')} /> : <AdminApp onHome={() => setView('home')} />}
    </>
  );
}

function CustomerApp({ onAdmin }) {
  const [services, setServices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [booking, setBooking] = useState({ name: '', phone: '', serviceId: '', date: '', time: '', notes: '' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([api('/services'), api('/business-settings')])
      .then(([serviceData, settingData]) => {
        setServices(serviceData);
        setSettings(settingData);
        setBooking((current) => ({ ...current, serviceId: serviceData[0]?.id || '' }));
      })
      .catch((error) => setNotice(error.message));
  }, []);

  async function submitBooking(event) {
    event.preventDefault();
    setNotice('Creating your booking...');
    try {
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({ ...booking, serviceId: Number(booking.serviceId) })
      });
      setNotice('Booking created. The owner will confirm if any adjustment is needed.');
      setBooking({ name: '', phone: '', serviceId: services[0]?.id || '', date: '', time: '', notes: '' });
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Linaz Beauty Parlour home">
          <Sparkles size={22} />
          <span>{settings?.parlour_name || 'Linaz Beauty Parlour'}</span>
        </a>
        <nav>
          <a href="#services">Services</a>
          <a href="#book">Book</a>
          <a href="#contact">Contact</a>
          <button className="ghost-button" onClick={onAdmin}>
            <LayoutDashboard size={17} />
            Admin
          </button>
        </nav>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Salon appointments, made easy</p>
            <h1>{settings?.parlour_name || 'Linaz Beauty Parlour'}</h1>
            <p>Beauty services, makeup packages, mehendi, hair care, and quick appointment booking from your phone.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#book">
                <CalendarCheck size={18} />
                Book Appointment
              </a>
              <a className="secondary-button" href="#services">
                <Scissors size={18} />
                View Services
              </a>
            </div>
          </div>
          <div className="hero-panel" aria-label="Featured bridal makeup package">
            <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80" alt="Beauty parlour styling station" />
            <div>
              <span>Featured</span>
              <strong>Bridal Makeup</strong>
              <small>Complete event-ready look with styling and draping.</small>
            </div>
          </div>
        </section>

        <section className="section" id="services">
          <div className="section-heading">
            <p className="eyebrow">Menu</p>
            <h2>Services & Prices</h2>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.id}>
                <div className="service-title">
                  <h3>{service.name}</h3>
                  <strong>₹{service.price}</strong>
                </div>
                <p>{service.description}</p>
                <span><Clock size={15} /> {service.duration} mins</span>
              </article>
            ))}
          </div>
        </section>

        <section className="booking-section" id="book">
          <div>
            <p className="eyebrow">Appointments</p>
            <h2>Book Your Visit</h2>
            <p>Choose a service and preferred time. Your booking is saved instantly as pending until the owner confirms.</p>
          </div>
          <form className="booking-form" onSubmit={submitBooking}>
            <label>Name<input required value={booking.name} onChange={(event) => setBooking({ ...booking, name: event.target.value })} /></label>
            <label>Phone<input required value={booking.phone} onChange={(event) => setBooking({ ...booking, phone: event.target.value })} /></label>
            <label>Service<select required value={booking.serviceId} onChange={(event) => setBooking({ ...booking, serviceId: event.target.value })}>{services.map((service) => <option key={service.id} value={service.id}>{service.name} - ₹{service.price}</option>)}</select></label>
            <div className="form-row">
              <label>Date<input required type="date" value={booking.date} onChange={(event) => setBooking({ ...booking, date: event.target.value })} /></label>
              <label>Time<input required type="time" value={booking.time} onChange={(event) => setBooking({ ...booking, time: event.target.value })} /></label>
            </div>
            <label>Notes<textarea value={booking.notes} onChange={(event) => setBooking({ ...booking, notes: event.target.value })} /></label>
            <button className="primary-button" type="submit"><CalendarCheck size={18} /> Confirm Booking</button>
            {notice && <p className="notice">{notice}</p>}
          </form>
        </section>

        <section className="contact-section" id="contact">
          <div>
            <p className="eyebrow">Contact</p>
            <h2>Visit or Message Us</h2>
            <p>{settings?.address}</p>
          </div>
          <div className="contact-list">
            <a href={`tel:${settings?.phone_number}`}><Phone size={18} /> {settings?.phone_number}</a>
            <span><Clock size={18} /> {settings?.opening_hours}</span>
            <a href={settings?.whatsapp_link} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp</a>
            <a href={settings?.instagram_link} target="_blank" rel="noreferrer"><Instagram size={18} /> Instagram</a>
          </div>
        </section>
      </main>

      {settings && <SocialBar settings={settings} />}
      <ChatWidget services={services} />
    </div>
  );
}

function SocialBar({ settings }) {
  return (
    <div className="social-bar">
      <a href={settings.whatsapp_link} target="_blank" rel="noreferrer"><MessageCircle size={19} /> WhatsApp</a>
      <a href={settings.instagram_link} target="_blank" rel="noreferrer"><Instagram size={19} /> Instagram</a>
    </div>
  );
}

function ChatWidget({ services }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi, I can help with service prices, packages, and bookings. What would you like today?' }
  ]);
  const sessionId = useMemo(() => createSessionId(), []);

  async function sendMessage(event) {
    event.preventDefault();
    if (!message.trim()) return;
    const nextMessage = message.trim();
    setMessages((items) => [...items, { role: 'user', content: nextMessage }]);
    setMessage('');
    setBusy(true);
    try {
      const result = await api('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message: nextMessage })
      });
      setMessages((items) => [...items, { role: 'assistant', content: result.reply }]);
    } catch (error) {
      setMessages((items) => [...items, { role: 'assistant', content: error.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <aside className="chat-window">
          <header>
            <div><strong>AI Receptionist</strong><span>{services.length} services available</span></div>
            <button aria-label="Close chat" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          <div className="chat-messages">
            {messages.map((item, index) => <p className={item.role} key={`${item.role}-${index}`}>{item.content}</p>)}
            {busy && <p className="assistant">Checking that for you...</p>}
          </div>
          <form onSubmit={sendMessage}>
            <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about prices or book..." />
            <button aria-label="Send message" type="submit"><Send size={18} /></button>
          </form>
        </aside>
      )}
      <button className="chat-fab" aria-label="Open AI chat" onClick={() => setOpen(true)}>
        <MessageCircle size={25} />
      </button>
    </>
  );
}

function AdminApp({ onHome }) {
  const [adminToken, setAdminToken] = useState('');
  return adminToken
    ? <Dashboard adminToken={adminToken} onHome={onHome} onLogout={() => setAdminToken('')} />
    : <AdminLogin onLogin={setAdminToken} onHome={onHome} />;
}

function AdminLogin({ onLogin, onHome }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    try {
      const result = await api('/admin/login', { method: 'POST', body: JSON.stringify(form) });
      onLogin(result.token);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="admin-login">
      <form onSubmit={submit}>
        <Sparkles size={30} />
        <h1>Admin Login</h1>
        <label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <button className="primary-button">Login</button>
        <button type="button" className="ghost-button" onClick={onHome}>Back to Site</button>
        {error && <p className="notice error">{error}</p>}
      </form>
    </main>
  );
}

function Dashboard({ adminToken, onHome, onLogout }) {
  const settingFields = ['parlour_name', 'phone_number', 'whatsapp_link', 'instagram_link', 'address', 'opening_hours'];
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [settings, setSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [newService, setNewService] = useState({ name: '', price: '', duration: '', description: '' });
  const [editingService, setEditingService] = useState(null);
  const [newStaff, setNewStaff] = useState({ name: '', role: '', phone: '' });
  const [tab, setTab] = useState('all');
  const [adminNotice, setAdminNotice] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const adminApi = (path, options = {}) => api(path, {
    ...options,
    headers: { Authorization: `Bearer ${adminToken}`, ...(options.headers || {}) }
  });

  function handleAdminError(error) {
    if (error.message === 'Admin login required.') {
      onLogout();
      return;
    }
    setAdminNotice(error.message);
  }

  const load = () => Promise.all([
    adminApi(`/appointments${tab === 'today' ? '?today=true' : ''}`),
    adminApi('/dashboard/summary'),
    api('/services'),
    adminApi('/staff'),
    api('/business-settings')
  ]).then(([appointmentData, summaryData, serviceData, staffData, settingData]) => {
    setAppointments(appointmentData);
    setSummary(summaryData);
    setServices(serviceData);
    setStaff(staffData);
    setSettings(settingData);
    setSettingsDraft(settingData);
  });

  useEffect(() => {
    load().catch(handleAdminError);
  }, [tab]);

  async function updateStatus(id, status) {
    try {
      await adminApi(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function addService(event) {
    event.preventDefault();
    try {
      const formData = new FormData(event.currentTarget);
      const payload = {
        name: formData.get('name') || '',
        price: formData.get('price') || '',
        duration: formData.get('duration') || '',
        description: formData.get('description') || ''
      };
      const service = await adminApi('/services', { method: 'POST', body: JSON.stringify(payload) });
      setNewService({ name: '', price: '', duration: '', description: '' });
      setAdminNotice(`Service added: ${service.name}`);
      await load();
    } catch (error) {
      handleAdminError(error);
    }
  }

  function startEditService(service) {
    setEditingService({
      id: service.id,
      name: service.name,
      price: service.price,
      duration: service.duration,
      description: service.description
    });
  }

  async function updateService(event) {
    event.preventDefault();
    try {
      const formData = new FormData(event.currentTarget);
      const payload = {
        name: formData.get('name') || '',
        price: formData.get('price') || '',
        duration: formData.get('duration') || '',
        description: formData.get('description') || ''
      };
      await adminApi(`/services/${editingService.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setAdminNotice(`Service updated: ${payload.name}`);
      setEditingService(null);
      await load();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function deleteService(service) {
    if (!window.confirm(`Delete ${service.name}? Existing appointments will stay in history.`)) return;
    try {
      const result = await adminApi(`/services/${service.id}`, { method: 'DELETE' });
      setAdminNotice(`Service deleted: ${result.name}`);
      if (editingService?.id === service.id) setEditingService(null);
      await load();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function addStaff(event) {
    event.preventDefault();
    try {
      const formData = new FormData(event.currentTarget);
      const payload = {
        name: formData.get('name') || '',
        role: formData.get('role') || '',
        phone: formData.get('phone') || ''
      };
      const staffMember = await adminApi('/staff', { method: 'POST', body: JSON.stringify(payload) });
      setNewStaff({ name: '', role: '', phone: '' });
      setAdminNotice(`Staff added: ${staffMember.name}`);
      await load();
    } catch (error) {
      handleAdminError(error);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSettingsSaving(true);
    setAdminNotice('Saving settings...');
    try {
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(settingFields.map((key) => [key, formData.get(key) || '']));
      const savedSettings = await adminApi('/business-settings', { method: 'PATCH', body: JSON.stringify(payload) });
      setSettings(savedSettings);
      setSettingsDraft(savedSettings);
      setAdminNotice(`Settings saved: ${savedSettings.address}`);
    } catch (error) {
      handleAdminError(error);
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div><p className="eyebrow">Owner</p><h1>Admin Dashboard</h1></div>
        <div className="form-actions">
          <button className="ghost-button" onClick={onLogout}>Logout</button>
          <button className="ghost-button" onClick={onHome}>Customer Site</button>
        </div>
      </header>

      <section className="summary-grid">
        <SummaryCard label="Today" value={summary?.todayBookings || 0} />
        <SummaryCard label="Upcoming" value={summary?.upcomingBookings || 0} />
        <SummaryCard label="Revenue" value={`₹${summary?.expectedRevenue || 0}`} />
        <SummaryCard label="Cancelled" value={summary?.cancelledBookings || 0} />
      </section>

      {adminNotice && <p className="notice">{adminNotice}</p>}

      <section className="admin-section">
        <div className="tabs">
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All Appointments</button>
          <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>Today</button>
        </div>
        <div className="appointment-list">
          {appointments.map((appointment) => (
            <article className="appointment-card" key={appointment.id}>
              <div>
                <strong>{appointment.customer_name}</strong>
                <span>{appointment.customer_phone}</span>
                <p>{appointment.service_name} · {appointment.date} at {appointment.time}</p>
              </div>
              <select value={appointment.status} onChange={(event) => updateStatus(appointment.id, event.target.value)}>
                <option>pending</option>
                <option>confirmed</option>
                <option>completed</option>
                <option>cancelled</option>
              </select>
            </article>
          ))}
          {!appointments.length && <p className="empty-state">No appointments found.</p>}
        </div>
      </section>

      <section className="admin-columns">
        <form className="admin-form" onSubmit={addService}>
          <h2>Manage Services</h2>
          <input required name="name" placeholder="Service name" value={newService.name} onChange={(event) => setNewService({ ...newService, name: event.target.value })} />
          <input required name="price" type="number" placeholder="Price" value={newService.price} onChange={(event) => setNewService({ ...newService, price: event.target.value })} />
          <input required name="duration" type="number" placeholder="Duration minutes" value={newService.duration} onChange={(event) => setNewService({ ...newService, duration: event.target.value })} />
          <textarea required name="description" placeholder="Description" value={newService.description} onChange={(event) => setNewService({ ...newService, description: event.target.value })} />
          <button type="submit"><Plus size={17} /> Add Service</button>
        </form>

        <form className="admin-form" onSubmit={editingService ? updateService : (event) => event.preventDefault()}>
          <h2>Edit Services</h2>
          {!editingService ? (
            <div className="service-edit-list">
              {services.map((service) => (
                <div className="service-edit-row" key={service.id}>
                  <button className="service-edit-button" type="button" onClick={() => startEditService(service)}>
                    <span>{service.name} - Rs.{service.price}</span>
                    <Pencil size={16} />
                  </button>
                  <button className="icon-danger-button" type="button" aria-label={`Delete ${service.name}`} onClick={() => deleteService(service)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <input required name="name" placeholder="Service name" value={editingService.name} onChange={(event) => setEditingService({ ...editingService, name: event.target.value })} />
              <input required name="price" type="number" placeholder="Price" value={editingService.price} onChange={(event) => setEditingService({ ...editingService, price: event.target.value })} />
              <input required name="duration" type="number" placeholder="Duration minutes" value={editingService.duration} onChange={(event) => setEditingService({ ...editingService, duration: event.target.value })} />
              <textarea required name="description" placeholder="Description" value={editingService.description} onChange={(event) => setEditingService({ ...editingService, description: event.target.value })} />
              <div className="form-actions">
                <button type="submit"><Check size={17} /> Save Changes</button>
                <button className="ghost-button" type="button" onClick={() => setEditingService(null)}><X size={17} /> Cancel</button>
              </div>
            </>
          )}
        </form>

        <form className="admin-form" onSubmit={addStaff}>
          <h2>Manage Staff</h2>
          <input required name="name" placeholder="Staff name" value={newStaff.name} onChange={(event) => setNewStaff({ ...newStaff, name: event.target.value })} />
          <input required name="role" placeholder="Role" value={newStaff.role} onChange={(event) => setNewStaff({ ...newStaff, role: event.target.value })} />
          <input name="phone" placeholder="Phone" value={newStaff.phone} onChange={(event) => setNewStaff({ ...newStaff, phone: event.target.value })} />
          <button type="submit"><UserRound size={17} /> Add Staff</button>
          <div className="mini-list">{staff.map((member) => <span key={member.id}>{member.name} · {member.role}</span>)}</div>
        </form>
      </section>

      {settingsDraft && (
        <form className="settings-form" onSubmit={saveSettings}>
          <h2>Business Settings</h2>
          {settingFields.map((key) => (
            <label key={key}>{key.replaceAll('_', ' ')}
              {key === 'address' || key === 'opening_hours' ? (
                <textarea name={key} value={settingsDraft[key] || ''} onChange={(event) => setSettingsDraft((current) => ({ ...current, [key]: event.target.value }))} />
              ) : (
                <input name={key} value={settingsDraft[key] || ''} onChange={(event) => setSettingsDraft((current) => ({ ...current, [key]: event.target.value }))} />
              )}
            </label>
          ))}
          <button className="primary-button" type="submit" disabled={settingsSaving}>
            {settingsSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong></article>;
}

createRoot(document.getElementById('root')).render(<App />);
