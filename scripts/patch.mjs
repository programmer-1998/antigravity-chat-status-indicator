#!/usr/bin/env node
/**
 * Antigravity Chat Status Indicator
 * Seamlessly injects a pulsing hazard status alert into the Antigravity desktop client.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATCH_TAG_START = '/* ANTIGRAVITY_STATUS_INDICATOR_START */';
const PATCH_TAG_END = '/* ANTIGRAVITY_STATUS_INDICATOR_END */';
const ANCHOR = 'void win.loadURL(url);';

function findAsar() {
  const envAsar = process.env.ANTIGRAVITY_ASAR;
  if (envAsar && fs.existsSync(envAsar)) return envAsar;

  const candidates = [
    '/usr/share/antigravity/resources/app.asar',
    '/opt/antigravity/resources/app.asar',
    '/opt/Antigravity/resources/app.asar',
    path.join(os.homedir(), '.local/share/antigravity/resources/app.asar'),
    '/Applications/Antigravity.app/Contents/Resources/app.asar',
    path.join(os.homedir(), 'Applications/Antigravity.app/Contents/Resources/app.asar')
  ];

  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      candidates.unshift(path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'resources', 'app.asar'));
      candidates.unshift(path.join(process.env.LOCALAPPDATA, 'Antigravity', 'resources', 'app.asar'));
    }
    if (process.env.PROGRAMFILES) {
      candidates.unshift(path.join(process.env.PROGRAMFILES, 'Antigravity', 'resources', 'app.asar'));
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function runAsar(cmd, args) {
  const fullArgs = ['--yes', '--package', '@electron/asar', 'asar', cmd, ...args];
  const res = spawnSync('npx', fullArgs, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`npx asar ${cmd} failed with exit code ${res.status}`);
  }
}

export function patch() {
  const targetAsar = findAsar();
  if (!targetAsar) {
    console.error('❌ Could not locate Antigravity app.asar. Set ANTIGRAVITY_ASAR environment variable.');
    process.exit(1);
  }

  console.log(`🔍 Found Antigravity package: ${targetAsar}`);
  const tmpDir = path.join(os.tmpdir(), `antigravity_status_patch_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    console.log('📦 Extracting app.asar ...');
    runAsar('extract', [targetAsar, tmpDir]);

    const utilsPath = path.join(tmpDir, 'dist', 'utils.js');
    if (!fs.existsSync(utilsPath)) {
      throw new Error(`dist/utils.js not found in extracted asar`);
    }

    let code = fs.readFileSync(utilsPath, 'utf8');

    // Clean previous patch if present
    if (code.includes(PATCH_TAG_START)) {
      const reg = new RegExp(`${PATCH_TAG_START}[\\s\\S]*?${PATCH_TAG_END}`, 'g');
      code = code.replace(reg, '');
    }

    const scriptPath = path.join(__dirname, '..', 'styles', 'status-indicator.js');
    const indicatorScript = fs.readFileSync(scriptPath, 'utf8').trim();
    const base64Payload = Buffer.from(indicatorScript).toString('base64');

    const payload = `
${PATCH_TAG_START}
    win.webContents.on('dom-ready', () => {
      try {
        const payload = Buffer.from("${base64Payload}", "base64").toString("utf8");
        win.webContents.executeJavaScript(payload).catch(() => {});
      } catch (e) {}
    });
${PATCH_TAG_END}
`;

    if (!code.includes(ANCHOR)) {
      throw new Error(`Anchor "${ANCHOR}" not found in dist/utils.js`);
    }

    code = code.replace(ANCHOR, `${ANCHOR}\n${payload}`);
    fs.writeFileSync(utilsPath, code, 'utf8');
    console.log('✅ Injected status indicator into dist/utils.js');

    // Backup original
    const backupPath = path.join(os.homedir(), '.gemini/antigravity/app.asar.backup.bak');
    if (!fs.existsSync(backupPath)) {
      console.log(`💾 Creating backup at: ${backupPath}`);
      fs.copyFileSync(targetAsar, backupPath);
    }

    console.log('📦 Repacking app.asar ...');
    runAsar('pack', [tmpDir, targetAsar]);
    console.log('🎉 Successfully applied Antigravity Chat Status Indicator!');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function unpatch() {
  const targetAsar = findAsar();
  if (!targetAsar) {
    console.error('❌ Could not locate Antigravity app.asar');
    process.exit(1);
  }

  const backupPath = path.join(os.homedir(), '.gemini/antigravity/app.asar.backup.bak');
  if (fs.existsSync(backupPath)) {
    console.log(`🔄 Restoring from backup: ${backupPath}`);
    fs.copyFileSync(backupPath, targetAsar);
    console.log('✅ Successfully unpatched Antigravity.');
  } else {
    console.log('⚠️ No backup found at ' + backupPath);
  }
}

if (process.argv.includes('--unpatch')) {
  unpatch();
} else {
  patch();
}
