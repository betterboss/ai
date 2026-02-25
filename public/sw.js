// Better Boss Service Worker — offline voice recording + caching

const CACHE_NAME = 'better-boss-v1';
const STATIC_ASSETS = [
  '/',
  '/voice',
  '/agent',
  '/sequences',
  '/leads',
  '/dashboard',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some routes may not be pre-cacheable, that's OK
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API routes — network only
  if (url.pathname.startsWith('/api/')) return;

  // For page navigations and static assets — network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle offline voice recording sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'voice-upload') {
    event.waitUntil(syncVoiceRecordings());
  }
});

async function syncVoiceRecordings() {
  try {
    // Open IndexedDB to get pending recordings
    const db = await openDB();
    const tx = db.transaction('pending-voice', 'readonly');
    const store = tx.objectStore('pending-voice');
    const recordings = await getAllFromStore(store);

    for (const recording of recordings) {
      try {
        const formData = new FormData();
        formData.append('audio', recording.blob, 'recording.webm');
        formData.append('userId', recording.userId);
        if (recording.grantKey) formData.append('grantKey', recording.grantKey);

        const response = await fetch('/api/voice/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          // Remove from pending
          const deleteTx = db.transaction('pending-voice', 'readwrite');
          deleteTx.objectStore('pending-voice').delete(recording.id);
        }
      } catch {
        // Will retry on next sync
      }
    }
  } catch {
    // IndexedDB not available
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('better-boss-offline', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-voice')) {
        db.createObjectStore('pending-voice', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
