import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const asarPath = '/usr/share/antigravity/resources/app.asar';
const tmpDir = '/tmp/asar_patch_indicator_' + Date.now();

try {
  console.log('1. Extracting app.asar...');
  execSync(`npx --yes --package @electron/asar asar extract ${asarPath} ${tmpDir}`);

  const utilsPath = path.join(tmpDir, 'dist', 'utils.js');
  let utilsCode = fs.readFileSync(utilsPath, 'utf8');

  if (utilsCode.includes('/* ANTIGRAVITY MODEL STATUS INDICATOR */')) {
    console.log('Already patched!');
  } else {
    console.log('2. Injecting Indicator code into init()...');

    const indicatorSnippet = `
                /* ANTIGRAVITY MODEL STATUS INDICATOR */
                try {
                    const indicatorStyle = document.createElement("style");
                    indicatorStyle.id = "antigravity-model-indicator-style";
                    indicatorStyle.textContent = \`
                        @keyframes agy-hazard-pulse {
                            0%, 100% {
                                opacity: 1;
                                transform: scale(1);
                                filter: drop-shadow(0 0 5px #eab308) drop-shadow(0 0 8px rgba(234, 179, 8, 0.7));
                            }
                            50% {
                                opacity: 0.3;
                                transform: scale(0.9);
                                filter: drop-shadow(0 0 1px rgba(234, 179, 8, 0.2));
                            }
                        }
                        .agy-hazard-indicator {
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            width: 16px !important;
                            height: 16px !important;
                            min-width: 16px !important;
                            color: #facc15 !important;
                            fill: #facc15 !important;
                            animation: agy-hazard-pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
                            cursor: pointer !important;
                            vertical-align: middle !important;
                            z-index: 10 !important;
                        }
                        .agy-spinner-hidden {
                            display: none !important;
                        }
                    \`;
                    document.head.appendChild(indicatorStyle);

                    const HAZARD_SVG = '<svg class="agy-hazard-indicator" viewBox="0 0 24 24" fill="currentColor" title="⚠️ مدل در این چت در دسترس نیست (Model Unavailable)"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" /></svg>';

                    function checkModelStatus() {
                        try {
                            const mainArea = document.querySelector('[role="main"]') || document.body;
                            const mainText = mainArea ? mainArea.innerText : '';
                            const isModelUnavailableInActive = mainText && (
                                mainText.includes('Model unavailable') ||
                                mainText.includes('unavailable, retrying') ||
                                mainText.includes('model unavailable')
                            );

                            const rows = document.querySelectorAll('[data-testid*="conversation-row"], [data-cascade-id]');
                            rows.forEach(row => {
                                const isSelected = row.getAttribute('data-selected') === 'true';
                                const spinner = row.querySelector('[data-testid="status-loading-spinner"], .animate-spin, svg.animate-spin');
                                let hazardBadge = row.querySelector('.agy-hazard-indicator');

                                if (isSelected && isModelUnavailableInActive) {
                                    if (spinner) {
                                        spinner.classList.add('agy-spinner-hidden');
                                    }
                                    if (!hazardBadge) {
                                        const wrapper = document.createElement('span');
                                        wrapper.innerHTML = HAZARD_SVG;
                                        const badgeEl = wrapper.firstElementChild;
                                        if (spinner && spinner.parentNode) {
                                            spinner.parentNode.insertBefore(badgeEl, spinner);
                                        } else {
                                            const rightSide = row.querySelector('div.flex.items-center.gap-1\\\\.5') || row;
                                            rightSide.appendChild(badgeEl);
                                        }
                                    }
                                } else if (isSelected && !isModelUnavailableInActive) {
                                    if (hazardBadge) hazardBadge.remove();
                                    if (spinner) spinner.classList.remove('agy-spinner-hidden');
                                }
                            });
                        } catch (_) {}
                    }

                    setInterval(checkModelStatus, 800);
                    const statusObserver = new MutationObserver(checkModelStatus);
                    statusObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
                } catch(e) {
                    console.error("Failed to init model status indicator", e);
                }
`;

    const targetPos = utilsCode.indexOf('function init() {');
    if (targetPos === -1) {
      throw new Error('Could not find function init() in dist/utils.js');
    }

    utilsCode = utilsCode.slice(0, targetPos + 'function init() {'.length) +
                indicatorSnippet +
                utilsCode.slice(targetPos + 'function init() {'.length);

    fs.writeFileSync(utilsPath, utilsCode, 'utf8');
    console.log('✅ Successfully injected into utils.js!');

    console.log('3. Backing up original app.asar to app.asar.pre_indicator.bak...');
    if (!fs.existsSync(asarPath + '.pre_indicator.bak')) {
      fs.copyFileSync(asarPath, asarPath + '.pre_indicator.bak');
    }

    console.log('4. Repacking app.asar...');
    execSync(`npx --yes --package @electron/asar asar pack ${tmpDir} ${asarPath}`);
    console.log('🎉 SUCCESS! Patched live app.asar with Chat Status Indicator.');
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
