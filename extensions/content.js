/**
 * content.js — AccessAI Browser Extension Content Script
 * CT-469 Project P15
 *
 * Injected into every page. Tracks real user interaction signals:
 * scroll speed, misclick rate, zoom changes, time on page.
 * Sends signals to background.js for RL state construction.
 */

(function () {
  let pageLoadTime = Date.now();
  let maxScrollDepth = 0;
  let clicks = 0;
  let misclicks = 0;
  let zoomAdjustments = 0;
  let lastDevicePixelRatio = window.devicePixelRatio;
  let scrollSpeeds = [];
  let lastScrollY = window.scrollY;
  let lastScrollTime = Date.now();

  // Track scroll depth and speed
  window.addEventListener("scroll", () => {
    const now = Date.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = (now - lastScrollTime) / 1000;
    if (dt > 0) scrollSpeeds.push(dy / dt);
    lastScrollY = window.scrollY;
    lastScrollTime = now;

    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      maxScrollDepth = Math.max(maxScrollDepth, window.scrollY / docHeight);
    }
  }, { passive: true });

  // Track click accuracy (misclick = click on non-interactive element)
  document.addEventListener("click", (e) => {
    clicks++;
    const tag = e.target.tagName.toLowerCase();
    const interactive = ["a", "button", "input", "select", "textarea", "label"];
    const isInteractive = interactive.includes(tag)
      || e.target.closest("a, button, [role='button'], [onclick]");
    if (!isInteractive) misclicks++;
  });

  // Track zoom changes via devicePixelRatio
  const zoomInterval = setInterval(() => {
    if (window.devicePixelRatio !== lastDevicePixelRatio) {
      zoomAdjustments++;
      lastDevicePixelRatio = window.devicePixelRatio;
    }
  }, 1000);

  // Report state every 10 seconds
  const reportInterval = setInterval(() => {
    const timeOnPage = (Date.now() - pageLoadTime) / 1000;
    const avgScroll = scrollSpeeds.length > 0
      ? scrollSpeeds.reduce((a, b) => a + b, 0) / scrollSpeeds.length
      : 0;

    chrome.runtime.sendMessage({
      type: "USER_STATS",
      payload: {
        time_on_page: timeOnPage,
        scroll_depth: maxScrollDepth,
        scroll_speed_norm: Math.min(avgScroll / 500, 1),
        misclick_rate: clicks > 0 ? misclicks / clicks : 0,
        zoom_adjustments: zoomAdjustments,
        total_clicks: clicks,
        content_type: document.images.length > 5 ? 1.0 : 0.0,
        device_type: window.innerWidth < 768 ? 1.0 : window.innerWidth < 1200 ? 0.5 : 0.0,
      }
    });
  }, 10000);

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    clearInterval(zoomInterval);
    clearInterval(reportInterval);
  });
})();
