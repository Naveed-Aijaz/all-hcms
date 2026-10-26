import API from './axios';

export const checkInApi = async (payload = {}) => {
  const response = await API.post('/attendance/check-in', payload);
  return response.data;
};

export const checkOutApi = async () => {
  const response = await API.put('/attendance/check-out');
  return response.data;
};

export const getMyAttendanceApi = async () => {
  const response = await API.get('/attendance/my-logs');
  return response.data;
};

export const getTodayBoardApi = async () => {
  const response = await API.get('/attendance/today');
  return response.data;
};
