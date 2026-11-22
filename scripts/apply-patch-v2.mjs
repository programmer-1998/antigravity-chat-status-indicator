import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const asarPath = '/usr/share/antigravity/resources/app.asar';
const tmpDir = path.join(os.tmpdir(), 'asar_patch_indicator_v2_' + Date.now());

try {
  console.log('1. Extracting app.asar...');
  execSync(`npx --yes --package @electron/asar asar extract ${asarPath} ${tmpDir}`);

  const utilsPath = path.join(tmpDir, 'dist', 'utils.js');
  let utilsCode = fs.readFileSync(utilsPath, 'utf8');

  const PATCH_TAG_START = '/* ANTIGRAVITY_STATUS_INDICATOR_START */';
  const PATCH_TAG_END = '/* ANTIGRAVITY_STATUS_INDICATOR_END */';

  if (utilsCode.includes(PATCH_TAG_START)) {
    console.log('Previous status indicator patch found. Cleaning it up first...');
    const regex = new RegExp(`${PATCH_TAG_START}[\\s\\S]*?${PATCH_TAG_END}`, 'g');
    utilsCode = utilsCode.replace(regex, '');
  }

  const ANCHOR = 'void win.loadURL(url);';
  if (!utilsCode.includes(ANCHOR)) {
    throw new Error(`Anchor "${ANCHOR}" not found in dist/utils.js!`);
  }

  // The injection payload
  const injectionPayload = `
${PATCH_TAG_START}
    win.webContents.on('dom-ready', () => {
      const currentURL = win.webContents.getURL();
      if (!currentURL || !/^https?:\\/\\/127\\.0\\.0\\.1:\\d+/i.test(currentURL)) return;

      win.webContents.executeJavaScript(\`(() => {
        if (window.__ANTIGRAVITY_HAZARD_INDICATOR_LOADED__) return;
        window.__ANTIGRAVITY_HAZARD_INDICATOR_LOADED__ = true;

        // 1. Inject Styles: Glowing blinking hazard sign & hiding squares
        const styleId = "antigravity-hazard-style";
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = \\\`
            @keyframes agy-hazard-pulse-glow {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
                filter: drop-shadow(0 0 4px #eab308) drop-shadow(0 0 8px rgba(234, 179, 8, 0.75));
              }
              50% {
                opacity: 0.35;
                transform: scale(0.9);
                filter: drop-shadow(0 0 1px rgba(234, 179, 8, 0.2));
              }
            }

            .agy-hazard-badge {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 17px !important;
              height: 17px !important;
              min-width: 17px !important;
              margin: 0 4px !important;
              color: #facc15 !important;
              fill: #facc15 !important;
              animation: agy-hazard-pulse-glow 1.25s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
              cursor: pointer !important;
              vertical-align: middle !important;
              z-index: 20 !important;
            }

            .agy-hazard-badge:hover {
              transform: scale(1.15) !important;
              filter: drop-shadow(0 0 10px #f59e0b) !important;
            }

            .agy-hide-squares {
              display: none !important;
            }
          \\\`;
          document.head.appendChild(style);
        }

        // 2. High-res SVG Warning Shield/Sign Icon (Not emoji)
        const HAZARD_SVG = \\\`<svg class="agy-hazard-badge" viewBox="0 0 24 24" fill="currentColor" title="⚠️ مدل در دسترس نیست (Model Unavailable)"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" /></svg>\\\`;

        // 3. Monitor sidebar conversation rows
        function updateStatus() {
          try {
            // Check active chat main area for error
            const mainEl = document.querySelector('[role="main"]') || document.body;
            const mainText = mainEl ? mainEl.innerText : '';
            const isActiveConvoUnavailable = mainText && (
              mainText.includes('Model unavailable') ||
              mainText.includes('unavailable, retrying') ||
              mainText.includes('model unavailable')
            );

            // Select all conversation rows in sidebar
            const rows = document.querySelectorAll('[data-testid*="conversation-row"], [data-cascade-id], .agy-sidebar-row');
            rows.forEach(row => {
              const isSelected = row.getAttribute('data-selected') === 'true' || row.classList.contains('bg-sidebar-secondary');
              
              // Find the 2x2 square loader container or spinning loader
              const squareLoader = row.querySelector('[data-testid="status-loading-spinner"], [data-agent-state-dot], .grid.place-content-center, .animate-spin') ||
                                   row.querySelector('span[style*="repeat(2"]');
              
              const loaderWrapper = squareLoader ? (squareLoader.closest('[data-testid="status-loading-spinner"]') || squareLoader) : null;
              let hazardEl = row.querySelector('.agy-hazard-badge');

              if (isSelected && isActiveConvoUnavailable) {
                // Hide 2x2 blinking square loader / spinner
                if (loaderWrapper) {
                  loaderWrapper.classList.add('agy-hide-squares');
                }
                // Insert hazard badge if not present
                if (!hazardEl) {
                  const temp = document.createElement('span');
                  temp.innerHTML = HAZARD_SVG;
                  const newBadge = temp.firstElementChild;
                  if (loaderWrapper && loaderWrapper.parentNode) {
                    loaderWrapper.parentNode.insertBefore(newBadge, loaderWrapper);
                  } else {
                    const rightContainer = row.querySelector('div.flex.items-center.gap-1\\\\.5') || row;
                    rightContainer.appendChild(newBadge);
                  }
                }
              } else if (isSelected && !isActiveConvoUnavailable) {
                // Restore normal state
                if (hazardEl) hazardEl.remove();
                if (loaderWrapper && loaderWrapper.classList.contains('agy-hide-squares')) {
                  loaderWrapper.classList.remove('agy-hide-squares');
                }
              }
            });
          } catch (e) {
            console.debug('[Antigravity Status Indicator]', e);
          }
        }

        setInterval(updateStatus, 800);
        const obs = new MutationObserver(updateStatus);
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        updateStatus();
      })()\`).catch(console.error);
    });
${PATCH_TAG_END}
`;

  utilsCode = utilsCode.replace(ANCHOR, `${ANCHOR}\n${injectionPayload}`);
  fs.writeFileSync(utilsPath, utilsCode, 'utf8');
  console.log('2. Successfully injected payload into dist/utils.js');

  const backupPath = path.join(os.homedir(), '.gemini/antigravity/app.asar.backup.bak');
  console.log(`3. Backing up original app.asar to ${backupPath}...`);
  fs.copyFileSync(asarPath, backupPath);

  console.log('4. Packing app.asar...');
  execSync(`npx --yes --package @electron/asar asar pack ${tmpDir} ${asarPath}`);
  console.log('🎉 Successfully patched Antigravity with Chat Status Indicator!');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
