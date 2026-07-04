'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { authMiddleware, hodOnly } = require('../middleware/auth');

const PIN_HASHES_PATH = path.join(__dirname, '../data/pin_hashes.json');
const STORE_MANAGERS_PATH = path.join(__dirname, '../data/store_managers.json');
const CONSTANTS_PATH = path.join(__dirname, '../services/constants.js');

function loadPinHashes() {
  try { return JSON.parse(fs.readFileSync(PIN_HASHES_PATH, 'utf8')); } catch (_) { return []; }
}

function savePinHashes(entries) {
  fs.writeFileSync(PIN_HASHES_PATH, JSON.stringify(entries, null, 2));
}

function loadStoreManagers() {
  try { return JSON.parse(fs.readFileSync(STORE_MANAGERS_PATH, 'utf8')); } catch (_) { return {}; }
}

function saveStoreManagers(data) {
  fs.writeFileSync(STORE_MANAGERS_PATH, JSON.stringify(data, null, 2));
}

router.post('/bulk-import', authMiddleware, hodOnly, async function(req, res) {
  try {
    const users = req.body.users;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide a non-empty users array' });
    }
    if (users.length > 50) {
      return res.status(400).json({ success: false, error: 'Max 50 users per import' });
    }

    const entries = loadPinHashes();
    const storeMgrs = loadStoreManagers();
    const imported = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const name = (u.name || '').trim();
      const pin = String(u.pin || '').trim();
      const role = (u.role || 'am').trim();
      const email = (u.email || '').trim();
      const storeId = (u.storeId || '').trim().toLowerCase();

      if (!name || !pin) {
        errors.push({ index: i, name: name || '(empty)', error: 'name and pin required' });
        continue;
      }
      if (!/^\d{4}$/.test(pin)) {
        errors.push({ index: i, name, error: 'PIN must be 4 digits' });
        continue;
      }
      if (!['am', 'hod', 'ceo', 'maintenance'].includes(role)) {
        errors.push({ index: i, name, error: 'role must be am/hod/ceo/maintenance' });
        continue;
      }

      const exists = entries.find(function(e) { return e.am === name; });
      if (exists) {
        skipped.push({ index: i, name, reason: 'already exists' });
        continue;
      }

      const hash = await bcrypt.hash(pin, 10);
      entries.push({ am: name, role, hash });
      imported.push({ index: i, name, role, email: email || null, storeId: storeId || null });

      if (email) {
        const constantsRaw = fs.readFileSync(CONSTANTS_PATH, 'utf8');
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const emailRegex = new RegExp("(['\"]?" + escapedName + "['\"]?\\s*:\\s*['\"])([^'\"]*)(['\"])");
        if (emailRegex.test(constantsRaw)) {
          const updated = constantsRaw.replace(emailRegex, '$1' + email + '$3');
          fs.writeFileSync(CONSTANTS_PATH, updated);
        }
      }

      if (storeId && storeMgrs[storeId]) {
        storeMgrs[storeId].managerName = name;
        if (email) storeMgrs[storeId].managerEmail = email;
      }
    }

    savePinHashes(entries);
    saveStoreManagers(storeMgrs);

    res.json({
      success: true,
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { imported, skipped, errors }
    });
  } catch(err) {
    console.error('[users] bulk-import error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/list', function(req, res) {
  var entries = loadPinHashes();
  var users = entries.map(function(e) { return { am: e.am, role: e.role }; });
  res.json({ success: true, data: users });
});

module.exports = router;