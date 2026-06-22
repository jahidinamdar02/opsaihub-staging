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
const cron = require('node-cron');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3004;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Rate limit exceeded for this endpoint' }
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
const { sendEmail, emailStyle, eRow, eCard, eBtn, eWrap } = require('./services/email');
const { AM_EMAILS, CC_EMAIL, HOD_EMAIL, CEO_EMAIL, TRAINING_EMAIL } = require('./services/constants');

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

// Web push crons — IST timezone
const { sendToAll: pushAll } = require('./routes/push');

// 9:00 AM IST — morning briefing
cron.schedule('0 9 * * *', function() {
  var subs = readJSON('push_subscriptions.json', []);
  if (!subs.length) return;
  var day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  pushAll(subs, { title: 'Good morning! ☀️', body: 'Your ' + day + ' briefing is ready. Check today\'s checklist and store targets.', tag: 'briefing', url: '/' }, function(r) {
    console.log('[PUSH] Morning briefing sent:', r);
  });
}, { timezone: 'Asia/Kolkata' });

// 3:00 PM IST — afternoon checklist reminder
cron.schedule('0 15 * * *', function() {
  var subs = readJSON('push_subscriptions.json', []);
  if (!subs.length) return;
  pushAll(subs, { title: 'Afternoon check-in 📋', body: 'Don\'t forget to submit your afternoon checklist before end of day.', tag: 'checklist', url: '/index.html', requireInteraction: true }, function(r) {
    console.log('[PUSH] Checklist reminder sent:', r);
  });
}, { timezone: 'Asia/Kolkata' });

app.get('/api/fy27-targets', function(req, res) {
  try { var data = readJSON('fy27_targets.json', {}); res.json(data); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/delivery', function(req, res) {
  try {
    var data = readJSON('delivery.json', []);
    var month = req.query.month;
    if (month) data = data.filter(function(d) { return d.month === month; });
    res.json({ success: true, data: data });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/delivery', function(req, res) {
  try {
    var data = readJSON('delivery.json', []);
    var payload = req.body;
    if (!payload.store || !payload.month) {
      return res.status(400).json({ success: false, error: 'Missing required fields: store, month' });
    }
    payload.id = Date.now().toString();
    var idx = data.findIndex(function(d) { return d.store === payload.store && d.month === payload.month; });
    if (idx >= 0) data[idx] = payload;
    else data.push(payload);
    writeJSON('delivery.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/issues', function(req, res) {
  try { res.json({ success: true, data: readJSON('issues.json', []) }); }
  catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/health-scores', function(req, res) {
  try { res.json({ success: true, data: (readJSON('health_scores.json', {})).stores || [] }); }
  catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/world-events', function(req, res) {
  try {
    var data = readJSON('world_events.json', { events: [] });
    res.json({ success: true, data: data.events, lastUpdated: data.lastUpdated });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/health', function(req, res) {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'staging', port: PORT, uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

app.get('/api/checklist/:day', function(req, res) {
  try {
    const items = readJSON('checklist-items.json', {});
    const day = req.params.day.toLowerCase();
    res.json({ success: true, day: day, data: items[day] || [] });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/performance', function(req, res) {
  try {
    let data = readJSON('performance.json', []);
    if (req.query.am) data = data.filter(function(p) { return p.am === req.query.am; });
    res.json({ success: true, data: data });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/coverage', function(req, res) {
  try {
    var all = readJSON('coverage.json', []);
    var am = req.query.am;
    var month = req.query.month;
    var filtered = all;
    if (am) filtered = filtered.filter(function(c) { return c.am === am; });
    if (month) {
      var monthFiltered = filtered.filter(function(c) { return c.month === month; });
      if (monthFiltered.length === 0 && filtered.length > 0) {
        filtered.sort(function(a, b) { return b.month.localeCompare(a.month); });
        var latestMonth = filtered[0].month;
        monthFiltered = filtered.filter(function(c) { return c.month === latestMonth; });
        res.json({ success: true, data: monthFiltered, note: 'No data for ' + month + ', showing ' + latestMonth });
        return;
      }
      filtered = monthFiltered;
    }
    res.json({ success: true, data: filtered });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/coverage', function(req, res) {
  try {
    const coverage = readJSON('coverage.json', []);
    const am = req.body.am, month = req.body.month, store = req.body.store, day = req.body.day;
    if (!am || !month || !store || !day) {
      return res.status(400).json({ success: false, error: 'Missing required fields: am, month, store, day' });
    }
    let amRec = null;
    for (var i = 0; i < coverage.length; i++) { if (coverage[i].am === am && coverage[i].month === month) { amRec = coverage[i]; break; } }
    if (!amRec) { amRec = { am: am, month: month, stores: [] }; coverage.push(amRec); }
    let storeRec = null;
    for (var j = 0; j < amRec.stores.length; j++) { if (amRec.stores[j].store === store) { storeRec = amRec.stores[j]; break; } }
    if (!storeRec) { storeRec = { store: store, wed: false, fri: false, sat: false, sun: false }; amRec.stores.push(storeRec); }
    if (day === 'wed' || day === 'fri' || day === 'sat' || day === 'sun') storeRec[day] = true;
    if (!writeJSON('coverage.json', coverage)) return res.status(500).json({ success: false, error: 'Save failed' });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/products', function(req, res) {
  try { res.json({ success: true, data: readJSON('products.json', []) }); }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/products', function(req, res) {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, error: 'Missing required field: name' });
    }
    var data = readJSON('products.json', []);
    data.unshift(req.body);
    writeJSON('products.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/projects', function(req, res) {
  try { res.json({ success: true, data: readJSON('projects.json', []) }); }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/projects', function(req, res) {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, error: 'Missing required field: name' });
    }
    var data = readJSON('projects.json', []);
    data.push(req.body);
    writeJSON('projects.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/training', function(req, res) {
  try { res.json({ success: true, data: readJSON('training.json', []) }); }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/training', function(req, res) {
  try {
    var payload = req.body;
    if (!payload.store || !payload.am) {
      return res.status(400).json({ success: false, error: 'Missing required fields: store, am' });
    }
    var data = readJSON('training.json', []);
    var idx = data.findIndex(function(d) { return d.store === payload.store; });
    if (idx >= 0) data[idx] = payload; else data.push(payload);
    writeJSON('training.json', data);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

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

app.use('/api/auth', require('./routes/auth'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/fdu', require('./routes/fdu'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/events', require('./routes/events'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/cash-audit', require('./routes/cash-audit'));
app.use('/api/news', require('./routes/news'));
app.use('/api/push', require('./routes/push').router);

// Profile picture upload
const multer = require('multer');
const profileUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      var dir = path.join(__dirname, 'uploads', 'profiles');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function(req, file, cb) {
      var ext = path.extname(file.originalname) || '.jpg';
      cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,6) + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

app.post('/api/profile/photo', profileUpload.single('photo'), function(req, res) {
  if (!req.file) return res.json({ success: false, error: 'No file uploaded' });
  var url = '/uploads/profiles/' + req.file.filename;
  var am = req.body.am || '';
  if (am) {
    var dataFile = path.join(__dirname, 'data', 'profile-photos.json');
    var photos = {};
    try { photos = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
    photos[am] = url;
    fs.writeFileSync(dataFile, JSON.stringify(photos, null, 2));
  }
  res.json({ success: true, url: url });
});

app.get('/api/profile/photo/:am', function(req, res) {
  var dataFile = path.join(__dirname, 'data', 'profile-photos.json');
  var photos = {};
  try { photos = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch(e) {}
  var url = photos[req.params.am] || null;
  res.json({ success: true, url: url });
});

app.post('/api/test-email', strictLimiter, function(req, res) {
  sendEmail(HOD_EMAIL, '[Test] OpsAIHub Email Working', '<p>Test email</p>',
    function(err) { res.json({ success: !err, error: err ? err.message : null }); }
  );
});

app.use('/api/ai-academy', require('./routes/ai-academy'));

// 404 handler for unknown API routes
app.use('/api', function(req, res) {
  res.status(404).json({ success: false, error: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl });
});

// Global error handler
app.use(function(err, req, res, next) {
  console.error('[ERROR] ' + req.method + ' ' + req.path + ':', err.message);
  
  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field.' });
  }
  
  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, function() { console.log('OpsAIHub running on port ' + PORT); });
module.exports = { readJSON: readJSON, writeJSON: writeJSON };
