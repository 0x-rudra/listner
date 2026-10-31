const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const axios = require('axios');
const Logger = require('./logger');
const Config = require('./config');

const STANDARD_MODELS = [
  { id: 'tiny.en', name: 'tiny.en', filename: 'ggml-tiny.en.bin', sizeApprox: '75 MB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin' },
  { id: 'base.en', name: 'base.en', filename: 'ggml-base.en.bin', sizeApprox: '145 MB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin' },
  { id: 'small.en', name: 'small.en', filename: 'ggml-small.en.bin', sizeApprox: '480 MB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin' },
  { id: 'medium.en', name: 'medium.en', filename: 'ggml-medium.en.bin', sizeApprox: '1.5 GB', url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin' }
];

class LocalTranscriptionService {
  constructor() {
    this.modelPath = null;
    this.ffmpegPath = null;
    Logger.log('LocalTranscriptionService initialized');
  }

  getModelsDir() {
    const { app } = require('electron');
    const modelsDir = path.join(app.getPath('userData'), 'whisper-models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    return modelsDir;
  }

  /**
   * Resolve active local model path
   */
  getActiveModelPath() {
    const configuredPath = Config.getLocalModelPath();
    if (configuredPath && fs.existsSync(configuredPath)) {
      return configuredPath;
    }

    const modelsDir = this.getModelsDir();
    const activeName = Config.getLocalModelName() || 'base.en';

    // Check if filename already in modelsDir
    const expectedFilename = activeName.endsWith('.bin') ? activeName : `ggml-${activeName}.bin`;
    const candidatePath = path.join(modelsDir, expectedFilename);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }

    // Check bundled model
    let bundledDir = '';
    try {
      const { app } = require('electron');
      bundledDir = app && app.isPackaged
        ? path.join(process.resourcesPath, 'whisper-models')
        : path.join(__dirname, '..', 'whisper-models');
    } catch (e) {
      bundledDir = path.join(__dirname, '..', 'whisper-models');
    }

    if (fs.existsSync(path.join(bundledDir, expectedFilename))) {
      return path.join(bundledDir, expectedFilename);
    }

    // Check if any .bin exists in modelsDir
    const allFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.bin'));
    if (allFiles.length > 0) {
      return path.join(modelsDir, allFiles[0]);
    }

    return null;
  }

  /**
   * Get list of all available models (standard + imported custom)
   */
  getLocalModelsList() {
    const modelsDir = this.getModelsDir();
    const activePath = this.getActiveModelPath();
    const filesInDir = fs.readdirSync(modelsDir);

    // Build standard models list
    const result = STANDARD_MODELS.map(m => {
      const filePath = path.join(modelsDir, m.filename);
      const isDownloaded = fs.existsSync(filePath);
      let sizeMB = 0;
      if (isDownloaded) {
        try {
          const stats = fs.statSync(filePath);
          sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        } catch (e) {}
      }

      return {
        id: m.id,
        name: m.name,
        filename: m.filename,
        path: filePath,
        sizeApprox: m.sizeApprox,
        sizeMB: sizeMB ? `${sizeMB} MB` : m.sizeApprox,
        isDownloaded,
        isCustom: false,
        isActive: activePath === filePath
      };
    });

    // Add imported models from Config
    const importedFromConfig = Config.getImportedModels();
    for (const imp of importedFromConfig) {
      const exists = fs.existsSync(imp.path);
      let sizeMB = imp.sizeMB;
      if (exists && !sizeMB) {
        try {
          const stats = fs.statSync(imp.path);
          sizeMB = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
        } catch (e) {}
      }

      // Check not duplicate
      if (!result.some(r => r.path === imp.path)) {
        result.push({
          id: imp.id || imp.filename,
          name: imp.name || imp.filename,
          filename: imp.filename,
          path: imp.path,
          sizeMB: sizeMB || 'Custom',
          isDownloaded: exists,
          isCustom: true,
          isActive: activePath === imp.path
        });
      }
    }

    // Scan any stray .bin files in modelsDir not yet accounted for
    for (const f of filesInDir) {
      if (f.endsWith('.bin')) {
        const fullPath = path.join(modelsDir, f);
        if (!result.some(r => r.filename === f || r.path === fullPath)) {
          let sizeMB = '0 MB';
          try {
            const stats = fs.statSync(fullPath);
            sizeMB = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
          } catch (e) {}

          const cleanName = f.replace(/^ggml-/, '').replace(/\.bin$/, '');
          result.push({
            id: f,
            name: cleanName,
            filename: f,
            path: fullPath,
            sizeMB,
            isDownloaded: true,
            isCustom: true,
            isActive: activePath === fullPath
          });
        }
      }
    }

    return result;
  }

  /**
   * Import a local model (.bin) selected by the user
   * @param {string} sourceFilePath - Path to source model file on user's disk
   */
  async importModel(sourceFilePath) {
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`File does not exist: ${sourceFilePath}`);
    }

    const filename = path.basename(sourceFilePath);
    if (!filename.toLowerCase().endsWith('.bin')) {
      throw new Error('Selected file must be a Whisper GGML .bin model file.');
    }

    const modelsDir = this.getModelsDir();
    const destinationPath = path.join(modelsDir, filename);

    Logger.log(`Importing model from ${sourceFilePath} to ${destinationPath}...`);

    // If source is not already inside modelsDir, copy it
    if (sourceFilePath !== destinationPath) {
      fs.copyFileSync(sourceFilePath, destinationPath);
    }

    const stats = fs.statSync(destinationPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
    const cleanName = filename.replace(/^ggml-/, '').replace(/\.bin$/, '');

    const modelRecord = {
      id: Date.now().toString(),
      name: cleanName,
      filename,
      path: destinationPath,
      sizeMB,
      importedAt: new Date().toISOString()
    };

    Config.addImportedModel(modelRecord);
    Config.setLocalModelName(cleanName);
    Config.setLocalModelPath(destinationPath);
    this.modelPath = destinationPath;

    Logger.success(`Model imported successfully: ${cleanName} (${sizeMB})`);
    return modelRecord;
  }

  /**
   * Set active local model by ID, name, or full path
   */
  setActiveModel(identifier) {
    const models = this.getLocalModelsList();
    const match = models.find(m => m.id === identifier || m.name === identifier || m.path === identifier);

    if (match) {
      Config.setLocalModelName(match.name);
      Config.setLocalModelPath(match.path);
      this.modelPath = match.path;
      Logger.log(`Active local model set to: ${match.name} (${match.path})`);
      return match;
    } else {
      Config.setLocalModelName(identifier);
      Logger.log(`Active local model name set to: ${identifier}`);
      return null;
    }
  }

  /**
   * Download a standard model directly from HuggingFace with progress callback
   */
  async downloadModel(modelName = 'base.en', onProgress = null) {
    const cleanName = modelName.replace(/^ggml-/, '').replace(/\.bin$/, '');
    const standardDef = STANDARD_MODELS.find(m => m.id === cleanName || m.name === cleanName) || {
      name: cleanName,
      filename: `ggml-${cleanName}.bin`,
      url: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${cleanName}.bin`
    };

    const modelsDir = this.getModelsDir();
    const targetPath = path.join(modelsDir, standardDef.filename);
    const tempPath = `${targetPath}.tmp`;

    Logger.log(`Downloading model ${cleanName} from ${standardDef.url}...`);

    try {
      const response = await axios({
        method: 'GET',
        url: standardDef.url,
        responseType: 'stream',
        timeout: 600000 // 10 minute timeout
      });

      const totalLength = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedLength = 0;

      const writer = fs.createWriteStream(tempPath);

      response.data.on('data', chunk => {
        downloadedLength += chunk.length;
        if (totalLength > 0 && onProgress) {
          const percent = Math.min(100, Math.round((downloadedLength / totalLength) * 100));
          onProgress({ percent, downloadedMB: (downloadedLength / (1024 * 1024)).toFixed(1), totalMB: (totalLength / (1024 * 1024)).toFixed(1) });
        }
      });

      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Rename temp to target
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      fs.renameSync(tempPath, targetPath);

      // Set as active model
      this.modelPath = targetPath;
      Config.setLocalModelName(cleanName);
      Config.setLocalModelPath(targetPath);

      Logger.success(`Model ${cleanName} downloaded successfully!`);
      return { success: true, path: targetPath, name: cleanName };
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
      Logger.error(`Error downloading model ${cleanName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an installed local model
   */
  deleteModel(modelPath) {
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
    }
    Config.removeImportedModel(modelPath);
    Logger.log(`Deleted model at: ${modelPath}`);
    return true;
  }

  isModelDownloaded() {
    const activePath = this.getActiveModelPath();
    return Boolean(activePath && fs.existsSync(activePath));
  }

  async initialize() {
    this.modelPath = this.getActiveModelPath();
    if (!this.modelPath) {
      throw new Error('No local Whisper model found. Please download or import a model in Settings.');
    }
    return true;
  }

  async getFfmpegPath() {
    if (this.ffmpegPath && fs.existsSync(this.ffmpegPath)) {
      return this.ffmpegPath;
    }

    let ffmpegPath = require('ffmpeg-static');
    if (!ffmpegPath) {
      throw new Error('ffmpeg-static not found.');
    }

    if (ffmpegPath.includes('app.asar')) {
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      const ffmpegDir = path.join(userDataPath, 'ffmpeg');
      const extractedPath = path.join(ffmpegDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');

      if (!fs.existsSync(ffmpegDir)) {
        fs.mkdirSync(ffmpegDir, { recursive: true });
      }

      if (!fs.existsSync(extractedPath)) {
        const ffmpegBuffer = fs.readFileSync(ffmpegPath);
        fs.writeFileSync(extractedPath, ffmpegBuffer);
        if (process.platform !== 'win32') {
          fs.chmodSync(extractedPath, 0o755);
        }
      }

      this.ffmpegPath = extractedPath;
      return extractedPath;
    } else {
      this.ffmpegPath = ffmpegPath;
      return ffmpegPath;
    }
  }

  async convertToWav(audioFilePath) {
    const ext = path.extname(audioFilePath).toLowerCase();
    if (ext === '.wav') {
      return audioFilePath;
    }

    const ffmpegPath = await this.getFfmpegPath();
    const wavPath = audioFilePath.replace(/\.[^.]+$/, '.wav');
    const args = [
      '-nostats',
      '-loglevel', 'error',
      '-y',
      '-i', audioFilePath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      wavPath
    ];

    Logger.log('Converting to WAV (16kHz mono):', wavPath);
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg conversion failed: ${stderr}`));
      });
      proc.on('error', reject);
    });

    return wavPath;
  }

  async ensureWhisperBinary() {
    let binaryDir;
    try {
      const { app } = require('electron');
      if (app && app.isPackaged) {
        binaryDir = path.join(process.resourcesPath, 'whisper-bin');
      } else {
        binaryDir = path.join(__dirname, '..', 'whisper-bin');
      }
    } catch (e) {
      binaryDir = path.join(__dirname, '..', 'whisper-bin');
    }

    // Platform-specific search
    if (process.platform === 'win32') {
      for (const name of ['whisper-cli.exe', 'main.exe']) {
        const p = path.join(binaryDir, name);
        if (fs.existsSync(p)) return p;
      }
    } else if (process.platform === 'darwin') {
      for (const name of ['whisper-cli', 'main']) {
        const p = path.join(binaryDir, name);
        if (fs.existsSync(p)) return p;
      }
    } else {
      // Linux: check whisper-bin/linux/whisper-cli, whisper-bin/whisper-cli, or system PATH
      const linuxCandidates = [
        path.join(binaryDir, 'linux', 'whisper-cli'),
        path.join(binaryDir, 'whisper-cli-linux'),
        path.join(binaryDir, 'whisper-cli')
      ];

      for (const p of linuxCandidates) {
        if (fs.existsSync(p)) {
          return p;
        }
      }

      // Check system PATH
      for (const sysCmd of ['whisper-cli', 'whisper-cpp', 'main']) {
        try {
          const res = spawnSync('which', [sysCmd]);
          if (res.status === 0) {
            const out = res.stdout.toString().trim();
            if (out && fs.existsSync(out)) return out;
          }
        } catch (e) {}
      }
    }

    throw new Error('Whisper executable binary not found for your operating system.');
  }

  async transcribe(audioFilePath) {
    try {
      await this.initialize();

      if (!fs.existsSync(audioFilePath)) {
        throw new Error('Audio file not found');
      }

      const activeModel = this.getActiveModelPath();
      if (!activeModel || !fs.existsSync(activeModel)) {
        throw new Error('Local Whisper model not found. Please download or import a model in Settings.');
      }

      const wavPath = await this.convertToWav(audioFilePath);
      const binaryPath = await this.ensureWhisperBinary();
      const binaryDir = path.dirname(binaryPath);

      Logger.log(`Running whisper: ${binaryPath} with model ${activeModel}`);

      const args = [
        '-m', activeModel,
        '-f', wavPath,
        '-l', 'en',
        '-otxt',
        '-np'
      ];

      // Add library path for dynamic libraries
      const env = { ...process.env };
      if (process.platform === 'linux') {
        env.LD_LIBRARY_PATH = `${binaryDir}:${process.env.LD_LIBRARY_PATH || ''}`;
      } else if (process.platform === 'darwin') {
        env.DYLD_LIBRARY_PATH = `${binaryDir}:${process.env.DYLD_LIBRARY_PATH || ''}`;
      }

      const transcribedText = await new Promise((resolve, reject) => {
        const whisperProcess = spawn(binaryPath, args, {
          cwd: binaryDir,
          env
        });

        let stdout = '';
        let stderr = '';

        whisperProcess.stdout.on('data', d => { stdout += d.toString(); });
        whisperProcess.stderr.on('data', d => { stderr += d.toString(); });

        whisperProcess.on('close', code => {
          if (code === 0) {
            const txtFile = `${wavPath}.txt`;
            if (fs.existsSync(txtFile)) {
              try {
                const text = fs.readFileSync(txtFile, 'utf8').trim();
                fs.unlinkSync(txtFile);
                return resolve(text);
              } catch (e) {}
            }
            resolve(stdout.trim());
          } else {
            reject(new Error(`Whisper binary exited with code ${code}: ${stderr || stdout}`));
          }
        });

        whisperProcess.on('error', reject);
      });

      // Cleanup
      try {
        if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
        if (wavPath !== audioFilePath && fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
      } catch (e) {}

      return transcribedText;
    } catch (error) {
      try {
        if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
      } catch (e) {}
      Logger.error('Local transcription failed:', error);
      throw error;
    }
  }

  getModelInfo() {
    return {
      activeModelPath: this.getActiveModelPath(),
      isDownloaded: this.isModelDownloaded(),
      models: this.getLocalModelsList()
    };
  }
}

module.exports = LocalTranscriptionService;
