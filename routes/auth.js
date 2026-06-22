'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { validate, schemas } = require('../services/validation');
const { generateToken } = require('../middleware/auth');

const PIN_HASHES_PATH = path.join(__dirname, '../data/pin_hashes.json');
const MASTER_LOG_PATH = path.join(__dirname, '../data/master_pin_log.json');

function loadPinHashes() {
  return JSON.parse(fs.readFileSync(PIN_HASHES_PATH, 'utf8'));
}

function appendMasterLog(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(MASTER_LOG_PATH, 'utf8')); } catch (_) {}
  log.push(entry);
  fs.writeFileSync(MASTER_LOG_PATH, JSON.stringify(log, null, 2));
}

router.post('/verify-pin', validate(schemas.pin), async function(req, res) {
  var pin = String(req.body.pin || '').trim();

  try {
    // Master PIN check — always authenticates as HOD
    const masterHash = process.env.MASTER_PIN_HASH;
    if (masterHash) {
      const isMaster = await bcrypt.compare(pin, masterHash);
      if (isMaster) {
        appendMasterLog({
          ts: new Date().toISOString(),
          ip: req.ip || req.connection?.remoteAddress || 'unknown'
        });
        const token = generateToken('Jahid', 'hod');
        return res.json({ success: true, am: 'Jahid', role: 'hod', token, master: true });
      }
    }

    // User PIN check
    const entries = loadPinHashes();
    for (const entry of entries) {
      const match = await bcrypt.compare(pin, entry.hash);
      if (match) {
        const token = generateToken(entry.am, entry.role);
        return res.json({ success: true, am: entry.am, role: entry.role, token });
      }
    }

    return res.json({ success: false });
  } catch (err) {
    console.error('[auth] verify-pin error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
