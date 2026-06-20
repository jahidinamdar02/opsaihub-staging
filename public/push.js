'use strict';

var VAPID_PUBLIC_KEY = 'BPKrexwotzCK7UAh-yLPLGpnk-urQyURMV6a-Rzhm_fHiyiadOIsnMSwnF0s3QIjDvQAY64nNHzikqtCPIySPlk';

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw     = window.atob(base64);
  var arr     = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function getPushState() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return 'default';
}

// Register SW and subscribe — saves subscription to server with AM name
async function enablePush(amName) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  var perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };

  var reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // Check if already subscribed
  var existing = await reg.pushManager.getSubscription();
  if (existing) {
    await saveSubscription(existing, amName);
    return { ok: true, existing: true };
  }

  var sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  await saveSubscription(sub, amName);
  return { ok: true, existing: false };
}

async function saveSubscription(sub, amName) {
  var payload = Object.assign({ am: amName || '' }, sub.toJSON());
  await fetch('/api/push/subscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
}

async function disablePush() {
  if (!isPushSupported()) return;
  var reg = await navigator.serviceWorker.ready;
  var sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  var am = localStorage.getItem('th_am_name') || '';
  await fetch('/api/push/unsubscribe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ am: am })
  });
}

// Auto-subscribe if permission already granted (returning user)
async function autoSubscribeIfGranted() {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;
  var am = localStorage.getItem('th_am_name') || '';
  if (!am || am === 'Jahid') return;
  try { await enablePush(am); } catch(e) {}
}

window.OpsHubPush = { enablePush, disablePush, getPushState, isPushSupported, autoSubscribeIfGranted };
