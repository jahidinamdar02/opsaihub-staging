'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON } = require('../services/store');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../services/email');
const { AM_EMAILS } = require('../services/constants');
const { validate, schemas } = require('../services/validation');

const feedUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      var dir = path.join(__dirname, '..', 'uploads', 'feed');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,9) + '.jpg'); }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', function(req, res) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    var posts = readJSON('posts.json', []);
    var cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    var filtered = posts.filter(function(p) {
      var ts = p.timestamp || p.createdAt || '';
      return ts > cutoff;
    });
    res.json({ success: true, data: filtered });
  }
  catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', validate(schemas.post), function(req, res) {
  try {
    const posts = readJSON('posts.json', []);
    const newPost = Object.assign({ id: Date.now().toString() }, req.body, { createdAt: new Date().toISOString(), pinned: false, reactions: {}, replies: [] });
    posts.unshift(newPost);
    if (!writeJSON('posts.json', posts)) return res.status(500).json({ success: false, error: 'Save failed' });
    res.json({ success: true, data: newPost });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/react', function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p) { return p.id === req.body.postId; });
    if (post) {
      if (!post.reactions) post.reactions = {};
      post.reactions[req.body.emoji] = req.body.count;
      writeJSON('posts.json', posts);
    }
    res.json({ success: true });
  } catch(err) { res.json({ success: false }); }
});

router.post('/comment', validate(schemas.comment), function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p) { return p.id === req.body.postId; });
    if (post) {
      if (!post.comments) post.comments = [];
      post.comments.push(req.body.comment);
      writeJSON('posts.json', posts);
    }
    res.json({ success: true });
  } catch(err) { res.json({ success: false }); }
});

router.post('/upload', feedUpload.single('photo'), async function(req, res) {
  try {
    if (!req.file) return res.json({ success: false });
    var filePath = req.file.path;
    try {
      var sharp = require('sharp');
      var resized = await sharp(filePath)
        .resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75, progressive: true })
        .toBuffer();
      fs.writeFileSync(filePath, resized);
    } catch(e) {}
    res.json({ success: true, url: '/uploads/feed/' + req.file.filename });
  } catch(err) { res.json({ success: false }); }
});

router.post('/edit', validate(schemas.postEdit), function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p) { return p.id === req.body.postId; });
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    post.caption = req.body.caption;
    post.editedAt = new Date().toISOString();
    writeJSON('posts.json', posts);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/comment/edit', validate(schemas.commentEdit), function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p) { return p.id === req.body.postId; });
    if (!post || !post.comments) return res.status(404).json({ success: false, error: 'Not found' });
    var idx = parseInt(req.body.commentIdx);
    if (isNaN(idx) || !post.comments[idx]) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (req.body.action === 'delete') {
      post.comments.splice(idx, 1);
    } else {
      post.comments[idx].text = req.body.text;
      post.comments[idx].edited = true;
    }
    writeJSON('posts.json', posts);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

function jahidAutoComment(post) {
  try {
    if (post.isAutoPost || post.author === 'Jahid') return;
    var caption = (post.caption || '').toLowerCase();
    var category = (post.category || '').toLowerCase();
    var author = post.author || 'team';
    var pools = {
      recognition: [
        '🏆 This is what excellence looks like! So proud of you, ' + author + ' — keep setting the bar! 🔥',
        '👏 Absolutely love seeing this! ' + author + ', you\'re an inspiration to the whole network. Keep it up! ⭐',
        '🥇 Recognition well deserved! This is exactly the culture we\'re building — thank you, ' + author + '! 💪',
        '🎊 So proud of this! ' + author + ', the team is lucky to have you. Keep shining! ✨',
      ],
      celebration: [
        '🎉 Love this energy! Celebrations like this is what keeps us going as a team! Great work, ' + author + '! ☕🙌',
        '🥳 Yes yes yes!! This is the Tim Hortons spirit right here! Amazing, ' + author + '! 🔥',
        '🎊 Big moments deserve big celebrations — so happy for you, ' + author + '! Keep this energy flowing! 💫',
        '🙌 Love it!! This is exactly what Tim\'s culture looks like. Celebrate this one, ' + author + '! 🎉',
      ],
      bestpractice: [
        '💡 Brilliant share, ' + author + '! This is gold for the whole network — tagging everyone to learn from this! 📌',
        '🤩 Now THIS is how we raise the bar! Amazing practice, ' + author + '. Let\'s make this standard across all stores! 💪',
        '👏 Love when we share knowledge like this! ' + author + ', you\'re making the whole team smarter. Thank you! 🌟',
        '📌 Pinning this in my mind! Excellent insight, ' + author + '. The network needs more of this! 🙌',
      ],
      coffee: [
        '☕ Nothing beats a great coffee moment! Looks amazing, ' + author + '! This is why we do what we do 😍',
        '😍 That looks incredible! ' + author + ', Tim\'s at its best right there! ☕🔥',
        '🫶 Pure joy in a cup! Love seeing the passion, ' + author + '! This is what Tim\'s India is all about ☕',
        '☕ This made my day! The love for the craft is real — keep it up, ' + author + '! 🌟',
      ],
      teamwin: [
        '💪 TEAM WIN!! This is what we grind for!! Huge shoutout to everyone involved — incredible, ' + author + '! 🏆🔥',
        '🙌 Team wins are the BEST wins! So proud of this, ' + author + '. You all smashed it! 💥',
        '🎯 This is the standard! When the team wins, everyone wins. Amazing work, ' + author + ' and the whole crew! 🥇',
        '🔥 Love this!! Nothing fires me up more than a team win! Outstanding, ' + author + '! Keep pushing! 💪',
      ],
      other: [
        '❤️ Love seeing activity on the feed! Keep sharing, ' + author + ' — this is how we stay connected as a team! 🙌',
        '🤩 Great share, ' + author + '! This is what our community feed is all about! Keep it coming! ☕',
        '💬 Love this! ' + author + ', you\'re keeping the team vibe alive — appreciate you! 🙏✨',
        '👀 Noticed this immediately! Great stuff, ' + author + '. The feed comes alive when you share like this! 🔥',
      ]
    };
    var comment;
    if (/checklist|audit|compli/i.test(caption)) {
      var checklistReplies = [
        '✅ Checklist done right — ' + author + ', this is how standards are upheld! Proud of this! 🙌',
        '📋 ' + author + ', the attention to detail here is next level! This is what audit-ready looks like! 💪',
        '✅ Consistency is the key — and ' + author + ' has it locked in! Great work! 🏆',
      ];
      comment = checklistReplies[Math.floor(Math.random() * checklistReplies.length)];
    } else if (/store|clean|display|merchandis/i.test(caption)) {
      var storeReplies = [
        '🏪 Store standards on point! ' + author + ', this is exactly what our guests deserve to walk into! 🔥',
        '✨ That store looks immaculate! ' + author + ', world-class execution — this is what pride looks like! 👏',
        '🙌 This is the Tim Hortons standard! ' + author + ', every store in the network should look like this! 💫',
      ];
      comment = storeReplies[Math.floor(Math.random() * storeReplies.length)];
    } else if (/sales|target|number|revenue|growth/i.test(caption)) {
      var salesReplies = [
        '📈 Numbers don\'t lie — and this one tells a great story! Brilliant, ' + author + '! 🏆',
        '🚀 When the work is right, the results follow! Amazing performance, ' + author + '! Keep pushing! 💥',
        '🎯 Targets hit! This is what consistency looks like — so proud of this, ' + author + '! 🔥',
      ];
      comment = salesReplies[Math.floor(Math.random() * salesReplies.length)];
    } else if (/team|staff|crew|people/i.test(caption)) {
      var teamReplies = [
        '🫶 People-first culture — this is what it looks like in action! Love this, ' + author + '! 🙌',
        '❤️ The team is everything! ' + author + ', you\'re building something special here. Keep nurturing it! 💪',
        '👨‍👩‍👧‍👦 This is the Tim\'s family right here! Love seeing the team spirit, ' + author + '! 🏆',
      ];
      comment = teamReplies[Math.floor(Math.random() * teamReplies.length)];
    } else {
      var pool = pools[category] || pools.other;
      comment = pool[Math.floor(Math.random() * pool.length)];
    }
    var posts = readJSON('posts.json', []);
    var idx = posts.findIndex(function(p) { return p.id === post.id; });
    if (idx === -1) return;
    if (!posts[idx].comments) posts[idx].comments = [];
    posts[idx].comments.push({ author: 'Jahid', text: comment, time: 'Just now' });
    writeJSON('posts.json', posts);
  } catch (e) { console.error('jahidAutoComment error:', e.message); }
}

router.post('/delete', function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var idx = posts.findIndex(function(p) { return p.id === req.body.postId; });
    if (idx === -1) return res.status(404).json({ success: false, error: 'Post not found' });
    posts.splice(idx, 1);
    writeJSON('posts.json', posts);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.put('/:id', function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var post = posts.find(function(p) { return p.id === req.params.id; });
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });
    if (req.body.caption !== undefined) post.caption = req.body.caption;
    if (req.body.category !== undefined) post.category = req.body.category;
    post.editedAt = new Date().toISOString();
    writeJSON('posts.json', posts);
    res.json({ success: true, data: post });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:id', function(req, res) {
  try {
    var posts = readJSON('posts.json', []);
    var idx = posts.findIndex(function(p) { return p.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ success: false, error: 'Post not found' });
    posts.splice(idx, 1);
    writeJSON('posts.json', posts);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
