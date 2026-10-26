/**
 * HCM Lite – Database Seed
 * Run: npm run seed
 *
 * Creates:
 *  - 1 Admin
 *  - 1 HR
 *  - 3 Employees
 *  - Sample attendance (last 5 days)
 *  - Sample leave requests
 *
 * Default password for ALL users: Password@123
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/User.js';
import Attendance from './models/Attendance.js';
import Leave from './models/Leave.js';

const PASSWORD = 'Password@123';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected.\n');

    // Clear existing data
    console.log('Clearing existing users, attendance, leaves...');
    await Promise.all([
      User.deleteMany({}),
      Attendance.deleteMany({}),
      Leave.deleteMany({}),
    ]);
    console.log('Cleared.\n');

    const hashed = await bcrypt.hash(PASSWORD, 12);

    // ── Users ──────────────────────────────────────────────
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@hcmlite.com',
      password: hashed,
      role: 'Admin',
      company: 'Saylani Tech',
      department: 'Management',
      designation: 'Administrator',
      employeeId: 'EMP-001',
      isActive: true,
    });

    const hr = await User.create({
      name: 'Sara Ahmed',
      email: 'hr@hcmlite.com',
      password: hashed,
      role: 'HR',
      company: 'Saylani Tech',
      department: 'Human Resources',
      designation: 'HR Manager',
      employeeId: 'EMP-002',
      phone: '0300-1112233',
      isActive: true,
    });

    const emp1 = await User.create({
      name: 'Ali Khan',
      email: 'ali@hcmlite.com',
      password: hashed,
      role: 'Employee',
      company: 'Saylani Tech',
      department: 'Engineering',
      designation: 'Software Engineer',
      employeeId: 'EMP-003',
      phone: '0300-2223344',
      salary: { basic: 80000, allowances: 15000 },
      isActive: true,
    });

    const emp2 = await User.create({
      name: 'Fatima Noor',
      email: 'fatima@hcmlite.com',
      password: hashed,
      role: 'Employee',
      company: 'Saylani Tech',
      department: 'Engineering',
      designation: 'Frontend Developer',
      employeeId: 'EMP-004',
      phone: '0300-3334455',
      salary: { basic: 75000, allowances: 12000 },
      isActive: true,
    });

    const emp3 = await User.create({
      name: 'Bilal Hussain',
      email: 'bilal@hcmlite.com',
      password: hashed,
      role: 'Employee',
      company: 'Saylani Tech',
      department: 'Operations',
      designation: 'Operations Associate',
      employeeId: 'EMP-005',
      phone: '0300-4445566',
      salary: { basic: 55000, allowances: 8000 },
      isActive: true,
    });

    console.log('Users created:');
    console.log('  Admin   → admin@hcmlite.com');
    console.log('  HR      → hr@hcmlite.com');
    console.log('  Emp     → ali@hcmlite.com');
    console.log('  Emp     → fatima@hcmlite.com');
    console.log('  Emp     → bilal@hcmlite.com');
    console.log(`  Password for all: ${PASSWORD}\n`);

    // ── Attendance (last 5 working days, skip today so camera demo still works) ──
    const employees = [emp1, emp2, emp3, hr];
    const attendanceDocs = [];

    for (let i = 1; i <= 5; i++) {
      const day = daysAgo(i);
      // skip Sunday (0)
      if (day.getDay() === 0) continue;
      const d = dateStr(day);

      for (const emp of employees) {
        const isLate = Math.random() > 0.7;
        const hour = isLate ? 9 : 8;
        const minute = isLate ? 25 + Math.floor(Math.random() * 20) : 45 + Math.floor(Math.random() * 15);
        const checkIn = new Date(day);
        checkIn.setHours(hour, minute, 0, 0);
        const checkOut = new Date(day);
        checkOut.setHours(17, 30 + Math.floor(Math.random() * 30), 0, 0);

        attendanceDocs.push({
          userId: emp._id,
          date: d,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          status: isLate ? 'Late' : 'Present',
          source: 'web',
        });
      }
    }

    await Attendance.insertMany(attendanceDocs);
    console.log(`Attendance records: ${attendanceDocs.length}`);

    // ── Leaves ─────────────────────────────────────────────
    const leaves = await Leave.insertMany([
      {
        userId: emp1._id,
        leaveType: 'Casual',
        startDate: daysAgo(-2), // upcoming
        endDate: daysAgo(-2),
        reason: 'Family wedding',
        status: 'Pending',
      },
      {
        userId: emp2._id,
        leaveType: 'Sick',
        startDate: daysAgo(3),
        endDate: daysAgo(2),
        reason: 'Fever and rest',
        status: 'Approved',
      },
      {
        userId: emp3._id,
        leaveType: 'Annual',
        startDate: daysAgo(-10),
        endDate: daysAgo(-5),
        reason: 'Planned vacation',
        status: 'Pending',
      },
      {
        userId: emp1._id,
        leaveType: 'Casual',
        startDate: daysAgo(10),
        endDate: daysAgo(10),
        reason: 'Personal work',
        status: 'Rejected',
      },
    ]);

    console.log(`Leave requests: ${leaves.length}\n`);

    console.log('─────────────────────────────────────');
    console.log('Seed completed successfully!');
    console.log('─────────────────────────────────────');
    console.log('Login credentials (password for all):');
    console.log(`  ${PASSWORD}`);
    console.log('');
    console.log('  Admin    admin@hcmlite.com');
    console.log('  HR       hr@hcmlite.com');
    console.log('  Employee ali@hcmlite.com');
    console.log('  Employee fatima@hcmlite.com');
    console.log('  Employee bilal@hcmlite.com');
    console.log('─────────────────────────────────────');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seed();
