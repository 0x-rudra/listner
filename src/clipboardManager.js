const { clipboard } = require('electron');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const Logger = require('./logger');

const WTYPE_PATH = path.join(__dirname, '..', 'bin', 'wtype');

class ClipboardManager {
  /**
   * Sync text with OS clipboards (Electron clipboard + Wayland wl-copy)
   */
  static syncClipboard(text) {
    if (!text) return;
    try {
      clipboard.writeText(text);
    } catch (e) {
      Logger.warn('Electron clipboard write error:', e.message);
    }

    if (process.platform === 'linux') {
      try {
        spawnSync('wl-copy', ['--', text], { input: text, timeout: 500 });
        spawnSync('wl-copy', ['--primary', '--', text], { input: text, timeout: 500 });
      } catch (e) {
        // wl-copy might not be available or timed out
      }
    }
  }

  /**
   * Types/pastes text word-by-word at the current cursor position in any active application
   * @param {string} text - The text to type
   * @param {number} delayMs - Delay between words in milliseconds (default: 35ms)
   */
  static async typeWordByWord(text, delayMs = 35) {
    if (!text || text.trim().length === 0) return false;

    const trimmed = text.trim();
    Logger.log(`[ClipboardManager] Typing word-by-word (${trimmed.length} chars): "${trimmed}"`);

    // Ensure full text is always saved in clipboard and primary selection for user
    this.syncClipboard(trimmed);

    // Give a brief 50ms pause to ensure target text box has focus
    await new Promise(r => setTimeout(r, 50));

    // 1. Try native Wayland direct typing using wtype if on Linux
    if (process.platform === 'linux' && fs.existsSync(WTYPE_PATH)) {
      try {
        const words = trimmed.match(/\S+\s*/g) || [trimmed];
        for (const word of words) {
          spawnSync(WTYPE_PATH, ['-d', '12', '-s', '10', '--', word], { timeout: 1500 });
          if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
          }
        }
        Logger.success('[ClipboardManager] wtype typing completed successfully');
        return true;
      } catch (err) {
        Logger.warn('[ClipboardManager] wtype direct typing encountered error, falling back to paste:', err.message);
      }
    }

    // 2. Fallback: Auto-paste complete text via simulated Ctrl+V / Command+V
    return await this.autoPaste(trimmed);
  }

  /**
   * Automatically paste text at the current cursor position
   * @param {string} text - The text to paste
   */
  static async autoPaste(text) {
    if (!text || text.trim().length === 0) return false;
    const trimmed = text.trim();

    try {
      this.syncClipboard(trimmed);
      await new Promise(r => setTimeout(r, 60));

      let pasted = false;

      // Wayland compositor paste via wtype with key-down/key-up spacing
      if (process.platform === 'linux' && fs.existsSync(WTYPE_PATH)) {
        try {
          const res = spawnSync(WTYPE_PATH, ['-s', '30', '-M', 'ctrl', '-s', '30', '-k', 'v', '-s', '30', '-m', 'ctrl'], { timeout: 1500 });
          if (res.status === 0) {
            pasted = true;
            Logger.success('[ClipboardManager] Pasted successfully using wtype Ctrl+V');
          }
        } catch (e) {
          Logger.warn('[ClipboardManager] wtype paste failed:', e.message);
        }
      }

      // Cross-platform / X11 paste via nut-js
      try {
        const isMac = os.platform() === 'darwin';
        const modifierKey = isMac ? Key.LeftSuper : Key.LeftControl;
        await keyboard.pressKey(modifierKey, Key.V);
        await keyboard.releaseKey(modifierKey, Key.V);
        pasted = true;
        Logger.success('[ClipboardManager] Pasted via nut-js');
      } catch (e) {
        Logger.warn('[ClipboardManager] nut-js paste failed:', e.message);
      }

      return pasted;
    } catch (error) {
      Logger.error('Error in autoPaste:', error);
      return false;
    }
  }

  /**
   * Copy text to clipboard without pasting
   * @param {string} text - The text to copy
   */
  static copy(text) {
    this.syncClipboard(text);
  }
}

module.exports = ClipboardManager;
