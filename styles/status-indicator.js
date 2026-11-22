(() => {
  if (window.__ANTIGRAVITY_STATUS_INDICATOR_LOADED__) return;
  window.__ANTIGRAVITY_STATUS_INDICATOR_LOADED__ = true;

  // 1. Request Notification Permission on Desktop (Cross-platform: Linux, Windows, macOS)
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch (_) {}

  // 2. Inject Styles with Glowing & Blinking Animations
  const styleId = 'antigravity-chat-status-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes agy-hazard-pulse-glow {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
          filter: drop-shadow(0 0 5px #eab308) drop-shadow(0 0 10px rgba(234, 179, 8, 0.85));
        }
        50% {
          opacity: 0.35;
          transform: scale(0.92);
          filter: drop-shadow(0 0 1px rgba(234, 179, 8, 0.2));
        }
      }

      .agy-chat-warning-badge {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 17px !important;
        height: 17px !important;
        min-width: 17px !important;
        margin-left: 6px !important;
        margin-right: 6px !important;
        color: #facc15 !important;
        fill: #facc15 !important;
        animation: agy-hazard-pulse-glow 1.25s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
        cursor: pointer !important;
        z-index: 50 !important;
        vertical-align: middle !important;
        transition: transform 0.2s ease !important;
      }

      .agy-chat-warning-badge:hover {
        transform: scale(1.2) !important;
        filter: drop-shadow(0 0 12px #f59e0b) !important;
      }

      .agy-hide-loader {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // 3. High-res SVG Warning Sign Icon (Professional Shield/Hazard, NOT emoji)
  const WARNING_SVG_HTML = `
    <svg class="agy-chat-warning-badge" viewBox="0 0 24 24" fill="currentColor" title="⚠️ مدل در این چت در دسترس نیست (Model Unavailable / Connection Error)">
      <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
    </svg>
  `.trim();

  // State tracker for system notifications (prevents spamming alerts)
  let lastNotificationTime = 0;
  const NOTIFICATION_COOLDOWN_MS = 60000; // 1 minute per conversation alert

  function sendDesktopNotification(chatTitle) {
    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) return;
    lastNotificationTime = now;

    try {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          const title = '⚠️ Antigravity: Model Unavailable';
          const body = chatTitle 
            ? `The model in "${chatTitle}" is currently unavailable or disconnected.`
            : 'A conversation encountered a model connection failure / retry state.';
          new Notification(title, {
            body,
            icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23facc15"><path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>',
            tag: 'antigravity-model-unavailable',
            silent: false
          });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    } catch (err) {
      console.debug('[Antigravity Status Indicator] Notification error:', err);
    }
  }

  // Regex pattern strictly matching model connection & availability failures
  // This avoids false positives when normal tool output or responses mention 'model'
  const UNAVAILABLE_STRICT_REGEX = /Model unavailable, retrying|model unavailable|model.*failed to respond|failed to reach model/i;

  function isModelGenuinelyUnavailable() {
    try {
      // 1. Check live ephemeral tool status bar (e.g. data-testid="ephemeral-tool-status")
      const ephemeralStatus = document.querySelector('[data-testid="ephemeral-tool-status"]');
      if (ephemeralStatus && UNAVAILABLE_STRICT_REGEX.test(ephemeralStatus.textContent || '')) {
        return true;
      }

      // 2. Check active conversation execution banner or retry indicators
      const retryBanners = document.querySelectorAll('[role="alert"], [data-testid*="error"], [data-testid*="retry"], .text-destructive, .text-warning');
      for (const el of retryBanners) {
        if (UNAVAILABLE_STRICT_REGEX.test(el.textContent || '')) {
          return true;
        }
      }

      // 3. Check the bottom status bar or active prompt container
      const inputZone = document.querySelector('[role="main"]') || document.body;
      if (inputZone) {
        // Look only at the last few elements or alerts, never entire historic conversation prose
        const alerts = inputZone.querySelectorAll('p, span, div');
        const total = alerts.length;
        // Check only the most recent 15 elements at the bottom
        for (let i = Math.max(0, total - 15); i < total; i++) {
          const text = alerts[i].textContent || '';
          if (text.includes('Model unavailable, retrying') || text.includes('Model unavailable')) {
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  // 4. Status Updater
  function updateChatStatusBadges() {
    try {
      const isUnavailable = isModelGenuinelyUnavailable();

      // Find all conversation rows in sidebar
      const rows = document.querySelectorAll('[data-testid*="conversation-row"], [data-cascade-id], .agy-sidebar-row');
      rows.forEach(row => {
        const isSelected = row.getAttribute('data-selected') === 'true' || 
                           row.classList.contains('bg-sidebar-secondary') ||
                           row.querySelector('[aria-selected="true"]') !== null;

        // Find the 2x2 square loader container (repeat(2, ...) or status-loading-spinner or data-agent-state-dot)
        const loader = row.querySelector('[data-testid="status-loading-spinner"]') ||
                       row.querySelector('[data-agent-state-dot]')?.closest('span') ||
                       row.querySelector('.grid.place-content-center') ||
                       row.querySelector('.animate-spin, svg.animate-spin');

        let badge = row.querySelector('.agy-chat-warning-badge');

        if (isSelected && isUnavailable) {
          // Hide 2x2 square loader or spinner
          if (loader) {
            loader.classList.add('agy-hide-loader');
          }
          if (!badge) {
            const container = document.createElement('span');
            container.innerHTML = WARNING_SVG_HTML;
            const newBadge = container.firstElementChild;
            if (loader && loader.parentNode) {
              loader.parentNode.insertBefore(newBadge, loader);
            } else {
              const rightSide = row.querySelector('div.flex.items-center.gap-1\\\\.5') || 
                                row.querySelector('div.flex.items-center') || 
                                row;
              rightSide.appendChild(newBadge);
            }

            // Trigger system desktop notification
            const chatTitle = (row.querySelector('.truncate, span') || {}).textContent || '';
            sendDesktopNotification(chatTitle.trim());
          }
        } else if (isSelected && !isUnavailable) {
          // Cleanly remove badge and restore normal 2x2 loader immediately
          if (badge) {
            badge.remove();
          }
          if (loader && loader.classList.contains('agy-hide-loader')) {
            loader.classList.remove('agy-hide-loader');
          }
        }
      });
    } catch (err) {
      console.debug('[Antigravity Status Indicator]', err);
    }
  }

  // 5. MutationObserver for realtime UI changes
  const observer = new MutationObserver(updateChatStatusBadges);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Heartbeat check every 600ms
  setInterval(updateChatStatusBadges, 600);
  updateChatStatusBadges();
})();
