'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON } = require('../services/store');

async function toJpegBuffer(filePath, width, height, quality) {
  var sharp = require('sharp');
  return sharp(filePath).resize(width, height, { fit: 'inside' }).jpeg({ quality }).toBuffer();
}

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
}).fields([{ name: 'photo1' }, { name: 'photo2' }, { name: 'token' }, { name: 'store' }, { name: 'am' }]);

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = 'meta/llama-3.2-11b-vision-instruct';

async function nvidiaChat(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + NVIDIA_API_KEY },
      body: JSON.stringify({ model: NVIDIA_MODEL, messages: messages, max_tokens: 1024, temperature: 0.1 }),
      signal: controller.signal
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error('NVIDIA API ' + resp.status + ': ' + text.substring(0, 200));
    const data = JSON.parse(text);
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

router.get('/submissions', function(req, res) {
  try {
    var data = readJSON('fdu_submissions.json', []);
    var days = parseInt(req.query.days);
    if (days > 0) {
      var cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      data = data.filter(function(d) { return (d.submittedAt || d.date || '').slice(0, 10) >= cutoff; });
    }
    res.json({ success: true, data: data });
  }
  catch(err) { res.status(500).json({ success: false }); }
});

router.get('/donut-results', function(req, res) {
  try {
    var data = readJSON('fdu_donut_submissions.json', []);
    var days = parseInt(req.query.days);
    if (days > 0) {
      var cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      data = data.filter(function(d) { return (d.submittedAt || d.date || '').slice(0, 10) >= cutoff; });
    }
    res.json({ success: true, data: data });
  }
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

router.get('/standards', function(req, res) {
  try {
    var standards = readJSON('fdu_standards.json', { storeSizes: {}, layouts: {}, timbitVariants: [] });
    var store = req.query.store;
    if (store) {
      var size = (standards.storeSizes || {})[store] || '5ft';
      var layout = (standards.layouts || {})[size] || (standards.layouts || {})['5ft'] || {};
      return res.json({ success: true, store: store, size: size, layout: layout, timbitVariants: standards.timbitVariants || [], all: standards });
    }
    res.json({ success: true, standards: standards });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/standards', function(req, res) {
  try {
    var incoming = req.body;
    if (!incoming || typeof incoming !== 'object') return res.status(400).json({ success: false, error: 'Invalid body' });
    incoming.updatedAt = new Date().toISOString();
    writeJSON('fdu_standards.json', incoming);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/submit', fduUpload, async function(req, res) {
  try {
    var now = new Date();
    var entry = {
      id: Date.now().toString(),
      store: req.body.store || '',
      am: (req.body.am || '').replace('Area Manager: ', '').trim(),
      submittedAt: now.toISOString(),
      onTime: true,
      photos: req.files && req.files.photo ? ['/uploads/fdu/' + req.files.photo[0].filename] : [],
      /* legacy fields — kept for history view backward compat */
      topRow: '', midRow: '', timbits: '', tags: '',
      topRowFeedback: '', midRowFeedback: '', timbitsFeedback: '', tagsFeedback: '',
      overallPass: false, summary: '',
      /* rich grading fields */
      fduSize: '',
      dreamBasketsFound: null, dreamBasketsRequired: null, dreamMinPerBasket: null, dreamPass: null, dreamFeedback: '',
      classicBasketsFound: null, classicBasketsRequired: null, classicMinPerBasket: null, classicPass: null, classicFeedback: '',
      timbitBasketsFound: null, timbitBasketsRequired: null, timbitMinPerBasket: null,
      timbitVariantsPresent: [], timbitVariantsMissing: [], timbitPass: null, timbitFeedback: '',
      tagsPass: null, tagsFeedback: ''
    };
    try {
      var photoPath = req.files && req.files.photo ? req.files.photo[0].path : null;
      var msgContent = [];
      if (photoPath && fs.existsSync(photoPath)) {
        var imgBuf = await toJpegBuffer(photoPath, 1024, 1024, 85);
        msgContent.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imgBuf.toString('base64') } });
      }
      var standards = readJSON('fdu_standards.json', { storeSizes: {}, layouts: {} });
      var storeSize = (standards.storeSizes || {})[entry.store] || '5ft';
      var layout = (standards.layouts || {})[storeSize] || {};
      var shelves = layout.shelves || [];
      var topShelf   = shelves.find(function(s){ return s.id === 'top'; })    || { baskets: 5, minPerBasket: 3 };
      var midShelf   = shelves.find(function(s){ return s.id === 'middle'; }) || { baskets: 5, minPerBasket: 3 };
      var btmShelf   = shelves.find(function(s){ return s.id === 'bottom'; }) || { baskets: 4, minPerBasket: 10 };
      var timbitNames = (standards.timbitVariants || []).map(function(t){ return t.name; }).join(', ') || 'Original Glazed, Chocolate, Blueberry, Birthday Cake';
      var timbitList = (standards.timbitVariants || []).map(function(t){ return t.name; });
      var inspectPrompt = 'You are a strict Tim Hortons India FDU quality inspector for ' + entry.store + ' (' + storeSize + ' FDU).' +
        ' MANDATORY STANDARDS FOR THIS STORE:' +
        ' TOP ROW (Dream Donuts): ' + topShelf.baskets + ' baskets, min ' + topShelf.minPerBasket + ' donuts per basket.' +
        ' MIDDLE ROW (Classic Donuts): ' + midShelf.baskets + ' baskets, min ' + midShelf.minPerBasket + ' donuts per basket.' +
        ' BOTTOM ROW (Tim Bits): ' + btmShelf.baskets + ' baskets, min ' + btmShelf.minPerBasket + ' per basket. All 4 variants must be present: ' + timbitNames + '.' +
        ' TAGS: each basket MUST have a small rectangular price+name label attached to the front of the basket. Labels are typically white or coloured cards with printed text. If you can see any labels/cards attached to basket fronts, tags = pass. Only fail tags if NO labels are visible on any basket.' +
        ' CRITICAL: COUNT THE DONUTS INSIDE EACH BASKET individually. A basket with fewer than ' + topShelf.minPerBasket + ' donuts = FAIL for that row.' +
        ' Every basket MUST have the minimum donuts. Partial compliance = FAIL. If ANY basket is underfilled, dreamPass/classicPass MUST be false.' +
        ' Respond ONLY in valid JSON (no markdown): {' +
        '"fduSize":"' + storeSize + '",' +
        '"dreamBasketsFound":<integer>,"dreamBasketsRequired":' + topShelf.baskets + ',"dreamMinPerBasket":' + topShelf.minPerBasket + ',' +
        '"dreamPass":<true ONLY if all baskets present AND every basket has >= ' + topShelf.minPerBasket + ' donuts, else false>,"dreamFeedback":"<list each basket with its donut count, flag any underfilled>",' +
        '"classicBasketsFound":<integer>,"classicBasketsRequired":' + midShelf.baskets + ',"classicMinPerBasket":' + midShelf.minPerBasket + ',' +
        '"classicPass":<true ONLY if all baskets present AND every basket has >= ' + midShelf.minPerBasket + ' donuts, else false>,"classicFeedback":"<list each basket with its donut count, flag any underfilled>",' +
        '"timbitBasketsFound":<integer>,"timbitBasketsRequired":' + btmShelf.baskets + ',"timbitMinPerBasket":' + btmShelf.minPerBasket + ',' +
        '"timbitVariantsPresent":<array — only names from ' + JSON.stringify(timbitList) + ' that are clearly visible>,' +
        '"timbitVariantsMissing":<array — names from that list not visible>,' +
        '"timbitPass":<true if all baskets + all 4 variants + min qty each, else false>,"timbitFeedback":"<baskets + which variants present/missing>",' +
        '"tagsPass":<true if you can see price/name labels on basket fronts, false only if NO labels visible at all>,"tagsFeedback":"<describe what labels you see or don\'t see>",' +
        '"overallPass":<true only if every section passes>,"summary":"<one sentence>"}';
      msgContent.push({ type: 'text', text: inspectPrompt });
      var raw = await nvidiaChat([{ role: 'user', content: msgContent }]);
      var rawClean = raw.trim().replace(/^```json\s*/i,'').replace(/^```/,'').replace(/```$/,'').trim();
      var parsed = JSON.parse(rawClean);
      /* rich grading fields */
      entry.fduSize = parsed.fduSize || storeSize;
      entry.dreamBasketsFound = typeof parsed.dreamBasketsFound === 'number' ? parsed.dreamBasketsFound : null;
      entry.dreamBasketsRequired = topShelf.baskets;
      entry.dreamMinPerBasket = topShelf.minPerBasket;
      entry.dreamPass = parsed.dreamPass === true ? true : parsed.dreamPass === false ? false : null;
      entry.dreamFeedback = parsed.dreamFeedback || '';
      entry.classicBasketsFound = typeof parsed.classicBasketsFound === 'number' ? parsed.classicBasketsFound : null;
      entry.classicBasketsRequired = midShelf.baskets;
      entry.classicMinPerBasket = midShelf.minPerBasket;
      entry.classicPass = parsed.classicPass === true ? true : parsed.classicPass === false ? false : null;
      entry.classicFeedback = parsed.classicFeedback || '';
      entry.timbitBasketsFound = typeof parsed.timbitBasketsFound === 'number' ? parsed.timbitBasketsFound : null;
      entry.timbitBasketsRequired = btmShelf.baskets;
      entry.timbitMinPerBasket = btmShelf.minPerBasket;
      entry.timbitVariantsPresent = Array.isArray(parsed.timbitVariantsPresent) ? parsed.timbitVariantsPresent : [];
      entry.timbitVariantsMissing = Array.isArray(parsed.timbitVariantsMissing) ? parsed.timbitVariantsMissing : [];
      entry.timbitPass = parsed.timbitPass === true ? true : parsed.timbitPass === false ? false : null;
      entry.timbitFeedback = parsed.timbitFeedback || '';
      entry.tagsPass = parsed.tagsPass === true;
      entry.tagsFeedback = parsed.tagsFeedback || '';
      /* server-side safety: override AI if feedback indicates underfilled baskets */
      var sparseRe = /sparse|underfill|fewer than|less than|below minimum|missing donut|only \d|has \d|barely|low count/i;
      if (entry.dreamPass && sparseRe.test(entry.dreamFeedback)) { entry.dreamPass = false; }
      if (entry.classicPass && sparseRe.test(entry.classicFeedback)) { entry.classicPass = false; }
      if (entry.timbitPass && sparseRe.test(entry.timbitFeedback)) { entry.timbitPass = false; }
      /* legacy fields for backward compat */
      entry.topRow = entry.dreamPass === true ? 'Pass' : 'Fail';
      entry.topRowFeedback = entry.dreamFeedback;
      entry.midRow = entry.classicPass === true ? 'Pass' : 'Fail';
      entry.midRowFeedback = entry.classicFeedback;
      entry.timbits = entry.timbitPass === true ? 'Pass' : 'Fail';
      entry.timbitsFeedback = entry.timbitFeedback;
      entry.tags = entry.tagsPass ? 'Pass' : 'Fail';
      entry.overallPass = entry.dreamPass === true && entry.classicPass === true && entry.timbitPass === true && entry.tagsPass === true;
      entry.summary = entry.overallPass ? 'All sections pass FDU standards.' : 'One or more sections failed FDU inspection.';
    } catch(aiErr) {
      console.error('FDU AI grading error:', aiErr.message);
      entry.topRow = 'Submitted'; entry.midRow = 'Submitted';
      entry.timbits = 'Submitted'; entry.tags = 'Submitted';
      entry.overallPass = null; entry.pendingReview = true;
      entry.summary = 'Photo submitted. Manual review pending.';
    }
    var data = readJSON('fdu_submissions.json', []);
    data.push(entry);
    writeJSON('fdu_submissions.json', data);
    res.json({ success: true, onTime: true, entry: entry });
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
      grade1: '', grade2: '', feedback1: '', feedback2: '', overallPass: null, summary: '', pendingReview: true
    };
    try {
      var photo1Path = req.files && req.files.photo1 ? req.files.photo1[0].path : null;
      var photo2Path = req.files && req.files.photo2 ? req.files.photo2[0].path : null;

      // Call 1: Grade Donut 1
      if (photo1Path && fs.existsSync(photo1Path)) {
        var img1Buf = await toJpegBuffer(photo1Path, 400, 400, 50);
        var prompt1 = 'You are a strict QSR quality inspector. Analyze this donut photo. Donut: ' + entry.donut1.name + '. Standards: ' + entry.donut1.standards + '. Check: coating evenness, topping count, quantity (min 3), shape. Respond with ONLY valid JSON, no other text: {"grade":"Pass or Fail","feedback":"one sentence on compliance"}';
        var raw1 = await nvidiaChat([{ role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img1Buf.toString('base64') } },
          { type: 'text', text: prompt1 }
        ] }]);
        raw1 = raw1.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        var jsonMatch1 = raw1.match(/\{[^}]+\}/);
        if (jsonMatch1) {
          var p1 = JSON.parse(jsonMatch1[0]);
          entry.grade1 = (p1.grade === 'Pass' || p1.grade === 'Fail') ? p1.grade : 'Pending Review';
          entry.feedback1 = p1.feedback || '';
        }
      }

      // Call 2: Grade Donut 2
      if (photo2Path && fs.existsSync(photo2Path)) {
        var img2Buf = await toJpegBuffer(photo2Path, 400, 400, 50);
        var prompt2 = 'You are a strict QSR quality inspector. Analyze this donut photo. Donut: ' + entry.donut2.name + '. Standards: ' + entry.donut2.standards + '. Check: coating evenness, topping count, quantity (min 3), shape. Respond with ONLY valid JSON, no other text: {"grade":"Pass or Fail","feedback":"one sentence on compliance"}';
        var raw2 = await nvidiaChat([{ role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + img2Buf.toString('base64') } },
          { type: 'text', text: prompt2 }
        ] }]);
        raw2 = raw2.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        var jsonMatch2 = raw2.match(/\{[^}]+\}/);
        if (jsonMatch2) {
          var p2 = JSON.parse(jsonMatch2[0]);
          entry.grade2 = (p2.grade === 'Pass' || p2.grade === 'Fail') ? p2.grade : 'Pending Review';
          entry.feedback2 = p2.feedback || '';
        }
      }

      if (entry.grade1 === 'Pending Review' || entry.grade2 === 'Pending Review') {
        entry.overallPass = null;
        entry.pendingReview = true;
        entry.summary = 'AI grading incomplete. Manual review required.';
      } else {
        entry.overallPass = entry.grade1 === 'Pass' && entry.grade2 === 'Pass';
        entry.summary = entry.grade1 === 'Pass' && entry.grade2 === 'Pass' ? 'Both donuts pass SOP standards.' : 'One or more donuts failed inspection.';
      }
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
