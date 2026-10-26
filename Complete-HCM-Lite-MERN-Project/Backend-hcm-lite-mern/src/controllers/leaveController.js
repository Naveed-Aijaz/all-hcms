import Leave from '../models/Leave.js';

export async function applyLeave(req, res, next) {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    const leave = await Leave.create({
      userId: req.user._id,
      leaveType,
      startDate,
      endDate,
      reason,
      status: 'Pending',
    });

    res.status(201).json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
}

export async function getMyLeaves(req, res, next) {
  try {
    const leaves = await Leave.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: leaves });
  } catch (error) {
    next(error);
  }
}

export async function updateLeaveStatus(req, res, next) {
  try {
    const { leaveId } = req.params;
    const { status } = req.body; // 'Approved' ya 'Rejected'

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request nahi mili' });
    }

    leave.status = status;
    await leave.save();

    res.json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
}