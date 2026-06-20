'use strict';
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../services/store');
const { sendEmail, emailStyle } = require('../services/email');
const { AM_EMAILS, HOD_EMAIL, CC_EMAIL } = require('../services/constants');
const { authMiddleware } = require('../middleware/auth');

const FINANCE_EMAIL = process.env.FINANCE_EMAIL || 'finance@timhortonsindia.com';

const CASH_AUDIT_CHECKPOINTS = [
  { section: 'MTD CASH VARIANCE & FLOAT COMPLIANCE', items: [
    { id: 'M-01', sev: 'Level 2', desc: 'MTD cash variance reviewed — total within acceptable thresholds; root cause documented for any excess; float ₹4,000 maintained across all tills all month' },
    { id: 'M-02', sev: 'Level 2', desc: 'All cashier-level shortages above ₹50 actioned — cashier bears shortfall; 3+ repeat cases tracked for termination eligibility' },
    { id: 'M-03', sev: 'Level 2', desc: 'Cash discrepancy incident reports filed and AM notified within TAT; all surplus deposited to bank' }
  ]},
  { section: 'SAFE & BANKING COMPLIANCE', items: [
    { id: 'M-04', sev: 'Level 2', desc: 'All daily bank deposits reconciled for the month — denomination verified, banking slips signed and filed; all 4 deposit slip copies handled correctly' },
    { id: 'M-05', sev: 'Level 2', desc: 'Scratch card verification from cash pickup agency confirmed for all pickups — serial matching process followed; cards filed under manager supervision' },
    { id: 'M-06', sev: 'Level 2', desc: 'Safe count logs complete for all shifts — MOD name, cash, envelopes, petty cash recorded; witness signed; 2 keys in key box (back area), 3rd with Finance throughout month' }
  ]},
  { section: 'VOID & REFUND COMPLIANCE MTD', items: [
    { id: 'M-07', sev: 'Level 3', desc: 'Void/Refund Register maintained continuously — all voids/Refunds have bill number, amount, reason code, approval initials; Daily Void Summary reviewed by SM' },
    { id: 'M-08', sev: 'Level 3', desc: 'Monthly void count and Refund count reviewed per cashier — no excessive or escalating trend; high usage triggered investigation this month' },
    { id: 'M-09', sev: 'Level 3', desc: 'No manual cash refunds without system entry — all refunds processed in system; card/UPI refunds to original mode with tracking number; no unauthorized Ops Head exception' },
    { id: 'M-10', sev: 'Level 3', desc: 'Repeated void/Refund cases escalated to Ops Head & Finance Controller; POS access restriction applied where required' }
  ]}
];

const CASH_AUDIT_STORES = [
  { code: '30001', name: 'TH Malhar Road', am: 'Deepak', region: 'Punjab' },
  { code: '30012', name: 'TH Sunview Enclave', am: 'Deepak', region: 'Punjab' },
  { code: '30013', name: 'TH Bucho Bathinda', am: 'Deepak', region: 'Punjab' },
  { code: '30014', name: 'TH Patiala', am: 'Deepak', region: 'Punjab' },
  { code: '30015', name: 'TH Mohali', am: 'Kajal', region: 'Punjab' },
  { code: '30026', name: 'TH Sangrur', am: 'Deepak', region: 'Punjab' },
  { code: '40006', name: 'TH Elante Mall', am: 'Kajal', region: 'Punjab' },
  { code: '40009', name: 'TH Sec 35 Chandigarh', am: 'Kajal', region: 'Punjab' },
  { code: '60001', name: 'TH DLF Cyberhub', am: 'Harish', region: 'Delhi' },
  { code: '60039', name: 'TH Golf Course AIPL', am: 'Harish', region: 'Delhi' },
  { code: '70002', name: 'TH Select City Saket', am: 'Harish', region: 'Delhi' },
  { code: '70003', name: 'TH Green Park', am: 'Harish', region: 'Delhi' },
  { code: '70004', name: 'TH Punjabi Bagh', am: 'Rohit', region: 'Delhi' },
  { code: '70005', name: 'TH Vegas Mall', am: 'Rohit', region: 'Delhi' },
  { code: '70008', name: 'TH T3D DIAL', am: 'Raman', region: 'Delhi' },
  { code: '70010', name: 'TH NSP Pritampura', am: 'Rohit', region: 'Delhi' },
  { code: '70017', name: 'TH Basant Lok', am: 'Harish', region: 'Delhi' },
  { code: '70023', name: 'TH Epicuria Nehru Place', am: 'Harish', region: 'Delhi' },
  { code: '70024', name: 'TH T1D Dial', am: 'Raman', region: 'Delhi' },
  { code: '70046', name: 'TH T3D Food Court', am: 'Raman', region: 'Delhi' },
  { code: '90007', name: 'TH Skymark One', am: 'Rohit', region: 'Delhi' },
  { code: '240037', name: 'TH T1 Ahmedabad Airport', am: 'TBA', region: 'Gujarat' },
  { code: '240041', name: 'TH Sindhu Bhavan', am: 'TBA', region: 'Gujarat' },
  { code: '240042', name: 'TH Navrangpura', am: 'TBA', region: 'Gujarat' },
  { code: '270018', name: 'TH Lokhandwala', am: 'Akash C', region: 'Mumbai' },
  { code: '270019', name: 'TH MC Kurla', am: 'Akash C', region: 'Mumbai' },
  { code: '270020', name: 'TH Bandra', am: 'Akash C', region: 'Mumbai' },
  { code: '270025', name: 'TH Balewadi Pune', am: 'Akash C', region: 'Pune' },
  { code: '270031', name: 'TH FIFC Mumbai', am: 'Akash C', region: 'Mumbai' },
  { code: '270032', name: 'TH HPCL Expressway', am: 'Akash R', region: 'Navi Mumbai' },
  { code: '270033', name: 'TH Viman Nagar', am: 'Akash C', region: 'Pune' },
  { code: '270034', name: 'TH Phoenix Mall Wakad', am: 'Akash C', region: 'Pune' },
  { code: '270038', name: 'TH Nexus Seawood', am: 'Akash R', region: 'Navi Mumbai' },
  { code: '270045', name: 'TH FC Road', am: 'Akash C', region: 'Mumbai' },
  { code: '270048', name: 'TH NMIA Arrival', am: 'Akash R', region: 'Navi Mumbai' },
  { code: '270049', name: 'TH NMIA Departure', am: 'Akash R', region: 'Navi Mumbai' },
  { code: '290016', name: 'TH BIAL', am: 'Jagadeesha', region: 'Karnataka' },
  { code: '290021', name: 'TH Mall of Asia', am: 'Jagadeesha', region: 'Karnataka' },
  { code: '290022', name: 'TH Koramangala', am: 'Jagadeesha', region: 'Karnataka' },
  { code: '290044', name: 'TH HSR', am: 'Jagadeesha', region: 'Karnataka' },
  { code: '360035', name: 'TH Inorbit Mall-Hyderabad', am: 'Shivam', region: 'Telangana' },
  { code: '360036', name: 'TH HIAL', am: 'Shivam', region: 'Telangana' },
  { code: '360050', name: 'TH HIAL Arrival', am: 'Shivam', region: 'Telangana' },
  { code: '360051', name: 'TH Lakeshore', am: 'Shivam', region: 'Telangana' }
];

const AM_EMAILS_CASH = Object.assign({}, AM_EMAILS, {
  'Akash C': 'akash.chavan@timhortonsindia.com',
  'Akash R': 'akash.rathod@timhortonsindia.com'
});

function cashAuditRiskRating(pct) {
  if (pct >= 90) return 'LOW RISK';
  if (pct >= 70) return 'MODERATE RISK';
  if (pct >= 50) return 'HIGH RISK';
  return 'CRITICAL RISK';
}

router.get('/monthly/list', function(req, res) {
  try {
    var all = readJSON('cash_audit_monthly.json', []);
    var am = req.query.am;
    if (am) all = all.filter(function(s) { return s.areaManager === am; });
    res.json({ success: true, data: all });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/monthly/stores', function(req, res) {
  res.json({ success: true, data: readJSON('store_am_allocation.json', CASH_AUDIT_STORES) });
});

router.get('/monthly/store-ranking', function(req, res) {
  try {
    var all = readJSON('cash_audit_monthly.json', []);
    var month = req.query.month;
    if (month) all = all.filter(function(s) { return s.monthYear === month; });
    var byStore = {};
    all.forEach(function(sub) {
      if (!byStore[sub.storeCode] || sub.submittedAt > byStore[sub.storeCode].submittedAt) {
        byStore[sub.storeCode] = sub;
      }
    });
    var ranked = CASH_AUDIT_STORES.map(function(s) {
      var latest = byStore[s.code];
      return { code: s.code, name: s.name, am: s.am, region: s.region,
        score: latest ? latest.compliancePct : null,
        riskRating: latest ? latest.riskRating : 'Not Submitted',
        submitted: !!latest, submittedAt: latest ? latest.submittedAt : null };
    }).sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
    ranked.forEach(function(r, i) { r.rank = i + 1; });
    res.json({ success: true, data: ranked });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/monthly/submit', authMiddleware, function(req, res) {
  try {
    var b = req.body;
    if (!b.store || !b.monthYear) return res.status(400).json({ success: false, error: 'Store and month are required' });
    var storeInfo = CASH_AUDIT_STORES.find(function(s) { return s.code === b.storeCode; }) || {};
    var compliant = 0, nonCompliant = 0;
    var cpOut = (b.checkpoints || []).map(function(cp) {
      if (cp.status === 'Compliant') compliant++;
      else if (cp.status === 'Non-Compliant') nonCompliant++;
      return { id: cp.id, desc: cp.desc, status: cp.status || 'N/A', remarks: cp.remarks || '', severity: cp.severity || '' };
    });
    var total = compliant + nonCompliant;
    var pct = total > 0 ? Math.round(compliant / total * 100) : 0;
    var sub = {
      id: 'CA-' + Date.now(), submittedAt: new Date().toISOString(),
      store: b.store, storeCode: b.storeCode || storeInfo.code || '',
      cityRegion: b.cityRegion || storeInfo.region || '',
      monthYear: b.monthYear, submissionDate: b.submissionDate || new Date().toISOString().slice(0, 10),
      storeManager: b.storeManager || '', areaManager: b.areaManager || storeInfo.am || '',
      region: b.region || storeInfo.region || '', regionalHead: b.regionalHead || '',
      reviewDate: b.reviewDate || '', prevScore: b.prevScore || '', targetScore: b.targetScore || '',
      checkpoints: cpOut, repeatOffenders: b.repeatOffenders || [],
      signoff: b.signoff || {}, compliant: compliant, nonCompliant: nonCompliant,
      compliancePct: pct, riskRating: cashAuditRiskRating(pct), emailSent: false
    };
    var all = readJSON('cash_audit_monthly.json', []);
    all.unshift(sub);
    writeJSON('cash_audit_monthly.json', all);
    var amEmail = AM_EMAILS_CASH[sub.areaManager] || null;
    var toList = [HOD_EMAIL, CC_EMAIL, FINANCE_EMAIL];
    if (amEmail) toList.push(amEmail);
    var subject = '[Cash Audit] ' + sub.store + ' — ' + sub.monthYear + ' | ' + sub.riskRating + ' (' + sub.compliancePct + '%)';
    toList.forEach(function(email) { if (email) sendEmail(email, subject, 'Cash audit submitted for ' + sub.store); });
    sub.emailSent = true;
    writeJSON('cash_audit_monthly.json', all);
    res.json({ success: true, id: sub.id, compliancePct: pct, riskRating: sub.riskRating });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
