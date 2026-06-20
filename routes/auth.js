'use strict';
const express = require('express');
const router = express.Router();
const { PIN_MAP } = require('../services/constants');
const { validate, schemas } = require('../services/validation');
const { generateToken } = require('../middleware/auth');

router.post('/verify-pin', validate(schemas.pin), function(req, res) {
  var pin = String(req.body.pin || '').trim();
  var match = PIN_MAP[pin];
  if (!match) return res.json({ success: false });
  var token = generateToken(match.am, match.role);
  res.json({ success: true, am: match.am, role: match.role, token: token });
});

module.exports = router;
