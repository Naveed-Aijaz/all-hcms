import Attendance from '../models/Attendance.js';

// Simple office hours (can later come from company settings)
const OFFICE_START_HOUR = 9; // 09:00
const GRACE_MINUTES = 15;

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function calcStatus(checkInTime) {
  const d = new Date(checkInTime);
  const hour = d.getHours();
  const minute = d.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const startMinutes = OFFICE_START_HOUR * 60;
  if (totalMinutes > startMinutes + GRACE_MINUTES) return 'Late';
  return 'Present';
}

export async function checkIn(req, res, next) {
  try {
    const userId = req.user._id;
    const today = getToday();
    const { photo, location } = req.body;

    const existing = await Attendance.findOne({ userId, date: today });
    if (existing) {
      return res.status(400).json({ message: 'Aap aaj pehle hi check-in kar chuke hain' });
    }

    const now = new Date();
    const status = calcStatus(now);

    const attendance = await Attendance.create({
      userId,
      date: today,
      checkInTime: now,
      status,
      checkInPhoto: photo || '',
      source: photo ? 'camera' : 'web',
      location: location || undefined,
    });

    res.status(201).json({ success: true, data: attendance, message: `Check-in successful (${status})` });
  } catch (error) {
    next(error);
  }
}

export async function checkOut(req, res, next) {
  try {
    const userId = req.user._id;
    const today = getToday();

    const attendance = await Attendance.findOne({ userId, date: today });
    if (!attendance) {
      return res.status(404).json({ message: 'Aaj ka koi check-in record nahi mila' });
    }
    if (attendance.checkOutTime) {
      return res.status(400).json({ message: 'Aap aaj pehle hi check-out kar chuke hain' });
    }

    attendance.checkOutTime = new Date();
    await attendance.save();

    res.json({ success: true, data: attendance, message: 'Check-out successful' });
  } catch (error) {
    next(error);
  }
}

export async function getMyAttendance(req, res, next) {
  try {
    const logs = await Attendance.find({ userId: req.user._id }).sort({ date: -1 }).limit(60);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getTodayBoard(req, res, next) {
  try {
    // HR/Admin can see today's board
    const today = getToday();
    const records = await Attendance.find({ date: today }).populate('userId', 'name email department role');
    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
}
