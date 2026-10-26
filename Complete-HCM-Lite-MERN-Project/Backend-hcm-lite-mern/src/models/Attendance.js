import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    status: { 
      type: String, 
      enum: ['Present', 'Absent', 'Late', 'Half-Day'], 
      default: 'Present' 
    },
    checkInPhoto: { 
      type: String, 
      required: true // Camera photo string (Base64) ko save karne ke liye
    },
  },
  { timestamps: true }
);

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;