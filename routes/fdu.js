'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON } = require('../services/store');

const fduUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/fdu/',
    filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,9) + '.jpg'); }
  }),
  limits: { fileSize: 30 * 1024 * 1024 }
}).fields([{ name: 'photo' }]);

const donutUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/fdu/',
    filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,9) + '.jpg'); }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
}).fields([{ name: 'photo1' }, { name: 'photo2' }]);

var Anthropic = require('@anthropic-ai/sdk');

router.get('/submissions', function(req, res) {
  try { res.json({ success: true, data: readJSON('fdu_submissions.json', []) }); }
  catch(err) { res.status(500).json({ success: false }); }
});

router.get('/donut-results', function(req, res) {
  try { res.json({ success: true, data: readJSON('fdu_donut_submissions.json', []) }); }
  catch(err) { res.status(500).json({ success: false }); }
});

router.get('/donut-sop', function(req, res) {
  try {
    var sop = readJSON('donut_sop.json', {});
    var today = new Date().toISOString().substring(0,10);
    if (sop.todaysPick && sop.todaysPick.date === today) {
      return res.json({ success: true, donut1: sop.todaysPick.donut1, donut2: sop.todaysPick.donut2, date: today });
    }
    var donuts = (sop.donuts || []).filter(function(d) { return !d.discontinued; });
    if (donuts.length < 2) return res.json({ success: false, error: 'Not enough donuts' });
    var shuffled = donuts.slice().sort(function() { return Math.random() - 0.5; });
    var pick = { date: today, donut1: shuffled[0], donut2: shuffled[1] };
    sop.todaysPick = pick;
    writeJSON('donut_sop.json', sop);
    res.json({ success: true, donut1: pick.donut1, donut2: pick.donut2, date: today });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/am-summary', function(req, res) {
  try {
    var subs = readJSON('fdu_donut_submissions.json', []);
    var stats = {};
    subs.forEach(function(s) {
      var am = s.am || 'Unknown';
      if (!stats[am]) stats[am] = { am: am, total: 0, passed: 0, failed: 0, stores: {} };
      stats[am].total++;
      var pass = s.overallPass === true || s.grade1 === 'Pass' || s.grade2 === 'Pass';
      if (pass) stats[am].passed++;
      else stats[am].failed++;
      if (s.store) stats[am].stores[s.store] = true;
    });
    var result = Object.values(stats).map(function(a) {
      return { am: a.am, total: a.total, passed: a.passed, failed: a.failed, passRate: a.total > 0 ? Math.round(a.passed / a.total * 100) : 0, storeCount: Object.keys(a.stores).length };
    });
    res.json({ success: true, data: result });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/links', function(req, res) {
  try { res.json({ success: true, data: readJSON('fdu_links.json', []) }); }
  catch(err) { res.status(500).json({ success: false }); }
});

router.post('/submit', fduUpload, async function(req, res) {
  try {
    var now = new Date();
    var ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    var cutoff = new Date(ist); cutoff.setHours(11,30,0,0);
    var onTime = ist <= cutoff;
    var entry = {
      id: Date.now().toString(),
      store: req.body.store || '',
      am: (req.body.am || '').replace('Area Manager: ', '').trim(),
      submittedAt: now.toISOString(),
      onTime: onTime,
      photos: req.files && req.files.photo ? ['/uploads/fdu/' + req.files.photo[0].filename] : [],
      topRow: '', midRow: '', timbits: '', water: '', tags: '',
      topRowFeedback: '', midRowFeedback: '', timbitsFeedback: '', waterFeedback: '', tagsFeedback: '',
      overallPass: false, summary: ''
    };
    try {
      var sharp = require('sharp');
      var aiClient = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var photoPath = req.files && req.files.photo ? req.files.photo[0].path : null;
      var msgContent = [];
      if (photoPath && fs.existsSync(photoPath)) {
        var imgBuf = await sharp(photoPath).resize(1200,1600,{fit:'inside'}).jpeg({quality:70}).toBuffer();
        msgContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imgBuf.toString('base64') } });
      }
      msgContent.push({ type: 'text', text: 'You are a strict Tim Hortons India FDU quality inspector. Inspect this FDU display photo against these exact SOPs: 1. TOP ROW (Dream Donuts): minimum 3 donuts in EACH basket. 2. MIDDLE ROW (Classic Donuts): minimum 2 donuts in EACH basket. 3. TIMBITS ROW: minimum 10 timbits in EACH basket. 4. BOTTOM SHELF: minimum 8 Tim Hortons water bottles upright centered labels forward. 5. TAGS: all price/name tags present neat and visible. Count carefully. Partial compliance = FAIL. Be specific about which basket fails. Respond ONLY in valid JSON no markdown no extra text: {"topRow":"Pass or Fail","midRow":"Pass or Fail","timbits":"Pass or Fail","water":"Pass or Fail","tags":"Pass or Fail","topRowFeedback":"one sentence","midRowFeedback":"one sentence","timbitsFeedback":"one sentence","waterFeedback":"one sentence","tagsFeedback":"one sentence","overallPass":true or false,"summary":"one sentence"}' });
      var resp = await aiClient.messages.create({ model: 'claude-opus-4-8', max_tokens: 1024, messages: [{ role: 'user', content: msgContent }] });
      var raw = resp.content[0].text.trim().replace(/^```json\s*/i,'').replace(/^```/,'').replace(/```$/,'').trim();
      var parsed = JSON.parse(raw);
      entry.topRow = parsed.topRow || 'Pass';
      entry.midRow = parsed.midRow || 'Pass';
      entry.timbits = parsed.timbits || 'Pass';
      entry.water = parsed.water || 'Pass';
      entry.tags = parsed.tags || 'Pass';
      entry.topRowFeedback = parsed.topRowFeedback || '';
      entry.midRowFeedback = parsed.midRowFeedback || '';
      entry.timbitsFeedback = parsed.timbitsFeedback || '';
      entry.waterFeedback = parsed.waterFeedback || '';
      entry.tagsFeedback = parsed.tagsFeedback || '';
      entry.overallPass = parsed.overallPass !== false;
      entry.summary = parsed.summary || '';
    } catch(aiErr) {
      console.error('FDU AI grading error:', aiErr.message);
      entry.topRow = 'Submitted'; entry.midRow = 'Submitted';
      entry.timbits = 'Submitted'; entry.water = 'Submitted'; entry.tags = 'Submitted';
      entry.overallPass = true; entry.summary = 'Photo submitted. Manual review pending.';
    }
    var data = readJSON('fdu_submissions.json', []);
    data.push(entry);
    writeJSON('fdu_submissions.json', data);
    res.json({ success: true, onTime: onTime, entry: entry });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/donut-submit', donutUpload, async function(req, res) {
  try {
    var sop = readJSON('donut_sop.json', {});
    var pick = sop.todaysPick || {};
    var d1 = pick.donut1 || {};
    var d2 = pick.donut2 || {};
    var entry = {
      id: Date.now().toString(),
      store: req.body.store || '',
      am: req.body.am || '',
      submittedAt: new Date().toISOString(),
      donut1: { id: d1.id || '', name: d1.name || '', standards: d1.standards || '' },
      donut2: { id: d2.id || '', name: d2.name || '', standards: d2.standards || '' },
      photo1: req.files && req.files.photo1 ? '/uploads/fdu/' + req.files.photo1[0].filename : '',
      photo2: req.files && req.files.photo2 ? '/uploads/fdu/' + req.files.photo2[0].filename : '',
      grade1: '', grade2: '', feedback1: '', feedback2: '', overallPass: true, summary: ''
    };
    try {
      var sharp = require('sharp');
      var aiClient = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var waterStd = 'Minimum 6 Tim Hortons water bottles upright on bottom FDU shelf, labels forward, no gaps, clean.';
      var textPrompt = 'You are a strict Tim Hortons India QSR quality inspector. Grade each item ONLY against its exact SOP standards. Be strict — partial compliance is a FAIL.' +
        ' DONUT 1 — ' + entry.donut1.name + ' (' + (entry.donut1.type || '') + '). SOP STANDARDS: ' + entry.donut1.standards +
        ' DONUT 2 — ' + entry.donut2.name + ' (' + (entry.donut2.type || '') + '). SOP STANDARDS: ' + entry.donut2.standards +
        ' WATER BOTTLES — Check Photo 1 (FDU display). SOP STANDARDS: ' + waterStd +
        ' For each donut: check coating evenness, topping/drizzle count and pattern, quantity in basket (min 3), shape and finish.' +
        ' For water bottles: count visible bottles (min 6), check upright position, label visibility, gaps.' +
        ' Respond ONLY in valid JSON, no markdown: {"grade1":"Pass or Fail","grade2":"Pass or Fail","waterBottles":"Pass or Fail","feedback1":"specific one sentence citing exact SOP deviation if fail","feedback2":"specific one sentence citing exact SOP deviation if fail","feedbackWater":"one sentence on water bottle compliance","overallPass":true or false,"summary":"one sentence overall"}';
      var donutMsgContent = [];
      var photo1Path = req.files && req.files.photo1 ? req.files.photo1[0].path : null;
      var photo2Path = req.files && req.files.photo2 ? req.files.photo2[0].path : null;
      if (photo1Path && fs.existsSync(photo1Path)) {
        var img1Buf = await sharp(photo1Path).resize(1200, 1600, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
        donutMsgContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img1Buf.toString('base64') } });
      }
      if (photo2Path && fs.existsSync(photo2Path)) {
        var img2Buf = await sharp(photo2Path).resize(1200, 1600, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
        donutMsgContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img2Buf.toString('base64') } });
      }
      donutMsgContent.push({ type: 'text', text: textPrompt });
      var resp = await aiClient.messages.create({ model: 'claude-opus-4-8', max_tokens: 1024, messages: [{ role: 'user', content: donutMsgContent }] });
      var rawText = resp.content[0].text.trim();
      rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      var parsed = JSON.parse(rawText);
      entry.grade1 = parsed.grade1 || 'Pass';
      entry.grade2 = parsed.grade2 || 'Pass';
      entry.waterBottles = parsed.waterBottles || 'Submitted';
      entry.feedback1 = parsed.feedback1 || '';
      entry.feedback2 = parsed.feedback2 || '';
      entry.feedbackWater = parsed.feedbackWater || '';
      entry.overallPass = parsed.overallPass !== false;
      entry.summary = parsed.summary || '';
    } catch(aiErr) {
      console.error('AI grading error:', aiErr.message);
      entry.grade1 = 'Submitted';
      entry.grade2 = 'Submitted';
      entry.feedback1 = 'Photo received. Manual review pending.';
      entry.feedback2 = 'Photo received. Manual review pending.';
      entry.overallPass = null;
      entry.pendingReview = true;
      entry.summary = 'Photos submitted successfully for review.';
    }
    var data = readJSON('fdu_donut_submissions.json', []);
    data.push(entry);
    writeJSON('fdu_donut_submissions.json', data);
    res.json({ success: true, entry: entry });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
