// Audio recording functionality with real-time streaming speech recognition
let mediaRecorder = null;
let audioChunks = [];
let sliceChunks = [];
let audioStream = null;
let waveformAudioCtx = null;
let waveformInterval = null;
let sliceInterval = null;
let isSpeakingDetected = false;

async function startRecording() {
  try {
    audioChunks = [];
    sliceChunks = [];
    isSpeakingDetected = false;
    
    // Get selected microphone from settings
    const micSelect = document.getElementById('microphone');
    const selectedDeviceId = micSelect ? micSelect.value : 'default';
    
    // Request microphone access
    const constraints = {
      audio: selectedDeviceId === 'default' ? {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1
      } : {
        deviceId: { exact: selectedDeviceId },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1
      }
    };
    
    audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Prefer webm with opus
    let mimeType = '';
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ];
    
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: mimeType || undefined
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
        sliceChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        if (sliceInterval) {
          clearInterval(sliceInterval);
          sliceInterval = null;
        }

        const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = Array.from(new Uint8Array(arrayBuffer));
        
        // Send final complete audio buffer
        window.electronAPI.sendAudioData(buffer);
        
        if (audioStream) {
          audioStream.getTracks().forEach(track => track.stop());
          audioStream = null;
        }
      } catch (error) {
        console.error('Error stopping audio recording:', error);
        window.electronAPI.sendAudioError(error.message);
      }
    };

    // Emit data every 100ms
    mediaRecorder.start(100);

    // Live waveform & Voice Activity Detector (VAD)
    try {
      waveformAudioCtx = new AudioContext();
      const source = waveformAudioCtx.createMediaStreamSource(audioStream);
      const analyser = waveformAudioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      waveformInterval = setInterval(() => {
        analyser.getByteTimeDomainData(dataArray);

        // Calculate average deviation to detect if user is speaking
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += Math.abs(dataArray[i] - 128);
        }
        const avg = sum / dataArray.length;
        if (avg > 3.0) {
          isSpeakingDetected = true;
        }

        window.electronAPI.sendWaveformData(Array.from(dataArray));
      }, 33); // ~30fps
    } catch (err) {
      console.warn('Waveform analyser setup failed:', err);
    }

    // Live Streaming Speech Slice Emitter
    // Every ~1.2s, if user spoke, package sliceChunks and emit for real-time transcription
    sliceInterval = setInterval(async () => {
      if (mediaRecorder && mediaRecorder.state === 'recording' && audioChunks.length >= 8 && isSpeakingDetected) {
        try {
          isSpeakingDetected = false;
          const sliceBlob = new Blob(audioChunks.slice(), { type: mimeType || 'audio/webm' });
          const arrayBuffer = await sliceBlob.arrayBuffer();
          const buffer = Array.from(new Uint8Array(arrayBuffer));
          
          if (buffer.length > 3000) {
            window.electronAPI.sendLiveAudioSlice(buffer);
          }
        } catch (err) {
          console.warn('Live slice emission error:', err);
        }
      }
    }, 1200);

  } catch (error) {
    console.error('Recording initialization error:', error);
    window.electronAPI.sendAudioError(error.message);
  }
}

function stopRecording() {
  if (sliceInterval) {
    clearInterval(sliceInterval);
    sliceInterval = null;
  }
  if (waveformInterval) {
    clearInterval(waveformInterval);
    waveformInterval = null;
  }
  if (waveformAudioCtx) {
    waveformAudioCtx.close().catch(() => {});
    waveformAudioCtx = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// Listen for IPC messages
if (window.electronAPI) {
  window.electronAPI.onStartRecording(startRecording);
  window.electronAPI.onStopRecording(stopRecording);
}
