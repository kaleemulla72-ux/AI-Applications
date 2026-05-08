# Linaz Beauty Parlour Web App

Mobile-first beauty parlour MVP with a React customer website, floating AI chat widget, appointment booking, social links, and an Express + SQLite admin dashboard.

## Features

- Customer homepage with services, prices, duration, descriptions, contact details, WhatsApp link, and Instagram link
- Floating AI receptionist chat widget
- Appointment booking form
- Admin login page
- Admin appointment dashboard with all/today filters and status updates
- Admin summary cards for today's bookings, upcoming bookings, expected revenue, and cancelled bookings
- Service and staff management
- Business settings editor
- SQLite database seeded with sample beauty parlour services

## Tech Stack

- React + Vite frontend
- Node.js + Express backend
- SQLite database
- OpenAI API for chatbot responses, with a local fallback when no API key is set

## Setup

1. Install root helper dependencies:

   ```bash
   npm install
   ```

2. Install frontend and backend dependencies:

   ```bash
   npm run install:all
   ```

3. Create environment files:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item server/.env.example server/.env
   Copy-Item client/.env.example client/.env
   ```

4. Set your admin password and optionally add your OpenAI key in `server/.env`:

   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=choose-a-private-password
   OPENAI_API_KEY=your_api_key_here
   OPENAI_MODEL=gpt-4o-mini
   ```

   The app still runs without `OPENAI_API_KEY`, but chat replies use the built-in local receptionist fallback.

5. Start both apps:

   ```bash
   npm run dev
   ```

6. Open:

   - Customer app: `http://localhost:5173`
   - Backend API: `http://localhost:5050`

## Admin Login

Admin credentials are configured in your local `server/.env` file:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose-a-private-password
```

Use a private password before sharing the app on your network.

## Environment Variables

Backend, `server/.env`:

```env
PORT=5050
CLIENT_ORIGIN=http://localhost:5173
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose-a-private-password
```

Frontend, `client/.env`:

```env
VITE_API_URL=http://localhost:5050
```

## API Endpoints

- `GET /services`
- `POST /services`
- `PATCH /services/:id`
- `GET /appointments`
- `POST /appointments`
- `PATCH /appointments/:id/status`
- `GET /staff`
- `POST /staff`
- `POST /chat/message`
- `GET /dashboard/summary`
- `GET /business-settings`
- `PATCH /business-settings`
- `POST /admin/login`

## Chat Booking Format

The AI chat can create bookings automatically when a customer provides all required details in one message:

```text
My name is Aisha, phone 9876543210, book Facial on 2026-05-10 at 14:30
```

Required booking details are name, phone number, service, date, and time.
