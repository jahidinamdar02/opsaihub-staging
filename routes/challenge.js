'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { readJSON, writeJSON } = require('../services/store');

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = 'meta/llama-3.2-90b-vision-instruct';
const AM_NAMES = ['Raman','Harish','Rohit','Deepak','Sandeep Mukharjee','Akash Rathod','Jagadeesha','Shivam','Kajal','Vrunda'];

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/challenge/',
    filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,9) + '.jpg'); }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
}).single('photo');

async function toJpegBuffer(filePath, w, h, q) {
  var sharp = require('sharp');
  try {
    return await sharp(filePath).resize(w, h, { fit: 'inside' }).jpeg({ quality: q }).toBuffer();
  } catch(e) {
    var tmp = filePath + '.heif.jpg';
    await execFileAsync('heif-convert', [filePath, tmp]);
    var buf = await sharp(tmp).resize(w, h, { fit: 'inside' }).jpeg({ quality: q }).toBuffer();
    fs.unlink(tmp, function(){});
    return buf;
  }
}

async function nvidiaChat(messages) {
  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + NVIDIA_API_KEY },
    body: JSON.stringify({ model: NVIDIA_MODEL, messages: messages, max_tokens: 256, temperature: 0.1 })
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error('NVIDIA API ' + resp.status + ': ' + text.substring(0, 200));
  return JSON.parse(text).choices[0].message.content;
}

function calcScore(subs) {
  if (!subs || !subs.length) return 0;
  var firstPass = subs.find(function(s) { return s.pass; });
  if (firstPass) return firstPass.attemptNumber === 1 ? 100 : 60;
  return 20;
}

// GET /api/challenge?am=Name
router.get('/', function(req, res) {
  try {
    var data = readJSON('challenges.json', { active: null, submissions: [], history: [] });
    var am = req.query.am || '';
    var activeId = data.active && data.active.id;
    var mySubmissions = am && activeId
      ? data.submissions.filter(function(s) { return s.am === am && s.challengeId === activeId; })
      : [];
    res.json({ success: true, active: data.active, mySubmissions: mySubmissions });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/challenge/leaderboard
router.get('/leaderboard', function(req, res) {
  try {
    var data = readJSON('challenges.json', { active: null, submissions: [], history: [] });
    if (!data.active) return res.json({ success: true, leaderboard: [] });
    var cid = data.active.id;
    var leaderboard = AM_NAMES.map(function(am) {
      var amSubs = data.submissions.filter(function(s) { return s.am === am && s.challengeId === cid; });
      return { am: am, score: calcScore(amSubs), attempts: amSubs.length, passed: amSubs.some(function(s) { return s.pass; }) };
    }).sort(function(a, b) { return b.score - a.score || a.attempts - b.attempts; });
    res.json({ success: true, leaderboard: leaderboard });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/challenge/create
router.post('/create', function(req, res) {
  try {
    var deviation = req.body.deviation, correctState = req.body.correctState, closesAt = req.body.closesAt;
    if (!deviation || !correctState || !closesAt) return res.status(400).json({ success: false, error: 'deviation, correctState and closesAt required' });
    var data = readJSON('challenges.json', { active: null, submissions: [], history: [] });
    if (data.active) data.history.push(data.active);
    var now = new Date();
    var d = new Date(Date.UTC(now.getFullYear(), 0, 1));
    var weekNum = Math.ceil(((now - d) / 86400000 + d.getUTCDay() + 1) / 7);
    data.active = { id: now.getFullYear() + '-W' + String(weekNum).padStart(2,'0'), deviation: deviation, correctState: correctState, createdAt: now.toISOString(), closesAt: closesAt };
    writeJSON('challenges.json', data);
    res.json({ success: true, active: data.active });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/challenge/submit
router.post('/submit', function(req, res) {
  upload(req, res, async function(multerErr) {
    if (multerErr) return res.status(400).json({ success: false, error: multerErr.message });
    try {
      var data = readJSON('challenges.json', { active: null, submissions: [], history: [] });
      if (!data.active) return res.status(400).json({ success: false, error: 'No active challenge' });
      if (new Date() > new Date(data.active.closesAt)) return res.status(400).json({ success: false, error: 'Challenge closed' });
      var am = req.body.am;
      if (!am || !req.file) return res.status(400).json({ success: false, error: 'am and photo required' });
      var cid = data.active.id;
      var prev = data.submissions.filter(function(s) { return s.am === am && s.challengeId === cid; });
      var sub = {
        id: Date.now().toString(), challengeId: cid, am: am,
        submittedAt: new Date().toISOString(), attemptNumber: prev.length + 1,
        pass: false, feedback: 'Manual review pending',
        photo: '/uploads/challenge/' + req.file.filename
      };
      try {
        var imgBuf = await toJpegBuffer(req.file.path, 800, 800, 75);
        var prompt = 'Tim Hortons India operations inspector. Required standard: "' + data.active.correctState + '". Deviation that needed correction: "' + data.active.deviation + '". Does this photo show the correct state has been achieved? Respond ONLY with valid JSON, no markdown: {"pass":true or false,"feedback":"one sentence"}';
        var raw = await nvidiaChat([{ role: 'user', content: [
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imgBuf.toString('base64') } },
          { type: 'text', text: prompt }
        ]}]);
        var cleaned = raw.trim().replace(/^```json\s*/i,'').replace(/^```/,'').replace(/```$/,'').trim();
        var parsed = JSON.parse(cleaned);
        sub.pass = parsed.pass === true;
        sub.feedback = parsed.feedback || '';
      } catch(aiErr) {
        console.error('[challenge] grading error:', aiErr.message);
      }
      data.submissions.push(sub);
      writeJSON('challenges.json', data);
      res.json({ success: true, submission: sub });
    } catch(err) { res.status(500).json({ success: false, error: err.message }); }
  });
});

module.exports = router;
