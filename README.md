# Gym Management Application

Multi-gym management for gym owners and members: QR + GPS attendance, members (with profile photos), batches and gym timings, membership plans, manual fee collection (cash/UPI), follow-ups, dashboards (incl. men/women split) and reports.

| Part | Tech | Folder |
|---|---|---|
| Database | MySQL 8 (raw SQL) | `server/db/schema.sql` |
| API | Node.js 20+ · Express 5 · mysql2 · JWT · zod | `server/` |
| Web app (owner + member, installable PWA) | React 18 · Vite · React Router | `client/` |

Not in v1 (by decision): push notifications, online payment gateway. Profile photos are resized in the browser and stored in MySQL (`photos` table), so they survive redeploys.

## 0. Daily start (this PC)

This project uses its **own MySQL server** (port 3307, data in `C:\Users\TICKMARKS\gym-app-mysql`), separate from the main MySQL84 service. Credentials are in `server/.env` (user `gym_app`). Open three terminals:

```bash
cd server && npm run db:start   # project MySQL on :3307 (keep open)
cd server && npm run dev        # API on :4100
cd client && npm run dev        # web app on http://localhost:5180
```

`npm run smoke` (in `server/`, with the API running) runs the 53-check end-to-end test; it adds test records, so reset afterwards with `npm run db:init -- --reset && npm run db:seed`.

## 1. Setup

```bash
# API
cd server
npm install
# edit server/.env: set DB_USER / DB_PASSWORD for your MySQL (JWT_SECRET is already generated)
npm run db:init       # creates database gym_app + tables
npm run db:seed       # optional demo gym + data
npm run dev           # http://localhost:4100

# Web app (second terminal)
cd client
npm install
npm run dev           # http://localhost:5180  (proxies /api to :4100)
```

Demo logins after `db:seed`:

| Role | Email | Password |
|---|---|---|
| Owner | owner@demo.gym | Owner@123 |
| Member | arjun@demo.gym | Member@123 |
| Member (expiring, payment due) | priya@demo.gym | Member@123 |
| Invited, not registered | neha@demo.gym | register in the app |

Start over: `npm run db:init -- --reset` (deletes all data) then `npm run db:seed`.

## 2. Adding a customer gym

There is no admin dashboard in v1; provision gyms from the command line:

```bash
cd server
npm run create-owner -- --gym "Iron Temple" --name "Ravi Kumar" --email ravi@example.com --password "S3cretPass"
```

The owner then logs in, sets the gym location under **Gym & QR**, creates plans, adds members, and prints the QR code.

## 3. Testing check-in on a phone

Browsers only allow camera and GPS on `https://` or `localhost`. To use a phone on the same Wi-Fi:

```bash
cd client
npm run dev:https     # prints https://<your-PC-IP>:5180
```

Open that URL on the phone, accept the self-signed certificate warning, and log in as a member.
Set the gym location (Owner → Gym & QR → *Use my current location*) to where you are actually testing.

## 4. How it works

**Member onboarding:** owner adds the member (name, phone, email) → member opens the app → *Create your account* with the same email → accounts are linked. Unknown emails are rejected.

**Check-in** (`POST /api/attendance/check-in`), all validated on the server:
1. QR payload `GYMAPP:<gymId>:<token>` must match the member's gym and the current token (owner can rotate it).
2. Distance from the gym ≤ radius (+ up to 50 m GPS accuracy allowance).
3. Member has a membership covering today.
4. One check-in per member per day (unique key in MySQL).

**Membership status** is derived from dates, never stored: `cancelled` / `pending` (starts later) / `expired` / `active`.
**Balance** = membership amount − sum of payments. Partial payments are allowed; overpaying is rejected. A balance is *overdue* 7 days after the membership starts.
**Dates:** "today" uses the gym's timezone (`gyms.timezone`, default Asia/Kolkata); timestamps are stored in UTC.

Business rules (grace days, expiring window, absent threshold) are in `server/src/config.js`.

## 5. API overview

All endpoints are under `/api`, JSON, `Authorization: Bearer <token>`.

| Area | Endpoints | Role |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/register`, `GET/PATCH /auth/me`, `POST /auth/change-password` | all |
| Gym | `GET /gym`, `PUT /gym`, `PUT /gym/hours`, `GET /gym/qr`, `POST /gym/qr/rotate` | owner (GET /gym: all) |
| Batches | `GET /batches`, `POST /batches`, `PUT /batches/:id`, `DELETE /batches/:id` | owner |
| Photos | `PUT/DELETE /members/:id/photo` · `PUT/DELETE /auth/me/photo` · `GET /photos/:key` (public, random key) | owner · all · anyone |
| Members | `GET /members?search&status&gender&batch`, `POST /members`, `GET/PUT /members/:id`, `POST /members/:id/reset-password` | owner |
| Plans | `GET /plans`, `POST /plans`, `PUT /plans/:id` | owner |
| Memberships | `POST /memberships`, `PATCH /memberships/:id/cancel` | owner |
| Payments | `GET /payments?from&to&method`, `GET /payments/dues`, `POST /payments` · `GET /payments/me` | owner · member |
| Attendance | `GET /attendance?date` · `POST /attendance/check-in`, `GET /attendance/me` | owner · member |
| Follow-ups | `GET /followups?status`, `POST /followups`, `PATCH /followups/:id` | owner |
| Dashboard | `GET /dashboard/owner` · `GET /dashboard/member` | owner · member |
| Reports | `GET /reports/attendance?from&to`, `GET /reports/payments?from&to` | owner |

## 6. Deploying (Hostinger Node.js app, or any Node host)

The API also serves the built React app, so **one Node app runs the whole site**
(`/` and `/login` → React, `/api/...` → API). The **`server/` folder is self-contained**:
it holds the built site (`server/public`) and the schema (`server/db/schema.sql`).

Hostinger → Web App → Deployments → Redeploy (Settings and redeploy):

| Setting | Value |
|---|---|
| Framework preset | **Express** |
| Root directory | **`server`** |
| Entry file | **`src/index.js`** |
| Node version | 22.x |

**After changing the UI, rebuild and commit the site**, because the host doesn't build `client/`:
```bash
cd client && npm run build      # writes ../server/public
git add server/public && git commit -m "Rebuild web app" && git push
```

Environment variables (control panel, or a `server/.env` file on the host):

| Variable | Value |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | the MySQL database created in hPanel (host is usually `localhost`) |
| `JWT_SECRET` | long random string |
| `CORS_ORIGIN` | the site URL, e.g. `https://your-site.hostingersite.com` |
| `OWNER_EMAIL` `OWNER_PASSWORD` `OWNER_NAME` `GYM_NAME` | first owner login; created on first start only if there's no owner yet |

On start the app creates any missing tables and adds any new columns automatically (`server/src/setup.js`), so there's no need to run `db:init` on the host.
If only the static site files are uploaded (plain website hosting), pages load but
login fails because `/api` isn't running. Use a Node.js app instead.

### Production notes

- `/api` and the site share one HTTPS domain, so no CORS setup is needed for the browser.
- Use a dedicated MySQL user with rights only on `gym_app`, not `root`.
- Set a fresh `JWT_SECRET` and `CORS_ORIGIN` for the real domain.
- Password reset is owner-assisted in v1 (no email service); members change their password under Profile.
