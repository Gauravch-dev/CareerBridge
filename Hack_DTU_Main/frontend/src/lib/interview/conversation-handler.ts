import { edgeTTSClient } from './tts-client';
import { whisperSTTClient } from './stt-client';
import { ollamaClient, ChatMessage } from './llm-client';
import {
  CallStatus,
  ConversationMessage,
  ConversationEventCallbacks,
  InterviewData,
} from './types';

/**
 * System prompt designed for natural conversational interviews with follow-ups.
 * The AI should NOT just recite questions — it should have a real conversation.
 */
const SYSTEM_PROMPT_TEMPLATE = `You are a professional job interviewer named Alex. You are conducting a real-time VOICE interview. This is a spoken conversation, not a written one.

INTERVIEW QUESTIONS (use as a guide, NOT a script):
{{questions}}

CRITICAL BEHAVIOR RULES:
1. Start with a brief, warm greeting and the FIRST question only.
2. After each candidate response, react naturally — acknowledge what they said before moving on.
3. Ask follow-up questions when the candidate gives vague or interesting answers. Dig deeper.
4. Do NOT ask multiple questions at once. ONE question at a time.
5. Do NOT list all questions upfront. Work through them conversationally.
6. Keep each response to 2-3 sentences maximum — this is a voice conversation.
7. Move to the next prepared question only when the current topic is sufficiently explored.
8. End the interview naturally after covering the key topics.

RESPONSE FORMAT RULES:
- Never use markdown, bullet points, or numbered lists.
- Never include stage directions like (pauses) or [smiles].
- Never use asterisks or formatting.
- Speak exactly as you would in a real voice conversation.
- Keep responses SHORT — under 40 words ideally.`;

const LANG_PROMPT: Record<string, string> = {
  hi: `\n\nLANGUAGE RULE: Conduct this ENTIRE interview in Hindi (Hinglish is perfectly fine). Greet in Hindi. Ask questions in Hindi. React in Hindi. Technical terms like React, API, SQL, etc. can stay in English — that is natural. Do NOT respond in English.`,
  mr: `\n\nLANGUAGE RULE: Conduct this ENTIRE interview in Marathi. Greet in Marathi. Ask questions in Marathi. React in Marathi. Technical terms like React, API, SQL, etc. can stay in English — that is natural. Do NOT respond in English.`,
};

const VOICE_MAP: Record<string, string> = {
  en: 'en-IN-NeerjaExpressiveNeural',
  hi: 'hi-IN-SwaraNeural',
  mr: 'mr-IN-AarohiNeural',
};

type EventName = 'call-start' | 'call-end' | 'message' | 'speech-start' | 'speech-end' | 'error' | 'end-request';

export class ConversationHandler {
  private status: CallStatus = CallStatus.INACTIVE;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private callbacks: ConversationEventCallbacks & { onEndRequest?: () => void } = {};
  private isProcessing = false;
  private currentAudioElement: HTMLAudioElement | null = null;
  // Raw PCM recording (bypasses webm codec issues)
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private isRecording = false;
  private aborted = false;
  private language = 'en';

  async start(config: InterviewData): Promise<void> {
    if (this.status !== CallStatus.INACTIVE) return;

    this.aborted = false;
    this.status = CallStatus.CONNECTING;

    try {
      const [ttsOk, sttOk, llmOk] = await Promise.all([
        edgeTTSClient.testConnection(),
        whisperSTTClient.testConnection(),
        ollamaClient.testConnection(),
      ]);

      if (!ttsOk) throw new Error('TTS service is not available');
      if (!sttOk) throw new Error('STT service is not available');
      if (!llmOk) throw new Error('LLM service is not available');

      // Find a real hardware microphone, skip virtual ones like Camo
      this.mediaStream = await this.getPreferredMicStream();

      // Use browser's native sample rate — forcing 16kHz causes silent recordings
      this.audioContext = new AudioContext();

      // Store language for TTS voice selection and STT
      this.language = config.language || 'en';

      // Build system prompt with questions as guide + language instruction
      const questionsFormatted = config.questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join('\n');
      const langSuffix = LANG_PROMPT[this.language] || '';
      const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{{questions}}', questionsFormatted) + langSuffix;

      this.conversationHistory = [
        { role: 'system', content: systemPrompt },
      ];

      this.status = CallStatus.ACTIVE;
      this.emit('call-start');

      // Generate greeting — LLM will say a short hello + first question
      await this.generateAndSpeak();
    } catch (error) {
      this.status = CallStatus.INACTIVE;
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  stop(): void {
    // Set abort flag first — this stops any in-flight generateAndSpeak/playback
    this.aborted = true;
    this.isRecording = false;

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.stopCurrentAudio();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isProcessing = false;
    this.pcmChunks = [];
    this.conversationHistory = [];
    this.status = CallStatus.FINISHED;
    this.emit('call-end');
  }

  /**
   * Full reset — clears all state so this handler can be reused for a fresh interview,
   * or call this before discarding the instance to ensure no leaks.
   */
  reset(): void {
    this.stop();
    this.aborted = false;
    this.language = 'en';
    this.callbacks = {};
    this.status = CallStatus.INACTIVE;
  }

  async startManualRecording(): Promise<void> {
    if (this.status !== CallStatus.ACTIVE || !this.mediaStream || this.isProcessing) return;

    this.stopCurrentAudio();

    // Create a FRESH AudioContext for recording — avoids suspended state issues
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = new AudioContext();

    // Ensure AudioContext is running (Chrome suspends it without user gesture)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Verify mic stream is active
    const audioTrack = this.mediaStream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled || audioTrack.readyState !== 'live') {
      console.error('[Interview] Mic track is not active:', audioTrack?.readyState, audioTrack?.enabled);
      return;
    }

    this.pcmChunks = [];
    this.isRecording = true;

    this.micSource = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      if (!this.isRecording) return;
      const inputData = event.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(inputData));
    };

    this.micSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);

    console.log('[Interview] Recording started. AudioContext state:', this.audioContext.state,
      'SampleRate:', this.audioContext.sampleRate,
      'Mic track:', audioTrack.label, audioTrack.readyState);
  }

  async stopManualRecording(): Promise<void> {
    if (!this.isRecording) {
      console.log('[Interview] Not recording');
      return;
    }

    this.isRecording = false;

    // Disconnect nodes
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (this.pcmChunks.length === 0) {
      console.log('[Interview] No audio captured');
      return;
    }

    // Build WAV from raw PCM samples
    const sampleRate = this.audioContext?.sampleRate || 48000;
    const totalSamples = this.pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const duration = totalSamples / sampleRate;
    console.log(`[Interview] Recording stopped. Samples: ${totalSamples}, Duration: ${duration.toFixed(1)}s, SampleRate: ${sampleRate}`);

    if (duration < 0.5) {
      console.log('[Interview] Too short, skipping');
      return;
    }

    // Merge all chunks into single Float32Array
    const mergedSamples = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];

    // Check if audio has actual content (not silence)
    let maxAmplitude = 0;
    for (let i = 0; i < mergedSamples.length; i++) {
      const abs = Math.abs(mergedSamples[i]);
      if (abs > maxAmplitude) maxAmplitude = abs;
    }
    console.log(`[Interview] Max amplitude: ${maxAmplitude.toFixed(4)}`);

    if (maxAmplitude < 0.01) {
      console.log('[Interview] Audio is silence, skipping');
      return;
    }

    // Create WAV blob
    const wavBlob = this.pcmToWav(mergedSamples, sampleRate);
    console.log(`[Interview] WAV size: ${wavBlob.size} bytes`);

    if (this.aborted) return;

    this.isProcessing = true;

    try {
      console.log('[Interview] Sending WAV to STT...');
      const transcription = await whisperSTTClient.transcribe(wavBlob, this.language);
      if (this.aborted) { this.isProcessing = false; return; }
      const userText = transcription.text.trim();
      console.log(`[Interview] STT result: "${userText}"`);

      if (!userText) {
        console.log('[Interview] Empty transcription, skipping');
        this.isProcessing = false;
        return;
      }

      // 3. Check if user wants to end the interview
      if (this.isEndRequest(userText)) {
        console.log('[Interview] User requested to end interview');
        this.conversationHistory.push({
          role: 'user',
          content: userText,
          timestamp: new Date().toISOString(),
        });
        this.emit('message', { role: 'user', content: userText });
        // Emit a special end-request event so the UI can trigger feedback
        this.emit('end-request');
        this.isProcessing = false;
        return;
      }

      // 4. Add user message
      this.conversationHistory.push({
        role: 'user',
        content: userText,
        timestamp: new Date().toISOString(),
      });
      this.emit('message', { role: 'user', content: userText });

      // 5. Generate AI response and speak it
      console.log('[Interview] Generating AI response...');
      await this.generateAndSpeak();
      console.log('[Interview] AI response complete');
    } catch (error) {
      console.error('[Interview] Pipeline error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isProcessing = false;
    }
  }

  on(event: EventName, callback: (...args: unknown[]) => void): void {
    switch (event) {
      case 'call-start': this.callbacks.onCallStart = callback as () => void; break;
      case 'call-end': this.callbacks.onCallEnd = callback as () => void; break;
      case 'message': this.callbacks.onMessage = callback as (msg: { role: string; content: string }) => void; break;
      case 'speech-start': this.callbacks.onSpeechStart = callback as () => void; break;
      case 'speech-end': this.callbacks.onSpeechEnd = callback as () => void; break;
      case 'error': this.callbacks.onError = callback as (error: Error) => void; break;
      case 'end-request': this.callbacks.onEndRequest = callback as () => void; break;
    }
  }

  off(event: EventName): void {
    switch (event) {
      case 'call-start': this.callbacks.onCallStart = undefined; break;
      case 'call-end': this.callbacks.onCallEnd = undefined; break;
      case 'message': this.callbacks.onMessage = undefined; break;
      case 'speech-start': this.callbacks.onSpeechStart = undefined; break;
      case 'speech-end': this.callbacks.onSpeechEnd = undefined; break;
      case 'error': this.callbacks.onError = undefined; break;
      case 'end-request': this.callbacks.onEndRequest = undefined; break;
    }
  }

  getConversationHistory(): ConversationMessage[] {
    return this.conversationHistory.filter((msg) => msg.role !== 'system');
  }

  getStatus(): CallStatus {
    return this.status;
  }

  getLanguage(): string {
    return this.language;
  }

  // ---------------------------------------------------------------------------
  // Core pipeline
  // ---------------------------------------------------------------------------

  private emit(event: EventName, data?: unknown): void {
    switch (event) {
      case 'call-start': this.callbacks.onCallStart?.(); break;
      case 'call-end': this.callbacks.onCallEnd?.(); break;
      case 'message': this.callbacks.onMessage?.(data as { role: string; content: string }); break;
      case 'speech-start': this.callbacks.onSpeechStart?.(); break;
      case 'speech-end': this.callbacks.onSpeechEnd?.(); break;
      case 'error': this.callbacks.onError?.(data as Error); break;
      case 'end-request': this.callbacks.onEndRequest?.(); break;
    }
  }

  /**
   * Get LLM response (non-streaming for correct ordering),
   * then synthesize ALL sentences in parallel for speed,
   * then play them in order.
   *
   * Why non-streaming: streaming causes race conditions between sentence
   * synthesis and playback ordering. The total time is similar because
   * we parallelize TTS synthesis.
   *
   * Pipeline timing:
   *   LLM: ~3-8s (one shot, model is warm)
   *   TTS: ~1-2s per sentence (done in parallel = ~2s total for all)
   *   Playback: sequential, can't be parallelized
   *   Total wait before first audio: ~5-10s
   */
  private async generateAndSpeak(): Promise<void> {
    if (this.aborted) return;

    const messages: ChatMessage[] = this.conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let fullResponse = '';

    // Step 1: Get complete LLM response
    try {
      fullResponse = await ollamaClient.generateResponse(messages);
    } catch (error) {
      if (this.aborted) return;
      console.error('LLM failed:', error);
      this.emit('error', new Error('AI interviewer failed to respond. Please try again.'));
      return;
    }

    if (this.aborted) return;

    const cleaned = this.filterResponse(fullResponse.trim());
    if (!cleaned) return;

    // Add to history + emit immediately (so transcript shows while TTS runs)
    this.conversationHistory.push({
      role: 'assistant',
      content: cleaned,
      timestamp: new Date().toISOString(),
    });
    this.emit('message', { role: 'assistant', content: cleaned });

    if (this.aborted) return;

    // Step 2: Split into sentences and synthesize ALL in parallel
    const sentences = this.splitIntoSentences(cleaned);
    console.log(`[Interview] Synthesizing ${sentences.length} sentences:`, sentences);

    // Fire all TTS requests at once with the correct voice for the language
    const voice = VOICE_MAP[this.language] || VOICE_MAP.en;
    const ttsResults = await Promise.allSettled(
      sentences.map((sentence) => edgeTTSClient.synthesize(sentence, voice))
    );

    if (this.aborted) return;

    const audioChunks: ArrayBuffer[] = [];
    ttsResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        audioChunks.push(result.value);
      } else {
        console.warn(`[Interview] TTS failed for sentence ${i}:`, sentences[i],
          result.status === 'rejected' ? result.reason : 'empty result');
      }
    });

    console.log(`[Interview] Playing ${audioChunks.length} audio chunks`);

    // Step 3: Play all chunks in order (sequential — can't overlap audio)
    if (audioChunks.length > 0 && !this.aborted) {
      this.emit('speech-start');
      for (const chunk of audioChunks) {
        if (this.aborted) break;
        await this.playAudioChunk(chunk);
      }
      if (!this.aborted) this.emit('speech-end');
    }
  }

  /**
   * Split text into speakable sentences.
   * Handles abbreviations (Mr., Dr., etc.) and keeps sentences reasonably sized.
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence endings followed by space + capital letter or end of string
    const parts = text.split(/(?<=[.!?])\s+/);
    const sentences: string[] = [];
    let buffer = '';

    for (const part of parts) {
      buffer += (buffer ? ' ' : '') + part;

      // Flush buffer if it ends with sentence punctuation and is long enough
      if (/[.!?]$/.test(buffer) && buffer.length >= 10) {
        sentences.push(buffer);
        buffer = '';
      }
    }

    if (buffer.trim()) {
      sentences.push(buffer.trim());
    }

    return sentences.filter(s => s.length > 0);
  }

  // ---------------------------------------------------------------------------
  // Audio playback
  // ---------------------------------------------------------------------------

  private playAudioChunk(audioData: ArrayBuffer): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = window.URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.currentAudioElement = audio;

        audio.onended = () => {
          window.URL.revokeObjectURL(url);
          this.currentAudioElement = null;
          resolve();
        };

        audio.onerror = () => {
          window.URL.revokeObjectURL(url);
          this.currentAudioElement = null;
          resolve();
        };

        audio.play().catch(() => {
          window.URL.revokeObjectURL(url);
          this.currentAudioElement = null;
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  private stopCurrentAudio(): void {
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Audio conversion
  // ---------------------------------------------------------------------------

  /**
   * Find and return a stream from a real hardware microphone.
   * Skips virtual microphones (Camo, VB-Audio, etc.)
   */
  private async getPreferredMicStream(): Promise<MediaStream> {
    // First request permission so we can enumerate devices with labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tempStream.getTracks().forEach(t => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');

    console.log('[Interview] Available microphones:', mics.map(m => `${m.label} (${m.deviceId.slice(0, 8)})`));

    // Prefer non-virtual mics — skip Camo, VB-Audio, Virtual, etc.
    const virtualKeywords = ['camo', 'virtual', 'vb-audio', 'obs', 'voicemod', 'krisp'];
    const realMic = mics.find(m => {
      const label = m.label.toLowerCase();
      return !virtualKeywords.some(kw => label.includes(kw));
    });

    const selectedMic = realMic || mics[0];
    console.log('[Interview] Selected microphone:', selectedMic?.label || 'default');

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: selectedMic?.deviceId ? { exact: selectedMic.deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  /**
   * Detect if the user is asking to end the interview.
   */
  private isEndRequest(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const endPhrases = [
      'end the interview',
      'stop the interview',
      'i want to end',
      'i want to stop',
      'let\'s end',
      'let\'s stop',
      'that\'s all',
      'i\'m done',
      'we can stop',
      'we can end',
      'finish the interview',
      'conclude the interview',
      'wrap up',
      'wrap it up',
      'no more questions',
      'end interview',
      'stop interview',
    ];
    return endPhrases.some(phrase => lower.includes(phrase));
  }

  /**
   * Convert raw PCM Float32Array samples to a WAV Blob.
   */
  private pcmToWav(samples: Float32Array, sampleRate: number): Blob {
    const length = samples.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);       // PCM
    view.setUint16(22, 1, true);       // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);       // block align
    view.setUint16(34, 16, true);      // bits per sample
    this.writeString(view, 36, 'data');
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private filterResponse(text: string): string {
    let f = text;
    f = f.replace(/\([^)]*\)/g, '');
    f = f.replace(/\[[^\]]*\]/g, '');
    f = f.replace(/\{[^}]*\}/g, '');
    f = f.replace(/\*\*(.*?)\*\*/g, '$1');
    f = f.replace(/__(.*?)__/g, '$1');
    f = f.replace(/\*(.*?)\*/g, '$1');
    f = f.replace(/_(.*?)_/g, '$1');
    f = f.replace(/^[\s]*[-*+]\s+/gm, '');
    f = f.replace(/\s+/g, ' ').trim();
    // Remove leading/trailing quotes that LLMs sometimes add
    f = f.replace(/^["']|["']$/g, '');
    return f;
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}
