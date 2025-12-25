// Jest setup file for mobile UI tests

// Mock TextEncoder/TextDecoder for JSDOM compatibility
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock window.orientation
Object.defineProperty(window, 'orientation', {
  writable: true,
  value: 0
});

// Mock screen.orientation
Object.defineProperty(window.screen, 'orientation', {
  writable: true,
  value: {
    angle: 0,
    lock: jest.fn().mockResolvedValue(),
    unlock: jest.fn().mockResolvedValue()
  }
});

// Mock CSS.supports
global.CSS = {
  supports: jest.fn().mockReturnValue(true)
};

// Mock navigator properties
Object.defineProperty(navigator, 'maxTouchPoints', {
  writable: true,
  value: 1
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn(id => clearTimeout(id));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock performance.now for consistent timing
global.performance = {
  now: jest.fn(() => Date.now())
};