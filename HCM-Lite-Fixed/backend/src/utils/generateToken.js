import jwt from 'jsonwebtoken';

const generateToken = (id) => {
  return jwt.sign({ sub: id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export default generateToken;