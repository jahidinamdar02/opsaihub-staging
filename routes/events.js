'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { readJSON, writeJSON } = require('../services/store');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../services/validation');

const eventUpload = multer({
  dest: 'uploads/events/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  }
}).array('images', 3);

const eventConcludeUpload = multer({ dest: 'uploads/events/', limits: { fileSize: 10 * 1024 * 1024 } }).array('images', 4);

router.get('/', function(req, res) {
  try {
    var data = readJSON('event_submissions.json', { submissions: [] });
    var subs = data.submissions || [];
    if (req.query.am) subs = subs.filter(function(s) { return s.am === req.query.am; });
    if (req.query.month) subs = subs.filter(function(s) { return s.eventDate && s.eventDate.startsWith(req.query.month); });
    subs = subs.sort(function(a, b) { return new Date(b.eventDate) - new Date(a.eventDate); });
    res.json({ success: true, data: subs, total: subs.length });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/stats/am', function(req, res) {
  try {
    var data = readJSON('event_submissions.json', { submissions: [] });
    var subs = data.submissions || [];
    var stats = {};
    subs.forEach(function(s) {
      if (!stats[s.am]) stats[s.am] = { am: s.am, total: 0, complianceScores: [], nonCompliant: [] };
      stats[s.am].total++;
      stats[s.am].complianceScores.push(s.compliance.score);
      if (s.compliance.score < 100) stats[s.am].nonCompliant.push({ id: s.id, date: s.eventDate, store: s.store, score: s.compliance.score });
    });
    Object.keys(stats).forEach(function(am) {
      var sc = stats[am].complianceScores;
      stats[am].avgCompliance = sc.length ? Math.round(sc.reduce(function(t, v) { return t + v; }, 0) / sc.length) : 0;
    });
    res.json({ success: true, data: stats });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:id', function(req, res) {
  try {
    var data = readJSON('event_submissions.json', { submissions: [] });
    var event = (data.submissions || []).find(function(s) { return s.id === req.params.id; });
    if (!event) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: event });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/submit', authMiddleware, validate(schemas.event), function(req, res) {
  eventUpload(req, res, function(err) {
    if (err) return res.status(400).json({ success: false, error: err.message });
    try {
      var b = req.body;
      var images = (req.files || []).map(function(f) {
        var ext = (f.originalname || '').split('.').pop().toLowerCase();
        var newName = f.filename + (ext ? '.' + ext : '');
        var oldPath = 'uploads/events/' + f.filename;
        var newPath = 'uploads/events/' + newName;
        try { require('fs').renameSync(oldPath, newPath); } catch(e) {}
        return '/uploads/events/' + newName;
      });
      var required = ['am', 'store', 'eventDate', 'venue', 'menuPricing', 'salesGenerated', 'revenueShare', 'otherExpenses', 'manualBillBook', 'manualBillBookComment', 'punchedInSystem', 'punchedInSystemComment', 'billsAttached', 'billsAttachedComment', 'managerPresent'];
      var missing = required.filter(function(k) { return !b[k] || b[k].toString().trim() === ''; });
      if (missing.length > 0) return res.status(400).json({ success: false, error: 'Missing required fields: ' + missing.join(', ') });
      if (images.length === 0) return res.status(400).json({ success: false, error: 'At least 1 image is required' });
      var sales = parseFloat(b.salesGenerated) || 0;
      var expenses = parseFloat(b.otherExpenses) || 0;
      var commission = parseFloat(b.revenueShare) || 0;
      var revenueShare = sales * (commission / 100);
      var foodCost = sales * 0.30;
      var rental = sales * 0.05;
      var commCharge = sales * 0.02;
      var bankCharges = sales * 0.02;
      var profit = sales - revenueShare - foodCost - rental - commCharge - bankCharges - expenses;
      var complianceItems = ['manualBillBook', 'punchedInSystem', 'billsAttached'];
      var complianceYes = complianceItems.filter(function(k) { return b[k] === 'yes'; }).length;
      var complianceScore = Math.round(complianceYes / complianceItems.length * 100);
      var record = {
        id: Date.now().toString(), am: b.am, store: b.store, region: b.region,
        eventDate: b.eventDate, venue: b.venue, menuPricing: b.menuPricing,
        customPrice: b.customPrice || null, salesGenerated: sales,
        revenueSharePct: commission, otherExpenses: expenses, profit: Math.round(profit),
        compliance: {
          manualBillBook: { answer: b.manualBillBook, comment: b.manualBillBookComment },
          punchedInSystem: { answer: b.punchedInSystem, comment: b.punchedInSystemComment },
          billsAttached: { answer: b.billsAttached, comment: b.billsAttachedComment },
          managerPresent: b.managerPresent, score: complianceScore
        },
        images: images, notes: b.notes || '', submittedAt: new Date().toISOString()
      };
      var data = readJSON('event_submissions.json', { submissions: [] });
      if (!data.submissions) data.submissions = [];
      data.submissions.push(record);
      data.lastUpdated = new Date().toISOString();
      writeJSON('event_submissions.json', data);
      res.json({ success: true, id: record.id, profit: record.profit, complianceScore: complianceScore });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
  });
});

router.post('/quick', validate(schemas.eventQuick), function(req, res) {
  try {
    var b = req.body;
    var required = ['am', 'store', 'eventName', 'eventDate', 'salesGenerated'];
    var missing = required.filter(function(k) { return !b[k] || b[k].toString().trim() === ''; });
    if (missing.length > 0) return res.status(400).json({ success: false, error: 'Missing: ' + missing.join(', ') });
    var sales = parseFloat(b.salesGenerated) || 0;
    var commission = parseFloat(b.revenueShare) || 0;
    var expenses = parseFloat(b.otherExpenses) || 0;
    var revenueShare = sales * (commission / 100);
    var foodCost = sales * 0.30;
    var rental = sales * 0.05;
    var commCharge = sales * 0.02;
    var bankCharges = sales * 0.02;
    var profit = Math.round(sales - revenueShare - foodCost - rental - commCharge - bankCharges - expenses);
    var record = {
      id: Date.now().toString(), am: b.am.trim(), store: b.store.trim(),
      eventName: b.eventName.trim(), eventDate: b.eventDate, venue: b.eventName.trim(),
      menuPricing: 'standard', salesGenerated: sales, revenueSharePct: commission,
      otherExpenses: expenses, profit: profit,
      compliance: { score: 0 }, images: [], notes: b.notes || '',
      submittedAt: new Date().toISOString()
    };
    var data = readJSON('event_submissions.json', { submissions: [] });
    if (!data.submissions) data.submissions = [];
    data.submissions.push(record);
    data.lastUpdated = new Date().toISOString();
    writeJSON('event_submissions.json', data);
    res.json({ success: true, id: record.id, profit: profit, profitPct: sales > 0 ? Math.round(profit / sales * 100) : 0 });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/:id/conclude', eventConcludeUpload, function(req, res) {
  eventConcludeUpload(req, res, function(err) {
    if (err) return res.status(400).json({ success: false, error: err.message });
    try {
      var data = readJSON('event_submissions.json', { submissions: [] });
      var idx = (data.submissions || []).findIndex(function(s) { return s.id === req.params.id; });
      if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
      var ev = data.submissions[idx];
      var sales = parseFloat(req.body.salesGenerated) || 0;
      var newImages = (req.files || []).map(function(f) { return '/uploads/events/' + f.filename; });
      ev.salesGenerated = sales;
      ev.status = 'concluded';
      ev.concludedAt = new Date().toISOString();
      ev.images = (ev.images || []).concat(newImages).slice(0, 4);
      if (req.body.notes) ev.notes = req.body.notes;
      data.submissions[idx] = ev;
      data.lastUpdated = new Date().toISOString();
      writeJSON('event_submissions.json', data);
      res.json({ success: true, event: ev });
    } catch(e) { res.status(500).json({ success: false, error: e.message }); }
  });
});

module.exports = router;
