'use strict';
const jwt = require('jsonwebtoken');

function generateToken(am, role) {
  return jwt.sign({ am, role }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

function hodOnly(req, res, next) {
  if (req.user.role !== 'hod' && req.user.role !== 'ceo') {
    return res.status(403).json({ success: false, error: 'HOD/CEO access required' });
  }
  next();
}

module.exports = { generateToken, authMiddleware, hodOnly };
