const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Config = require('./config');
const Logger = require('./logger');
const LocalTranscriptionService = require('./localTranscription');

class TranscriptionService {
  constructor() {
    this.localService = new LocalTranscriptionService();
    Logger.log('TranscriptionService initialized with BYOK support');
  }

  /**
   * Main transcribe entrypoint - routes to local or cloud BYOK
   * @param {string} audioFilePath - Path to the audio file
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribe(audioFilePath) {
    const transcriptionMode = Config.getTranscriptionMode();
    Logger.log(`Transcription mode: ${transcriptionMode}`);

    if (transcriptionMode === 'offline') {
      return await this.transcribeOffline(audioFilePath);
    } else {
      return await this.transcribeCloudBYOK(audioFilePath);
    }
  }

  /**
   * Transcribe audio file using local Whisper model (offline mode)
   * @param {string} audioFilePath - Path to the audio file
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeOffline(audioFilePath) {
    Logger.log('Using local offline transcription...');
    return await this.localService.transcribe(audioFilePath);
  }

  /**
   * Transcribe audio file using Cloud BYOK (OpenAI, Groq, or Custom Endpoint)
   * @param {string} audioFilePath - Path to the audio file
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeCloudBYOK(audioFilePath) {
    const provider = Config.getCloudProvider();
    Logger.log(`Using Cloud BYOK with provider: ${provider}`);

    let apiUrl = '';
    let apiKey = '';
    let modelName = '';
    let providerDisplayName = '';

    if (provider === 'groq') {
      providerDisplayName = 'Groq Whisper';
      apiUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';
      apiKey = Config.getGroqApiKey();
      modelName = Config.getGroqModel() || 'whisper-large-v3-turbo';

      if (!apiKey) {
        Logger.error('Groq API key missing');
        throw new Error('Groq API key not configured. Please enter your Groq API key in Settings.');
      }
    } else if (provider === 'custom') {
      providerDisplayName = 'Custom OpenAI-Compatible API';
      apiUrl = Config.getCustomEndpoint() || 'http://localhost:8000/v1/audio/transcriptions';
      apiKey = Config.getCustomApiKey();
      modelName = Config.getCustomModel() || 'whisper-1';

      if (!apiUrl) {
        Logger.error('Custom endpoint URL missing');
        throw new Error('Custom API endpoint URL not configured. Please set the endpoint URL in Settings.');
      }
    } else {
      // Default to OpenAI
      providerDisplayName = 'OpenAI Whisper';
      apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
      apiKey = Config.getOpenAIApiKey() || Config.getApiKey();
      modelName = Config.getOpenAIModel() || 'whisper-1';

      if (!apiKey) {
        Logger.error('OpenAI API key missing');
        throw new Error('OpenAI API key not configured. Please enter your OpenAI API key in Settings.');
      }
    }

    if (!fs.existsSync(audioFilePath)) {
      Logger.error('Audio file not found:', audioFilePath);
      throw new Error('Audio file not found');
    }

    const stats = fs.statSync(audioFilePath);
    Logger.log(`Audio file: ${path.basename(audioFilePath)}, Size: ${(stats.size / 1024).toFixed(2)} KB`);
    Logger.log(`Target: ${providerDisplayName} (${modelName}) at ${apiUrl}`);

    try {
      const formData = new FormData();
      const fileExtension = path.extname(audioFilePath).toLowerCase();
      const mimeType = fileExtension === '.wav' ? 'audio/wav' :
                       fileExtension === '.webm' ? 'audio/webm' :
                       fileExtension === '.mp3' ? 'audio/mpeg' :
                       fileExtension === '.m4a' ? 'audio/m4a' :
                       fileExtension === '.ogg' ? 'audio/ogg' :
                       'audio/webm';

      formData.append('file', fs.createReadStream(audioFilePath), {
        filename: path.basename(audioFilePath),
        contentType: mimeType
      });
      formData.append('model', modelName);
      formData.append('response_format', 'json');

      const headers = {
        ...formData.getHeaders()
      };

      if (apiKey && apiKey.trim().length > 0) {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      Logger.log(`Sending request to ${providerDisplayName}...`);
      const response = await axios.post(apiUrl, formData, {
        headers,
        timeout: 35000 // 35 second timeout
      });

      Logger.success(`Received response from ${providerDisplayName}`);

      let transcribedText = '';
      if (typeof response.data === 'string') {
        try {
          const parsed = JSON.parse(response.data);
          transcribedText = parsed.text || response.data;
        } catch (e) {
          transcribedText = response.data;
        }
      } else if (response.data && typeof response.data === 'object') {
        transcribedText = response.data.text || response.data.transcription || JSON.stringify(response.data);
      }

      transcribedText = String(transcribedText || '').trim();
      Logger.transcription('ACTUAL TRANSCRIPTION TEXT:', `"${transcribedText}"`);

      // Clean up temp audio file
      try {
        fs.unlinkSync(audioFilePath);
        Logger.log('Temp audio file deleted');
      } catch (e) {
        Logger.warn('Error deleting temp audio file:', e.message);
      }

      return transcribedText;
    } catch (error) {
      // Clean up audio file on error
      try {
        if (fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
        }
      } catch (cleanupError) {
        console.error('Error deleting temp audio file:', cleanupError);
      }

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        const msg = data?.error?.message || data?.error || (typeof data === 'string' ? data : error.message);

        if (status === 401) {
          throw new Error(`[${providerDisplayName}] Invalid API key. Please check your ${providerDisplayName} key in Settings.`);
        } else if (status === 429) {
          throw new Error(`[${providerDisplayName}] Rate limit or quota exceeded. Please try again later or check billing.`);
        } else if (status === 400) {
          throw new Error(`[${providerDisplayName}] Audio could not be processed: ${msg}`);
        } else if (status === 404) {
          throw new Error(`[${providerDisplayName}] Model '${modelName}' or endpoint not found (${apiUrl}).`);
        } else if (status >= 500) {
          throw new Error(`[${providerDisplayName}] Server error (${status}). Please try again shortly.`);
        } else {
          throw new Error(`[${providerDisplayName}] Error ${status}: ${msg}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error(`[${providerDisplayName}] Request timed out. Check your internet connection and try again.`);
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error(`Could not connect to ${apiUrl}. Check network connection or endpoint URL.`);
      } else {
        throw new Error(`Transcription failed: ${error.message}`);
      }
    }
  }

  // Legacy method
  async transcribeOnline(audioFilePath) {
    return await this.transcribeCloudBYOK(audioFilePath);
  }

  async transcribeBuffer(audioBuffer) {
    const os = require('os');
    const tempDir = path.join(os.tmpdir(), 'ezspeak');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.wav`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    return await this.transcribe(tempFilePath);
  }
}

module.exports = TranscriptionService;
