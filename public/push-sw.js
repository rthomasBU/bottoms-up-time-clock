// push-sw.js
// Handles Web Push 'push' and 'notificationclick' events. Loaded via
// importScripts() from the generated Workbox service worker (see
// vite.config.ts -> workbox.importScripts), so push handling stays
// completely separate from precaching/routing - this file is a static
// asset copied as-is to the site root, never touched by Vite/Workbox
// itself.

self.addEventListener('push', (event) => {
  let data = { title: 'Bottoms Up Time Clock', body: '' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'bottoms-up-notification',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    }),
  );
});
