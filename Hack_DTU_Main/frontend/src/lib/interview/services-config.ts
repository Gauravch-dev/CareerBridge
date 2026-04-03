const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const SERVICES_CONFIG = {
  EDGE_TTS: {
    URL: import.meta.env.VITE_EDGE_TTS_URL || 'http://localhost:5100',
  },
  WHISPER_STT: {
    URL: import.meta.env.VITE_WHISPER_STT_URL || 'http://localhost:5200',
  },
  OLLAMA: {
    URL: `${API_URL}/api/ollama-proxy`,
    MODEL: 'gemma3:4b',
  },
} as const;

export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  CHUNK_SIZE: 1024,
  MIME_TYPE: 'audio/wav',
} as const;
