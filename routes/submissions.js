'use strict';
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../services/store');
const { sendEmail, emailStyle } = require('../services/email');
const { AM_EMAILS, HOD_EMAIL } = require('../services/constants');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../services/validation');

router.get('/', function(req, res) {
  try {
    let data = readJSON('submissions.json', []);
    if (req.query.am) data = data.filter(function(s) { return s.am === req.query.am; });
    if (req.query.day) data = data.filter(function(s) { return s.day === req.query.day; });
    if (req.query.store) data = data.filter(function(s) { return s.store === req.query.store; });
    res.json({ success: true, data: data, count: data.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', authMiddleware, validate(schemas.submission), function(req, res) {
  try {
    var submissions = readJSON('submissions.json', []);
    var submission = req.body;
    if (!submission.submittedAt) submission.submittedAt = new Date().toISOString();
    if (!submission.date) submission.date = new Date().toISOString().slice(0,10);
    if (!submission.id) submission.id = Date.now().toString();
    var dupIdx = submissions.findIndex(function(s) {
      return s.day === submission.day && s.store === submission.store && s.date === submission.date;
    });
    if (dupIdx >= 0) submissions[dupIdx] = submission;
    else submissions.push(submission);
    writeJSON('submissions.json', submissions);
    try { sendSubmissionEmail(submission, null); } catch(e) { console.error('Email error:', e.message); }
    res.json({ success: true, id: submission.id, message: 'Submission saved' });
    setImmediate(function() { try { checkWeeklyTop3AutoPost(submission.am); } catch(e) {} });
  } catch(err) {
    console.error('Submission error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

function sendSubmissionEmail(submission, callback) {
  var amEmail = AM_EMAILS[submission.am] || null;
  if (!amEmail) { if(callback) callback(null); return; }
  var day = (submission.day || '').toUpperCase();
  var store = submission.store || 'Unknown Store';
  var am = submission.am || 'AM';
  var score = submission.score || 'N/A';
  var date = submission.date || new Date().toISOString().slice(0,10);
  var subject = '[Tim\'s Ops Connect] ' + day + ' Checklist Submitted — ' + store;
  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">' +
    '<div style="background:#C8102E;padding:20px;border-radius:8px 8px 0 0">' +
    '<h2 style="color:#fff;margin:0">Tim\'s Ops Connect &#9749;</h2></div>' +
    '<div style="background:#f5f5f7;padding:20px;border-radius:0 0 8px 8px">' +
    '<h3 style="color:#1D1D1F;margin-top:0">' + day + ' Checklist — ' + store + '</h3>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<tr><td style="padding:8px;border-bottom:1px solid #E5E5EA;color:#6E6E73">AM</td><td style="padding:8px;border-bottom:1px solid #E5E5EA;font-weight:600">' + am + '</td></tr>' +
    '<tr><td style="padding:8px;border-bottom:1px solid #E5E5EA;color:#6E6E73">Store</td><td style="padding:8px;border-bottom:1px solid #E5E5EA;font-weight:600">' + store + '</td></tr>' +
    '<tr><td style="padding:8px;border-bottom:1px solid #E5E5EA;color:#6E6E73">Date</td><td style="padding:8px;border-bottom:1px solid #E5E5EA;font-weight:600">' + date + '</td></tr>' +
    '<tr><td style="padding:8px;color:#6E6E73">Score</td><td style="padding:8px;font-weight:600;color:#C8102E">' + score + '%</td></tr>' +
    '</table>' +
    '<p style="color:#6E6E73;font-size:12px;margin-top:16px">This is an automated confirmation from Tim\'s Ops Connect. View full data at staging.opsaihub.in</p>' +
    '</div></div>';
  sendEmail(amEmail, subject, html, callback);
}

function checkWeeklyTop3AutoPost(triggerAM) {
  const { checkWeeklyTop3AutoPost: check } = require('../services/leaderboard');
  check(triggerAM);
}

module.exports = router;
