# Linaz Beauty Parlour Web App

Mobile-first beauty parlour MVP with a React customer website, floating AI chat widget, appointment booking, social links, and an Express + SQLite admin dashboard.

## Features

- Customer homepage with services, prices, duration, descriptions, contact details, WhatsApp link, and Instagram link
- Floating AI receptionist chat widget
- Appointment booking form
- Auto-sliding image and video gallery
- Admin login page
- Admin appointment dashboard with all/today filters and status updates
- Admin summary cards for today's bookings, upcoming bookings, expected revenue, and cancelled bookings
- Service and staff management
- Admin gallery uploads for images and videos
- Business settings editor
- Google Map section on the customer site
- Google Business Profile reviews feed when API credentials are configured
- Owner email alerts for new appointments when SMTP is configured
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
   GOOGLE_BUSINESS_ACCOUNT_ID=your_google_business_account_id
   GOOGLE_BUSINESS_LOCATION_ID=your_google_business_location_id
   GOOGLE_BUSINESS_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_BUSINESS_CLIENT_SECRET=your_google_oauth_client_secret
   GOOGLE_BUSINESS_REFRESH_TOKEN=your_google_oauth_refresh_token
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_email_app_password
   APPOINTMENT_ALERT_EMAIL=owner_email@example.com
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
GOOGLE_BUSINESS_ACCOUNT_ID=
GOOGLE_BUSINESS_LOCATION_ID=
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=
GOOGLE_BUSINESS_REFRESH_TOKEN=
GOOGLE_BUSINESS_ACCESS_TOKEN=
GOOGLE_BUSINESS_REVIEW_PAGE_SIZE=8
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
APPOINTMENT_ALERT_EMAIL=
GALLERY_UPLOAD_MAX_MB=80
```

Google reviews use the Google Business Profile Reviews API:
`GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews`.
The location must be verified, and OAuth must include the `https://www.googleapis.com/auth/business.manage` scope.
Use either a refresh-token setup or a short-lived `GOOGLE_BUSINESS_ACCESS_TOKEN` for testing.

Email appointment alerts are optional. For Gmail, use an app password instead of your normal Gmail password, then set:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com
APPOINTMENT_ALERT_EMAIL=owner_email@example.com
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
- `GET /gallery`
- `POST /gallery`
- `DELETE /gallery/:id`
- `POST /chat/message`
- `GET /google-reviews`
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
