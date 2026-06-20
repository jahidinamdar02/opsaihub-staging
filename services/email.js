'use strict';
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

function sendEmail(to, subject, html, callback) {
  transporter.sendMail({
    from: '"Tim\'s Ops Connect" <' + process.env.EMAIL_USER + '>',
    to: to,
    subject: subject,
    html: html
  }, function(err, info) {
    if (err) console.error('[Email error]', err.message);
    else console.log('[Email sent]', to);
    if (callback) callback(err);
  });
}

function emailStyle() {
  return '<style>body{margin:0;padding:0;background:#F5F5F7;font-family:Arial,sans-serif}' +
    '.wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}' +
    '.hdr{background:linear-gradient(135deg,#C8102E,#8B0B1F);padding:24px 28px}' +
    '.hdr-logo{color:#fff;font-size:20px;font-weight:700}' +
    '.hdr-sub{color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px}' +
    '.body{padding:24px 28px}' +
    '.greeting{font-size:20px;font-weight:700;color:#1C1C1E;margin-bottom:16px}' +
    '.card{background:#F5F5F7;border-radius:10px;padding:16px;margin-bottom:16px}' +
    '.card-ttl{font-size:11px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}' +
    '.card-val{font-size:28px;font-weight:700;color:#1C1C1E}' +
    '.card-val.green{color:#1B7A3A}.card-val.amber{color:#B36200}' +
    '.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E5E5EA}' +
    '.row:last-child{border-bottom:none}' +
    '.btn{display:block;background:#C8102E;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-top:16px}' +
    '.footer{padding:16px 28px;text-align:center;font-size:11px;color:#8E8E93;border-top:1px solid #E5E5EA}</style>';
}

function eRow(label, value, color) {
  return '<div class="row"><span style="font-size:13px;color:#1C1C1E">' + label + '</span>' +
    '<span style="font-size:12px;font-weight:700;color:' + (color || '#007AFF') + '">' + value + '</span></div>';
}

function eCard(title, content) {
  return '<div class="card"><div class="card-ttl">' + title + '</div>' + content + '</div>';
}

function eBtn(text, url) {
  return '<a href="' + url + '" class="btn">' + text + '</a>';
}

function eWrap(body, logoText, subtitle) {
  return emailStyle() + '<div class="wrap">' +
    '<div class="hdr"><div class="hdr-logo">' + (logoText || "Tim's Ops Connect") + '</div>' +
    (subtitle ? '<div class="hdr-sub">' + subtitle + '</div>' : '') + '</div>' +
    '<div class="body">' + body + '</div>' +
    '<div class="footer">Tim Hortons India &middot; OpsAIHub</div></div>';
}

module.exports = { sendEmail, emailStyle, eRow, eCard, eBtn, eWrap };
