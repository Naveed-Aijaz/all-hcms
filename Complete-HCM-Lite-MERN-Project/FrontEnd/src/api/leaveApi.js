import API from './axios';

export const applyLeaveApi = async (leaveData) => {
  const response = await API.post('/leaves', leaveData);
  return response.data;
};

export const getMyLeavesApi = async () => {
  const response = await API.get('/leaves/my-leaves');
  return response.data;
};