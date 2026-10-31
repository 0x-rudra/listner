const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings & Configuration
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  isConfigured: () => ipcRenderer.invoke('is-configured'),
  getMicrophone: () => ipcRenderer.invoke('get-microphone'),
  setMicrophone: (deviceId) => ipcRenderer.invoke('set-microphone', deviceId),
  getHotkey: () => ipcRenderer.invoke('get-hotkey'),
  setHotkey: (hotkey) => ipcRenderer.invoke('set-hotkey', hotkey),
  pauseHotkey: () => ipcRenderer.send('pause-hotkey'),
  resumeHotkey: () => ipcRenderer.send('resume-hotkey'),
  getTranscriptionMode: () => ipcRenderer.invoke('get-transcription-mode'),
  setTranscriptionMode: (mode) => ipcRenderer.invoke('set-transcription-mode', mode),
  checkModelDownloaded: () => ipcRenderer.invoke('check-model-downloaded'),
  downloadModel: () => ipcRenderer.invoke('download-model'),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Window actions
  closeSettings: () => ipcRenderer.send('close-settings'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Audio Recording (Renderer to Main)
  sendAudioData: (buffer) => ipcRenderer.send('audio-recorded', buffer),
  sendAudioError: (error) => ipcRenderer.send('audio-error', error),
  sendWaveformData: (data) => ipcRenderer.send('waveform-data', data),

  // Audio Recording (Main to Renderer)
  onStartRecording: (callback) => {
    ipcRenderer.on('start-recording', () => callback());
  },
  onStopRecording: (callback) => {
    ipcRenderer.on('stop-recording', () => callback());
  },

  // Events from Main
  onHistoryUpdated: (callback) => {
    ipcRenderer.on('history-updated', () => callback());
  },
  onError: (callback) => {
    ipcRenderer.on('error', (event, message) => callback(message));
  },
  onRecordingStatusChanged: (callback) => {
    ipcRenderer.on('recording-status-changed', (event, status) => callback(status));
  },
  onNavigateTab: (callback) => {
    ipcRenderer.on('navigate-tab', (event, tab) => callback(tab));
  },

  // Manual trigger from UI
  toggleRecording: () => ipcRenderer.send('toggle-recording')
});
