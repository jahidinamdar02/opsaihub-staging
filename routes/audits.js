'use strict';
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../services/store');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../services/validation');

router.get('/', function(req, res) {
  try { res.json({ success: true, data: readJSON('audits.json', { audits: [] }) }); }
  catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/', authMiddleware, validate(schemas.audit), function(req, res) {
  try {
    var data = readJSON('audits.json', { audits: [] });
    var entry = req.body;
    entry.id = Date.now().toString();
    entry.submittedAt = new Date().toISOString();
    data.audits = data.audits.filter(function(a) {
      return !(a.store === entry.store && a.cycle === entry.cycle && a.type === entry.type);
    });
    data.audits.push(entry);
    writeJSON('audits.json', data);
    res.json({ success: true, id: entry.id });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
