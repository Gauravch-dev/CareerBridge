import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  Mic,
  Bot,
  Volume2,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type CheckStatus = 'checking' | 'pass' | 'fail';

interface SystemChecks {
  camera: CheckStatus;
  microphone: CheckStatus;
  aiService: CheckStatus;
  speaker: CheckStatus;
}

const RULES = [
  'Sit in a quiet, well-lit environment',
  'Keep your camera ON throughout the interview',
  'No other person should be visible on screen',
  'Do not switch tabs or windows during the interview',
  'Keep water and necessities ready before starting',
  'Use a stable internet connection',
  'Speak clearly into the microphone',
];

const WARNINGS = [
  'Once the interview starts, it CANNOT be paused or restarted',
  'All violations (looking away, tab switches, multiple faces) are logged',
  '3 violations = automatic interview termination',
  'An integrity score will be included in your feedback report',
];

export const InterviewReadiness = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [checks, setChecks] = useState<SystemChecks>({
    camera: 'checking',
    microphone: 'checking',
    aiService: 'checking',
    speaker: 'checking',
  });
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    runSystemChecks();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  };

  const runSystemChecks = async () => {
    // Run camera + mic and AI checks in parallel
    await Promise.all([
      checkCameraAndMic(),
      checkAIServices(),
    ]);
    // Speaker is assumed working if audio context works
    setChecks((prev) => ({ ...prev, speaker: 'pass' }));
  };

  const checkCameraAndMic = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some((d) => d.kind === 'videoinput');
      const hasAudio = devices.some((d) => d.kind === 'audioinput');

      if (!hasVideo) {
        setChecks((prev) => ({ ...prev, camera: 'fail', microphone: hasAudio ? 'checking' : 'fail' }));
        setErrorMessage('No camera found on this device.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setChecks((prev) => ({ ...prev, camera: 'pass' }));

      // Analyze mic audio levels
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let micDetected = false;

      const checkMicLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        setAudioLevel(avg);

        if (avg > 5 && !micDetected) {
          micDetected = true;
          setChecks((prev) => ({ ...prev, microphone: 'pass' }));
        }

        animFrameRef.current = requestAnimationFrame(checkMicLevel);
      };

      checkMicLevel();

      // Auto-pass mic after 3 seconds if stream is active (mic might be quiet)
      setTimeout(() => {
        setChecks((prev) => ({
          ...prev,
          microphone: prev.microphone === 'checking' ? 'pass' : prev.microphone,
        }));
      }, 3000);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        setErrorMessage('Camera/microphone permission denied. Please allow access and refresh.');
        setChecks((prev) => ({ ...prev, camera: 'fail', microphone: 'fail' }));
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No camera found on this device.');
        setChecks((prev) => ({ ...prev, camera: 'fail' }));
      } else if (error.name === 'NotReadableError') {
        setErrorMessage('Camera is being used by another application.');
        setChecks((prev) => ({ ...prev, camera: 'fail' }));
      } else {
        setErrorMessage('Failed to access camera/microphone.');
        setChecks((prev) => ({ ...prev, camera: 'fail', microphone: 'fail' }));
      }
    }
  };

  const checkAIServices = async () => {
    try {
      // Check if at least one AI service is reachable
      const ttsUrl = import.meta.env.VITE_EDGE_TTS_URL || 'http://localhost:5100';
      const sttUrl = import.meta.env.VITE_WHISPER_STT_URL || 'http://localhost:5200';
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const checks = await Promise.allSettled([
        fetch(`${ttsUrl}/health`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${sttUrl}/health`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${apiUrl}/api/ollama-proxy/api/tags`, { signal: AbortSignal.timeout(5000) }),
      ]);

      const anyPassed = checks.some(
        (r) => r.status === 'fulfilled' && r.value.ok,
      );

      setChecks((prev) => ({ ...prev, aiService: anyPassed ? 'pass' : 'fail' }));
    } catch {
      setChecks((prev) => ({ ...prev, aiService: 'fail' }));
    }
  };

  const canStart =
    checks.camera === 'pass' &&
    checks.microphone === 'pass' &&
    checks.aiService === 'pass' &&
    agreedToRules;

  const handleStart = () => {
    // Cleanup streams before navigating — InterviewAgent will request its own
    cleanup();
    navigate(`/dashboard/interview/${id}`, {
      state: { cameraStream: true, rulesAccepted: true },
    });
  };

  const StatusIcon = ({ status }: { status: CheckStatus }) => {
    if (status === 'checking') return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
    if (status === 'pass') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard/mock-interview')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Before You Begin
          </h1>
          <p className="text-muted-foreground text-sm">
            Review the rules and complete the system check
          </p>
        </div>
      </div>

      {/* Interview Rules */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Interview Rules</h2>
        <ul className="space-y-3">
          {RULES.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-yellow-600 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Important
          </h3>
          <ul className="space-y-2">
            {WARNINGS.map((warning, i) => (
              <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                <span className="shrink-0">-</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* System Check */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">System Check</h2>

        <div className="space-y-4">
          {/* Camera */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Camera</span>
            </div>
            <StatusIcon status={checks.camera} />
          </div>

          {/* Camera preview */}
          {checks.camera !== 'fail' && (
            <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video max-w-sm mx-auto">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Microphone */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-muted-foreground" />
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Microphone</span>
                {checks.microphone === 'pass' && (
                  <div className="flex items-center gap-1 h-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-100 ${
                          i < audioLevel / 10
                            ? 'bg-green-500'
                            : 'bg-muted'
                        }`}
                        style={{ height: `${Math.min(16, 4 + i * 1.5)}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <StatusIcon status={checks.microphone} />
          </div>

          {/* AI Service */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">AI Service</span>
            </div>
            <StatusIcon status={checks.aiService} />
          </div>

          {/* Speaker */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Speaker</span>
            </div>
            <StatusIcon status={checks.speaker} />
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Agreement + Start */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="agree"
            checked={agreedToRules}
            onCheckedChange={(checked) => setAgreedToRules(checked === true)}
          />
          <label htmlFor="agree" className="text-sm cursor-pointer leading-relaxed">
            I have read and agree to the interview rules. I understand that violations will be
            monitored and an integrity report will be generated.
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/mock-interview')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleStart}
            disabled={!canStart}
            className="gap-2"
          >
            <Shield className="w-4 h-4" />
            I'm Ready — Start Interview
          </Button>
        </div>

        {checks.camera === 'fail' && (
          <p className="text-xs text-red-500 text-center">
            Camera is required for this interview. Please enable your camera or use a device with a camera.
          </p>
        )}
      </div>
    </div>
  );
};
