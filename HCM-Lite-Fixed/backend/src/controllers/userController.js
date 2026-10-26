import User from "../models/User.js";

// Get all users (Admin/HR only)
export async function getAllUsers(req, res, next) {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

// Update user profile or avatar
export async function updateProfile(req, res, next) {
  try {
    const userId = req.user._id;
    const { name, department, company } = req.body;

    const updateData = { name, department, company };
    if (req.file) {
      updateData.profilePicture = req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
}