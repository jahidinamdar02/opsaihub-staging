'use strict';
const express = require('express');
const router = express.Router();
const { readJSON, writeJSON } = require('../services/store');

var newsCache = { data: null, ts: 0 };
router.get('/india', function(req, res) {
  var now = Date.now();
  if (newsCache.data && (now - newsCache.ts) < 5 * 60 * 1000) {
    return res.json({ success: true, data: newsCache.data, cached: true });
  }
  var https = require('https');
  var cities = [
    { name: 'Delhi', q: 'Delhi+business+economy+retail' },
    { name: 'Mumbai', q: 'Mumbai+business+economy+retail' },
    { name: 'Chandigarh', q: 'Chandigarh+Punjab+business+economy' },
    { name: 'Pune', q: 'Pune+business+economy+retail' },
    { name: 'Ahmedabad', q: 'Ahmedabad+Gujarat+business+economy' },
    { name: 'Bengaluru', q: 'Bengaluru+business+economy+retail' },
    { name: 'Hyderabad', q: 'Hyderabad+business+economy+retail' },
    { name: 'MPEH', q: 'Mumbai+Pune+Expressway+highway+business' },
    { name: 'Delhi Airport', q: 'Delhi+IGI+airport+business+travel+footfall' },
    { name: 'Bengaluru Airport', q: 'Bengaluru+BIAL+airport+business+travel' },
    { name: 'Hyderabad Airport', q: 'Hyderabad+RGIA+airport+business+travel' },
    { name: 'Ahmedabad Airport', q: 'Ahmedabad+airport+business+travel' }
  ];
  var results = [];
  var done = 0;
  cities.forEach(function(city) {
    var opts = { hostname: 'news.google.com', path: '/rss/search?q=' + city.q + '&hl=en-IN&gl=IN&ceid=IN:en', method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } };
    var req2 = https.request(opts, function(r) {
      var d = '';
      r.on('data', function(c) { d += c; });
      r.on('end', function() {
        try {
          var items = []; var sp = 0;
          while (true) { var s = d.indexOf('<item>', sp), e = d.indexOf('</item>', sp); if (s < 0 || e < 0) break; items.push(d.substring(s, e + 7)); sp = e + 7; }
          items.slice(0, 2).forEach(function(item) {
            var title = [null, '']; var tc1 = item.indexOf('<title>'), tc2 = item.indexOf('</title>'); if (tc1 > -1 && tc2 > -1) { var tr = item.substring(tc1 + 7, tc2); if (tr.indexOf('CDATA') > -1) { tr = tr.replace('<![CDATA[', '').replace(']]>', ''); } title = [null, tr.trim()]; }
            var link = [null, '']; var lc1 = item.indexOf('<link>'), lc2 = item.indexOf('</link>'); if (lc1 > -1 && lc2 > -1) { link = [null, item.substring(lc1 + 6, lc2).trim()]; }
            var pubDate = [null, '']; var pc1 = item.indexOf('<pubDate>'), pc2 = item.indexOf('</pubDate>'); if (pc1 > -1 && pc2 > -1) { pubDate = [null, item.substring(pc1 + 9, pc2).trim()]; }
            var source = [null, '']; var sc1 = item.indexOf('>', item.indexOf('<source')), sc2 = item.indexOf('</source>'); if (sc1 > -1 && sc2 > -1) { source = [null, item.substring(sc1 + 1, sc2).trim()]; }
            if (title[1] && title[1].length > 10) {
              results.push({ city: city.name, title: title[1].replace(/ - .*$/, '').trim(), source: source[1] || 'Google News', pubDate: pubDate[1] || '', link: link[1] || '' });
            }
          });
        } catch(e) {}
        done++;
        if (done === cities.length) { newsCache = { data: results, ts: Date.now() }; res.json({ success: true, data: results, cached: false }); }
      });
    });
    req2.on('error', function() { done++; if (done === cities.length) res.json({ success: true, data: results, cached: false }); });
    req2.end();
  });
});

var worldCache = { data: null, ts: 0 };
router.get('/world', function(req, res) {
  var now = Date.now();
  if (worldCache.data && (now - worldCache.ts) < 5 * 60 * 1000) {
    return res.json({ success: true, data: worldCache.data, cached: true });
  }
  var https = require('https');
  var topics = [
    { name: 'India Economy', q: 'India+GDP+economy+growth+RBI', color: '#FF9500' },
    { name: 'Consumer Spending', q: 'India+consumer+spending+retail+QSR+food', color: '#34C759' },
    { name: 'Oil & Fuel', q: 'crude+oil+petrol+diesel+India+price', color: '#FF3B30' },
    { name: 'Rupee & Markets', q: 'rupee+dollar+Sensex+Nifty+India+markets', color: '#007AFF' },
    { name: 'Food & Hospitality', q: 'India+food+restaurant+hospitality+industry', color: '#FF6B35' },
    { name: 'Airport & Travel', q: 'India+airport+aviation+travel+passenger+footfall', color: '#AF52DE' }
  ];
  var results = [];
  var done = 0;
  topics.forEach(function(topic) {
    var opts = { hostname: 'news.google.com', path: '/rss/search?q=' + topic.q + '&hl=en-IN&gl=IN&ceid=IN:en', method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } };
    var req2 = https.request(opts, function(r) {
      var d = '';
      r.on('data', function(c) { d += c; });
      r.on('end', function() {
        try {
          var items = []; var sp = 0;
          while (true) { var s = d.indexOf('<item>', sp), e = d.indexOf('</item>', sp); if (s < 0 || e < 0) break; items.push(d.substring(s, e + 7)); sp = e + 7; }
          items.slice(0, 2).forEach(function(item) {
            var title = [null, '']; var tc1 = item.indexOf('<title>'), tc2 = item.indexOf('</title>'); if (tc1 > -1 && tc2 > -1) { var tr = item.substring(tc1 + 7, tc2); if (tr.indexOf('CDATA') > -1) { tr = tr.replace('<![CDATA[', '').replace(']]>', ''); } title = [null, tr.trim()]; }
            var link = [null, '']; var lc1 = item.indexOf('<link>'), lc2 = item.indexOf('</link>'); if (lc1 > -1 && lc2 > -1) { link = [null, item.substring(lc1 + 6, lc2).trim()]; }
            var pubDate = [null, '']; var pc1 = item.indexOf('<pubDate>'), pc2 = item.indexOf('</pubDate>'); if (pc1 > -1 && pc2 > -1) { pubDate = [null, item.substring(pc1 + 9, pc2).trim()]; }
            var source = [null, '']; var sc1 = item.indexOf('>', item.indexOf('<source')), sc2 = item.indexOf('</source>'); if (sc1 > -1 && sc2 > -1) { source = [null, item.substring(sc1 + 1, sc2).trim()]; }
            if (title[1] && title[1].length > 10) {
              results.push({ topic: topic.name, color: topic.color, title: title[1].split(' - ')[0].trim(), source: source[1] || 'Google News', pubDate: pubDate[1] || '', link: link[1] || '' });
            }
          });
        } catch(e) {}
        done++;
        if (done === topics.length) { worldCache = { data: results, ts: Date.now() }; res.json({ success: true, data: results }); }
      });
    });
    req2.on('error', function() { done++; if (done === topics.length) res.json({ success: true, data: results }); });
    req2.end();
  });
});

module.exports = router;
