'use strict';
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../services/store');

function getWeekKey() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 1);
  var week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return now.getFullYear() + '-W' + String(week).padStart(2, '0');
}

function getMonthKey() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

// Collect all video keys watched across current month's weeks
function getMonthlyStatus(amData, weekKey) {
  var monthPrefix = weekKey.slice(0, 4); // year
  var monthKey = getMonthKey();
  var allWatched = new Set();
  Object.keys(amData.weeks || {}).forEach(function(wk) {
    // Include weeks from current month (approximate: same year, rough date check)
    var weekData = amData.weeks[wk];
    (weekData.watched || []).forEach(function(v) { allWatched.add(v); });
  });
  var coreWatched = Array.from(allWatched).filter(function(k) { return k.startsWith('v'); });
  var MONTHLY_TARGET = 5;
  return {
    achieved: coreWatched.length >= MONTHLY_TARGET,
    watchedCount: coreWatched.length,
    monthKey: monthKey
  };
}

// GET /api/ai-academy/leaderboard
router.get('/leaderboard', function(req, res) {
  try {
    var data = readJSON('ai_academy.json', {});
    var leaderboard = Object.keys(data).map(function(am) {
      var amData = data[am];
      var allWatched = new Set();
      var weeksPassed = 0;
      Object.keys(amData.weeks || {}).forEach(function(wk) {
        var wd = amData.weeks[wk];
        (wd.watched || []).forEach(function(v) { allWatched.add(v); });
        if ((wd.watched || []).length > 0) weeksPassed++;
      });
      var certs = Object.keys(amData.certs || {}).length;
      var videosWatched = allWatched.size;
      var score = videosWatched * 5 + certs * 20;
      return { am: am, videosWatched: videosWatched, weeksPassed: weeksPassed, certificates: certs, score: score };
    }).filter(function(e) { return e.videosWatched > 0; })
      .sort(function(a, b) { return b.score - a.score; });
    res.json({ success: true, leaderboard: leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ai-academy/:am
router.get('/:am', function(req, res) {
  try {
    var am = req.params.am;
    var data = readJSON('ai_academy.json', {});
    var amData = data[am] || { weeks: {}, certs: {} };
    var weekKey = getWeekKey();
    var weekData = (amData.weeks || {})[weekKey] || { watched: [], challengeDone: false };
    var monthlyStatus = getMonthlyStatus(amData, weekKey);

    // Check for pending cert (previous month where target was hit but cert not acked)
    var hasPendingCert = false, pendingCertMonth = null, pendingCertLabel = null, pendingCertStats = null;
    var monthKey = getMonthKey();
    if (monthlyStatus.achieved && !(amData.certs || {})[monthKey]) {
      hasPendingCert = true;
      pendingCertMonth = monthKey;
      pendingCertLabel = monthKey;
      pendingCertStats = { watchedCount: monthlyStatus.watchedCount, bestScore: 0 };
    }

    res.json({
      success: true,
      weekKey: weekKey,
      data: amData,
      monthlyStatus: monthlyStatus,
      hasPendingCert: hasPendingCert,
      pendingCertMonth: pendingCertMonth,
      pendingCertLabel: pendingCertLabel,
      pendingCertStats: pendingCertStats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai-academy/watch  { am, videoKey }
router.post('/watch', function(req, res) {
  try {
    var am = req.body.am;
    var videoKey = req.body.videoKey;
    if (!am || !videoKey) return res.status(400).json({ success: false, error: 'am and videoKey required' });
    var data = readJSON('ai_academy.json', {});
    if (!data[am]) data[am] = { weeks: {}, certs: {} };
    var weekKey = getWeekKey();
    if (!data[am].weeks[weekKey]) data[am].weeks[weekKey] = { watched: [], challengeDone: false };
    var watched = data[am].weeks[weekKey].watched;
    if (watched.indexOf(videoKey) < 0) watched.push(videoKey);
    writeJSON('ai_academy.json', data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai-academy/challenge  { am, weekKey }
router.post('/challenge', function(req, res) {
  try {
    var am = req.body.am;
    var weekKey = req.body.weekKey || getWeekKey();
    if (!am) return res.status(400).json({ success: false, error: 'am required' });
    var data = readJSON('ai_academy.json', {});
    if (!data[am]) data[am] = { weeks: {}, certs: {} };
    if (!data[am].weeks[weekKey]) data[am].weeks[weekKey] = { watched: [], challengeDone: false };
    data[am].weeks[weekKey].challengeDone = true;
    writeJSON('ai_academy.json', data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai-academy/ack-cert  { am, monthKey }
router.post('/ack-cert', function(req, res) {
  try {
    var am = req.body.am;
    var monthKey = req.body.monthKey || getMonthKey();
    if (!am) return res.status(400).json({ success: false, error: 'am required' });
    var data = readJSON('ai_academy.json', {});
    if (!data[am]) data[am] = { weeks: {}, certs: {} };
    if (!data[am].certs) data[am].certs = {};
    data[am].certs[monthKey] = true;
    writeJSON('ai_academy.json', data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
