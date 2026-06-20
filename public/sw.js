'use strict';

var CACHE_NAME = 'opsaihub-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(e) {
  if (!e.data) return;
  var data = e.data.json();
  var title   = data.title   || 'OpsAIHub';
  var options = {
    body:    data.body    || '',
    icon:    data.icon    || '/icons/icon-192.png',
    badge:   data.badge   || '/icons/icon-72.png',
    tag:     data.tag     || 'opsaihub',
    data:    { url: data.url || '/' },
    actions: data.actions || [],
    vibrate: [150, 50, 150],
    requireInteraction: !!data.requireInteraction
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';

  if (e.action === 'checklist') url = '/tasks.html';
  else if (e.action === 'fdu')   url = '/fdu-dashboard.html';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf(self.location.origin) === 0 && 'focus' in clients[i]) {
          clients[i].navigate(url);
          return clients[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
