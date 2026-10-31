const Config = require('./config');
const Logger = require('./logger');

let uIOhook = null;
let UiohookKey = null;
try {
  const uio = require('uiohook-napi');
  uIOhook = uio.uIOhook;
  UiohookKey = uio.UiohookKey;
} catch (e) {
  Logger.warn('uiohook-napi not available or failed to load:', e.message);
}

class HotkeyManager {
  constructor(onRecordStart, onRecordStop, globalShortcut) {
    this.onRecordStart = onRecordStart;
    this.onRecordStop = onRecordStop;
    this.globalShortcut = globalShortcut;
    this.isRecording = false;
    this.lastKeyPressTime = 0;
    this.keyPressDebounce = 150; // 150ms debounce
    this.keyDownTime = null;
    this.isMonitoring = false;
    this.isPaused = false;
    this.registeredAccelerator = null;
    this.uiohookStarted = false;
    this.isHoldMode = false;
    this.pressedKeys = new Set();

    // Modifier mappings for uiohook
    if (UiohookKey) {
      this.modifiers = {
        'Ctrl': [UiohookKey.Ctrl, UiohookKey.CtrlRight],
        'Alt': [UiohookKey.Alt, UiohookKey.AltRight],
        'Shift': [UiohookKey.Shift, UiohookKey.ShiftRight],
        'Meta': [UiohookKey.Meta, UiohookKey.MetaRight],
        'Command': [UiohookKey.Meta, UiohookKey.MetaRight],
        'Cmd': [UiohookKey.Meta, UiohookKey.MetaRight]
      };
    } else {
      this.modifiers = {};
    }
  }

  /**
   * Convert hotkey string into Electron accelerator string(s)
   */
  getElectronAccelerators(hotkeyString) {
    if (!hotkeyString) return ['CommandOrControl+Space'];

    const parts = hotkeyString.split('+').map(p => p.trim());
    const accelerators = [];

    const mapPart = (part) => {
      const lower = part.toLowerCase();
      if (['ctrl', 'control', 'ctrlright', 'ctrlleft', 'controlright', 'controlleft'].includes(lower)) return 'CommandOrControl';
      if (['alt', 'altleft', 'altright'].includes(lower)) return 'Alt';
      if (['shift', 'shiftleft', 'shiftright'].includes(lower)) return 'Shift';
      if (['meta', 'metaleft', 'metaright', 'cmd', 'super'].includes(lower)) return 'Super';
      if (['bracketright', 'closebracket'].includes(lower)) return ']';
      if (['bracketleft', 'openbracket'].includes(lower)) return '[';
      if (['backslash'].includes(lower)) return '\\';
      if (['slash'].includes(lower)) return '/';
      if (['space'].includes(lower)) return 'Space';
      return part;
    };

    const primary = parts.map(mapPart).join('+');
    accelerators.push(primary);

    // Add common cross-platform variants
    if (primary.includes('Super')) {
      accelerators.push(primary.replace(/Super/g, 'Alt'));
    }
    if (primary.includes('CommandOrControl')) {
      accelerators.push(primary.replace(/CommandOrControl/g, 'Control'));
    }

    // Always include proven OS fallback shortcuts
    accelerators.push('CommandOrControl+Space');
    accelerators.push('Alt+Space');
    accelerators.push('CommandOrControl+Shift+Space');
    accelerators.push('F8');

    return [...new Set(accelerators)];
  }

  /**
   * Start monitoring for hotkey using both OS globalShortcut and uiohook
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      Logger.warn('Hotkey monitoring already active');
      return;
    }

    this.isMonitoring = true;
    const hotkeyString = Config.getHotkey() || 'Ctrl+Space';
    Logger.log(`Starting hotkey monitoring for: ${hotkeyString}...`);

    // 1. Register with Electron globalShortcut (Primary OS-level handler)
    this.registerGlobalShortcut(hotkeyString);

    // 2. Start uiohook for smart push-to-talk / hold detection if available
    this.startUiohook(hotkeyString);
  }

  registerGlobalShortcut(hotkeyString) {
    if (!this.globalShortcut) {
      Logger.warn('globalShortcut not available');
      return;
    }

    try {
      this.globalShortcut.unregisterAll();
    } catch (e) {}

    const candidates = this.getElectronAccelerators(hotkeyString);
    let registered = false;

    for (const acc of candidates) {
      try {
        const ok = this.globalShortcut.register(acc, () => {
          if (this.isPaused) return;
          Logger.log(`OS globalShortcut triggered (${acc})`);
          this.handleToggle();
        });

        if (ok) {
          registered = true;
          this.registeredAccelerator = acc;
          Logger.success(`Global OS shortcut registered successfully: ${acc}`);
          break;
        } else {
          Logger.warn(`Failed to register globalShortcut accelerator: ${acc}`);
        }
      } catch (err) {
        Logger.warn(`Error registering accelerator ${acc}: ${err.message}`);
      }
    }

    // If none of the candidates worked, register a fallback
    if (!registered) {
      const fallbacks = ['CommandOrControl+Shift+Space', 'Alt+Space', 'F8'];
      for (const fb of fallbacks) {
        try {
          if (this.globalShortcut.register(fb, () => this.handleToggle())) {
            this.registeredAccelerator = fb;
            Logger.success(`Registered fallback global shortcut: ${fb}`);
            break;
          }
        } catch (e) {}
      }
    }
  }

  startUiohook(hotkeyString) {
    if (!uIOhook || !UiohookKey) {
      Logger.warn('uiohook not available on this platform, relying on OS globalShortcut.');
      return;
    }

    try {
      this.targetHotkey = this.parseHotkey(hotkeyString);

      uIOhook.removeAllListeners('keydown');
      uIOhook.removeAllListeners('keyup');

      uIOhook.on('keydown', (e) => {
        if (this.isPaused) return;
        this.pressedKeys.add(e.keycode);

        if (this.checkHotkey()) {
          this.handleKeyDown();
        } else if (this.isRecording) {
          // If recording, pressing any regular key turns it off
          const isModifier = Object.values(this.modifiers).flat().includes(e.keycode);
          if (!isModifier) {
            Logger.log('Any key pressed on keyboard while recording -> Stopping dictation');
            this.handleToggle();
          }
        }
      });

      uIOhook.on('keyup', (e) => {
        if (this.isPaused) {
          this.pressedKeys.delete(e.keycode);
          return;
        }

        const wasPressed = this.pressedKeys.has(e.keycode);
        this.pressedKeys.delete(e.keycode);

        if (wasPressed && this.isRelevantKey(e.keycode)) {
          this.handleKeyUp();
        }
      });

      uIOhook.start();
      this.uiohookStarted = true;
      Logger.success('uiohook listener active');
    } catch (error) {
      Logger.warn(`uiohook could not be started (${error.message}). Global shortcuts will use OS accelerator.`);
      this.uiohookStarted = false;
    }
  }

  parseHotkey(hotkeyString) {
    if (!hotkeyString || !UiohookKey) return null;
    const parts = hotkeyString.split('+').map(p => p.trim());
    const conditions = [];

    for (const part of parts) {
      if (this.modifiers[part]) {
        conditions.push(this.modifiers[part]);
      } else {
        const code = UiohookKey[part];
        if (code) conditions.push([code]);
      }
    }

    return conditions.length > 0 ? conditions : null;
  }

  isRelevantKey(keycode) {
    if (!this.targetHotkey) return false;
    return this.targetHotkey.some(group => group.includes(keycode));
  }

  checkHotkey() {
    if (!this.targetHotkey) return false;
    for (const validOptions of this.targetHotkey) {
      const isSatisfied = validOptions.some(code => this.pressedKeys.has(code));
      if (!isSatisfied) return false;
    }
    return true;
  }

  /**
   * Immediate toggle called by globalShortcut or quick click
   */
  async handleToggle() {
    const now = Date.now();
    if (now - this.lastKeyPressTime < this.keyPressDebounce) {
      return;
    }
    this.lastKeyPressTime = now;

    if (this.isRecording) {
      Logger.log('Hotkey toggle: Stopping dictation...');
      this.isRecording = false;
      this.isHoldMode = false;
      try {
        if (this.globalShortcut && this.globalShortcut.isRegistered('Escape')) {
          this.globalShortcut.unregister('Escape');
        }
      } catch (e) {}
      if (this.onRecordStop) await this.onRecordStop();
    } else {
      Logger.log('Hotkey toggle: Starting dictation...');
      this.isRecording = true;
      this.isHoldMode = false;
      try {
        if (this.globalShortcut && !this.globalShortcut.isRegistered('Escape')) {
          this.globalShortcut.register('Escape', () => {
            if (this.isRecording) {
              Logger.log('Escape pressed -> Stopping dictation');
              this.handleToggle();
            }
          });
        }
      } catch (e) {}
      if (this.onRecordStart) await this.onRecordStart();
    }
  }

  setRecording(isRec) {
    this.isRecording = isRec;
    if (!isRec && this.globalShortcut) {
      try {
        if (this.globalShortcut.isRegistered('Escape')) {
          this.globalShortcut.unregister('Escape');
        }
      } catch (e) {}
    }
  }

  /**
   * Handle keydown from uiohook (immediate response)
   */
  async handleKeyDown() {
    const now = Date.now();
    if (this.keyDownTime && now - this.keyDownTime < this.keyPressDebounce) {
      return;
    }
    this.keyDownTime = now;

    // Start recording immediately with zero delay
    if (!this.isRecording) {
      Logger.log('uiohook: Key down -> Starting recording immediately');
      this.isRecording = true;
      this.isHoldMode = false;
      if (this.onRecordStart) await this.onRecordStart();
    }
  }

  /**
   * Handle keyup from uiohook
   */
  async handleKeyUp() {
    if (!this.keyDownTime) return;

    const now = Date.now();
    const pressDuration = now - this.keyDownTime;
    this.keyDownTime = null;

    // If held for more than 400ms, user was using hold-to-talk -> release to stop!
    if (pressDuration >= 400 && this.isRecording) {
      Logger.log(`uiohook: Hold released (${(pressDuration / 1000).toFixed(1)}s) -> Stopping recording`);
      this.isRecording = false;
      this.isHoldMode = false;
      if (this.onRecordStop) await this.onRecordStop();
    } else {
      // Tap (< 400ms) -> remains in toggle recording mode until tapped again!
      Logger.log('uiohook: Tap detected -> Continuing in toggle mode');
    }
  }

  pauseMonitoring() {
    this.isPaused = true;
    this.pressedKeys.clear();
    this.keyDownTime = null;
    Logger.log('Hotkey monitoring paused');
  }

  resumeMonitoring() {
    this.pressedKeys.clear();
    this.isPaused = false;
    Logger.log('Hotkey monitoring resumed');
  }

  stopMonitoring() {
    this.isMonitoring = false;

    if (this.uiohookStarted && uIOhook) {
      try {
        uIOhook.stop();
        this.uiohookStarted = false;
      } catch (error) {}
    }

    if (this.globalShortcut) {
      try {
        this.globalShortcut.unregisterAll();
      } catch (error) {}
    }
    Logger.log('Hotkey monitoring stopped');
  }

  getRecordingStatus() {
    return this.isRecording;
  }
}

module.exports = HotkeyManager;
