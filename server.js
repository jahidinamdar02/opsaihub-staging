'use strict';
require('dotenv').config();
const nodemailer = require('nodemailer');
const multer = require('multer');
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3004;
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── FY27 Targets API (must be before static middleware) ──
app.get('/api/fy27-targets', function(req, res) {
  try {
    var data = readJSON('fy27_targets.json', {});
    res.json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});


// ── Delivery API (before static middleware) ──────────────
app.get('/api/delivery', function(req, res) {
  try {
    var data = readJSON('delivery.json', []);
    var month = req.query.month;
    if(month) data = data.filter(function(d){ return d.month === month; });
    res.json({ success:true, data:data });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

app.post('/api/delivery', function(req, res) {
  try {
    var data = readJSON('delivery.json', []);
    var payload = req.body;
    payload.id = Date.now().toString();
    var idx = data.findIndex(function(d){ return d.store===payload.store && d.month===payload.month; });
    if(idx >= 0) data[idx] = payload;
    else data.push(payload);
    writeJSON('delivery.json', data);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});


// ── FDU Dashboard APIs (before static) ───────────────────
app.get('/api/fdu/submissions', function(req, res) {
  try { res.json({ success:true, data:readJSON('fdu_submissions.json', []) }); }
  catch(err) { res.status(500).json({ success:false }); }
});

app.get('/api/fdu/donut-results', function(req, res) {
  try { res.json({ success:true, data:readJSON('fdu_donut_submissions.json', []) }); }
  catch(err) { res.status(500).json({ success:false }); }
});

app.use(express.static(path.join(__dirname, 'public')));
const uploadsDir = path.join(__dirname, 'uploads', 'checklist');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
function readJSON(filename, fallback) {
  if (fallback === undefined) fallback = [];
  try {
    const filepath = path.join(__dirname, 'data', filename);
    if (!fs.existsSync(filepath)) return fallback;
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (err) { return fallback; }
}
function writeJSON(filename, data) {
  try {
    fs.writeFileSync(path.join(__dirname, 'data', filename), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) { return false; }
}

// ── AM Email Map ──────────────────────────────────────────
var AM_EMAILS = {
  'Raman':       'raman.kumar@timhortonsindia.com',
  'Harish':      'harish.solanki@timhortonsindia.com',
  'Rohit':       'rohit.gupta@timhortonsindia.com',
  'Deepak':      'deepak.kumar@timhortonsindia.com',
  'Akash Chavan':'akash.chavan@timhortonsindia.com',
  'Akash Rathod':'akash.rathod@timhortonsindia.com',
  'Jagadeesha':  'jagadeesha.shetty@timhortonsindia.com',
  'Shivam':      'shivam.singh@timhortonsindia.com',
  'Jahid':       'jahid.inamdar@timhortonsindia.com'
};
var CC_EMAIL   = 'sandeep.yadav@timhortonsindia.com';
var HOD_EMAIL  = 'jahid.inamdar@timhortonsindia.com';
var CEO_EMAIL  = 'tarun.jain@timhortonsindia.com';
var TRAINING_EMAIL = 'trainingcentre.west@timhortonsindia.com';

var transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
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
  var mailOptions = {
    from: '"Tim\'s Ops Connect" <' + process.env.EMAIL_USER + '>',
    to: amEmail,
    cc: [CC_EMAIL],
    subject: subject,
    html: html
  };
  transporter.sendMail(mailOptions, function(err, info) {
    if (err) { console.error('Email error:', err.message); }
    else { console.log('Email sent to', amEmail); }
    if (callback) callback(err);
  });
}





// ── KPI Data Routes ───────────────────────────────────────
app.get('/api/kpi/:month', function(req, res) {
  var month = req.params.month;
  var allowed = ['feb2026','mar2026'];
  if (allowed.indexOf(month) === -1) return res.status(400).json({error:'Invalid month'});
  try {
    var data = readJSON('kpi_'+month+'.json', {});
    res.json(data);
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});


app.get('/api/issues', function(req, res) {
  try { res.json({ success:true, data: readJSON('issues.json', []) }); }
  catch(e) { res.status(500).json({ success:false, error:e.message }); }
});


app.get('/api/health-scores', function(req, res) {
  try { res.json({ success:true, data: (readJSON('health_scores.json', {})).stores || [] }); }
  catch(e) { res.status(500).json({ success:false, error:e.message }); }
});


app.get('/api/audits', function(req, res) {
  try { res.json({ success:true, data: readJSON('audits.json', {audits:[]}) }); }
  catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.post('/api/audits', function(req, res) {
  try {
    var data = readJSON('audits.json', {audits:[]});
    var entry = req.body;
    entry.id = Date.now().toString();
    entry.submittedAt = new Date().toISOString();
    // Remove existing entry for same store+cycle+type if exists
    data.audits = data.audits.filter(function(a){
      return !(a.store === entry.store && a.cycle === entry.cycle && a.type === entry.type);
    });
    data.audits.push(entry);
    writeJSON('audits.json', data);
    res.json({ success:true, id: entry.id });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});


app.get('/api/world-events', function(req, res) {
  try {
    var data = readJSON('world_events.json', {events:[]});
    res.json({ success:true, data: data.events, lastUpdated: data.lastUpdated });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});
app.get('/health', function(req, res) {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'staging', port: PORT, uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});
app.get('/api/stores', function(req, res) {
  try { res.json({ success: true, data: readJSON('stores.json', []) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/stores/am/:amName', function(req, res) {
  try {
    const stores = readJSON('stores.json', []);
    res.json({ success: true, data: stores.filter(function(s) { return s.am.toLowerCase() === req.params.amName.toLowerCase(); }) });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/checklist/:day', function(req, res) {
  try {
    const items = readJSON('checklist-items.json', {});
    const day = req.params.day.toLowerCase();
    res.json({ success: true, day: day, data: items[day] || [] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/submissions', function(req, res) {
  try {
    var submissions = readJSON('submissions.json', []);
    var submission = req.body;
    // Add timestamp if missing
    if (!submission.submittedAt) {
      submission.submittedAt = new Date().toISOString();
    }
    if (!submission.date) {
      submission.date = new Date().toISOString().slice(0,10);
    }
    // Generate ID if missing
    if (!submission.id) {
      submission.id = Date.now().toString();
    }
    // Check for duplicate (same day + store + date)
    var dupIdx = submissions.findIndex(function(s) {
      return s.day === submission.day && 
             s.store === submission.store && 
             s.date === submission.date;
    });
    if (dupIdx >= 0) {
      submissions[dupIdx] = submission; // Update existing
    } else {
      submissions.push(submission);
    }
    writeJSON('submissions.json', submissions);
    // Send email confirmation (non-blocking)
    try {
      sendSubmissionEmail(submission, null);
    } catch(emailErr) {
      console.error('Email send error:', emailErr.message);
    }
    res.json({ success: true, id: submission.id, message: 'Submission saved' });
  } catch(err) {
    console.error('Submission error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

;
app.get('/api/submissions', function(req, res) {
  try {
    let data = readJSON('submissions.json', []);
    if (req.query.am) data = data.filter(function(s) { return s.am === req.query.am; });
    if (req.query.day) data = data.filter(function(s) { return s.day === req.query.day; });
    if (req.query.store) data = data.filter(function(s) { return s.store === req.query.store; });
    res.json({ success: true, data: data, count: data.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/performance', function(req, res) {
  try {
    let data = readJSON('performance.json', []);
    if (req.query.am) data = data.filter(function(p) { return p.am === req.query.am; });
    res.json({ success: true, data: data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/coverage', function(req, res) {
  try {
    let data = readJSON('coverage.json', []);
    if (req.query.am) data = data.filter(function(c) { return c.am === req.query.am; });
    if (req.query.month) data = data.filter(function(c) { return c.month === req.query.month; });
    res.json({ success: true, data: data });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/coverage', function(req, res) {
  try {
    const coverage = readJSON('coverage.json', []);
    const am = req.body.am, month = req.body.month, store = req.body.store, day = req.body.day;
    let amRec = null;
    for (var i = 0; i < coverage.length; i++) { if (coverage[i].am === am && coverage[i].month === month) { amRec = coverage[i]; break; } }
    if (!amRec) { amRec = { am: am, month: month, stores: [] }; coverage.push(amRec); }
    let storeRec = null;
    for (var j = 0; j < amRec.stores.length; j++) { if (amRec.stores[j].store === store) { storeRec = amRec.stores[j]; break; } }
    if (!storeRec) { storeRec = { store: store, wed: false, fri: false, sat: false, sun: false }; amRec.stores.push(storeRec); }
    if (day === 'wed' || day === 'fri' || day === 'sat' || day === 'sun') storeRec[day] = true;
    if (!writeJSON('coverage.json', coverage)) return res.status(500).json({ success: false, error: 'Save failed' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.get('/api/posts', function(req, res) {
  try { res.json({ success: true, data: readJSON('posts.json', []) }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/posts', function(req, res) {
  try {
    const posts = readJSON('posts.json', []);
    const newPost = Object.assign({ id: Date.now().toString() }, req.body, { createdAt: new Date().toISOString(), pinned: false, reactions: {}, replies: [] });
    posts.unshift(newPost);
    if (!writeJSON('posts.json', posts)) return res.status(500).json({ success: false, error: 'Save failed' });
    res.json({ success: true, data: newPost });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/timsy/chat', async function(req, res) {
  try {
    const sops = readJSON('timsy-sops.json', []);
    const sopContext = sops.map(function(s) { return 'MODULE: ' + s.module + ' ' + s.content; }).join(' --- ');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        system: 'You are Timsy, AI training assistant for Tim Hortons India. Answer only from SOPs. Under 150 words. End with: Need more help? Just ask! SOPs: ' + sopContext,
        messages: [{ role: 'user', content: req.body.message }] })
    });
    const data = await response.json();
    const reply = (data.content && data.content[0]) ? data.content[0].text : 'I will check with the ops team on that one.';
    res.json({ success: true, reply: reply });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
app.post('/api/timsy/results', function(req, res) {
  try {
    const results = readJSON('timsy-results.json', []);
    const newResult = Object.assign({ id: Date.now().toString() }, req.body, { completedAt: new Date().toISOString() });
    results.push(newResult);
    if (!writeJSON('timsy-results.json', results)) return res.status(500).json({ success: false, error: 'Save failed' });
    res.json({ success: true, data: newResult });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});
// ── Products API ─────────────────────────────────────────
app.get('/api/products', function(req, res) {
  try { res.json({ success:true, data:readJSON('products.json', []) }); }
  catch(err) { res.status(500).json({ success:false, error:err.message }); }
});
app.post('/api/products', function(req, res) {
  try {
    var data = readJSON('products.json', []);
    data.unshift(req.body);
    writeJSON('products.json', data);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ── Projects API ─────────────────────────────────────────
app.get('/api/projects', function(req, res) {
  try { res.json({ success:true, data:readJSON('projects.json', []) }); }
  catch(err) { res.status(500).json({ success:false, error:err.message }); }
});
app.post('/api/projects', function(req, res) {
  try {
    var data = readJSON('projects.json', []);
    data.push(req.body);
    writeJSON('projects.json', data);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ── Timsy Results API ─────────────────────────────────────
app.get('/api/timsy/results', function(req, res) {
  try { res.json({ success:true, data:readJSON('timsy-results.json', []) }); }
  catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ── Training API ─────────────────────────────────────────
app.get('/api/training', function(req, res) {
  try { res.json({ success:true, data:readJSON('training.json', []) }); }
  catch(err) { res.status(500).json({ success:false, error:err.message }); }
});
app.post('/api/training', function(req, res) {
  try {
    var data = readJSON('training.json', []);
    var payload = req.body;
    var idx = data.findIndex(function(d){ return d.store===payload.store; });
    if(idx>=0) data[idx]=payload; else data.push(payload);
    writeJSON('training.json', data);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

// ── Feed APIs ─────────────────────────────────────────────
app.post('/api/posts/react', function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p){ return p.id === req.body.postId; });
    if(post) {
      if(!post.reactions) post.reactions = {};
      post.reactions[req.body.emoji] = req.body.count;
      writeJSON('posts.json', posts);
    }
    res.json({ success:true });
  } catch(err) { res.json({ success:false }); }
});

app.post('/api/posts/comment', function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p){ return p.id === req.body.postId; });
    if(post) {
      if(!post.comments) post.comments = [];
      post.comments.push(req.body.comment);
      writeJSON('posts.json', posts);
    }
    res.json({ success:true });
  } catch(err) { res.json({ success:false }); }
});

app.post('/api/feed/upload', multer({dest:'uploads/feed/'}).single('photo'), function(req, res) {
  try {
    if(!req.file) return res.json({ success:false });
    res.json({ success:true, url:'/uploads/feed/'+req.file.filename });
  } catch(err) { res.json({ success:false }); }
});

// ── Ask Jahid Smart Bot Routes ────────────────────────────
var JAHID_SYSTEM_PROMPT = 'You are Ask Jahid, the smart operations assistant for Tim Hortons India\'s platform Tim\'s Ops Connect. Help Area Managers with data entry, checklist guidance, KPI understanding and technical issues. Be warm, direct, concise under 150 words unless step-by-step needed. End with: Need more help? Just ask! KEY: 9 AMs, 44 stores, 6 regions. Mon&Tue ALL stores remote by midnight. Wed/Fri/Sat/Sun one store on-site visit. Thu day off. Score: YES=1 NO=0 NA=excluded. Green 90-100 Yellow 75-89 Orange 60-74 Red below 60. ADS=Avg Daily Sales ADT=Avg Daily Transactions APC=Avg Per Check UPD=Units Per Day. Wednesday machines use comment field not date. April targets 60K+ stores x1.09 sub-60K x1.05.';

// ── FDU APIs ─────────────────────────────────────────────
app.get('/api/fdu/donut-sop', function(req, res) {
  try {
    var sop = readJSON('donut_sop.json', {});
    var today = new Date().toISOString().substring(0,10);
    if(sop.todaysPick && sop.todaysPick.date === today) {
      return res.json({ success:true, donut1:sop.todaysPick.donut1, donut2:sop.todaysPick.donut2, date:today });
    }
    var donuts = sop.donuts || [];
    if(donuts.length < 2) return res.json({ success:false, error:'Not enough donuts' });
    var shuffled = donuts.slice().sort(function(){ return Math.random()-0.5; });
    var pick = { date:today, donut1:shuffled[0], donut2:shuffled[1] };
    sop.todaysPick = pick;
    writeJSON('donut_sop.json', sop);
    res.json({ success:true, donut1:pick.donut1, donut2:pick.donut2, date:today });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

app.post('/api/fdu/submit', multer({storage:require('multer').diskStorage({destination:'uploads/fdu/',filename:function(req,file,cb){cb(null,Date.now()+'-'+Math.random().toString(36).substr(2,9)+'.jpg');}})}). fields([{name:'photo'}]), function(req, res) {
  try {
    var data = readJSON('fdu_submissions.json', []);
    var entry = {
      id: Date.now().toString(),
      store: req.body.store || '',
      am: (req.body.am||'').replace('Area Manager: ','').trim(),
      submittedAt: new Date().toISOString(),
      photos: req.files ? Object.keys(req.files).map(function(k){ return '/uploads/fdu/'+req.files[k][0].filename+'.jpg'; }) : []
    };
    data.push(entry);
    writeJSON('fdu_submissions.json', data);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

app.post('/api/fdu/donut-submit', multer({storage:require('multer').diskStorage({destination:'uploads/fdu/',filename:function(req,file,cb){cb(null,Date.now()+'-'+Math.random().toString(36).substr(2,9)+'.jpg');}}),limits:{fileSize:20*1024*1024}}).fields([{name:'photo1'},{name:'photo2'}]), async function(req, res) {
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
      donut1: { id: d1.id||'', name: d1.name||'', standards: d1.standards||'' },
      donut2: { id: d2.id||'', name: d2.name||'', standards: d2.standards||'' },
      photo1: req.files && req.files.photo1 ? '/uploads/fdu/'+req.files.photo1[0].filename : '',
      photo2: req.files && req.files.photo2 ? '/uploads/fdu/'+req.files.photo2[0].filename : '',
      grade1: '', grade2: '', feedback1: '', feedback2: '', overallPass: true, summary: ''
    };
    try {
      var Anthropic = require('@anthropic-ai/sdk');
      var client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      var textPrompt = 'You are a QSR food quality inspector.' +
        ' Donut 1: ' + entry.donut1.name + '. Standards: ' + entry.donut1.standards +
        ' Donut 2: ' + entry.donut2.name + '. Standards: ' + entry.donut2.standards +
        ' Look at both photos and grade each donut.' +
        ' Respond ONLY in valid JSON, no markdown: {"grade1":"Pass or Fail","grade2":"Pass or Fail","feedback1":"one sentence","feedback2":"one sentence","overallPass":true or false,"summary":"one sentence"}';
      var msgContent = [];
      var photo1Path = req.files && req.files.photo1 ? req.files.photo1[0].path : null;
      var photo2Path = req.files && req.files.photo2 ? req.files.photo2[0].path : null;
      function detectMime(buf) {
        if(buf[0]===0x89&&buf[1]===0x50) return 'image/png';
        if(buf[0]===0xFF&&buf[1]===0xD8) return 'image/jpeg';
        if(buf[0]===0x47&&buf[1]===0x49) return 'image/gif';
        return 'image/jpeg';
      }
      if (photo1Path && fs.existsSync(photo1Path)) {
        var img1 = fs.readFileSync(photo1Path);
        msgContent.push({ type: 'image', source: { type: 'base64', media_type: detectMime(img1), data: img1.toString('base64') } });
      }
      if (photo2Path && fs.existsSync(photo2Path)) {
        var img2 = fs.readFileSync(photo2Path);
        msgContent.push({ type: 'image', source: { type: 'base64', media_type: detectMime(img2), data: img2.toString('base64') } });
      }
      msgContent.push({ type: 'text', text: textPrompt });
      var resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: msgContent }]
      });
      var rawText = resp.content[0].text.trim();
      rawText = rawText.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'').trim();
      var parsed = JSON.parse(rawText);
      entry.grade1 = parsed.grade1 || 'Pass';
      entry.grade2 = parsed.grade2 || 'Pass';
      entry.feedback1 = parsed.feedback1 || '';
      entry.feedback2 = parsed.feedback2 || '';
      entry.overallPass = parsed.overallPass !== false;
      entry.summary = parsed.summary || '';
    } catch(aiErr) {
      console.error('AI grading error:', aiErr.message);
      entry.grade1 = 'Submitted';
      entry.grade2 = 'Submitted';
      entry.feedback1 = 'Photo received. Manual review pending.';
      entry.feedback2 = 'Photo received. Manual review pending.';
      entry.overallPass = true;
      entry.summary = 'Photos submitted successfully for review.';
    }
    var data = readJSON('fdu_donut_submissions.json', []);
    data.push(entry);
    writeJSON('fdu_donut_submissions.json', data);
    res.json({ success: true, entry: entry });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/fdu/am-summary', function(req, res) {
  try {
    var subs = readJSON('fdu_donut_submissions.json', []);
    var stats = {};
    subs.forEach(function(s) {
      var am = s.am || 'Unknown';
      stats[am].total++;
      if (s.grade === 'A' || s.grade === 'B') stats[am].passed++;
      else stats[am].failed++;
      if (s.store) stats[am].stores[s.store] = true;
    });
    var result = Object.values(stats).map(function(a) {
      return {
        am: a.am,
        total: a.total,
        passed: a.passed,
        failed: a.failed,
        passRate: a.total > 0 ? Math.round(a.passed/a.total*100) : 0,
        storeCount: Object.keys(a.stores).length
      };
    });
    res.json({ success:true, data:result });
  } catch(err) { res.status(500).json({ success:false, error:err.message }); }
});

app.get('/api/fdu/links', function(req, res) {
  try { res.json({ success:true, data:readJSON('fdu_links.json', []) }); }
  catch(err) { res.status(500).json({ success:false }); }
});

app.post('/api/ask-jahid/chat', async function(req, res) {
  try {
    var message = req.body.message || req.body.query || '';
    var history = req.body.history || req.body.messages || [];
    var https = require('https');

    // READ LIVE DATA ON EVERY REQUEST
    var sales = readJSON('sales_summary.json', {});
    var audits = readJSON('audits.json', {audits:[]});
    var submissions = readJSON('submissions.json', []);
    var m = sales.march || {}, f = sales.feb || {};

    var today = new Date();
    var yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    var weekStart = new Date(today); weekStart.setDate(today.getDate()-today.getDay()+1); weekStart.setHours(0,0,0,0);

    // Build DETAILED per-AM submission data including content quality
    var AM_STORES = {
      'Raman': ['TH T3D DIAL','TH T3D Food Court','TH T1D Dial'],
      'Harish': ['TH DLF Cyberhub','TH Golf Course AIPL','TH Select City Saket','TH Green Park','TH Basant Lok','TH Epicuria Nehru Place'],
      'Rohit': ['TH Skymark one','TH Vegas Mall','TH NSP Pritampura','TH Punjabi bagh'],
      'Deepak': ['TH Malhar Road','TH Sunview Enclave','TH Bucho Bathinda','TH Patiala','TH Mohali','TH Sangrur','TH Elante Mall','TH Sec 35 Chandigarh'],
      'Akash Chavan': ['TH Balewadi Pune','TH Lokhandwala','TH MC Kurla','TH Viman Nagar','TH Phonix Mall Wakad','TH FC Road','TH FIFC Mumbai'],
      'Akash Rathod': ['TH HPCL Mumbai Pune Expressway','TH NMIA Arrival','TH NMiA Departure','TH Nexus Seawood'],
      'Jagadeesha': ['TH Koramangala','TH BIAL','TH Mall of Asia','TH HSR'],
      'Shivam': ['TH Inorbit Mall-Hyderabad','TH HIAL','TH HIAL Arrival','TH Lakeshore']
    };

    // Build rich submission detail per AM
    var amSubDetail = Object.keys(AM_STORES).map(function(am){
      var amSubs = submissions.filter(function(s){ return s.am === am; })
        .sort(function(a,b){return new Date(b.submittedAt||0)-new Date(a.submittedAt||0);});
      
      var yesterdaySubs = amSubs.filter(function(s){
        return new Date(s.submittedAt||s.timestamp||0).toDateString() === yesterday.toDateString();
      });
      var weekSubs = amSubs.filter(function(s){
        return new Date(s.submittedAt||s.timestamp||0) >= weekStart;
      });
      var lastSub = amSubs[0];

      // Analyse submission quality
      var subDetails = yesterdaySubs.map(function(s){
        var answerCount = Object.keys(s.answers||{}).length;
        var totalItems = s.day==='saturday'||s.day==='sunday' ? 12 :
                         s.day==='monday' ? 14 :
                         s.day==='wednesday' ? 9 : 8;
        var hasSpeedTimes = s.speedTimes && Object.keys(s.speedTimes).length > 0;
        var speedDetails = hasSpeedTimes ? ' speed times: '+Object.values(s.speedTimes).join(', ') : '';
        var quality = answerCount === 0 ? 'EMPTY - no items ticked' :
                      answerCount < totalItems ? 'PARTIAL - only '+answerCount+'/'+totalItems+' items answered' :
                      'COMPLETE - all items answered';
        return s.day+' at '+s.store.replace('TH ','')+' | score: '+(s.score||0)+'% | checklist: '+quality+speedDetails;
      }).join('; ');

      return am + ':\n' +
        '  Yesterday: ' + (yesterdaySubs.length ? subDetails : 'nothing submitted') + '\n' +
        '  This week: ' + weekSubs.length + ' submissions | ' +
        (lastSub ? 'Last: '+lastSub.day+' '+lastSub.store.replace('TH ','')+' on '+(lastSub.submittedAt||'').substring(0,10) : 'no submissions yet');
    }).join('\n');

    // REV audit
    var revAudits = (audits.audits||[]).filter(function(a){return a.rev_score!==null&&a.rev_score!==undefined;});
    var indiaAvg = revAudits.length ? Math.round(revAudits.reduce(function(t,a){return t+a.rev_score;},0)/revAudits.length*10)/10 : 0;
    var amRevLines = Object.keys(AM_STORES).map(function(am){
      var ra = revAudits.filter(function(a){return a.am===am;});
      if(!ra.length) return am+': no REV data';
      var avg = Math.round(ra.reduce(function(t,a){return t+a.rev_score;},0)/ra.length*10)/10;
      return am+': '+avg+'% ('+(avg>=86?'Excellent':avg>=77?'Pass':'NON-PERFORMING')+')';
    }).join(' | ');
    var failed = revAudits.filter(function(a){return a.rev_score<77;}).map(function(a){return a.store.replace('TH ','')+'('+a.rev_score+'%)';}).join(', ');
    var regionAvgs = {'Delhi NCR':['Raman','Harish','Rohit'],'Punjab':['Deepak'],'Maharashtra':['Akash Chavan','Akash Rathod'],'Karnataka':['Jagadeesha'],'Telangana':['Shivam']};
    var regionLines = Object.keys(regionAvgs).map(function(r){
      var ra=revAudits.filter(function(a){return regionAvgs[r].indexOf(a.am)>-1;});
      var avg=ra.length?Math.round(ra.reduce(function(t,a){return t+a.rev_score;},0)/ra.length*10)/10:null;
      return r+': '+(avg!==null?avg+'%':'no data');
    }).join(' | ');

    var systemPrompt = 'You are Jahid, an AI assistant for QSR India operations.\n\n' +
      'RESPONSE RULES - STRICTLY FOLLOW:\n' +
      '1. Be CRISP and DIRECT. Answer in 2-4 lines maximum unless a detailed breakdown is asked.\n' +
      '2. Answer ONLY what was asked. Do NOT add unsolicited context, audit scores, action items, or next steps unless asked.\n' +
      '3. NEVER add sections like "Context on stores", "Action needed", "Next steps" unless explicitly asked.\n' +
      '4. Use the live data below. NEVER say you cannot access data.\n' +
      '5. If submission exists but checklist is empty — say it was submitted but checklist items were not filled.\n' +
      '6. No bullet points for simple factual answers. Just a clean direct sentence or two.\n\n' +
      'TODAY: ' + today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) + '\n' +
      'YESTERDAY: ' + yesterday.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}) + '\n\n' +
      'LIVE SUBMISSION DATA:\n' + amSubDetail + '\n\n' +
      'AM STORES:\n' +
      'Raman (Delhi NCR): T3D DIAL, T3D Food Court, T1D Dial\n' +
      'Harish (Delhi NCR): DLF Cyberhub, Golf Course AIPL, Select City Saket, Green Park, Basant Lok, Epicuria Nehru Place\n' +
      'Rohit (Delhi NCR): Skymark, Vegas Mall, NSP Pritampura, Punjabi Bagh\n' +
      'Deepak (Punjab): Malhar Road, Sunview, Bucho Bathinda, Patiala, Mohali, Sangrur, Elante Mall, Sec 35 Chandigarh\n' +
      'Akash Chavan (Maharashtra): Balewadi, Lokhandwala, MC Kurla, Viman Nagar, Wakad, FC Road, FIFC\n' +
      'Akash Rathod (Maharashtra): HPCL MPE, NMIA Arrival, NMIA Departure, Seawoods\n' +
      'Jagadeesha (Karnataka): Koramangala, BIAL, Mall of Asia, HSR\n' +
      'Shivam (Telangana): Inorbit Hyderabad, HIAL, HIAL Arrival, Lakeshore\n\n' +
      'MARCH 2026 KPIs: ADS Rs.'+m.ads+' | ADT '+m.adt+' | APC Rs.'+m.apc+' | MTD Rs.'+m.total_mtd+' | Delivery Rs.'+m.del_mtd+' | vs LY '+m.vs_ly+'%\n' +
      'FEB 2026 KPIs: ADS Rs.'+f.ads+' | ADT '+f.adt+' | APC Rs.'+f.apc+' | MTD Rs.'+f.total_mtd+'\n\n' +
      'REV AUDIT H1 2026 (Pass=77%+, Target=86%+):\n' +
      'India Average: '+indiaAvg+'% | By Region: '+regionLines+'\n' +
      'AM Scores: '+amRevLines+'\n' +
      'Failed stores (<77%): '+(failed||'none')+'\n\n' +
      'LTO: Mango LTO launches 1 April 2026, ends 14 May 2026. All 44 stores.\n\n' +
      'CHECKLIST DAYS: Monday=Financial Audit | Tuesday=Sales Intelligence | Wednesday=Maintenance visit | Thursday=Rest | Friday=People & Readiness | Saturday/Sunday=Weekend Operations';

    var apiMessages = history.concat([{role:'user', content:message}]);
    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: systemPrompt,
      messages: apiMessages
    });
    var opts = {
      hostname:'api.anthropic.com', path:'/v1/messages', method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(body)}
    };
    var apiReq = https.request(opts, function(apiRes){
      var data='';
      apiRes.on('data',function(c){data+=c;});
      apiRes.on('end',function(){
        try{
          var p=JSON.parse(data);
          var reply=p.content&&p.content[0]?p.content[0].text:'Sorry, please try again.';
          res.json({success:true, reply:reply});
        }catch(e){res.json({success:false,error:'Parse error'});}
      });
    });
    apiReq.on('error',function(e){res.json({success:false,error:e.message});});
    apiReq.write(body);
    apiReq.end();
  } catch(e){res.status(500).json({success:false,error:e.message});}
});

app.post('/api/ask-jahid/issue', async function(req, res) {
  var name = req.body.name || 'Unknown AM';
  var store = req.body.store || 'Not specified';
  var description = req.body.description || '';
  var amEmails = { 'Raman':'raman.kumar@timhortonsindia.com','Harish':'harish.solanki@timhortonsindia.com','Rohit':'rohit.gupta@timhortonsindia.com','Deepak':'deepak.kumar@timhortonsindia.com','Akash Chavan':'akash.chavan@timhortonsindia.com','Akash Rathod':'akash.rathod@timhortonsindia.com','Jagadeesha':'jagadeesha.shetty@timhortonsindia.com','Shivam':'shivam.singh@timhortonsindia.com' };
  var amEmail = amEmails[name] || null;
  var toList = ['jahid.inamdar@timhortonsindia.com','sandeep.yadav@timhortonsindia.com'];
  if (amEmail) toList.push(amEmail);
  var html = '<div style="font-family:Arial,sans-serif"><div style="background:#C8102E;padding:20px;border-radius:8px 8px 0 0"><h2 style="color:#fff;margin:0">Technical Issue Reported — Tim\'s Ops Connect</h2></div><div style="background:#f5f5f7;padding:20px"><p><b>AM:</b> ' + name + '</p><p><b>Store:</b> ' + store + '</p><p><b>Time:</b> ' + new Date().toLocaleString("en-IN") + '</p><p><b>Issue:</b> ' + description + '</p></div></div>';
  try {
    await transporter.sendMail({ from: '"Tim\'s Ops Connect" <' + process.env.EMAIL_USER + '>', to: toList.join(', '), subject: '[OpsAIHub Alert] Issue — ' + name + ' — ' + store, html: html });
  } catch(e) { console.error('Issue email error:', e.message); }
  try { var issues = readJSON('issues.json',[]); issues.push({name,store,description,timestamp:new Date().toISOString()}); writeJSON('issues.json',issues); } catch(e){}
  res.json({ success: true });
});



app.post('/api/feedback', function(req, res) {
  try {
    var feedbackFile = 'feedback.json';
    var feedback = readJSON(feedbackFile, []);
    var entry = Object.assign({ id: Date.now().toString() }, req.body);
    feedback.push(entry);
    writeJSON(feedbackFile, feedback);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get('/api/sales-summary', function(req, res) {
  try { res.json({ success:true, data: readJSON('sales_summary.json', {}) }); }
  catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

app.get('/api/world-events', function(req, res) {
  try {
    var d = readJSON('world_events.json', {events:[],lastUpdated:null});
    res.json({ success:true, data: d.events||[], lastUpdated: d.lastUpdated });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});


app.post('/api/jahid/chat', async function(req, res) {
  try {
    var message = req.body.message || '';
    var messages = req.body.messages || [];
    var https = require('https');
    var systemPrompt = "You are Jahid, an intelligent, vibrant AI assistant for Tim Hortons India operations. You are the intelligence hub for OpsAIHub platform.\n\nPERSONALITY: Energetic, confident, friendly but professional. Slightly witty. Think smart business partner not a bot. Always give actionable insights not just raw data. End with a helpful nudge.\n\nRULES:\n- ONLY use data provided below. Never say you cannot access data.\n- Never hallucinate numbers. If data is not below, say it will be available as AMs submit.\n- Always give insight + recommendation after data\n- Structure: Answer directly -> Add insight -> Offer next step\n\nLIVE OPSAIHUB DATA:\n\nSCALE: 44 stores, 9 AMs, 6 regions\n\nAM & STORES:\n- Raman (Delhi NCR): T3D DIAL, T3D Food Court, T1D Dial\n- Harish (Delhi NCR): DLF Cyberhub, Golf Course AIPL, Select City Saket, Green Park, Basant Lok, Epicuria Nehru Place\n- Rohit (Delhi NCR): Skymark, Vegas Mall, NSP Pritampura, Punjabi Bagh\n- Deepak (Punjab): Malhar Road, Sunview Enclave, Bucho Bathinda, Patiala, Mohali, Sangrur, Elante Mall, Sec 35 Chandigarh\n- Akash Chavan (Maharashtra): Balewadi, Lokhandwala, MC Kurla, Viman Nagar, Wakad, FC Road, FIFC\n- Akash Rathod (Maharashtra): HPCL MPE, NMIA Arrival, NMIA Departure, Seawoods\n- Jagadeesha (Karnataka): Koramangala, BIAL, Mall of Asia, HSR Layout\n- Shivam (Telangana): Inorbit Hyderabad, HIAL, HIAL Arrival, Lakeshore\n- Gujarat (no AM): Ahmedabad Airport, Sindhu Bhavan, Navrangpura\n\nMARCH 2026 KPIs (25 days):\n- ADS: Rs.81680 per store per day\n- ADT: 148 transactions per store per day\n- APC: Rs.558\n- MTD Revenue: Rs.87805608 (25 days)\n- Delivery MTD: Rs.15197465 | Delivery APC: Rs.324\n- vs Last Year: 107% | vs Last Month: 105%\n\nFEBRUARY 2026 KPIs (28 days):\n- ADS: Rs.81849 | ADT: 151 | APC: Rs.564\n- MTD Revenue: Rs.100838386 | Delivery: Rs.17923480\n\nREV AUDIT H1 2026 (Pass=77%+, Excellent=86%+, India Target=86%):\n- India REV Average: 86% (AT TARGET)\n- Maharashtra Average: 81.2% (Akash Chavan + Akash Rathod)\n- FAILED stores (below 77%): Lokhandwala(74%), Nexus Seawood(74%), DLF Cyberhub(76.4%)\n- EXCELLENT stores (86%+): Bandra(88%), FIFC Mumbai(89%), HSR(92%), Mall of Asia(87%), BIAL(91.4%), Sindhu Bhavan(92.97%), Navrangpura(87.85%), T1 Ahmedabad Airport(90.23%), HIAL Arrival(92.74%), HIAL(93.03%), Golf Course AIPL(86%), Basant Lok(86%), Skymark one(86%), Epicuria Nehru Place(87.7%)\n\nAM REV PERFORMANCE:\n  - Akash Chavan: avg 83.7% | stores: Lokhandwala, Bandra, FIFC Mumbai | grade: Pass\n  - Akash Rathod: avg 77.5% | stores: HPCL Mumbai Pune Expressway, Nexus Seawood | grade: Pass\n  - Jagadeesha: avg 88% | stores: Koramangala, HSR, Mall of Asia, BIAL | grade: Excellent\n  - Deepak: avg 90.4% | stores: Sindhu Bhavan, Navrangpura, T1 Ahmedabad Airport | grade: Excellent\n  - Shivam: avg 90.3% | stores: Inorbit Mall-Hyderabad, HIAL Arrival, HIAL | grade: Excellent\n  - Harish: avg 83.8% | stores: DLF Cyberhub, Golf Course AIPL, Basant Lok, Epicuria Nehru Place, Select City Saket | grade: Pass\n  - Rohit: avg 86% | stores: Skymark one | grade: Excellent\n\nPERFORMANCE BANDS:\n- Excellent: 90-100%\n- Good: 75-89%\n- Needs Attention: 60-74%\n- Critical: below 60%\n\nCHECKLISTS:\n- Monday: Financial & Inventory Audit (14 items, all stores, remote)\n- Tuesday: Sales Intelligence (5 sections, all stores, remote)\n- Wednesday: Maintenance + Cleanliness + Pest (one store visit)\n- Thursday: Rest day\n- Friday: People & Readiness (one store visit)\n- Saturday/Sunday: Weekend Operations (12 items, one store visit)";
    var apiMessages = messages.concat([{role:'user', content:message}]);
    var body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: apiMessages
    });
    var opts = {
      hostname:'api.anthropic.com', path:'/v1/messages', method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(body)}
    };
    var apiReq = https.request(opts, function(apiRes){
      var data='';
      apiRes.on('data',function(c){data+=c;});
      apiRes.on('end',function(){
        try{
          var p=JSON.parse(data);
          var reply = p.content&&p.content[0]?p.content[0].text:'Sorry, please try again.';
          res.json({success:true, reply:reply});
        }catch(e){res.json({success:false,error:'Parse error'});}
      });
    });
    apiReq.on('error',function(e){res.json({success:false,error:e.message});});
    apiReq.write(body);
    apiReq.end();
  } catch(e){res.status(500).json({success:false,error:e.message});}
});

// ════════════════════════════════════════════════════════════
// EVENTS MODULE — Submission + Retrieval + Compliance
// ════════════════════════════════════════════════════════════
var eventUpload = multer({
  dest: 'uploads/events/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function(req, file, cb){
    if(file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  }
}).array('images', 3);

app.post('/api/events/submit', function(req, res){
  eventUpload(req, res, function(err){
    if(err) return res.status(400).json({success:false, error:err.message});
    try {
      var b = req.body;
      var images = (req.files||[]).map(function(f){
        // Rename to preserve extension for browser rendering
        var ext = (f.originalname||'').split('.').pop().toLowerCase();
        var newName = f.filename + (ext?'.'+ext:'');
        var oldPath = 'uploads/events/'+f.filename;
        var newPath = 'uploads/events/'+newName;
        try{ require('fs').renameSync(oldPath, newPath); } catch(e){}
        return '/uploads/events/'+newName;
      });

      // Validate mandatory fields
      var required = ['am','store','eventDate','venue','menuPricing','salesGenerated','revenueShare','otherExpenses','manualBillBook','manualBillBookComment','punchedInSystem','punchedInSystemComment','billsAttached','billsAttachedComment','managerPresent'];
      var missing = required.filter(function(k){ return !b[k] || b[k].toString().trim() === ''; });
      if(missing.length > 0) return res.status(400).json({success:false, error:'Missing required fields: '+missing.join(', ')});
      if(images.length === 0) return res.status(400).json({success:false, error:'At least 1 image is required'});

      // Calculate profit
      var sales = parseFloat(b.salesGenerated)||0;
      var expenses = parseFloat(b.otherExpenses)||0;
      var commission = parseFloat(b.revenueShare)||0;
      var revenueShare  = sales * (commission / 100);  // % Revenue Share / Rentals (AM-entered)
            var foodCost     = sales * 0.30;                 // 30% Food Cost
            var rental       = sales * 0.05;                 // 5% Expenses
            var commCharge   = sales * 0.02;                 // 2% Commission
            var bankCharges  = sales * 0.02;                 // 2% Bank Charges
            var profit = sales - revenueShare - foodCost - rental - commCharge - bankCharges - expenses;

      // Compliance score
      var complianceItems = ['manualBillBook','punchedInSystem','billsAttached'];
      var complianceYes = complianceItems.filter(function(k){ return b[k]==='yes'; }).length;
      var complianceScore = Math.round(complianceYes/complianceItems.length*100);

      var record = {
        id: Date.now().toString(),
        am: b.am,
        store: b.store,
        region: b.region,
        eventDate: b.eventDate,
        venue: b.venue,
        menuPricing: b.menuPricing,
        customPrice: b.customPrice||null,
        salesGenerated: sales,
        revenueSharePct: commission,
        otherExpenses: expenses,
        profit: Math.round(profit),
        compliance: {
          manualBillBook: { answer: b.manualBillBook, comment: b.manualBillBookComment },
          punchedInSystem: { answer: b.punchedInSystem, comment: b.punchedInSystemComment },
          billsAttached: { answer: b.billsAttached, comment: b.billsAttachedComment },
          managerPresent: b.managerPresent,
          score: complianceScore
        },
        images: images,
        notes: b.notes||'',
        submittedAt: new Date().toISOString()
      };

      var data = readJSON('event_submissions.json', {submissions:[]});
      if(!data.submissions) data.submissions = [];
      data.submissions.push(record);
      data.lastUpdated = new Date().toISOString();
      writeJSON('event_submissions.json', data);

      res.json({success:true, id:record.id, profit:record.profit, complianceScore:complianceScore});
    } catch(e){ res.status(500).json({success:false, error:e.message}); }
  });
});

app.get('/api/events', function(req, res){
  try {
    var data = readJSON('event_submissions.json', {submissions:[]});
    var subs = data.submissions||[];
    // Filter params
    if(req.query.am) subs = subs.filter(function(s){return s.am===req.query.am;});
    if(req.query.month) subs = subs.filter(function(s){return s.eventDate&&s.eventDate.startsWith(req.query.month);});
    subs = subs.sort(function(a,b){return new Date(b.eventDate)-new Date(a.eventDate);});
    res.json({success:true, data:subs, total:subs.length});
  } catch(e){ res.status(500).json({success:false, error:e.message}); }
});

app.get('/api/events/:id', function(req, res){
  try {
    var data = readJSON('event_submissions.json', {submissions:[]});
    var event = (data.submissions||[]).find(function(s){return s.id===req.params.id;});
    if(!event) return res.status(404).json({success:false, error:'Not found'});
    res.json({success:true, data:event});
  } catch(e){ res.status(500).json({success:false, error:e.message}); }
});

app.get('/api/events/stats/am', function(req, res){
  try {
    var data = readJSON('event_submissions.json', {submissions:[]});
    var subs = data.submissions||[];
    var stats = {};
    subs.forEach(function(s){
      if(!stats[s.am]) stats[s.am]={am:s.am,total:0,complianceScores:[],nonCompliant:[]};
      stats[s.am].total++;
      stats[s.am].complianceScores.push(s.compliance.score);
      if(s.compliance.score < 100) stats[s.am].nonCompliant.push({id:s.id,date:s.eventDate,store:s.store,score:s.compliance.score});
    });
    Object.keys(stats).forEach(function(am){
      var sc = stats[am].complianceScores;
      stats[am].avgCompliance = sc.length?Math.round(sc.reduce(function(t,v){return t+v;},0)/sc.length):0;
    });
    res.json({success:true, data:stats});
  } catch(e){ res.status(500).json({success:false, error:e.message}); }
});

// Serve event images
app.use('/uploads/events', require('express').static('uploads/events'));



// ── HOME SCORES — Real scores from last 4 days ───────────
app.get('/api/home-scores', function(req, res){
  try {
    var submissions = readJSON('submissions.json', []);
    var stores = readJSON('stores.json', []);

    // Last 4 days window
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 4);
    cutoff.setHours(0,0,0,0);

    var recent = submissions.filter(function(s){
      return new Date(s.submittedAt || s.timestamp || 0) >= cutoff;
    });

    // Build per-store score from recent submissions
    var storeMap = {};
    recent.forEach(function(s){
      var key = s.store;
      if(!storeMap[key]) storeMap[key] = { store: key, am: s.am, region: s.region||'', scores:[], days:[], lastSubmit: null };
      if(s.score !== null && s.score !== undefined){
        storeMap[key].scores.push(s.score);
      }
      if(s.day) storeMap[key].days.push(s.day);
      var st = new Date(s.submittedAt || s.timestamp || 0);
      if(!storeMap[key].lastSubmit || st > new Date(storeMap[key].lastSubmit)){
        storeMap[key].lastSubmit = s.submittedAt || s.timestamp;
      }
    });

    // Build final store list — all stores, with real score if available
    var result = stores.map(function(s){
      var data = storeMap[s.name] || storeMap[(s.name||'').replace('TH ','')];
      var score = null;
      var hasData = false;
      if(data && data.scores.length > 0){
        // Average of all scores in last 4 days
        score = Math.round(data.scores.reduce(function(t,v){return t+v;},0) / data.scores.length);
        hasData = true;
      }
      return {
        name: s.name,
        am: s.am || (data ? data.am : ''),
        region: s.region || (data ? data.region : ''),
        score: score,
        hasData: hasData,
        days: data ? data.days : [],
        lastSubmit: data ? data.lastSubmit : null
      };
    });

    // Sort: stores with data first (by score desc), then no-data stores
    result.sort(function(a,b){
      if(a.hasData && !b.hasData) return -1;
      if(!a.hasData && b.hasData) return 1;
      return (b.score||0) - (a.score||0);
    });

    res.json({ success: true, data: result, asOf: new Date().toISOString(), windowDays: 4 });
  } catch(e){ res.status(500).json({ success:false, error:e.message }); }
});

app.use("/uploads/fdu", require("express").static(require("path").join(__dirname,"uploads/fdu")));
app.use("/uploads/donuts",require("express").static(require("path").join(__dirname,"uploads/donuts")));
app.use(function(req, res) {
  const p = path.join(__dirname, 'public', req.path.replace('/', '') + '.html');
  if (fs.existsSync(p)) { res.sendFile(p); } else { res.sendFile(path.join(__dirname, 'public', 'index.html')); }
});

// ════════════════════════════════════════════════════════════
// STEP 12 — AUTOMATION & SELF-HEALING
// ════════════════════════════════════════════════════════════
const cron = require('node-cron');
const https = require('https');

var AM_EMAILS = {
  'Raman':       'raman@timhortonsindia.com',
  'Harish':      'harish@timhortonsindia.com',
  'Rohit':       'rohit@timhortonsindia.com',
  'Deepak':      'deepak@timhortonsindia.com',
  'Akash Chavan':'akash.chavan@timhortonsindia.com',
  'Akash Rathod':'akash.rathod@timhortonsindia.com',
  'Jagadeesha':  'jagadeesha@timhortonsindia.com',
  'Shivam':      'shivam@timhortonsindia.com'
};
var HOD_EMAIL = 'jahid.inamdar@timhortonsindia.com';
var FROM_EMAIL = '"Tim Ops Connect" <' + (process.env.EMAIL_USER||'jahidinamdar02@opsaihub.in') + '>';

function sendEmail(to, subject, html, cb){
  var opts = {
    from: FROM_EMAIL,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: subject,
    html: html
  };
  transporter.sendMail(opts, function(err, info){
    if(err) console.log('Email error:', err.message);
    else console.log('Email sent:', subject, '->', opts.to);
    if(cb) cb(err, info);
  });
}

function emailStyle(){
  return '<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F5F5F7;margin:0;padding:0;}'+
    '.wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;margin-top:20px;}'+
    '.hdr{background:linear-gradient(135deg,#C8102E,#8B0B1F);padding:28px 28px 20px;text-align:center;}'+
    '.hdr-logo{font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;}'+
    '.hdr-sub{font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;}'+
    '.body{padding:24px 28px;}'+
    '.greeting{font-size:18px;font-weight:700;color:#1C1C1E;margin-bottom:16px;}'+
    '.card{background:#F5F5F7;border-radius:12px;padding:16px;margin-bottom:12px;}'+
    '.card-ttl{font-size:11px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;}'+
    '.card-val{font-size:24px;font-weight:700;color:#1C1C1E;}'+
    '.green{color:#1B7A3A;}.red{color:#C8102E;}.amber{color:#B36200;}'+
    '.btn{display:block;background:#C8102E;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin:20px 0;}'+
    '.footer{padding:16px 28px;background:#F5F5F7;text-align:center;font-size:11px;color:#8E8E93;}'+
    '.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E5E5EA;}'+
    '.row:last-child{border-bottom:none;}'+
    '</style>';
}

// ── CLAUDE HAIKU DAILY BRIEFING ───────────────────────────
function generateBriefing(callback){
  var subs = readJSON('submissions.json', []);
  var kpi = readJSON('sales_summary.json', {});
  var today = new Date();
  var dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];
  
  var context = 'Today is '+dayName+', '+today.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})+'. ';
  context += 'Tim Hortons India Operations Summary: ';
  context += '44 stores, 9 Area Managers, 6 regions. ';
  if(kpi.march){ context += 'March MTD: ADS Rs.'+kpi.march.totalADS+', ADT '+kpi.march.totalADT+', APC Rs.'+kpi.march.totalAPC+'. '; }
  context += 'Submissions today: '+subs.filter(function(s){var d=new Date(s.submittedAt||s.timestamp||Date.now());return d.toDateString()===today.toDateString();}).length+' received. ';
  
  var body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages:[{role:'user',content:context+' Generate a sharp 5-line morning ops briefing for the Head of Operations. Cover: 1) Key priority for today 2) Any risk to watch 3) One coaching point for AMs 4) Weather/seasonal note if relevant 5) One motivational close. Be direct, no fluff, QSR operations lens.'}]
  });
  
  var opts = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  
  var req = https.request(opts, function(res){
    var data = '';
    res.on('data', function(c){ data += c; });
    res.on('end', function(){
      try{
        var parsed = JSON.parse(data);
        var text = parsed.content && parsed.content[0] ? parsed.content[0].text : 'Briefing unavailable today.';
        callback(null, text);
      } catch(e){ callback(null, 'Briefing generation failed: '+e.message); }
    });
  });
  req.on('error', function(e){ callback(null, 'API error: '+e.message); });
  req.write(body);
  req.end();
}

// ── MONDAY 8AM — WEEKLY NUDGE TO ALL AMs ─────────────────
cron.schedule('0 8 * * 1', function(){
  console.log('[CRON] Monday nudge emails firing...');
  var today = new Date();
  var weekStr = today.toLocaleDateString('en-IN',{day:'numeric',month:'long'});
  
  Object.keys(AM_EMAILS).forEach(function(am){
    var stores = {
      'Raman':['T3DD','T3DD FC','T1DD'],
      'Harish':['Cyber Hub','Select City','Green Park','Basant Lok','Epicuria','AIPL Golf Course'],
      'Rohit':['Skymark','Vegas Mall','NSP','Punjabi Bagh'],
      'Deepak':['CP67 Mohali','Elante Mall','Sunview','Sec 35','Bhupindra Road','Malhar Rd','Sangrur','Bucho'],
      'Akash Chavan':['Balewadi','Lokhandwala','Supreme','PMC Kurla','Viman Nagar','PMC Wakad','FC Road','FIFC'],
      'Akash Rathod':['HPCL-MPE','NMIAL','NMIAL Arrival','Seawoods'],
      'Jagadeesha':['Koramangala','BIAL','Mall of Asia','HSR Layout'],
      'Shivam':['Inorbit Mall','Hyderabad Arrivals','Lakeshore','Hyderabad Airport']
    }[am] || [];
    
    var html = emailStyle()+'<div class="wrap">'+
      '<div class="hdr"><div class="hdr-logo">Tim Ops Connect</div><div class="hdr-sub">Weekly Checklist Reminder &mdash; Week of '+weekStr+'</div></div>'+
      '<div class="body">'+
      '<div class="greeting">Good morning, '+am+' ☕</div>'+
      '<p style="color:#3C3C43;font-size:14px;line-height:1.6;">New week, fresh start. Your Monday and Tuesday checklists cover all your stores and are due by <strong>Tuesday midnight.</strong></p>'+
      '<div class="card"><div class="card-ttl">Your Stores This Week</div>'+
      stores.map(function(s){return '<div class="row"><span style="font-size:13px;color:#1C1C1E;">'+s+'</span><span style="font-size:11px;color:#8E8E93;">MON + TUE required</span></div>';}).join('')+
      '</div>'+
      '<div class="card"><div class="card-ttl">This Week Checklist</div>'+
      '<div class="row"><span style="font-size:13px;">Monday</span><span class="amber" style="font-size:12px;font-weight:700;">Financial &amp; Inventory Audit</span></div>'+
      '<div class="row"><span style="font-size:13px;">Tuesday</span><span class="amber" style="font-size:12px;font-weight:700;">Sales Intelligence</span></div>'+
      '<div class="row"><span style="font-size:13px;">Wednesday</span><span style="font-size:12px;color:#8E8E93;">Maintenance Visit</span></div>'+
      '<div class="row"><span style="font-size:13px;">Friday</span><span style="font-size:12px;color:#8E8E93;">People &amp; Readiness</span></div>'+
      '<div class="row"><span style="font-size:13px;">Sat / Sun</span><span style="font-size:12px;color:#8E8E93;">Weekend Operations</span></div>'+
      '</div>'+
      '<a href="https://staging.opsaihub.in/tasks.html" class="btn">Open Tasks &rarr;</a>'+
      '</div>'+
      '<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; This is an automated reminder</div></div>';
    
    sendEmail(AM_EMAILS[am], '[Tim Ops] Week of '+weekStr+' &mdash; Checklists Ready', html);
  });
}, { timezone: 'Asia/Kolkata' });

// ── DAILY 8AM — CLAUDE BRIEFING TO JAHID ─────────────────
cron.schedule('0 8 * * *', function(){
  console.log('[CRON] Daily briefing generating...');
  generateBriefing(function(err, briefing){
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    var subs = readJSON('submissions.json', []);
    var todaySubs = subs.filter(function(s){
      return new Date(s.submittedAt||s.timestamp||0).toDateString()===today.toDateString();
    });
    
    var html = emailStyle()+'<div class="wrap">'+
      '<div class="hdr"><div class="hdr-logo">Tim Ops Connect</div><div class="hdr-sub">Daily Briefing &mdash; '+dateStr+'</div></div>'+
      '<div class="body">'+
      '<div class="greeting">Good morning, Jahid ☕</div>'+
      '<div class="card" style="background:linear-gradient(135deg,#0D1B2A,#1A0D2E);color:#fff;">'+
      '<div class="card-ttl" style="color:rgba(255,255,255,0.5);">AI Ops Briefing</div>'+
      '<p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,0.9);">'+briefing.split('\n').join('<br>')+'</p></div>'+
      '<div class="card"><div class="card-ttl">Submissions Today</div>'+
      '<div class="card-val">'+(todaySubs.length||0)+'</div>'+
      '<p style="font-size:12px;color:#8E8E93;margin-top:4px;">received so far</p></div>'+
      '<div class="card"><div class="card-ttl">System Status</div>'+
      '<div style="font-size:13px;color:#1B7A3A;font-weight:700;">All systems operational</div>'+
      '<div style="font-size:11px;color:#8E8E93;margin-top:4px;">Staging: staging.opsaihub.in</div></div>'+
      '<a href="https://staging.opsaihub.in/hod.html" class="btn">Open HOD Dashboard &rarr;</a>'+
      '</div>'+
      '<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; Daily automated briefing</div></div>';
    
    sendEmail(HOD_EMAIL, '[Tim Ops] Daily Briefing &mdash; '+dateStr, html);
  });
}, { timezone: 'Asia/Kolkata' });

// ── FRIDAY 6PM — CHASE NON-SUBMITTERS ────────────────────
cron.schedule('0 18 * * 5', function(){
  console.log('[CRON] Friday chase emails checking...');
  var subs = readJSON('submissions.json', []);
  var thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay() + 1);
  thisWeekStart.setHours(0,0,0,0);
  
  var submitted = {};
  subs.forEach(function(s){
    var d = new Date(s.submittedAt||s.timestamp||0);
    if(d >= thisWeekStart && s.am) submitted[s.am] = true;
  });
  
  Object.keys(AM_EMAILS).forEach(function(am){
    if(!submitted[am]){
      var html = emailStyle()+'<div class="wrap">'+
        '<div class="hdr" style="background:linear-gradient(135deg,#B36200,#7A4200);">'+
        '<div class="hdr-logo">Tim Ops Connect</div><div class="hdr-sub">Checklist Reminder &mdash; Action Required</div></div>'+
        '<div class="body">'+
        '<div class="greeting">Hi '+am+',</div>'+
        '<div class="card" style="border:2px solid #FF9500;">'+
        '<div class="card-ttl" style="color:#B36200;">Pending This Week</div>'+
        '<p style="font-size:14px;color:#1C1C1E;line-height:1.6;">Your weekly checklist submissions are pending. Please complete and submit before <strong>end of day Sunday.</strong></p>'+
        '<p style="font-size:13px;color:#8E8E93;">Late submissions are accepted but flagged. Consistent late submissions impact your performance score.</p>'+
        '</div>'+
        '<a href="https://staging.opsaihub.in/tasks.html" class="btn" style="background:#FF9500;">Complete Checklist Now &rarr;</a>'+
        '</div>'+
        '<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; Automated reminder</div></div>';
      
      sendEmail(AM_EMAILS[am], '[Tim Ops] Action Required: Checklist Pending This Week', html);
    }
  });
}, { timezone: 'Asia/Kolkata' });

// ── SUNDAY 9AM — PERSONAL WEEKLY SUMMARY TO EACH AM ──────
cron.schedule('0 9 * * 0', function(){
  console.log('[CRON] Sunday summaries firing...');
  var subs = readJSON('submissions.json', []);
  var kpi = readJSON('sales_summary.json', {});
  var weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0,0,0,0);
  var weekStr = weekStart.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' - '+new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  
  Object.keys(AM_EMAILS).forEach(function(am){
    var amSubs = subs.filter(function(s){ return s.am===am && new Date(s.submittedAt||s.timestamp||0)>=weekStart; });
    var days = ['Monday','Tuesday','Wednesday','Friday','Saturday','Sunday'];
    
    var html = emailStyle()+'<div class="wrap">'+
      '<div class="hdr"><div class="hdr-logo">Tim Ops Connect</div><div class="hdr-sub">Your Week in Review &mdash; '+weekStr+'</div></div>'+
      '<div class="body">'+
      '<div class="greeting">Good morning, '+am+' ☕</div>'+
      '<p style="font-size:14px;color:#3C3C43;line-height:1.6;">Here is your weekly summary. Great work staying on top of your stores.</p>'+
      '<div class="card"><div class="card-ttl">Submissions This Week</div>'+
      '<div class="card-val '+( amSubs.length>=4?'green':'amber')+'">'+amSubs.length+' / 6</div>'+
      '<p style="font-size:12px;color:#8E8E93;margin-top:4px;">checklists submitted</p></div>'+
      '<div class="card"><div class="card-ttl">Week Summary</div>'+
      days.map(function(day){
        var hasSub = amSubs.some(function(s){ return (s.day||'').toLowerCase()===day.toLowerCase(); });
        return '<div class="row"><span style="font-size:13px;">'+day+'</span><span style="font-size:12px;font-weight:700;color:'+(hasSub?'#1B7A3A':'#C8102E')+'">'+(hasSub?'Submitted':'Pending')+'</span></div>';
      }).join('')+
      '</div>'+
      '<div class="card" style="background:linear-gradient(135deg,#C8102E,#8B0B1F);"><div class="card-ttl" style="color:rgba(255,255,255,0.6);">New Week Starts Tomorrow</div>'+
      '<p style="font-size:14px;color:#fff;line-height:1.6;">Monday checklist is due by Tuesday midnight. Start the week strong.</p></div>'+
      '<a href="https://staging.opsaihub.in" class="btn">Open OpsAIHub &rarr;</a>'+
      '</div>'+
      '<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; Weekly automated summary</div></div>';
    
    sendEmail(AM_EMAILS[am], '[Tim Ops] Your Week in Review &mdash; '+weekStr, html);
  });
}, { timezone: 'Asia/Kolkata' });

// ── 1ST OF MONTH — COVERAGE RESET + REPORT ───────────────
cron.schedule('0 7 1 * *', function(){
  console.log('[CRON] Monthly reset firing...');
  var now = new Date();
  var month = now.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  
  // Reset coverage
  var coverage = readJSON('coverage.json', {});
  coverage.lastReset = now.toISOString();
  coverage.currentMonth = now.getMonth()+1+'-'+now.getFullYear();
  writeJSON('coverage.json', coverage);
  
  // Email Jahid
  var html = emailStyle()+'<div class="wrap">'+
    '<div class="hdr"><div class="hdr-logo">Tim Ops Connect</div><div class="hdr-sub">Monthly Reset &mdash; '+month+'</div></div>'+
    '<div class="body">'+
    '<div class="greeting">New month, Jahid ☕</div>'+
    '<div class="card"><div class="card-ttl">Monthly Reset Complete</div>'+
    '<p style="font-size:14px;color:#1C1C1E;line-height:1.6;">Coverage counters have been reset for all 44 stores. All Area Managers start fresh for '+month+'.</p></div>'+
    '<div class="card"><div class="card-ttl">This Month Targets</div>'+
    '<div class="row"><span style="font-size:13px;">Store Visits</span><span style="font-size:12px;font-weight:700;color:#007AFF;">Every store once</span></div>'+
    '<div class="row"><span style="font-size:13px;">Mon/Tue Submissions</span><span style="font-size:12px;font-weight:700;color:#007AFF;">4 weeks x all stores</span></div>'+
    '<div class="row"><span style="font-size:13px;">Assessment</span><span style="font-size:12px;font-weight:700;color:#007AFF;">1 module per AM</span></div>'+
    '</div>'+
    '<a href="https://staging.opsaihub.in/hod.html" class="btn">View HOD Dashboard &rarr;</a>'+
    '</div>'+
    '<div class="footer">Tim Hortons India &middot; OpsAIHub &middot; Monthly automated report</div></div>';
  
  sendEmail(HOD_EMAIL, '[Tim Ops] Monthly Reset Complete &mdash; '+month, html);
}, { timezone: 'Asia/Kolkata' });

// ── SELF-HEALING MONITOR — EVERY 15 MINS ─────────────────
var lastDownAlert = null;
cron.schedule('*/15 * * * *', function(){
  var http = require('http');
  http.get('http://localhost:'+PORT+'/health', function(res){
    if(res.statusCode !== 200){
      var now = new Date();
      if(!lastDownAlert || (now-lastDownAlert) > 3600000){
        lastDownAlert = now;
        sendEmail(HOD_EMAIL, '[ALERT] OpsAIHub DOWN - '+res.statusCode,
          emailStyle()+'<div class="wrap"><div class="hdr" style="background:linear-gradient(135deg,#FF3B30,#C8102E);"><div class="hdr-logo">OpsAIHub Alert</div></div>'+
          '<div class="body"><div class="greeting" style="color:#C8102E;">Site Health Alert</div>'+
          '<div class="card" style="border:2px solid #FF3B30;"><div class="card-ttl" style="color:#C8102E;">Status Code: '+res.statusCode+'</div>'+
          '<p style="font-size:14px;">OpsAIHub staging returned a non-200 response at '+now.toLocaleString('en-IN')+'. PM2 auto-restart should recover this automatically.</p></div>'+
          '<div class="card"><div class="card-ttl">Manual Recovery</div>'+
          '<p style="font-family:monospace;font-size:12px;background:#F5F5F7;padding:8px;border-radius:6px;">pm2 restart th-staging</p></div>'+
          '</div><div class="footer">OpsAIHub Self-Healing Monitor</div></div>');
      }
    } else {
      lastDownAlert = null;
    }
  }).on('error', function(e){
    var now = new Date();
    if(!lastDownAlert || (now-lastDownAlert) > 3600000){
      lastDownAlert = now;
      sendEmail(HOD_EMAIL, '[ALERT] OpsAIHub UNREACHABLE',
        emailStyle()+'<div class="wrap"><div class="hdr" style="background:linear-gradient(135deg,#FF3B30,#C8102E);"><div class="hdr-logo">OpsAIHub Alert</div></div>'+
        '<div class="body"><div class="greeting" style="color:#C8102E;">Site Unreachable</div>'+
        '<div class="card" style="border:2px solid #FF3B30;">'+
        '<p style="font-size:14px;">Cannot reach OpsAIHub at '+now.toLocaleString('en-IN')+'. Error: '+e.message+'</p>'+
        '<p style="font-family:monospace;font-size:12px;background:#F5F5F7;padding:8px;border-radius:6px;margin-top:8px;">pm2 restart th-staging</p></div>'+
        '</div><div class="footer">OpsAIHub Self-Healing Monitor</div></div>');
    }
  });
});

// ── DAILY 11PM — DATA BACKUP ─────────────────────────────
cron.schedule('0 23 * * *', function(){
  var exec = require('child_process').exec;
  var date = new Date().toISOString().split('T')[0];
  var backupDir = process.env.HOME+'/backups/'+date;
  exec('mkdir -p '+backupDir+' && cp -r '+__dirname+'/data/* '+backupDir+'/', function(err){
    if(err) console.log('[BACKUP] Error:', err.message);
    else console.log('[BACKUP] Data backed up to', backupDir);
    // Keep last 30 days
    exec('ls '+process.env.HOME+'/backups/ | sort | head -n -30 | xargs -I{} rm -rf '+process.env.HOME+'/backups/{}', function(){});
  });
});

// ── TEST EMAIL ROUTE ──────────────────────────────────────
app.post('/api/test-email', function(req, res){
  sendEmail(HOD_EMAIL, '[Test] OpsAIHub Email Working',
    emailStyle()+'<div class="wrap"><div class="hdr"><div class="hdr-logo">Tim Ops Connect</div></div>'+
    '<div class="body"><div class="greeting">Test email ☕</div>'+
    '<p style="font-size:14px;color:#3C3C43;">Email system is working correctly. All automated emails will be sent from this address.</p>'+
    '<div class="card"><div class="card-ttl">Scheduled Emails</div>'+
    '<div class="row"><span>Monday 8am</span><span style="color:#007AFF;">AM weekly nudge</span></div>'+
    '<div class="row"><span>Daily 8am</span><span style="color:#007AFF;">Jahid briefing</span></div>'+
    '<div class="row"><span>Friday 6pm</span><span style="color:#007AFF;">Chase non-submitters</span></div>'+
    '<div class="row"><span>Sunday 9am</span><span style="color:#007AFF;">AM weekly summary</span></div>'+
    '<div class="row"><span>Every 15 mins</span><span style="color:#007AFF;">Self-healing monitor</span></div>'+
    '<div class="row"><span>Daily 11pm</span><span style="color:#007AFF;">Data backup</span></div>'+
    '</div></div><div class="footer">OpsAIHub &middot; Step 12 Complete</div></div>',
    function(err){ res.json({ success:!err, error:err?err.message:null }); }
  );
});

console.log('[CRON] All automation scheduled — 6 jobs active');
// ════════════════════════════════════════════════════════════




// ── FY27 Targets API ─────────────────────────────────────
app.get('/api/fy27-targets', function(req, res) {
  try {
    var data = readJSON('fy27_targets.json', {});
    res.json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/fy27-targets", function(req, res) { try { res.json(readJSON("fy27_targets.json", {})); } catch(err) { res.status(500).json({ error: err.message }); } });

// ── FDU Dashboard APIs ────────────────────────────────────
app.get('/api/fdu/submissions', function(req, res) {
  try { res.json({ success:true, data:readJSON('fdu_submissions.json', []) }); }
  catch(err) { res.status(500).json({ success:false }); }
});

app.get('/api/fdu/donut-results', function(req, res) {
  try { res.json({ success:true, data:readJSON('fdu_donut_submissions.json', []) }); }
  catch(err) { res.status(500).json({ success:false }); }
});

app.listen(PORT, function() { console.log('OpsAIHub Staging running on port ' + PORT); });
module.exports = { readJSON: readJSON, writeJSON: writeJSON };
