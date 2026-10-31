const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings & BYOK Configuration
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  saveProviderSettings: (settings) => ipcRenderer.invoke('save-provider-settings', settings),
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
  getCloudProvider: () => ipcRenderer.invoke('get-cloud-provider'),
  setCloudProvider: (provider) => ipcRenderer.invoke('set-cloud-provider', provider),

  // Local Offline Models & Import
  getLocalModels: () => ipcRenderer.invoke('get-local-models'),
  setLocalModel: (modelId) => ipcRenderer.invoke('set-local-model', modelId),
  importLocalModel: () => ipcRenderer.invoke('import-local-model'),
  downloadModel: (modelName) => ipcRenderer.invoke('download-model', modelName),
  deleteLocalModel: (modelPath) => ipcRenderer.invoke('delete-local-model', modelPath),
  checkModelDownloaded: () => ipcRenderer.invoke('check-model-downloaded'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },

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
  sendLiveAudioSlice: (buffer) => ipcRenderer.send('live-audio-slice', buffer),

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
  onLiveTranscriptionUpdate: (callback) => {
    ipcRenderer.on('live-dictation-snippet', (event, text) => callback(text));
  },

  // Manual trigger from UI
  toggleRecording: () => ipcRenderer.send('toggle-recording')
});
