import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("token", token, cookieOptions());
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company,
    department: user.department,
  };
}

export async function signup(req, res, next) {
  try {
    const { name, email, password, role, company } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // First user in the system becomes Admin (for empty start / judging)
    const totalUsers = await User.countDocuments();
    let assignedRole = "Employee";
    if (totalUsers === 0) {
      assignedRole = "Admin";
    } else if (role && ["Admin", "HR", "Employee"].includes(role)) {
      // only allow explicit role if somehow needed; normally HR creates employees
      assignedRole = role;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      company: company || "",
      mustChangePassword: assignedRole !== "Admin",
    });

    setAuthCookie(res, user);

    return res.status(201).json({
      user: safeUser(user),
      message: totalUsers === 0 ? "First Admin account created" : "Account created",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    setAuthCookie(res, user);
    return res.json({ user: safeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  res.json({ user: safeUser(req.user) });
}

export function logout(req, res) {
  res.clearCookie("token", cookieOptions());
  res.status(200).json({ message: "Logged out successfully" });
}
