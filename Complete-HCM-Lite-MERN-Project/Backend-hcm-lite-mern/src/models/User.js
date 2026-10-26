import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { 
      type: String, 
      enum: ['Admin', 'HR', 'Manager', 'Employee', 'jobseeker'], 
      default: 'Employee' 
    },
    department: { type: String, default: 'General' },
    company: { type: String, default: '' },
    profilePicture: { type: String, default: '' },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;