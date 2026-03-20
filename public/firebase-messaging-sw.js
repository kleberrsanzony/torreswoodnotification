// public/firebase-messaging-sw.js

// Import Firebase compat modules
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// Helper to get query parameters passed during registration
const params = new URL(location).searchParams;

const firebaseConfig = {
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
};

// Initialize the Firebase app in the service worker
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification?.title || 'Torres Madeira Notifica';
    const notificationOptions = {
      body: payload.notification?.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: payload.data,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Service worker install event
self.addEventListener('install', (event) => {
  console.log('Firebase Service Worker installing...');
  self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', (event) => {
  console.log('Firebase Service Worker activating...');
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Open the main app route when clicking the notification
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/estoque') && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new tab
      if (clients.openWindow) {
        return clients.openWindow('/estoque');
      }
    })
  );
});
