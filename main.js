const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme, shell } = require('electron');
const path = require('path');
const HotkeyManager = require('./src/hotkeyManager');
const AudioRecorder = require('./src/audioRecorder');
const TranscriptionService = require('./src/transcription');
const ClipboardManager = require('./src/clipboardManager');
const Config = require('./src/config');
const Logger = require('./src/logger');

// Disable GPU to prevent flashing and GPU errors
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow = null;
let settingsWindow = null;
let recordingIndicator = null;
let tray = null;
let hotkeyManager = null;
let audioRecorder = null;
let transcriptionService = null;
let recordingStatus = 'idle'; // 'idle', 'recording', 'processing'
let isRecording = false;


function createRecordingIndicator() {
  const { screen } = require('electron');
  // Use the display where the user's cursor is, not necessarily the primary
  const cursorPos = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
  const { x: displayX, y: displayY, width, height: displayHeight } = activeDisplay.bounds;

  recordingIndicator = new BrowserWindow({
    width: 180,
    height: 64,
    x: Math.floor(displayX + width / 2 - 90), // Center on active display
    y: displayY + displayHeight - 90, // 90px from bottom of active display
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: false,
    acceptFirstMouse: false, // Prevent window from stealing focus on macOS
    visibleOnAllWorkspaces: true, // Show on all desktops without stealing focus
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // On Windows, use a higher z-order level so the overlay isn't hidden
  // behind elevated or fullscreen windows. noop on macOS.
  if (process.platform === 'win32') {
    recordingIndicator.setAlwaysOnTop(true, 'pop-up-menu');
  }

  recordingIndicator.loadFile('renderer/recording-indicator.html');
  recordingIndicator.setIgnoreMouseEvents(false); // Allow dragging
}

function showRecordingIndicator() {
  if (recordingIndicator && !recordingIndicator.isDestroyed()) {
    // Reposition to the display where the cursor currently is
    const { screen } = require('electron');
    const cursorPos = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
    const { x: displayX, y: displayY, width, height: displayHeight } = activeDisplay.bounds;
    recordingIndicator.setPosition(
      Math.floor(displayX + width / 2 - 90),
      displayY + displayHeight - 90
    );
    recordingIndicator.showInactive(); // Show without stealing focus
    // Trigger timer reset
    recordingIndicator.webContents.executeJavaScript('if (typeof startTimer === "function") startTimer();');
  } else {
    createRecordingIndicator();
    // Use did-finish-load for reliability — ready-to-show can miss when show:false
    recordingIndicator.webContents.once('did-finish-load', () => {
      recordingIndicator.showInactive(); // Show without stealing focus
      // Trigger timer start after window is shown
      recordingIndicator.webContents.executeJavaScript('if (typeof startTimer === "function") startTimer();');
    });
  }
}

function hideRecordingIndicator() {
  if (recordingIndicator && !recordingIndicator.isDestroyed()) {
    recordingIndicator.hide();
    // Reset to recording mode for next use
    recordingIndicator.webContents.executeJavaScript('if (typeof setRecordingMode === "function") setRecordingMode();');
  }
}

function setIndicatorTranscribing() {
  if (recordingIndicator && !recordingIndicator.isDestroyed()) {
    recordingIndicator.webContents.executeJavaScript('if (typeof setTranscribingMode === "function") setTranscribingMode();');
  }
}

function createTray() {
  // Use PNG on macOS (Electron doesn't support SVG for tray icons), ICO on Windows
  const iconFile = process.platform === 'darwin' ? 'icon.png' : 'icon.ico';
  const iconPath = path.join(__dirname, 'assets', iconFile);
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  updateTrayMenu();
  tray.on('double-click', () => {
    showMainWindow('app');
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Status: ${recordingStatus === 'recording' ? 'Recording...' : recordingStatus === 'processing' ? 'Processing...' : 'Ready'}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open App',
      click: () => {
        showMainWindow('app');
      }
    },
    {
      label: 'Settings',
      click: () => {
        showMainWindow('settings');
      }
    },
    {
      label: 'History',
      click: () => {
        showMainWindow('history');
      }
    },
    {
      label: 'Open DevTools',
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.webContents.openDevTools();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('ezspeak - Voice to Text');
}

function setRecordingStatus(status) {
  recordingStatus = status;
  updateTrayMenu();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    try {
      settingsWindow.webContents.send('recording-status-changed', status);
    } catch (e) {
      // Ignore if renderer not ready
    }
  }
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 540,
    height: 660,
    minWidth: 480,
    minHeight: 560,
    resizable: true,
    frame: false, // Remove default frame for custom title bar
    show: false, // Show when explicitly instructed
    skipTaskbar: false, // Show in taskbar when visible
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#18181b'
  });

  settingsWindow.loadFile('renderer/settings.html');

  // Intercept window close so the background recording capability remains active
  settingsWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });

  // Enable DevTools - can be opened with F12 or Ctrl+Shift+I
  settingsWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      settingsWindow.webContents.toggleDevTools();
    }
  });

  // Open DevTools in dev mode automatically
  if (process.argv.includes('--dev')) {
    settingsWindow.webContents.openDevTools({ mode: 'detach' });
    Logger.log('DevTools opened (dev mode)');
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function showMainWindow(tab = 'app') {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    if (tab) {
      try {
        settingsWindow.webContents.send('navigate-tab', tab);
      } catch (e) {}
    }
  } else {
    createSettingsWindow();
    settingsWindow.webContents.once('did-finish-load', () => {
      settingsWindow.show();
      settingsWindow.focus();
      if (tab) {
        settingsWindow.webContents.send('navigate-tab', tab);
      }
    });
  }
}

function showSettingsWindow() {
  showMainWindow('settings');
}

async function initializeServices() {
  const { globalShortcut } = require('electron');

  audioRecorder = new AudioRecorder();
  transcriptionService = new TranscriptionService();

  // Initialize hotkey manager
  hotkeyManager = new HotkeyManager(
    handleRecordStart,
    handleRecordStop,
    globalShortcut
  );
}

async function handleRecordStart() {
  Logger.log('handleRecordStart called');

  if (isRecording) {
    Logger.warn('Already recording, ignoring start request');
    return;
  }

  if (!Config.isConfigured()) {
    Logger.warn('Not configured, showing settings window');
    showSettingsWindow();
    return;
  }

  try {
    Logger.recording('Starting recording...');
    isRecording = true;
    setRecordingStatus('recording');
    showRecordingIndicator(); // Show visual indicator

    await audioRecorder.startRecording();
    Logger.success('Recording started successfully');
  } catch (error) {
    Logger.error('Error starting recording:', error);
    isRecording = false;
    setRecordingStatus('idle');
    hideRecordingIndicator();
  }
}

async function handleRecordStop() {
  Logger.log('handleRecordStop called');

  if (!isRecording) {
    Logger.warn('Not recording, ignoring stop request');
    return;
  }

  try {
    Logger.recording('Stopping recording...');
    setIndicatorTranscribing(); // Switch to transcribing mode instead of hiding
    setRecordingStatus('processing');
    isRecording = false;

    const audioFilePath = await audioRecorder.stopRecording();
    Logger.success('Recording stopped, file:', audioFilePath);

    // Check file size
    const stats = require('fs').statSync(audioFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    Logger.log(`Audio file size: ${fileSizeKB} KB`);

    if (!audioFilePath || !require('fs').existsSync(audioFilePath)) {
      throw new Error('Audio file was not created');
    }

    // Transcribe audio
    Logger.log('Sending to Whisper API for transcription...');
    const transcribedText = await transcriptionService.transcribe(audioFilePath);
    Logger.transcription('Transcription result:', transcribedText);

    if (transcribedText && transcribedText.trim().length > 0) {
      // Auto-paste the transcribed text
      Logger.log('Auto-pasting text...');
      await ClipboardManager.autoPaste(transcribedText.trim());
      Logger.success('Text pasted successfully!');

      // Save to history
      Config.addToHistory(transcribedText.trim());
      Logger.log('Transcription saved to history');

      // Notify settings window so History tab stays live if it's open
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        try {
          settingsWindow.webContents.send('history-updated');
        } catch (e) {
          // Window may be in the middle of loading — ignore
        }
      }
    } else {
      Logger.warn('No text to paste (empty transcription)');
    }

    hideRecordingIndicator(); // Hide indicator after completion
    setRecordingStatus('idle');
  } catch (error) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const errorStack = error?.stack || 'No stack trace available';

    Logger.error('Error in recording/transcription:', errorMessage);
    Logger.error('Full error object:', error);
    Logger.error('Stack:', errorStack);

    setRecordingStatus('idle');
    hideRecordingIndicator();

    // Send error to renderer if settings window is open
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      try {
        settingsWindow.webContents.send('error', errorMessage);
      } catch (e) {
        Logger.error('Failed to send error to renderer:', e);
      }
    }
  }
}

// IPC Handlers
ipcMain.handle('get-api-key', () => {
  return Config.getApiKey();
});

ipcMain.handle('set-api-key', (event, key) => {
  Config.setApiKey(key);
  return true;
});

ipcMain.handle('is-configured', () => {
  return Config.isConfigured();
});

ipcMain.handle('get-microphone', () => {
  return Config.getMicrophoneDeviceId();
});

ipcMain.handle('set-microphone', (event, deviceId) => {
  Config.setMicrophoneDeviceId(deviceId);
  return true;
});

ipcMain.handle('get-hotkey', () => {
  return Config.getHotkey();
});

ipcMain.handle('set-hotkey', async (event, hotkey) => {
  Config.setHotkey(hotkey);

  // Restart hotkey monitoring with new key
  if (hotkeyManager) {
    Logger.log(`Changing hotkey to ${hotkey}, restarting monitoring...`);
    hotkeyManager.stopMonitoring();
    await hotkeyManager.startMonitoring();
  }

  return true;
});

ipcMain.on('pause-hotkey', () => {
  if (hotkeyManager) hotkeyManager.pauseMonitoring();
});

ipcMain.on('resume-hotkey', () => {
  if (hotkeyManager) hotkeyManager.resumeMonitoring();
});

ipcMain.handle('get-transcription-mode', () => {
  return Config.getTranscriptionMode();
});

ipcMain.handle('set-transcription-mode', (event, mode) => {
  Config.setTranscriptionMode(mode);
  Logger.log(`Transcription mode set to: ${mode}`);
  return true;
});

ipcMain.handle('check-model-downloaded', () => {
  return transcriptionService.localService.isModelDownloaded();
});

ipcMain.handle('download-model', async () => {
  try {
    await transcriptionService.localService.initialize();
    return { success: true };
  } catch (error) {
    Logger.error('Error downloading model:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
});

ipcMain.on('toggle-recording', async () => {
  if (isRecording) {
    await handleRecordStop();
  } else {
    await handleRecordStart();
  }
});

ipcMain.on('minimize-window', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.minimize();
  }
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// Forward live waveform data from the settings window to the recording indicator
ipcMain.on('waveform-data', (event, data) => {
  if (recordingIndicator && !recordingIndicator.isDestroyed()) {
    recordingIndicator.webContents.executeJavaScript(
      `if (typeof updateWaveform === 'function') updateWaveform(${JSON.stringify(data)})`
    );
  }
});

ipcMain.handle('get-history', () => {
  return Config.getHistory();
});

ipcMain.handle('clear-history', () => {
  Config.clearHistory();
  return true;
});

// App lifecycle
// Global error handlers
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception:', error);
  Logger.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Rejection at:', promise);
  Logger.error('Reason:', reason);
  if (reason instanceof Error) {
    Logger.error('Error message:', reason.message);
    Logger.error('Stack:', reason.stack);
  }
});

app.whenReady().then(async () => {
  Logger.init(); // Initialize file logging
  Logger.log('App ready, initializing...');

  // Set app icon on macOS
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    app.dock.setIcon(icon);
  }

  // Force dark mode for window chrome
  nativeTheme.themeSource = 'dark';

  createTray();
  Logger.success('System tray created');

  createRecordingIndicator(); // Pre-create indicator
  Logger.success('Recording indicator created');

  await initializeServices();
  Logger.success('Services initialized');

  // Start monitoring for hotkey
  await hotkeyManager.startMonitoring();

  // Show application window immediately on startup
  showMainWindow('app');
  Logger.success('Application window opened');

  console.log('\n========================================');
  console.log('   ezspeak is ready!');
  console.log('========================================\n');
});

app.on('window-all-closed', (event) => {
  // Don't quit the app when all windows are closed - keep running in system tray
  // This works on both Windows and macOS
});

app.on('activate', () => {
  // On macOS, clicking the dock icon should show the application window
  showMainWindow('app');
});

app.on('before-quit', () => {
  app.isQuitting = true;
  // Cleanup
  if (hotkeyManager) {
    hotkeyManager.stopMonitoring();
  }
  if (audioRecorder && audioRecorder.getRecordingStatus()) {
    audioRecorder.stopRecording().catch(console.error);
  }
  if (recordingIndicator && !recordingIndicator.isDestroyed()) {
    recordingIndicator.close();
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.destroy();
  }
});

