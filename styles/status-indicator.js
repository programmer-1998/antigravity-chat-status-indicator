(() => {
  if (window.__ANTIGRAVITY_STATUS_INDICATOR_LOADED__) return;
  window.__ANTIGRAVITY_STATUS_INDICATOR_LOADED__ = true;

  // 1. Inject Styles with Glowing & Blinking Animations
  const styleId = 'antigravity-chat-status-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes agy-hazard-pulse-glow {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
          filter: drop-shadow(0 0 5px #eab308) drop-shadow(0 0 10px rgba(234, 179, 8, 0.8));
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

  // 2. High-res SVG Warning Sign Icon (Professional Shield/Hazard, NOT emoji)
  const WARNING_SVG_HTML = `
    <svg class="agy-chat-warning-badge" viewBox="0 0 24 24" fill="currentColor" title="⚠️ مدل در این چت در دسترس نیست (Model Unavailable / Connection Error)">
      <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
    </svg>
  `.trim();

  // 3. Status Updater
  function updateChatStatusBadges() {
    try {
      // Check active chat view for Model unavailable
      const mainArea = document.querySelector('[role="main"]') || document.body;
      const mainText = mainArea ? (mainArea.innerText || mainArea.textContent || '') : '';
      const isModelUnavailableInActive = (
        mainText.includes('Model unavailable') ||
        mainText.includes('unavailable, retrying') ||
        mainText.includes('model unavailable')
      );

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

        if (isSelected && isModelUnavailableInActive) {
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
          }
        } else if (isSelected && !isModelUnavailableInActive) {
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

  // 4. MutationObserver for realtime UI changes
  const observer = new MutationObserver(updateChatStatusBadges);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Heartbeat check every 600ms
  setInterval(updateChatStatusBadges, 600);
  updateChatStatusBadges();
})();
