'use strict';
require('dotenv').config();

process.on('unhandledRejection', function(reason) {
  console.error('[CRASH GUARD] Unhandled rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', function(err) {
  console.error('[CRASH GUARD] Uncaught exception:', err.message);
});

const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3004;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', apiLimiter);

if (process.env.NODE_ENV === 'production') {
  app.use(function(req, res, next) {
    if (req.headers['x-forwarded-proto'] !== 'https' && !req.secure) {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

app.use(function(req, res, next) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const { readJSON, writeJSON } = require('./services/store');
const { cleanupOldPosts, generateAutoRecognitionPost } = require('./services/utils');
const { registerCrons } = require('./services/crons');

const usageLog = path.join(__dirname, 'data', 'usage.log');
app.use(function(req, res, next) {
  if (req.path.endsWith('.html') || req.path === '/') {
    res.on('finish', function() {
      var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
      var entry = new Date().toISOString() + ' | ' + res.statusCode + ' | ' + req.path + ' | ' + ip + ' | ' + (req.get('user-agent') || '-') + '\n';
      fs.appendFile(usageLog, entry, function(err) {
        if (err) console.error('usage log write failed:', err.message);
      });
    });
  }
  next();
});

registerCrons(app);

// Health check
app.get('/health', function(req, res) {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'staging', port: PORT, uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

// Static uploads
const uploadsDir = path.join(__dirname, 'uploads', 'checklist');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/uploads/profiles', express.static('uploads/profiles'));
app.use('/uploads/events', express.static('uploads/events'));
app.use('/uploads/feed', express.static('uploads/feed'));
app.use('/uploads/checklist', express.static('uploads/checklist'));
app.use('/uploads/fdu', express.static(path.join(__dirname, 'uploads/fdu')));
app.use('/uploads/donuts', express.static(path.join(__dirname, 'uploads/donuts')));
app.use('/uploads/sap', express.static('uploads/sap'));
app.use('/uploads/task-proof', express.static('uploads/task-proof'));
app.use('/uploads/maintenance', express.static(path.join(__dirname, 'uploads/maintenance')));
app.use('/uploads/challenge', express.static(path.join(__dirname, 'uploads/challenge')));

// API routes
app.use('/api', require('./routes/data'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/leadership', require('./routes/leadership'));
app.use('/api/test', require('./routes/test-route'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/fdu', require('./routes/fdu'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/events', require('./routes/events'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/cash-audit', require('./routes/cash-audit'));
app.use('/api/labor', require('./routes/labor'));
app.use('/api/news', require('./routes/news'));
app.use('/api/push', require('./routes/push').router);
app.use('/api/ai-academy', require('./routes/ai-academy'));
app.use('/api/challenge', require('./routes/challenge'));
app.use('/api/anomalies', require('./routes/anomalies'));
app.use('/api/ask-ops', require('./routes/askOps'));
app.use('/api/store-allocation', require('./routes/store-allocation'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/sap', require('./routes/sap'));
app.use('/api/users', require('./routes/users'));

// 404 handler
app.use('/api', function(req, res) {
  res.status(404).json({ success: false, error: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl });
});

// Error handler
app.use(function(err, req, res, next) {
  console.error('[ERROR] ' + req.method + ' ' + req.path + ':', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.use(express.static(path.join(__dirname, 'public')));

cleanupOldPosts();
setInterval(cleanupOldPosts, 6 * 60 * 60 * 1000);

generateAutoRecognitionPost();
setInterval(generateAutoRecognitionPost, 60 * 60 * 1000);

app.listen(PORT, function() { console.log('OpsAIHub running on port ' + PORT); });
module.exports = { readJSON: readJSON, writeJSON: writeJSON };
