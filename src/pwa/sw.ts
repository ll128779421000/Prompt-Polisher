// Service Worker for Prompt Polisher PWA
const CACHE_NAME = 'prompt-polisher-v1'
const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

// Install event - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_RESOURCES))
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  // Handle share target
  if (event.request.url.includes('/share-target') && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request))
    return
  }

  // Regular cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response
        }
        
        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.status === 200) {
              const responseToCache = response.clone()
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache))
            }
            return response
          })
      })
      .catch(() => {
        // Fallback for offline
        if (event.request.destination === 'document') {
          return caches.match('/')
        }
      })
  )
})

// Handle share target requests
async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const formData = await request.formData()
    const title = formData.get('title') || ''
    const text = formData.get('text') || ''
    const url = formData.get('url') || ''
    
    // Combine shared content
    const sharedContent = [title, text, url]
      .filter(Boolean)
      .join(' ')
      .trim()
    
    // Redirect to main app with shared content
    const targetURL = new URL('/', self.location.origin)
    if (sharedContent) {
      targetURL.searchParams.set('text', sharedContent)
    }
    
    return Response.redirect(targetURL.toString(), 302)
  } catch (error) {
    console.error('Share target error:', error)
    return Response.redirect('/', 302)
  }
}

// Background sync for saving prompts when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'save-prompt') {
    event.waitUntil(syncSavedPrompts())
  }
})

async function syncSavedPrompts() {
  // Implementation would sync local prompts with cloud storage
  // For now, this is a placeholder for future functionality
  console.log('Syncing saved prompts...')
}