import { SERVICES_CONFIG } from './services-config';

const { URL } = SERVICES_CONFIG.WHISPER_STT;

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration?: number;
}

class WhisperSTTClient {
  /**
   * Transcribe an audio blob to text using Whisper.
   * Sends the audio as multipart form data.
   */
  async transcribe(audioBlob: Blob, language = 'en'): Promise<TranscriptionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('language', language);

      const response = await fetch(`${URL}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`STT transcription failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.text || '',
        confidence: data.confidence,
        duration: data.duration,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if the Whisper STT server is reachable.
   */
  async testConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${URL}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const whisperSTTClient = new WhisperSTTClient();
