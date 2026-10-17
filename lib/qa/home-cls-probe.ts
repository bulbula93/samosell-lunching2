// Fixed overlay and bounded, in-memory measurements only. No requests, storage,
// account data or DOM text are captured. Enabled on the read-only Preview only.
export const homeClsProbe = String.raw`(() => {
  if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return;
  const entries = [], geometry = [];
  let max = 0, score = 0, first = 0, last = 0;
  const observer = new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      if (e.startTime - last > 1000 || e.startTime - first > 5000) { score = 0; first = e.startTime; }
      last = e.startTime; score += e.value; max = Math.max(max, score);
      entries.push({time: e.startTime, value: e.value, sources: (e.sources || []).map(s => ({
        tag: s.node?.tagName, class: typeof s.node?.className === 'string' ? s.node.className.slice(0,160) : '',
        previous: s.previousRect.toJSON(), current: s.currentRect.toJSON()
      }))});
    }
  });
  observer.observe({type:'layout-shift', buffered:true});
  const started = performance.now();
  const timer = setInterval(() => {
    let output = document.getElementById('cls-audit-result');
    if (!output) {
      output = document.createElement('output'); output.id = 'cls-audit-result';
      output.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;background:#fff;color:#111;font:11px monospace;max-width:100%;padding:4px;pointer-events:none';
      document.body.append(output);
    }
    const slot = document.querySelector('[data-home-stories-slot]');
    if (slot && geometry.length < 100) geometry.push({time:performance.now(),height:slot.getBoundingClientRect().height,railHeight:slot.firstElementChild?.getBoundingClientRect().height || 0});
    const done = performance.now() - started >= 20000;
    const result = {status:done?'complete':'measuring',viewport:[innerWidth,innerHeight],cls:max,entries,geometry};
    output.textContent = result.status + ' CLS ' + max.toFixed(5) + ' · ' + innerWidth + 'x' + innerHeight;
    output.setAttribute('data-result', JSON.stringify(result));
    if (done) { clearInterval(timer); observer.disconnect(); }
  },250);
})();`
