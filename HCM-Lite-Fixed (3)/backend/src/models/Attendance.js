import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Half-Day'],
      default: 'Present',
    },
    checkInPhoto: { type: String }, // Base64 or URL (optional for fallback)
    source: { type: String, enum: ['web', 'camera', 'manual'], default: 'web' },
    location: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    notes: String,
  },
  { timestamps: true }
);

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
