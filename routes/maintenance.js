'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { readJSON, writeJSON } = require('../services/store');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail, eWrap, eCard, eRow, eBtn } = require('../services/email');
const { AM_EMAILS, MAINTENANCE_EMAIL, MAINTENANCE_REGION_EMAILS, P1_ESCALATION_EMAILS, CEO_EMAIL } = require('../services/constants');

// Resize uploaded maintenance photos to max 1200px wide, 80% JPEG quality
function compressPhoto(filePath, cb) {
  var tmp = filePath + '.tmp.jpg';
  sharp(filePath)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(tmp, function(err) {
      if (err) return cb(); // skip compression on error, keep original
      fs.rename(tmp, filePath, function() { cb(); });
    });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      var d = 'uploads/maintenance/';
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      cb(null, d);
    },
    filename: function(req, file, cb) {
      cb(null, Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '.jpg');
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
}).fields([{ name: 'photo1' }, { name: 'photo2' }, { name: 'photo3' }]);

var allStores = [
  { store: 'T3DD', am: 'Raman' }, { store: 'T3DD FC', am: 'Raman' }, { store: 'T1DD', am: 'Raman' },
  { store: 'Cyber Hub', am: 'Harish' }, { store: 'Select City', am: 'Harish' },
  { store: 'Green Park', am: 'Harish' }, { store: 'Basant Lok', am: 'Harish' },
  { store: 'Epicuria', am: 'Harish' }, { store: 'APL Golf Course', am: 'Harish' },
  { store: 'Skymark', am: 'Rohit' }, { store: 'Vegas Mall', am: 'Rohit' },
  { store: 'NSP', am: 'Rohit' }, { store: 'Punjabi Bagh', am: 'Rohit' },
  { store: 'CP67 Mohali', am: 'Kajal' }, { store: 'Elante Mall', am: 'Kajal' }, { store: 'Sector 35', am: 'Kajal' },
  { store: 'Sunview', am: 'Deepak' }, { store: 'Bhupindra Road', am: 'Deepak' },
  { store: 'Malhar Rd', am: 'Deepak' }, { store: 'Sangrur', am: 'Deepak' }, { store: 'Bucho', am: 'Deepak' },
  { store: 'Lokhandwala', am: 'Sandeep Mukharjee' }, { store: 'Supreme', am: 'Sandeep Mukharjee' },
  { store: 'PMC Kurla', am: 'Sandeep Mukharjee' }, { store: 'FIFC', am: 'Sandeep Mukharjee' },
  { store: 'Balewadi', am: 'TBA' }, { store: 'Viman Nagar', am: 'TBA' },
  { store: 'PMC Wakad', am: 'TBA' }, { store: 'FC Road', am: 'TBA' },
  { store: 'HPCL-MPE', am: 'Akash Rathod' }, { store: 'NMIAL', am: 'Akash Rathod' },
  { store: 'NMIAL Arrival', am: 'Akash Rathod' }, { store: 'Seawoods', am: 'Akash Rathod' },
  { store: 'Koramangala', am: 'Jagadeesha' }, { store: 'BIAL', am: 'Jagadeesha' },
  { store: 'Mall of Asia', am: 'Jagadeesha' }, { store: 'HSR Layout', am: 'Jagadeesha' },
  { store: 'Inorbit Mall Hyd', am: 'Shivam' }, { store: 'Hyderabad Arrivals', am: 'Shivam' },
  { store: 'Lakeshore', am: 'Shivam' }, { store: 'Hyderabad Airport', am: 'Shivam' },
  { store: 'Ahmedabad Airport', am: 'Unassigned' }, { store: 'Sindhu Bhavan', am: 'Unassigned' },
  { store: 'Navrangpura', am: 'Unassigned' }
];

function getAM(store) {
  var s = allStores.find(function(x) {
    return x.store.toLowerCase().trim() === (store || '').toLowerCase().trim();
  });
  return s ? s.am : null;
}

function nextTicketId() {
  var tickets = readJSON('maintenance_tickets.json', []);
  var today = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  var prefix = 'MT-' + today + '-';
  var todayCount = tickets.filter(function(t) { return t.id && t.id.startsWith(prefix); }).length;
  return prefix + String(todayCount + 1).padStart(3, '0');
}

function ticketEmailBody(ticket, heading, extra) {
  var priorityColor = ticket.priority === 'urgent' ? '#C8102E' : '#007AFF';
  return eWrap(
    '<div class="greeting">' + heading + '</div>' +
    eCard('Ticket Details',
      eRow('Ticket ID', ticket.id, '#C8102E') +
      eRow('Store', ticket.store) +
      eRow('Area Manager', ticket.am || 'N/A') +
      eRow('Raised By', ticket.submittedBy + (ticket.phone ? ' · ' + ticket.phone : '')) +
      eRow('Category', ticket.category) +
      eRow('Priority', ticket.priority.toUpperCase(), priorityColor) +
      eRow('Date', new Date(ticket.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
    ) +
    eCard('Issue Description', '<p style="font-size:14px;color:#1C1C1E;line-height:1.6;margin:0;">' + ticket.description + '</p>') +
    (extra || '') +
    eBtn('Open Dashboard', 'https://opsaihub.in/maintenance-dashboard.html'),
    "Tim's Ops Connect", 'Maintenance Portal'
  );
}

// POST /api/maintenance/submit — public
router.post('/submit', function(req, res) {
  upload(req, res, function(err) {
    if (err) return res.status(400).json({ success: false, error: 'Upload failed' });

    var store = (req.body.store || '').trim();
    var submittedBy = (req.body.submittedBy || '').trim();
    var category = (req.body.category || '').trim();
    var description = (req.body.description || '').trim();
    if (!store || !submittedBy || !category || !description) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    var photoFiles = [];
    ['photo1', 'photo2', 'photo3'].forEach(function(f) {
      if (req.files && req.files[f] && req.files[f][0]) {
        photoFiles.push(req.files[f][0]);
      }
    });

    // Compress photos then save ticket
    var pending = photoFiles.length;
    function finish() {
      var photos = photoFiles.map(function(f) { return '/uploads/maintenance/' + f.filename; });
      var am = getAM(store);
      var ticket = {
        id: nextTicketId(),
        store: store,
        am: am || '',
        submittedBy: submittedBy,
        phone: (req.body.phone || '').trim(),
        submittedAt: new Date().toISOString(),
        category: category,
        priority: ['urgent','p1'].indexOf(req.body.priority) !== -1 ? req.body.priority : 'normal',
        description: description,
        photos: photos,
        status: 'open',
        maintenanceNotes: '',
        resolvedAt: null,
        resolvedBy: null,
        amVerifiedAt: null,
        amVerifiedBy: null
      };

      var tickets = readJSON('maintenance_tickets.json', []);
      tickets.push(ticket);
      writeJSON('maintenance_tickets.json', tickets);

      var subjectPrefix = ticket.priority === 'p1' ? '[P1 CRITICAL] ⚡ ' : ticket.priority === 'urgent' ? '[URGENT] ' : '';
      var html = ticketEmailBody(ticket, 'New Maintenance Complaint');
      var regionalCC = am && MAINTENANCE_REGION_EMAILS[am] ? MAINTENANCE_REGION_EMAILS[am] : null;
      var maintenanceCC = [regionalCC].filter(Boolean).join(', ') || undefined;
      sendEmail(MAINTENANCE_EMAIL, subjectPrefix + 'New Ticket — ' + ticket.store + ' (' + ticket.id + ')', html, maintenanceCC);
      if (am && AM_EMAILS[am]) {
        sendEmail(AM_EMAILS[am], subjectPrefix + 'Maintenance Ticket Raised — ' + ticket.store + ' (' + ticket.id + ')', html);
      }
      res.json({ success: true, id: ticket.id });
    }

    if (!pending) return finish();
    photoFiles.forEach(function(f) {
      compressPhoto(path.join(__dirname, '..', f.destination, f.filename), function() {
        if (--pending === 0) finish();
      });
    });
  });
});

// GET /api/maintenance/tickets — auth required
router.get('/tickets', authMiddleware, function(req, res) {
  try {
    var tickets = readJSON('maintenance_tickets.json', []);
    if (req.user.role === 'am') {
      tickets = tickets.filter(function(t) { return t.am === req.user.am; });
    }
    var status = req.query.status;
    var days = parseInt(req.query.days);
    if (status) tickets = tickets.filter(function(t) { return t.status === status; });
    if (days > 0) {
      var cutoff = new Date(Date.now() - days * 86400000).toISOString();
      tickets = tickets.filter(function(t) { return t.submittedAt >= cutoff; });
    }
    tickets.sort(function(a, b) { return a.submittedAt < b.submittedAt ? 1 : -1; });
    res.json({ success: true, data: tickets });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// GET /api/maintenance/stores — public, for submit form dropdown
router.get('/stores', function(req, res) {
  res.json({ success: true, data: allStores.map(function(s) { return s.store; }) });
});

// POST /api/maintenance/tickets/:id/resolve — maintenance/hod only
router.post('/tickets/:id/resolve', authMiddleware, function(req, res) {
  if (req.user.role !== 'maintenance' && req.user.role !== 'hod' && req.user.role !== 'ceo') {
    return res.status(403).json({ success: false, error: 'Maintenance access required' });
  }
  var tickets = readJSON('maintenance_tickets.json', []);
  var ticket = tickets.find(function(t) { return t.id === req.params.id; });
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  if (ticket.status === 'closed') return res.status(400).json({ success: false, error: 'Already closed' });

  ticket.status = 'resolved';
  ticket.maintenanceNotes = (req.body.notes || '').trim();
  ticket.resolvedAt = new Date().toISOString();
  ticket.resolvedBy = req.user.am;
  ticket.teamType = req.body.teamType === 'external' ? 'external' : 'internal';
  ticket.partsCost = parseFloat(req.body.partsCost) || 0;
  ticket.laborCost = ticket.teamType === 'internal' ? 0 : (parseFloat(req.body.laborCost) || 0);
  ticket.totalCost = ticket.partsCost + ticket.laborCost;
  writeJSON('maintenance_tickets.json', tickets);

  if (ticket.am && AM_EMAILS[ticket.am]) {
    var notesHtml = ticket.maintenanceNotes
      ? eCard('Resolution Notes', '<p style="font-size:14px;color:#1C1C1E;line-height:1.6;margin:0;">' + ticket.maintenanceNotes + '</p>')
      : '';
    var html = ticketEmailBody(ticket, 'Ticket Resolved — Please Verify',
      notesHtml +
      '<p style="font-size:14px;color:#3A3A3C;margin:0 0 16px;">Please log in and verify that the issue has been fixed, then close the ticket.</p>'
    );
    sendEmail(AM_EMAILS[ticket.am], 'Please Verify — ' + ticket.id + ' (' + ticket.store + ')', html);
  }
  res.json({ success: true });
});

// POST /api/maintenance/tickets/:id/verify — am/hod only
router.post('/tickets/:id/verify', authMiddleware, function(req, res) {
  if (req.user.role !== 'am' && req.user.role !== 'hod' && req.user.role !== 'ceo') {
    return res.status(403).json({ success: false, error: 'AM access required' });
  }
  var tickets = readJSON('maintenance_tickets.json', []);
  var ticket = tickets.find(function(t) { return t.id === req.params.id; });
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  if (ticket.status !== 'resolved') return res.status(400).json({ success: false, error: 'Not yet resolved' });
  if (req.user.role === 'am' && ticket.am !== req.user.am) {
    return res.status(403).json({ success: false, error: 'Not your store' });
  }

  ticket.status = 'closed';
  ticket.amVerifiedAt = new Date().toISOString();
  ticket.amVerifiedBy = req.user.am;
  writeJSON('maintenance_tickets.json', tickets);
  res.json({ success: true });
});

// POST /api/maintenance/tickets/:id/escalate — maintenance only, emails Jeenal + Vivek
router.post('/tickets/:id/escalate', authMiddleware, function(req, res) {
  if (req.user.role !== 'maintenance' && req.user.role !== 'hod' && req.user.role !== 'ceo') {
    return res.status(403).json({ success: false, error: 'Maintenance access required' });
  }
  var tickets = readJSON('maintenance_tickets.json', []);
  var ticket = tickets.find(function(t) { return t.id === req.params.id; });
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  if (ticket.priority !== 'p1') return res.status(400).json({ success: false, error: 'Only P1 tickets can be escalated' });
  if (ticket.status === 'closed') return res.status(400).json({ success: false, error: 'Ticket already closed' });

  if (!ticket.escalationCount) ticket.escalationCount = 0;
  if (!ticket.escalations) ticket.escalations = [];
  ticket.escalationCount++;
  ticket.escalations.push({ level: 'team', sentAt: new Date().toISOString(), sentBy: req.user.am });
  writeJSON('maintenance_tickets.json', tickets);

  var isReminder = ticket.escalationCount > 1;
  var subject = isReminder
    ? '[P1 REMINDER ' + ticket.escalationCount + '] ⚡ ' + ticket.category + ' — ' + ticket.store + ' — Awaiting Resolution'
    : '[P1 ESCALATION] ⚡ ' + ticket.category + ' — ' + ticket.store + ' — Immediate Action Required';

  var amEmail = ticket.am && AM_EMAILS[ticket.am] ? AM_EMAILS[ticket.am] : null;
  var ccList = [MAINTENANCE_EMAIL, amEmail].filter(Boolean).join(', ');

  var html = ticketEmailBody(ticket,
    isReminder ? 'P1 Escalation — Reminder ' + ticket.escalationCount : 'P1 Equipment Escalation',
    '<p style="font-size:14px;color:#C8102E;font-weight:700;margin:0 0 12px;">⚡ This is a P1 Critical equipment issue requiring immediate attention. ' +
    (isReminder ? 'This is reminder #' + ticket.escalationCount + '. Issue remains unresolved.' : 'Please coordinate with the maintenance team for urgent resolution.') + '</p>' +
    '<p style="font-size:13px;color:#3A3A3C;margin:0 0 12px;">Store: <strong>' + ticket.store + '</strong> &nbsp;|&nbsp; AM: <strong>' + (ticket.am || 'Unassigned') + '</strong></p>'
  );

  var toEmails = (req.body.escalateTo || '').split(',').map(function(e) { return e.trim(); }).filter(Boolean);
  if (!toEmails.length) toEmails = P1_ESCALATION_EMAILS;
  ticket.escalations[ticket.escalations.length - 1].sentTo = toEmails;
  writeJSON('maintenance_tickets.json', tickets);
  // escalation emails disabled
  // toEmails.forEach(function(e) { sendEmail(e, subject, html, ccList); });
  res.json({ success: true, escalationCount: ticket.escalationCount });
});

function msToHuman(ms) {
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function escalationTimeline(ticket) {
  var fmt = function(iso) {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  var events = [{ label: 'Ticket Raised', at: ticket.submittedAt }];
  (ticket.escalations || []).forEach(function(e, i) {
    var to = e.sentTo ? e.sentTo.join(', ') : 'team';
    events.push({ label: (e.level === 'ceo' ? 'CEO Escalation' : 'Escalation ' + i + ' → ' + to), at: e.sentAt });
  });
  var rows = events.map(function(ev, i) {
    var delay = i > 0 ? ' &nbsp;<span style="color:#C8102E;font-weight:700;">(+' + msToHuman(new Date(ev.at) - new Date(events[i - 1].at)) + ')</span>' : '';
    return eRow(ev.label + delay, fmt(ev.at));
  }).join('');
  return eCard('Escalation Timeline', rows);
}

// POST /api/maintenance/tickets/:id/escalate-ceo — only after 2 escalations, requires reason
router.post('/tickets/:id/escalate-ceo', authMiddleware, function(req, res) {
  if (req.user.role !== 'maintenance' && req.user.role !== 'hod') {
    return res.status(403).json({ success: false, error: 'Maintenance access required' });
  }
  var reason = (req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ success: false, error: 'A reason is required to escalate to CEO' });

  var tickets = readJSON('maintenance_tickets.json', []);
  var ticket = tickets.find(function(t) { return t.id === req.params.id; });
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  if (ticket.priority !== 'p1') return res.status(400).json({ success: false, error: 'Only P1 tickets' });
  if ((ticket.escalationCount || 0) < 2) return res.status(400).json({ success: false, error: 'Minimum 2 escalations required before CEO escalation' });
  if (ticket.ceoEscalatedAt) return res.status(400).json({ success: false, error: 'Already escalated to CEO' });
  if (ticket.status === 'closed') return res.status(400).json({ success: false, error: 'Ticket already closed' });

  ticket.ceoEscalatedAt = new Date().toISOString();
  ticket.ceoEscalatedBy = req.user.am;
  if (!ticket.escalations) ticket.escalations = [];
  ticket.escalations.push({ level: 'ceo', sentAt: ticket.ceoEscalatedAt, sentBy: req.user.am, reason: reason });
  writeJSON('maintenance_tickets.json', tickets);

  var subject = '[P1 CEO ESCALATION] 🚨 ' + ticket.category + ' — ' + ticket.store + ' — ' + (ticket.escalationCount || 2) + ' Reminders Unanswered';
  var amEmail = ticket.am && AM_EMAILS[ticket.am] ? AM_EMAILS[ticket.am] : null;
  var ccList = [MAINTENANCE_EMAIL, amEmail].filter(Boolean).concat(P1_ESCALATION_EMAILS).filter(Boolean).join(', ');

  var html = ticketEmailBody(ticket,
    '🚨 CEO Escalation — P1 Critical Unresolved',
    eCard('Reason for Escalation', '<p style="font-size:14px;color:#C8102E;font-weight:700;margin:0;">' + reason + '</p>') +
    escalationTimeline(ticket)
  );

  // escalation emails disabled
  // sendEmail(CEO_EMAIL, subject, html, ccList);
  res.json({ success: true });
});

module.exports = router;
