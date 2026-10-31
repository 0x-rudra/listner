const Store = require('electron-store');
const os = require('os');

const HISTORY_MAX = 50;

const store = new Store({
  name: 'ezspeak-config',
  defaults: {
    // Mode: 'cloud' (formerly 'online') or 'offline'
    transcriptionMode: 'cloud',
    
    // Cloud BYOK provider: 'openai', 'groq', or 'custom'
    cloudProvider: 'openai',

    // OpenAI settings
    openaiApiKey: '',
    openaiModel: 'whisper-1',

    // Groq settings (ultra-fast transcription)
    groqApiKey: '',
    groqModel: 'whisper-large-v3-turbo',

    // Custom OpenAI-compatible endpoint
    customEndpoint: 'http://localhost:8000/v1/audio/transcriptions',
    customApiKey: '',
    customModel: 'whisper-1',

    // Legacy fallback apiKey
    apiKey: '',

    // Local Whisper settings
    localModelName: 'base.en',
    localModelPath: '',
    importedModels: [], // array of { id, name, filename, path, sizeMB, importedAt }

    // App & Audio Settings
    mode: 'toggle', // 'toggle' or 'hold'
    microphoneDeviceId: 'default',
    hotkey: 'Ctrl+Space',
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16,
    transcriptionHistory: []
  }
});

class Config {
  // ─── Mode & Provider ───────────────────────────────────────────
  static getTranscriptionMode() {
    const mode = store.get('transcriptionMode', 'cloud');
    // Map legacy 'online' to 'cloud'
    return mode === 'online' ? 'cloud' : mode;
  }

  static setTranscriptionMode(mode) {
    if (mode === 'cloud' || mode === 'offline' || mode === 'online') {
      store.set('transcriptionMode', mode === 'online' ? 'cloud' : mode);
    }
  }

  static getCloudProvider() {
    return store.get('cloudProvider', 'openai');
  }

  static setCloudProvider(provider) {
    if (['openai', 'groq', 'custom'].includes(provider)) {
      store.set('cloudProvider', provider);
    }
  }

  // ─── Cloud BYOK Provider Settings ──────────────────────────────
  static getOpenAIApiKey() {
    return store.get('openaiApiKey', '') || store.get('apiKey', '');
  }

  static setOpenAIApiKey(key) {
    store.set('openaiApiKey', key);
    store.set('apiKey', key); // Sync legacy key
  }

  static getOpenAIModel() {
    return store.get('openaiModel', 'whisper-1');
  }

  static setOpenAIModel(model) {
    store.set('openaiModel', model);
  }

  static getGroqApiKey() {
    return store.get('groqApiKey', '');
  }

  static setGroqApiKey(key) {
    store.set('groqApiKey', key);
  }

  static getGroqModel() {
    return store.get('groqModel', 'whisper-large-v3-turbo');
  }

  static setGroqModel(model) {
    store.set('groqModel', model);
  }

  static getCustomEndpoint() {
    return store.get('customEndpoint', 'http://localhost:8000/v1/audio/transcriptions');
  }

  static setCustomEndpoint(endpoint) {
    store.set('customEndpoint', endpoint);
  }

  static getCustomApiKey() {
    return store.get('customApiKey', '');
  }

  static setCustomApiKey(key) {
    store.set('customApiKey', key);
  }

  static getCustomModel() {
    return store.get('customModel', 'whisper-1');
  }

  static setCustomModel(model) {
    store.set('customModel', model);
  }

  // Legacy API key helper
  static getApiKey() {
    const provider = this.getCloudProvider();
    if (provider === 'groq') return this.getGroqApiKey();
    if (provider === 'custom') return this.getCustomApiKey();
    return this.getOpenAIApiKey();
  }

  static setApiKey(apiKey) {
    const provider = this.getCloudProvider();
    if (provider === 'groq') this.setGroqApiKey(apiKey);
    else if (provider === 'custom') this.setCustomApiKey(apiKey);
    else this.setOpenAIApiKey(apiKey);
  }

  static getAllProviderSettings() {
    return {
      transcriptionMode: this.getTranscriptionMode(),
      cloudProvider: this.getCloudProvider(),
      openai: {
        apiKey: this.getOpenAIApiKey(),
        model: this.getOpenAIModel()
      },
      groq: {
        apiKey: this.getGroqApiKey(),
        model: this.getGroqModel()
      },
      custom: {
        endpoint: this.getCustomEndpoint(),
        apiKey: this.getCustomApiKey(),
        model: this.getCustomModel()
      },
      local: {
        modelName: this.getLocalModelName(),
        modelPath: this.getLocalModelPath(),
        importedModels: this.getImportedModels()
      }
    };
  }

  // ─── Local Model Settings ──────────────────────────────────────
  static getLocalModelName() {
    return store.get('localModelName', 'base.en');
  }

  static setLocalModelName(name) {
    store.set('localModelName', name);
  }

  static getLocalModelPath() {
    return store.get('localModelPath', '');
  }

  static setLocalModelPath(path) {
    store.set('localModelPath', path);
  }

  static getImportedModels() {
    return store.get('importedModels', []);
  }

  static addImportedModel(model) {
    const models = this.getImportedModels();
    // Prevent duplicates by path or filename
    const filtered = models.filter(m => m.path !== model.path && m.filename !== model.filename);
    filtered.push(model);
    store.set('importedModels', filtered);
    store.set('localModelName', model.name);
    store.set('localModelPath', model.path);
    return filtered;
  }

  static removeImportedModel(modelPath) {
    const models = this.getImportedModels().filter(m => m.path !== modelPath);
    store.set('importedModels', models);
    if (store.get('localModelPath') === modelPath) {
      store.set('localModelPath', '');
      store.set('localModelName', 'base.en');
    }
    return models;
  }

  // ─── System / General ──────────────────────────────────────────
  static getMode() {
    return store.get('mode', 'toggle');
  }

  static setMode(mode) {
    if (mode === 'toggle' || mode === 'hold') {
      store.set('mode', mode);
    }
  }

  static getMicrophoneDeviceId() {
    return store.get('microphoneDeviceId', 'default');
  }

  static setMicrophoneDeviceId(deviceId) {
    store.set('microphoneDeviceId', deviceId);
  }

  static getHotkey() {
    const hk = store.get('hotkey');
    if (!hk || hk === 'CtrlRight' || hk === 'MetaRight') {
      return 'Ctrl+Space';
    }
    return hk;
  }

  static setHotkey(hotkey) {
    store.set('hotkey', hotkey);
  }

  static getAudioSettings() {
    return {
      sampleRate: store.get('sampleRate', 16000),
      channels: store.get('channels', 1),
      bitDepth: store.get('bitDepth', 16)
    };
  }

  static isConfigured() {
    const mode = this.getTranscriptionMode();
    if (mode === 'offline') {
      return true; // Local model is checked separately
    }
    const provider = this.getCloudProvider();
    if (provider === 'openai') {
      return this.getOpenAIApiKey().length > 0;
    }
    if (provider === 'groq') {
      return this.getGroqApiKey().length > 0;
    }
    if (provider === 'custom') {
      return this.getCustomEndpoint().length > 0;
    }
    return false;
  }

  // ─── Transcription history ───────────────────────────────────────
  static getHistory() {
    return store.get('transcriptionHistory', []);
  }

  static addToHistory(text) {
    const history = this.getHistory();
    const entry = {
      id: Date.now().toString(),
      text: text.trim(),
      timestamp: new Date().toISOString()
    };
    const updated = [entry, ...history].slice(0, HISTORY_MAX);
    store.set('transcriptionHistory', updated);
    return entry;
  }

  static clearHistory() {
    store.set('transcriptionHistory', []);
  }
}

module.exports = Config;
