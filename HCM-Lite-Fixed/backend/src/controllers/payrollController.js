import Attendance from "../models/Attendance.js";

// Basic salary calculation based on presence
export async function generatePayroll(req, res, next) {
  try {
    const { userId, month, year } = req.body;

    // Simple attendance count for the month
    const records = await Attendance.find({
      userId,
      date: { $regex: `^${year}-${month}` } // Matches YYYY-MM format
    });

    const presentDays = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
    const dailyRate = 2000; // Example daily base rate
    const totalSalary = presentDays * dailyRate;

    res.status(200).json({
      success: true,
      data: {
        userId,
        month,
        year,
        presentDays,
        totalSalary,
      },
    });
  } catch (error) {
    next(error);
  }
}