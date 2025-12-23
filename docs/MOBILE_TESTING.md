# Mobile Testing Guidelines

## Overview

This guide provides comprehensive testing strategies for the J_kube Rummikub application's mobile interface, covering touch interactions, responsive design, and cross-device compatibility.

## Testing Strategy

### 1. Device Testing Matrix

#### Primary Test Devices

| Device Category | Screen Size | Resolution | Test Priority |
|----------------|-------------|------------|---------------|
| **iPhone SE** | 4.7" | 375×667 | High |
| **iPhone 12/13** | 6.1" | 390×844 | High |
| **iPhone 12/13 Pro Max** | 6.7" | 428×926 | Medium |
| **Samsung Galaxy S21** | 6.2" | 384×854 | High |
| **iPad** | 10.9" | 820×1180 | Medium |
| **Android Tablet** | 10.1" | 800×1280 | Medium |

#### Browser Testing Matrix

| Browser | iOS | Android | Priority |
|---------|-----|---------|----------|
| **Safari** | ✅ | ❌ | High |
| **Chrome** | ✅ | ✅ | High |
| **Firefox** | ✅ | ✅ | Medium |
| **Samsung Internet** | ❌ | ✅ | Medium |
| **Edge** | ✅ | ✅ | Low |

### 2. Responsive Design Testing

#### Breakpoint Testing

Test at these specific viewport widths:

```css
/* Mobile Portrait */
320px - 480px

/* Mobile Landscape */
481px - 768px

/* Tablet Portrait */
769px - 1024px

/* Desktop */
1025px+
```

#### Testing Checklist

**Layout Responsiveness**:
- [ ] Game board scales appropriately
- [ ] Player hand tiles remain readable
- [ ] UI controls are touch-friendly (minimum 44px)
- [ ] Text remains legible at all sizes
- [ ] No horizontal scrolling required
- [ ] Proper spacing between interactive elements

**Navigation**:
- [ ] Menu accessible on mobile
- [ ] Game controls easily reachable
- [ ] Back/forward navigation works
- [ ] Modal dialogs fit screen properly

### 3. Touch Interaction Testing

#### Core Touch Gestures

**Tile Selection**:
```javascript
// Test: Single tap to select/deselect tiles
describe('Tile Selection', () => {
  test('Single tap selects tile', async () => {
    const tile = await page.$('.tile');
    await tile.tap();
    expect(await tile.evaluate(el => el.classList.contains('selected'))).toBe(true);
  });
  
  test('Double tap deselects tile', async () => {
    const tile = await page.$('.tile.selected');
    await tile.tap();
    await tile.tap();
    expect(await tile.evaluate(el => el.classList.contains('selected'))).toBe(false);
  });
});
```

**Drag and Drop**:
```javascript
// Test: Touch drag for tile movement
describe('Drag and Drop', () => {
  test('Touch drag moves tile to board', async () => {
    const tile = await page.$('.player-hand .tile');
    const board = await page.$('.game-board');
    
    // Get positions
    const tileBox = await tile.boundingBox();
    const boardBox = await board.boundingBox();
    
    // Perform drag
    await page.touchscreen.tap(tileBox.x + tileBox.width/2, tileBox.y + tileBox.height/2);
    await page.touchscreen.tap(boardBox.x + 100, boardBox.y + 100);
    
    // Verify tile moved
    const boardTiles = await page.$$('.game-board .tile');
    expect(boardTiles.length).toBeGreaterThan(0);
  });
});
```

**Gesture Recognition**:
- [ ] Tap (< 200ms, < 10px movement)
- [ ] Long press (> 500ms)
- [ ] Drag (> 20px movement)
- [ ] Pinch-to-zoom (if implemented)
- [ ] Swipe gestures (if implemented)

#### Touch Event Testing

**Event Sequence Validation**:
```javascript
// Test proper touch event sequence
const touchEvents = [];

element.addEventListener('touchstart', (e) => {
  touchEvents.push({
    type: 'touchstart',
    timestamp: Date.now(),
    touches: e.touches.length
  });
});

element.addEventListener('touchmove', (e) => {
  touchEvents.push({
    type: 'touchmove',
    timestamp: Date.now(),
    touches: e.touches.length
  });
});

element.addEventListener('touchend', (e) => {
  touchEvents.push({
    type: 'touchend',
    timestamp: Date.now(),
    touches: e.touches.length
  });
});
```

### 4. Performance Testing

#### Mobile Performance Metrics

**Target Performance**:
- First Contentful Paint: < 2s
- Largest Contentful Paint: < 3s
- Touch response time: < 100ms
- Animation frame rate: 60fps
- Memory usage: < 50MB

**Testing Tools**:
```bash
# Lighthouse mobile audit
npx lighthouse --preset=mobile --output=html --output-path=mobile-audit.html http://localhost:8000

# Chrome DevTools mobile simulation
# 1. Open DevTools
# 2. Click device toolbar icon
# 3. Select device or custom dimensions
# 4. Test with network throttling
```

#### Performance Test Script

```javascript
// performance-test.js
const puppeteer = require('puppeteer');

async function testMobilePerformance() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Simulate mobile device
  await page.emulate(puppeteer.devices['iPhone 12']);
  
  // Enable network throttling
  const client = await page.target().createCDPSession();
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
    uploadThroughput: 750 * 1024 / 8, // 750 Kbps
    latency: 40 // 40ms
  });
  
  // Measure performance
  await page.goto('http://localhost:8000');
  
  const metrics = await page.metrics();
  console.log('Performance Metrics:', metrics);
  
  await browser.close();
}
```

### 5. Cross-Device Compatibility

#### iOS Testing

**Safari-Specific Issues**:
- [ ] Touch events work properly
- [ ] Viewport meta tag respected
- [ ] CSS transforms work correctly
- [ ] Audio/vibration feedback (if used)
- [ ] Home screen app behavior

**iOS Testing Script**:
```javascript
// ios-compatibility.test.js
describe('iOS Compatibility', () => {
  beforeEach(async () => {
    await page.emulate(puppeteer.devices['iPhone 12']);
  });
  
  test('Viewport scales correctly', async () => {
    const viewport = await page.viewport();
    expect(viewport.width).toBe(390);
    expect(viewport.height).toBe(844);
  });
  
  test('Touch events register', async () => {
    const tile = await page.$('.tile');
    await tile.tap();
    // Verify touch was registered
  });
});
```

#### Android Testing

**Chrome Mobile Issues**:
- [ ] Touch delay (300ms) eliminated
- [ ] Zoom disabled where appropriate
- [ ] Hardware acceleration working
- [ ] Back button behavior

**Android Testing Script**:
```javascript
// android-compatibility.test.js
describe('Android Compatibility', () => {
  beforeEach(async () => {
    await page.emulate(puppeteer.devices['Pixel 5']);
  });
  
  test('No 300ms touch delay', async () => {
    const startTime = Date.now();
    const tile = await page.$('.tile');
    await tile.tap();
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(150);
  });
});
```

### 6. Automated Mobile Testing

#### Cypress Mobile Tests

```javascript
// cypress/e2e/mobile/mobile-gameplay.cy.js
describe('Mobile Gameplay', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.visit('/');
  });
  
  it('should handle touch tile selection', () => {
    cy.get('.tile').first().click();
    cy.get('.tile.selected').should('exist');
  });
  
  it('should support drag and drop on mobile', () => {
    cy.get('.player-hand .tile').first()
      .trigger('touchstart', { which: 1 })
      .trigger('touchmove', { clientX: 300, clientY: 200 })
      .trigger('touchend');
    
    cy.get('.game-board .tile').should('exist');
  });
  
  it('should display mobile-optimized layout', () => {
    cy.get('.game-container').should('have.class', 'mobile-layout');
    cy.get('.tile').should('have.css', 'font-size', '14px');
  });
});
```

#### Playwright Mobile Tests

```javascript
// tests/mobile-e2e.spec.js
const { test, devices } = require('@playwright/test');

test.describe('Mobile End-to-End Tests', () => {
  test('iPhone gameplay flow', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    
    const page = await context.newPage();
    await page.goto('/');
    
    // Test mobile-specific interactions
    await page.locator('.tile').first().tap();
    await expect(page.locator('.tile.selected')).toBeVisible();
  });
  
  test('Android tablet layout', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Galaxy Tab S4'],
    });
    
    const page = await context.newPage();
    await page.goto('/');
    
    // Test tablet-specific layout
    await expect(page.locator('.game-board')).toHaveCSS('grid-template-columns', 'repeat(auto-fit, minmax(60px, 1fr))');
  });
});
```

### 7. Manual Testing Procedures

#### Pre-Testing Setup

1. **Device Preparation**:
   ```bash
   # Clear browser cache
   # Disable browser extensions
   # Ensure stable network connection
   # Close other apps to free memory
   ```

2. **Test Environment**:
   ```bash
   # Local development server
   npm start
   
   # Or test production build
   npm run build
   npm run serve
   ```

#### Manual Test Scenarios

**Scenario 1: New Player Mobile Onboarding**
1. Open game on mobile device
2. Create account with touch keyboard
3. Join or create first game
4. Complete tutorial interactions
5. Verify all UI elements accessible

**Scenario 2: Gameplay Session**
1. Join game with multiple players
2. Play full game using only touch
3. Test all tile interactions
4. Verify game state persistence
5. Test connection recovery

**Scenario 3: Orientation Changes**
1. Start game in portrait mode
2. Rotate to landscape during gameplay
3. Verify layout adapts properly
4. Continue gameplay in landscape
5. Rotate back to portrait

#### Testing Checklist

**Visual Testing**:
- [ ] All text readable without zooming
- [ ] Buttons large enough for touch (44px minimum)
- [ ] Proper contrast ratios
- [ ] No overlapping elements
- [ ] Consistent spacing and alignment

**Interaction Testing**:
- [ ] All buttons respond to touch
- [ ] Drag and drop works smoothly
- [ ] No accidental selections
- [ ] Proper feedback for user actions
- [ ] Error states clearly communicated

**Performance Testing**:
- [ ] Smooth animations (60fps)
- [ ] Quick response to touch (< 100ms)
- [ ] No memory leaks during long sessions
- [ ] Efficient battery usage

### 8. Debugging Mobile Issues

#### Remote Debugging

**iOS Safari**:
1. Enable Web Inspector on iOS device
2. Connect device to Mac via USB
3. Open Safari → Develop → [Device] → [Page]
4. Use desktop DevTools for mobile debugging

**Android Chrome**:
1. Enable USB Debugging on Android
2. Connect device via USB
3. Open Chrome → chrome://inspect
4. Click "Inspect" on target page

#### Common Mobile Issues

**Touch Events Not Working**:
```javascript
// Debug touch event registration
element.addEventListener('touchstart', (e) => {
  console.log('Touch start:', e.touches.length);
  e.preventDefault(); // Prevent mouse events
});
```

**Layout Issues**:
```css
/* Debug responsive layout */
* {
  outline: 1px solid red;
}

/* Check viewport settings */
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
```

**Performance Issues**:
```javascript
// Monitor performance
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log('Performance:', entry.name, entry.duration);
  });
});
observer.observe({ entryTypes: ['measure', 'navigation'] });
```

### 9. Continuous Mobile Testing

#### CI/CD Integration

```yaml
# .github/workflows/mobile-tests.yml
name: Mobile Tests
on: [push, pull_request]

jobs:
  mobile-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run mobile tests
        run: npm run test:mobile
      
      - name: Mobile Lighthouse audit
        run: |
          npm start &
          sleep 10
          npx lighthouse --preset=mobile --output=json --output-path=mobile-audit.json http://localhost:8000
      
      - name: Upload mobile test results
        uses: actions/upload-artifact@v2
        with:
          name: mobile-test-results
          path: mobile-audit.json
```

#### Automated Mobile Testing Schedule

```bash
# Daily mobile compatibility tests
0 2 * * * npm run test:mobile:full

# Weekly performance audits
0 3 * * 0 npm run audit:mobile:performance

# Monthly cross-device testing
0 4 1 * * npm run test:mobile:devices
```

## Quick Reference

### Essential Mobile Testing Commands

```bash
# Run mobile-specific tests
npm run test:mobile

# Mobile performance audit
npm run audit:mobile

# Cross-device compatibility test
npm run test:devices

# Mobile accessibility test
npm run test:a11y:mobile
```

### Mobile Testing Checklist

- [ ] Responsive design at all breakpoints
- [ ] Touch interactions work properly
- [ ] Performance meets mobile targets
- [ ] Cross-browser compatibility verified
- [ ] Accessibility standards met
- [ ] Network resilience tested
- [ ] Battery usage optimized
- [ ] Memory usage within limits