import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['Admin', 'HR', 'Employee'],
      default: 'Employee',
    },
    department: { type: String, default: 'General' },
    designation: { type: String, default: '' },
    employeeId: { type: String },
    company: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    salary: {
      basic: { type: Number, default: 0 },
      allowances: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;
