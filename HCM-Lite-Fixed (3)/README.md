# HCM Lite – AI-assisted Human Capital Management

Saylani Hackathon project. Web app with **Admin / HR / Employee** roles.

## Stack
- **Frontend**: React + Vite + MUI + Redux Toolkit
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Auth**: JWT (httpOnly cookie) + bcrypt

## Features
- [x] Auth (login / signup) – 3 roles
- [x] First user becomes Admin
- [x] Role-based sidebar & menus
- [x] **Camera Check-In** (webcam + optional GPS)
- [x] Check-out + attendance history + Late detection
- [x] Leave apply + history
- [x] Personal dashboard
- [x] **Seed script** – one command sample data
- [ ] Full Org Setup / Departments / Holidays
- [ ] Employee 360 + CSV import
- [ ] Payroll run + payslip PDF
- [ ] AI Assistant with tool calling

## Quick start

### 1. Backend
```bash
cd backend
cp .env.example .env
# Edit .env → set MONGODB_URI and JWT_SECRET

npm install
npm run seed          # ← creates Admin, HR, Employees + sample data
npm start             # http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev           # http://localhost:5173
```

### Seed login credentials
| Role     | Email               | Password      |
|----------|---------------------|---------------|
| Admin    | admin@hcmlite.com   | Password@123  |
| HR       | hr@hcmlite.com      | Password@123  |
| Employee | ali@hcmlite.com     | Password@123  |
| Employee | fatima@hcmlite.com  | Password@123  |
| Employee | bilal@hcmlite.com   | Password@123  |

`npm run seed` pehle purana data clear karta hai, phir naya insert karta hai.

## Camera attendance
Login as any employee → **Attendance** → **Camera Check-In** → allow camera → Capture → Confirm.

## Environment
See `backend/.env.example`. Never commit real secrets.
