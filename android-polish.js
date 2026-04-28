/* Stillness Android + mobile runtime polish.
   Additive only: no app data migration, no existing IDs renamed. */
(function () {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setViewportHeight() {
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight || 0;
    if (h > 0) root.style.setProperty('--screen-vh', (h * 0.01) + 'px');
  }

  function setPlatformFlags() {
    root.classList.toggle('is-android', isAndroid);
    root.classList.toggle('is-installed', isStandalone);
    root.classList.toggle('is-touch', matchMedia('(pointer: coarse)').matches);
  }

  function syncOverlayState() {
    const anyOpen = !!d.querySelector('.overlay.open, [role="dialog"].open');
    d.body.classList.toggle('has-overlay-open', anyOpen);
  }

  function enhanceOverlayCloseButtons() {
    d.querySelectorAll('.overlay-close').forEach((btn) => {
      if (btn.dataset.androidPolished === '1') return;
      btn.dataset.androidPolished = '1';
      btn.setAttribute('type', btn.getAttribute('type') || 'button');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') || 'Close this practice');
      btn.addEventListener('pointerup', function (event) {
        event.stopPropagation();
      }, { passive: true });
    });
  }

  function enhanceInputs() {
    d.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.dataset.androidInputPolished === '1') return;
      el.dataset.androidInputPolished = '1';
      if (!el.getAttribute('autocomplete') && (el.tagName === 'TEXTAREA' || el.type === 'text')) {
        el.setAttribute('autocomplete', 'off');
      }
      el.addEventListener('focus', () => {
        setTimeout(() => {
          try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch {}
        }, 240);
      }, { passive: true });
    });
  }

  function showChip(kind, message, actionLabel, action, autoHideMs) {
    const old = d.querySelector('.' + kind + '-chip');
    if (old) old.remove();
    const chip = d.createElement('div');
    chip.className = kind + '-chip';
    chip.setAttribute('role', 'status');
    chip.innerHTML = '<span></span><div style="display:flex;gap:8px;align-items:center"><button type="button" class="main-action"></button><button type="button" class="dismiss">Later</button></div>';
    chip.querySelector('span').textContent = message;
    const main = chip.querySelector('.main-action');
    main.textContent = actionLabel;
    main.addEventListener('click', async () => {
      try { await action(); } finally { chip.remove(); }
    });
    chip.querySelector('.dismiss').addEventListener('click', () => chip.remove());
    d.body.appendChild(chip);
    if (autoHideMs) setTimeout(() => { if (chip.isConnected) chip.remove(); }, autoHideMs);
  }

  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isAndroid || isStandalone) return;
    event.preventDefault();
    deferredInstallPrompt = event;
    showChip('install', 'Install Stillness on Android for full-screen offline use.', 'Install', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch {}
      deferredInstallPrompt = null;
    });
  });

  function wireServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting) showUpdateReady(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateReady(worker);
        });
      });
    }).catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  function showUpdateReady(worker) {
    showChip('update', 'A newer version of Stillness is ready.', 'Update', async () => {
      try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch { window.location.reload(); }
    });
  }

  function wireOfflineStatus() {
    function showOffline() {
      showChip('offline', 'You are offline. Saved entries still work on this device.', 'OK', async () => {}, 6500);
    }
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', () => {
      const old = d.querySelector('.offline-chip');
      if (old) old.remove();
      showChip('offline', 'Back online.', 'OK', async () => {}, 2500);
    });
  }

  function observeAppMutations() {
    const mo = new MutationObserver(() => {
      syncOverlayState();
      enhanceOverlayCloseButtons();
      enhanceInputs();
    });
    mo.observe(d.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }

  function init() {
    setPlatformFlags();
    setViewportHeight();
    enhanceOverlayCloseButtons();
    enhanceInputs();
    syncOverlayState();
    observeAppMutations();
    wireServiceWorker();
    wireOfflineStatus();

    window.addEventListener('resize', setViewportHeight, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 300), { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setViewportHeight, { passive: true });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
