// Read-only lab runner. Requires Playwright and a Chromium executable.
// Authentication data stays in a private file outside the repository.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const auth = JSON.parse(fs.readFileSync(process.env.QA_PREVIEW_ACCESS_FILE, 'utf8'))
const out = process.env.QA_OUTPUT_DIR
fs.mkdirSync(out, { recursive: true })
const targets = [
  { build: 'production', origin: 'https://samosell.ge', commit: '32bfc680b0fb0cfb3a54ced025b61d5527d83172' },
  { build: 'preview', origin: 'https://' + auth.previewHost, commit: process.env.QA_PREVIEW_COMMIT ?? 'b70b7a6d98c323f90f5fa0530a608f2173b4b819' },
]
const pages = ['/', '/catalog', '/catalog?q=Zara', '/listing/pekhsatsmeli-9454b0c8']
const configuration = { viewport: { width: 390, height: 844 }, cpu: 4, latencyMs: 150, downloadBytesPerSec: 200000, uploadBytesPerSec: 93750, repeats: 5, labOnly: true }
fs.writeFileSync(path.join(out, 'configuration.json'), JSON.stringify({ configuration, targets, pages }, null, 2))
const browser = await chromium.launch({ executablePath: process.env.QA_CHROMIUM_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined })
const results = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const redactUrl = url => { try { const u = new URL(url); return u.origin + u.pathname } catch { return 'unknown' } }
try {
  for (const route of pages) for (let repeat = 1; repeat <= configuration.repeats; repeat++) {
    // Alternate the host order to reduce time-of-run bias; measurements are serial.
    for (const target of repeat % 2 ? targets : [...targets].reverse()) {
      const context = await browser.newContext({ viewport: configuration.viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36' })
      // Preserve mandatory-only consent across both cache modes; prevent any analytics or user-data writes.
      await context.addCookies([{ name: 'samosell_browser_consent', value: encodeURIComponent(JSON.stringify({ version: 1, personalization: false, analytics: false, marketing: false, updatedAt: Date.now() })), url: target.origin }])
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      // Block known write-only telemetry URLs with CDP, preserving browser HTTP
      // caching. Playwright route interception would disable HTTP caching.
      await cdp.send('Network.setBlockedURLs', { urls: ['*/api/listing-view', '*/api/growth/events', '*/api/web-vitals', '*/api/catalog-events', '*/api/ads/impression', '*/api/ads/click'] })
      if (target.build === 'preview') {
        const response = await page.goto(target.origin + '/?_vercel_share=' + encodeURIComponent(auth.secret), { waitUntil: 'domcontentloaded', timeout: 45000 })
        if (response.status() !== 200 || new URL(page.url()).hostname !== auth.previewHost) throw new Error('preview_authentication_failed')
      }
      await page.goto('about:blank')
      await cdp.send('Network.clearBrowserCache')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: configuration.cpu })
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: configuration.latencyMs, downloadThroughput: configuration.downloadBytesPerSec, uploadThroughput: configuration.uploadBytesPerSec, connectionType: 'cellular4g' })
      await page.addInitScript(() => {
        window.__qa = { lcp: null, lcpElement: null, shifts: [], events: [], lastChange: performance.now(), supported: PerformanceObserver.supportedEntryTypes }
        new PerformanceObserver(list => { for (const e of list.getEntries()) { window.__qa.lcp = e.startTime; window.__qa.lcpElement = e.element ? { tag: e.element.tagName, alt: e.element.getAttribute('alt'), url: e.url ? new URL(e.url).pathname : null } : null; window.__qa.lastChange = performance.now() } }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__qa.shifts.push({ value: e.value, at: e.startTime, nodes: e.sources.map(s => ({ tag: s.node?.tagName, className: String(s.node?.className ?? '').slice(0,180), previous: s.previousRect.toJSON?.() ?? {}, current: s.currentRect.toJSON?.() ?? {} })) }); window.__qa.lastChange = performance.now() } }).observe({ type: 'layout-shift', buffered: true })
        if (PerformanceObserver.supportedEntryTypes.includes('event')) new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) window.__qa.events.push({ name: e.name, duration: e.duration, id: e.interactionId }) }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
      })
      for (const cache of ['cold', 'repeat']) {
        const errors = [], failures = [], statuses = [], downloads = new Map()
        const onError = e => errors.push(String(e.message).slice(0,500))
        const onConsole = msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0,500)) }
        const onFail = req => failures.push({ url: redactUrl(req.url()), method: req.method(), error: req.failure()?.errorText })
        const onResponse = res => { if (res.status() >= 400) statuses.push({ url: redactUrl(res.url()), status: res.status(), method: res.request().method() }) }
        const onFinish = info => downloads.set(info.requestId, info.encodedDataLength)
        page.on('pageerror', onError); page.on('console', onConsole); page.on('requestfailed', onFail); page.on('response', onResponse); cdp.on('Network.loadingFinished', onFinish)
        const started = Date.now()
        let status = null, navigationError = null
        try {
          const response = cache === 'cold' ? await page.goto(target.origin + route, { waitUntil: 'load', timeout: 45000 }) : await page.reload({ waitUntil: 'load', timeout: 45000 })
          status = response?.status()
        } catch (error) { navigationError = String(error.message).split('\n')[0] }
        // At least 8s observation; continue until stable for 3s, capped at 30s after navigation.
        while (Date.now() - started < 30000) {
          const quiet = await page.evaluate(() => performance.now() - (window.__qa?.lastChange ?? 0))
          if (Date.now() - started >= 8000 && quiet >= 3000) break
          await sleep(500)
        }
        const metrics = await page.evaluate(() => {
          const q = window.__qa, nav = performance.getEntriesByType('navigation')[0]
          let max = 0, session = 0, first = 0, last = 0
          for (const shift of q.shifts) { if (shift.at - last > 1000 || shift.at - first > 5000) { session = shift.value; first = shift.at } else session += shift.value; last = shift.at; max = Math.max(max, session) }
          return { lcp_ms: q.lcp, lcpElement: q.lcpElement, cls: max, shifts: q.shifts,
            fcp_ms: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null, ttfb_ms: nav?.responseStart - nav?.startTime,
            documentBytes: nav?.transferSize, resourceBytes: performance.getEntriesByType('resource').reduce((a,r) => a+r.transferSize,0),
            width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
            listingLinks: document.querySelectorAll('a[href^="/listing/"]').length,
            images: [...document.images].map(img => { const r=performance.getEntriesByName(img.currentSrc).at(-1); return { alt: img.alt, url: new URL(img.currentSrc || img.src, location.href).pathname, bytes: r?.transferSize ?? null, decodedBytes: r?.decodedBodySize ?? null, complete: img.complete, naturalWidth: img.naturalWidth, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, loading: img.loading, priority: img.fetchPriority } }),
            heading: document.querySelector('h1')?.textContent?.trim(), degradation: !!document.querySelector('[role="status"]'), observedMs: performance.now(), supportedEvents: q.supported.includes('event') }
        })
        if (repeat === 1 && cache === 'cold') await page.screenshot({ path: path.join(out, `${target.build}-${pages.indexOf(route)}.png`) })
        // Standardized, non-submitting keyboard interactions; this is a synthetic interaction sample, not field INP.
        for (let key = 0; key < 5; key++) { await page.keyboard.press('Tab'); await sleep(100) }
        await sleep(200)
        const interactions = await page.evaluate(() => window.__qa.events)
        const inp = interactions.length ? Math.max(...interactions.map(e => e.duration)) : null
        const result = { build: target.build, commit: target.commit, route, repeat, cache, status, navigationError, at: new Date().toISOString(), ...metrics, synthetic_inp_ms: inp, interactions, transferBytesCDP: [...downloads.values()].reduce((a,b) => a+b,0), errors, failures, statuses }
        results.push(result)
        fs.appendFileSync(path.join(out, 'runs.jsonl'), JSON.stringify(result) + '\n')
        console.log(JSON.stringify({ n: results.length, build: target.build, route, repeat, cache, status, lcp: metrics.lcp_ms, cls: metrics.cls, errors: errors.length, failures: failures.length }))
        page.off('pageerror', onError); page.off('console', onConsole); page.off('requestfailed', onFail); page.off('response', onResponse); cdp.off('Network.loadingFinished', onFinish)
      }
      await context.close()
    }
  }
} finally { await browser.close() }
fs.writeFileSync(path.join(out, 'runs.json'), JSON.stringify(results, null, 2))
