// Vitest setup file
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/dom'

// Cleanup DOM after each test
afterEach(() => {
  cleanup()
})

// Mock Chrome APIs for testing
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    },
    getURL: vi.fn((path) => `chrome-extension://test/${path}`)
  },
  storage: {
    local: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      clear: vi.fn(() => Promise.resolve())
    },
    sync: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve())
    }
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([{ id: 1, url: 'https://example.com' }])),
    sendMessage: vi.fn()
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn()
    }
  },
  commands: {
    onCommand: {
      addListener: vi.fn()
    }
  }
} as any

// Mock DOM APIs
global.navigator = {
  ...global.navigator,
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
} as any

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(() => ({
    result: {
      createObjectStore: vi.fn(),
      objectStore: vi.fn(() => ({
        add: vi.fn(),
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }))
    },
    onsuccess: vi.fn(),
    onerror: vi.fn()
  }))
}

global.indexedDB = mockIndexedDB as any