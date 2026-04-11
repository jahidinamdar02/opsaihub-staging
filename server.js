'use strict';
require('dotenv').config();
const nodemailer = require('nodemailer');
const multer = require('multer');
const express = require('express');
const path = require('path')
const cron = require('node-cron');;
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
    var all = readJSON('coverage.json', []);
    var am = req.query.am;
    var month = req.query.month;
    var filtered = all;
    if(am) filtered = filtered.filter(function(c){ return c.am === am; });
    if(month) {
      var monthFiltered = filtered.filter(function(c){ return c.month === month; });
      // If no data for requested month, fall back to most recent month
      if(monthFiltered.length === 0 && filtered.length > 0) {
        filtered.sort(function(a,b){ return b.month.localeCompare(a.month); });
        var latestMonth = filtered[0].month;
        monthFiltered = filtered.filter(function(c){ return c.month === latestMonth; });
        res.json({ success:true, data:monthFiltered, note:'No data for '+month+', showing '+latestMonth });
        return;
      }
      filtered = monthFiltered;
    }
    res.json({ success:true, data:filtered });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
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

app.post('/api/feed/upload', multer({storage:require('multer').diskStorage({destination:'uploads/feed/',filename:function(req,file,cb){cb(null,Date.now()+'-'+Math.random().toString(36).substr(2,9)+'.jpg');}}),limits:{fileSize:10*1024*1024}}).single('photo'), function(req, res) {
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
      photos: req.files ? Object.keys(req.files).map(function(k){ return '/uploads/fdu/'+req.files[k][0].filename; }) : []
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
      var waterStd='Minimum 6 Tim Hortons water bottles upright on bottom FDU shelf, labels forward, no gaps, clean.';
      var textPrompt = 'You are a strict Tim Hortons India QSR quality inspector. Grade each item ONLY against its exact SOP standards. Be strict — partial compliance is a FAIL.' +
        ' DONUT 1 — ' + entry.donut1.name + ' (' + (entry.donut1.type||'') + '). SOP STANDARDS: ' + entry.donut1.standards +
        ' DONUT 2 — ' + entry.donut2.name + ' (' + (entry.donut2.type||'') + '). SOP STANDARDS: ' + entry.donut2.standards +
        ' WATER BOTTLES — Check Photo 1 (FDU display). SOP STANDARDS: ' + waterStd +
        ' For each donut: check coating evenness, topping/drizzle count and pattern, quantity in basket (min 3), shape and finish.' +
        ' For water bottles: count visible bottles (min 6), check upright position, label visibility, gaps.' +
        ' Respond ONLY in valid JSON, no markdown: {"grade1":"Pass or Fail","grade2":"Pass or Fail","waterBottles":"Pass or Fail","feedback1":"specific one sentence citing exact SOP deviation if fail","feedback2":"specific one sentence citing exact SOP deviation if fail","feedbackWater":"one sentence on water bottle compliance","overallPass":true or false,"summary":"one sentence overall"}';
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

    var systemPrompt = "You are the OpsAIHub AI for Tim Hortons India. You are Jahid's intelligent ops partner — sharp, direct, data-driven.\n\nPERSONALITY: Confident, friendly, slightly witty. Think smart business partner, not a bot. Always give insight + recommendation after data.\n\nRULES:\n- ONLY use data provided below. Never hallucinate numbers.\n- If asked about something not in data, say \"data will be available as AMs submit\"\n- Structure every answer: Direct answer → Insight → Next step\n- Keep responses under 200 words unless asked for detail\n- For store comparisons, rank by performance\n- For AM performance, always cite specific stores\n\nPLATFORM: OpsAIHub — 44 stores, 9 AMs, 6 regions\nAM ROSTER: Raman(Delhi NCR-3 stores), Harish(Delhi NCR-6), Rohit(Delhi NCR-4), Deepak(Punjab-8), Akash Chavan(Maharashtra-8), Akash Rathod(Maharashtra-4), Jagadeesha(Karnataka-4), Shivam(Telangana-4), Gujarat unassigned(3)\n\nCHECKLISTS: Mon=Financial+Inventory(all stores), Tue=Sales Intelligence(all stores), Wed=Maintenance visit, Thu=Rest, Fri=People+Readiness, Sat/Sun=Weekend Ops\n\nSCORING BANDS: Excellent 90-100% | Good 75-89% | Needs Attention 60-74% | Critical below 60%\n\nLIVE DATA AS OF TODAY (2026-04-10):\n\nAPRIL 2026 MTD (10 days):\n- Total Revenue: Rs.35,312,692 (10 days MTD)\n- Network ADS: Rs.353,127 (10-day avg)\n- Network ADT: 145 transactions/store/day\n- Network APC: Rs.545\n- India ADT: 148 | India APC: Rs.558\n\nTOP 5 STORES BY ADS:\n- TH T1D Dial: Rs.3872834/day, ADT:707, APC:568\n- TH HIAL: Rs.1896940/day, ADT:357, APC:552\n- TH DLF Cyberhub: Rs.1611845/day, ADT:281, APC:596\n- TH Select City Saket: Rs.1228972/day, ADT:234, APC:546\n- TH Lokhandwala: Rs.1174031/day, ADT:238, APC:512\n\nBOTTOM 5 STORES BY ADS:\n- TH Punjabi bagh: Rs.364617/day, ADT:71, APC:535\n- TH NMIA Arrival: Rs.353712/day, ADT:59, APC:618\n- TH Lakeshore: Rs.270881/day, ADT:58, APC:489\n- TH NMiA Departure: Rs.86595/day, ADT:15, APC:619\n- TH T3D DIAL: Rs.0/day, ADT:0, APC:0\n\nKEY FLAGS (stores below benchmark):\n- Donuts below 45/day: TH DLF Cyberhub(43), TH BIAL(22), TH HPCL Mumbai Pune Expressway(37), TH Vegas Mall(33), TH T3D Food Court(19), TH Skymark one(35), TH Mall of Asia(31), TH Elante Mall(31), TH Sindhu Bhavan(28), TH HSR(39), TH T1 Ahmedabad Airport(23), TH FIFC Mumbai(31), TH Malhar Road(39), TH Nexus Seawood(32), TH Balewadi Pune(30), TH Viman Nagar(32), TH Sunview Enclave(26), TH Green Park(39), TH Mohali(25), TH MC Kurla(28), TH HIAL Arrival(30), TH Sangrur(14), TH Sec 35 Chandigarh(20), TH Navrangpura(17), TH Phonix Mall Wakad(31), TH Patiala(22), TH NSP Pritampura(15), TH Basant Lok(22), TH Bucho Bathinda(11), TH Epicuria Nehru Place(19), TH FC Road(22), TH Punjabi bagh(16), TH NMIA Arrival(10), TH Lakeshore(28), TH NMiA Departure(3)\n- Timbits below 100/day: TH DLF Cyberhub(66), TH Select City Saket(87), TH BIAL(48), TH HPCL Mumbai Pune Expressway(85), TH Bandra(88), TH Vegas Mall(52), TH T3D Food Court(6), TH Skymark one(72), TH Elante Mall(56), TH Sindhu Bhavan(45), TH Golf Course AIPL(55), TH T1 Ahmedabad Airport(32), TH FIFC Mumbai(74), TH Malhar Road(56), TH Nexus Seawood(59), TH Viman Nagar(49), TH Sunview Enclave(50), TH Green Park(58), TH Mohali(47), TH MC Kurla(62), TH HIAL Arrival(48), TH Sangrur(32), TH Sec 35 Chandigarh(45), TH Navrangpura(35), TH Phonix Mall Wakad(54), TH Patiala(40), TH NSP Pritampura(31), TH Basant Lok(43), TH Bucho Bathinda(22), TH Epicuria Nehru Place(33), TH FC Road(43), TH Punjabi bagh(31), TH NMIA Arrival(17), TH Lakeshore(68), TH NMiA Departure(3)\n- Water below 10/day: TH DLF Cyberhub(7), TH Lokhandwala(5), TH BIAL(6), TH HPCL Mumbai Pune Expressway(6), TH Bandra(3), TH Vegas Mall(4), TH Skymark one(2), TH Mall of Asia(4), TH Elante Mall(5), TH Koramangala(1), TH Sindhu Bhavan(3), TH Golf Course AIPL(2), TH HSR(2), TH T1 Ahmedabad Airport(9), TH FIFC Mumbai(2), TH Inorbit Mall-Hyderabad(6), TH Malhar Road(1), TH Nexus Seawood(2), TH Balewadi Pune(2), TH Viman Nagar(4), TH Sunview Enclave(3), TH Green Park(1), TH Mohali(2), TH MC Kurla(3), TH Sangrur(2), TH Navrangpura(1), TH Phonix Mall Wakad(3), TH Patiala(1), TH NSP Pritampura(1), TH Basant Lok(2), TH Bucho Bathinda(1), TH Epicuria Nehru Place(1), TH FC Road(2), TH Punjabi bagh(1), TH NMIA Arrival(4), TH Lakeshore(5), TH NMiA Departure(3)\n\nFDU COMPLIANCE TODAY:\n- FDU Display submissions: 3 stores\n- Donut checks: 9 (Pass:3 Fail:6)\n\nCHECKLIST SUBMISSIONS TODAY: 0\n\nAPRIL 2026 TARGETS (44 stores):\n- Network daily sales target: Rs.3,896,000\n- Avg per store: Rs.88,545/day\n- Store targets: T1D Dial:Rs.438000/day Donuts:141 Timbits:239 | HIAL:Rs.216500/day Donuts:75 Timbits:144 | DLF Cyberhub:Rs.181700/day Donuts:47 Timbits:72 | Select City Saket:Rs.142400/day Donuts:52 Timbits:95 | Lokhandwala:Rs.134200/day Donuts:58 Timbits:110 | BIAL:Rs.113900/day Donuts:24 Timbits:52 | Vegas Mall:Rs.109700/day Donuts:36 Timbits:57 | HPCL Mumbai Pune Expressway:Rs.109300/day Donuts:40 Timbits:93 | T3D Food Court:Rs.103000/day Donuts:21 Timbits:7 | Skymark one:Rs.101000/day Donuts:38 Timbits:78 | Bandra:Rs.108200/day Donuts:82 Timbits:96 | Koramangala:Rs.90000/day Donuts:51 Timbits:128 | Sindhu Bhavan:Rs.90300/day Donuts:31 Timbits:49 | HSR:Rs.88100/day Donuts:43 Timbits:112 | Golf Course AIPL:Rs.86700/day Donuts:51 Timbits:60 | Mall of Asia:Rs.96200/day Donuts:34 Timbits:126 | Inorbit Mall-Hyderabad:Rs.82100/day Donuts:57 Timbits:187 | T1 Ahmedabad Airport:Rs.83300/day Donuts:25 Timbits:35 | Elante Mall:Rs.92700/day Donuts:34 Timbits:61 | FIFC Mumbai:Rs.79900/day Donuts:34 Timbits:81 | Nexus Seawood:Rs.79800/day Donuts:35 Timbits:64 | Viman Nagar:Rs.75200/day Donuts:35 Timbits:53 | Malhar Road:Rs.77400/day Donuts:43 Timbits:61 | Balewadi Pune:Rs.73200/day Donuts:33 Timbits:110 | Green Park:Rs.71000/day Donuts:43 Timbits:63 | Mohali:Rs.71800/day Donuts:27 Timbits:51 | Sunview Enclave:Rs.73900/day Donuts:28 Timbits:55 | HIAL Arrival:Rs.66400/day Donuts:33 Timbits:52 | MC Kurla:Rs.68000/day Donuts:31 Timbits:68 | Navrangpura:Rs.63800/day Donuts:19 Timbits:38 | Sangrur:Rs.65500/day Donuts:15 Timbits:35 | Sec 35 Chandigarh:Rs.64900/day Donuts:22 Timbits:49 | Phonix Mall Wakad:Rs.65600/day Donuts:34 Timbits:59 | NMIA Arrival:Rs.66400/day Donuts:11 Timbits:19 | Patiala:Rs.55600/day Donuts:23 Timbits:42 | NSP Pritampura:Rs.52500/day Donuts:16 Timbits:33 | Bucho Bathinda:Rs.46300/day Donuts:12 Timbits:23 | Basant Lok:Rs.45700/day Donuts:23 Timbits:45 | Epicuria Nehru Place:Rs.44000/day Donuts:20 Timbits:35 | FC Road:Rs.41600/day Donuts:23 Timbits:45 | Punjabi bagh:Rs.39900/day Donuts:17 Timbits:33 | Lakeshore:Rs.30500/day Donuts:29 Timbits:71 | NMiA Departure:Rs.9800/day Donuts:3 Timbits:3 | T3D DIAL:Rs.0/day Donuts:0 Timbits:0\n\nFY27 AOP: Rs.147.5 Cr (annual)\n\nSTORE-LEVEL KPIs (all 44 stores):\nTH T1D Dial: ADS=3872834 ADT=707 APC=568 Donuts=129 Timbits=219 Water=0\nTH HIAL: ADS=1896940 ADT=357 APC=552 Donuts=69 Timbits=132 Water=0\nTH DLF Cyberhub: ADS=1611845 ADT=281 APC=596 Donuts=43 Timbits=66 Water=7\nTH Select City Saket: ADS=1228972 ADT=234 APC=546 Donuts=48 Timbits=87 Water=13\nTH Lokhandwala: ADS=1174031 ADT=238 APC=512 Donuts=53 Timbits=101 Water=5\nTH BIAL: ADS=997327 ADT=188 APC=550 Donuts=22 Timbits=48 Water=6\nTH HPCL Mumbai Pune Expressway: ADS=965760 ADT=159 APC=632 Donuts=37 Timbits=85 Water=6\nTH Bandra: ADS=951563 ADT=200 APC=493 Donuts=75 Timbits=88 Water=3\nTH Vegas Mall: ADS=951288 ADT=186 APC=531 Donuts=33 Timbits=52 Water=4\nTH T3D Food Court: ADS=910505 ADT=169 APC=559 Donuts=19 Timbits=6 Water=0\nTH Skymark one: ADS=871248 ADT=164 APC=551 Donuts=35 Timbits=72 Water=2\nTH Mall of Asia: ADS=818792 ADT=150 APC=565 Donuts=31 Timbits=116 Water=4\nTH Elante Mall: ADS=805958 ADT=116 APC=724 Donuts=31 Timbits=56 Water=5\nTH Koramangala: ADS=798111 ADT=189 APC=437 Donuts=47 Timbits=117 Water=1\nTH Sindhu Bhavan: ADS=781371 ADT=157 APC=517 Donuts=28 Timbits=45 Water=3\nTH Golf Course AIPL: ADS=757780 ADT=144 APC=545 Donuts=47 Timbits=55 Water=2\nTH HSR: ADS=754193 ADT=171 APC=457 Donuts=39 Timbits=103 Water=2\nTH T1 Ahmedabad Airport: ADS=732117 ADT=143 APC=532 Donuts=23 Timbits=32 Water=9\nTH FIFC Mumbai: ADS=711641 ADT=144 APC=514 Donuts=31 Timbits=74 Water=2\nTH Inorbit Mall-Hyderabad: ADS=708339 ADT=135 APC=547 Donuts=52 Timbits=172 Water=6\nTH Malhar Road: ADS=677949 ADT=112 APC=631 Donuts=39 Timbits=56 Water=1\nTH Nexus Seawood: ADS=677572 ADT=121 APC=581 Donuts=32 Timbits=59 Water=2\nTH Balewadi Pune: ADS=643092 ADT=131 APC=508 Donuts=30 Timbits=101 Water=2\nTH Viman Nagar: ADS=640627 ADT=118 APC=566 Donuts=32 Timbits=49 Water=4\nTH Sunview Enclave: ADS=640106 ADT=89 APC=746 Donuts=26 Timbits=50 Water=3\nTH Green Park: ADS=628251 ADT=133 APC=491 Donuts=39 Timbits=58 Water=1\nTH Mohali: ADS=619408 ADT=108 APC=595 Donuts=25 Timbits=47 Water=2\nTH MC Kurla: ADS=589436 ADT=111 APC=549 Donuts=28 Timbits=62 Water=3\nTH HIAL Arrival: ADS=585164 ADT=112 APC=540 Donuts=30 Timbits=48 Water=0\nTH Sangrur: ADS=575058 ADT=87 APC=691 Donuts=14 Timbits=32 Water=2\nTH Sec 35 Chandigarh: ADS=563817 ADT=98 APC=600 Donuts=20 Timbits=45 Water=0\nTH Navrangpura: ADS=559954 ADT=121 APC=479 Donuts=17 Timbits=35 Water=1\nTH Phonix Mall Wakad: ADS=554991 ADT=103 APC=561 Donuts=31 Timbits=54 Water=3\nTH Patiala: ADS=503483 ADT=93 APC=564 Donuts=22 Timbits=40 Water=1\nTH NSP Pritampura: ADS=478187 ADT=95 APC=522 Donuts=15 Timbits=31 Water=1\nTH Basant Lok: ADS=414728 ADT=87 APC=494 Donuts=22 Timbits=43 Water=2\nTH Bucho Bathinda: ADS=409552 ADT=57 APC=747 Donuts=11 Timbits=22 Water=1\nTH Epicuria Nehru Place: ADS=403742 ADT=88 APC=475 Donuts=19 Timbits=33 Water=1\nTH FC Road: ADS=376325 ADT=83 APC=471 Donuts=22 Timbits=43 Water=2\nTH Punjabi bagh: ADS=364617 ADT=71 APC=535 Donuts=16 Timbits=31 Water=1\nTH NMIA Arrival: ADS=353712 ADT=59 APC=618 Donuts=10 Timbits=17 Water=4\nTH Lakeshore: ADS=270881 ADT=58 APC=489 Donuts=28 Timbits=68 Water=5\nTH NMiA Departure: ADS=86595 ADT=15 APC=619 Donuts=3 Timbits=3 Water=3\nTH T3D DIAL: ADS=0 ADT=0 APC=0 Donuts=0 Timbits=0 Water=0";
    var apiMessages=[].concat((history||[]).map(function(h){return {role:h.role||'user',content:h.content||h.text||''};}),[{role:'user',content:message}]);
    var body=JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:600,system:systemPrompt,messages:apiMessages});
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
app.use('/uploads/feed', require('express').static('uploads/feed'));
app.use('/uploads/checklist', require('express').static('uploads/checklist'));



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
    
    var storeRows=stores.map(function(s){return eRow(s,'MON+TUE','#8E8E93');}).join('');
    var checklistRows=eRow('Monday','Financial & Inventory','#B36200')+eRow('Tuesday','Sales Intelligence','#B36200')+eRow('Wednesday','Maintenance Visit','#8E8E93')+eRow('Friday','People & Readiness','#8E8E93')+eRow('Sat/Sun','Weekend Ops','#8E8E93');
    var body='<div style="font-size:18px;font-weight:700;color:#1C1C1E;margin-bottom:12px;">Good morning, '+am+' ☕</div>'+
      '<p style="font-size:14px;line-height:1.6;color:#3C3C43;margin-bottom:16px;">New week, fresh start. Monday and Tuesday checklists cover all stores — due by <strong>Tuesday midnight.</strong></p>'+
      eCard('Your Stores This Week',storeRows)+
      eCard('This Week Schedule',checklistRows)+
      eBtn('Open Tasks &rarr;','https://staging.opsaihub.in/tasks.html');
    var html=eWrap(body,'Weekly Reminder','Weekly Checklist Reminder &mdash; Week of '+weekStr);
    
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

// ── MTD SALES ROUTES ─────────────────────────────────────
app.get('/api/mtd/summary',function(req,res){
  try{
    var kpi=readJSON('kpi_mar2026.json',{});
    var stores=kpi.stores||{};
    var names=Object.keys(stores);
    if(names.length===0) return res.json({success:true,data:{totalMTDSales:0,avgADT:0,avgAPC:0,storeCount:0}});
    var totalSales=names.reduce(function(sum,s){return sum+(stores[s].ads||0)*(kpi.days||25);},0);
    var avgADT=Math.round(names.reduce(function(sum,s){return sum+(stores[s].adt||0);},0)/names.length);
    var avgAPC=Math.round(names.reduce(function(sum,s){return sum+(stores[s].apc||0);},0)/names.length);
    res.json({success:true,data:{totalMTDSales:totalSales,avgADT:avgADT,avgAPC:avgAPC,storeCount:names.length,days:kpi.days||25,indiaADT:kpi.india_adt||avgADT,indiaAPC:kpi.india_apc||avgAPC}});
  }catch(e){console.error('MTD summary error:',e.message);res.status(500).json({success:false,error:e.message});}
});
app.get('/api/mtd/stores',function(req,res){
  try{
    var kpi=readJSON('kpi_mar2026.json',{});
    var master=readJSON('stores.json',[]);
    var kd=kpi.stores||{};
    var result=master.map(function(s){
      var d=kd[s.name]||kd['TH '+s.name]||{};
      return {storeCode:s.id,storeName:s.name,am:s.am,region:s.region,mtdSales:(d.ads||0)*(kpi.days||25),ads:d.ads||0,adt:d.adt||0,apc:d.apc||0,donut:d.donut||0,timbit:d.timbit||0,water:d.water||0};
    });
    res.json({success:true,data:result});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});
app.get('/api/mtd/am/:amName',function(req,res){
  try{
    var kpi=readJSON('kpi_mar2026.json',{});
    var master=readJSON('stores.json',[]);
    var kd=kpi.stores||{};
    var amStores=master.filter(function(s){return s.am&&s.am.toLowerCase()===decodeURIComponent(req.params.amName).toLowerCase();});
    if(!amStores.length) return res.status(404).json({success:false,error:'AM not found'});
    var sd=amStores.map(function(s){var d=kd[s.name]||kd['TH '+s.name]||{};return {storeName:s.name,ads:d.ads||0,adt:d.adt||0,apc:d.apc||0,mtdSales:(d.ads||0)*(kpi.days||25)};});
    var totalSales=sd.reduce(function(sum,s){return sum+s.mtdSales;},0);
    var avgADT=Math.round(sd.reduce(function(sum,s){return sum+s.adt;},0)/Math.max(sd.length,1));
    var avgAT=Math.round(sd.reduce(function(sum,s){return sum+s.apc;},0)/Math.max(sd.length,1));
    res.json({success:true,data:{am:req.params.amName,totalMTDSales:totalSales,avgADT:avgADT,avgAT:avgAT,storeCount:sd.length,stores:sd}});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});
app.get('/api/mtd/am-summary',function(req,res){
  try{
    var kpi=readJSON('kpi_mar2026.json',{});
    var master=readJSON('stores.json',[]);
    var kd=kpi.stores||{};
    var amMap={};
    master.forEach(function(s){
      if(!s.am) return;
      if(!amMap[s.am]) amMap[s.am]={am:s.am,region:s.region||'',totalMTDSales:0,storeCount:0,adts:[],apcs:[]};
      var d=kd[s.name]||kd['TH '+s.name]||{};
      amMap[s.am].totalMTDSales+=(d.ads||0)*(kpi.days||25);
      amMap[s.am].adts.push(d.adt||0);
      amMap[s.am].apcs.push(d.apc||0);
      amMap[s.am].storeCount++;
    });
    var result=Object.values(amMap).map(function(a){
      a.avgADT=Math.round(a.adts.reduce(function(s,v){return s+v;},0)/Math.max(a.adts.length,1));
      a.avgAPC=Math.round(a.apcs.reduce(function(s,v){return s+v;},0)/Math.max(a.apcs.length,1));
      delete a.adts;delete a.apcs;return a;
    });
    res.json({success:true,data:result});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});
app.get('/api/mtd/flags',function(req,res){
  try{
    var kpi=readJSON('kpi_mar2026.json',{});
    var master=readJSON('stores.json',[]);
    var kd=kpi.stores||{};
    var flags=[];
    master.forEach(function(s){
      var d=kd[s.name]||kd['TH '+s.name]||{};
      if(d.donut>0&&d.donut<45) flags.push({store:s.name,am:s.am,flag:'Donuts below 45/day',value:d.donut});
      if(d.timbit>0&&d.timbit<100) flags.push({store:s.name,am:s.am,flag:'Timbits below 100/day',value:d.timbit});
      if(d.water>0&&d.water<10) flags.push({store:s.name,am:s.am,flag:'Water bottles below 10/day',value:d.water});
    });
    res.json({success:true,data:flags});
  }catch(e){res.status(500).json({success:false,error:e.message});}
});

app.use(express.static(path.join(__dirname, 'public')));

// ── INDIA CITY NEWS ──────────────────────────────────────
var newsCache={data:null,ts:0};
app.get('/api/news/india',function(req,res){
  var now=Date.now();
  if(newsCache.data&&(now-newsCache.ts)<5*60*1000){
    return res.json({success:true,data:newsCache.data,cached:true});
  }
  var https=require('https');
  var cities=[
    {name:'Delhi',q:'Delhi+news'},
    {name:'Mumbai',q:'Mumbai+news'},
    {name:'Chandigarh',q:'Chandigarh+news'},
    {name:'Pune',q:'Pune+news'},
    {name:'Ahmedabad',q:'Ahmedabad+news'},
    {name:'Bengaluru',q:'Bengaluru+news'},
    {name:'Hyderabad',q:'Hyderabad+news'},
    {name:'MPEH',q:'Mumbai+Pune+Expressway'}
  ];
  var results=[];
  var done=0;
  cities.forEach(function(city){
    var opts={
      hostname:'news.google.com',
      path:'/rss/search?q='+city.q+'&hl=en-IN&gl=IN&ceid=IN:en',
      method:'GET',
      headers:{'User-Agent':'Mozilla/5.0'}
    };
    var req2=https.request(opts,function(r){
      var d='';
      r.on('data',function(c){d+=c;});
      r.on('end',function(){
        try{
          var items=[];var sp=0;while(true){var s=d.indexOf('<item>',sp),e=d.indexOf('</item>',sp);if(s<0||e<0)break;items.push(d.substring(s,e+7));sp=e+7;}
          items.slice(0,2).forEach(function(item){
            var title=[null,'']; var tc1=item.indexOf('<title>'),tc2=item.indexOf('</title>'); if(tc1>-1&&tc2>-1){var tr=item.substring(tc1+7,tc2); if(tr.indexOf('CDATA')>-1){tr=tr.replace(/<![CDATA[/,'').replace(/]]>/,'');} title=[null,tr.trim()];}
            var link=[null,'']; var lc1=item.indexOf('<link>'),lc2=item.indexOf('</link>'); if(lc1>-1&&lc2>-1){link=[null,item.substring(lc1+6,lc2).trim()];}
            var pubDate=[null,'']; var pc1=item.indexOf('<pubDate>'),pc2=item.indexOf('</pubDate>'); if(pc1>-1&&pc2>-1){pubDate=[null,item.substring(pc1+9,pc2).trim()];}
            var source=[null,'']; var sc1=item.indexOf('>',item.indexOf('<source')),sc2=item.indexOf('</source>'); if(sc1>-1&&sc2>-1){source=[null,item.substring(sc1+1,sc2).trim()];}  
            if(title[1]&&title[1].length>10){
              results.push({
                city:city.name,
                title:title[1].replace(/ - .*$/,'').trim(),
                source:source[1]||'Google News',
                pubDate:pubDate[1]||'',
                link:link[1]||''
              });
            }
          });
        }catch(e){}
        done++;
        if(done===cities.length){
          newsCache={data:results,ts:Date.now()};
          res.json({success:true,data:results,cached:false});
        }
      });
    });
    req2.on('error',function(){done++;if(done===cities.length)res.json({success:true,data:results,cached:false});});
    req2.end();
  });
});

// ── WORLD NEWS ───────────────────────────────────────────
var worldCache={data:null,ts:0};
app.get('/api/news/world',function(req,res){
  var now=Date.now();
  if(worldCache.data&&(now-worldCache.ts)<5*60*1000){
    return res.json({success:true,data:worldCache.data,cached:true});
  }
  var https=require('https');
  var topics=[
    {name:'Global Economy',q:'global+economy+India+impact',color:'#FF9500'},
    {name:'Middle East',q:'Middle+East+conflict+oil+price',color:'#FF3B30'},
    {name:'US Markets',q:'US+markets+Fed+rate+dollar',color:'#007AFF'},
    {name:'China Trade',q:'China+trade+India+exports',color:'#FF2D55'},
    {name:'Crude Oil',q:'crude+oil+price+India',color:'#AF52DE'}
  ];
  var results=[];
  var done=0;
  topics.forEach(function(topic){
    var opts={
      hostname:'news.google.com',
      path:'/rss/search?q='+topic.q+'&hl=en-IN&gl=IN&ceid=IN:en',
      method:'GET',
      headers:{'User-Agent':'Mozilla/5.0'}
    };
    var req2=https.request(opts,function(r){
      var d='';
      r.on('data',function(c){d+=c;});
      r.on('end',function(){
        try{
          var items=[];var sp=0;
          while(true){var s=d.indexOf('<item>',sp),e=d.indexOf('</item>',sp);if(s<0||e<0)break;items.push(d.substring(s,e+7));sp=e+7;}
          items.slice(0,2).forEach(function(item){
            var title=[null,'']; var tc1=item.indexOf('<title>'),tc2=item.indexOf('</title>'); if(tc1>-1&&tc2>-1){var tr=item.substring(tc1+7,tc2); if(tr.indexOf('CDATA')>-1){tr=tr.replace('<![CDATA[','').replace(']]>','');} title=[null,tr.trim()];}
            var link=[null,'']; var lc1=item.indexOf('<link>'),lc2=item.indexOf('</link>'); if(lc1>-1&&lc2>-1){link=[null,item.substring(lc1+6,lc2).trim()];}
            var pubDate=[null,'']; var pc1=item.indexOf('<pubDate>'),pc2=item.indexOf('</pubDate>'); if(pc1>-1&&pc2>-1){pubDate=[null,item.substring(pc1+9,pc2).trim()];}
            var source=[null,'']; var sc1=item.indexOf('>',item.indexOf('<source')),sc2=item.indexOf('</source>'); if(sc1>-1&&sc2>-1){source=[null,item.substring(sc1+1,sc2).trim()];}
            if(title[1]&&title[1].length>10){
              results.push({topic:topic.name,color:topic.color,title:title[1].split(' - ')[0].trim(),source:source[1]||'Google News',pubDate:pubDate[1]||'',link:link[1]||''});
            }
          });
        }catch(e){}
        done++;
        if(done===topics.length){worldCache={data:results,ts:Date.now()};res.json({success:true,data:results});}
      });
    });
    req2.on('error',function(){done++;if(done===topics.length)res.json({success:true,data:results});});
    req2.end();
  });
});

app.listen(PORT, function() { console.log('OpsAIHub Staging running on port ' + PORT); });
module.exports = { readJSON: readJSON, writeJSON: writeJSON };
