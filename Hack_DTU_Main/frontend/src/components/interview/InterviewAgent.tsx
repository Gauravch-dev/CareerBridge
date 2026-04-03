import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Mic, MicOff, PhoneOff, Play, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConversationHandler } from '@/lib/interview/conversation-handler';
import { feedbackGenerator } from '@/lib/interview/feedback-generator';
import { CallStatus } from '@/lib/interview/types';
import type { FeedbackData } from '@/lib/interview/types';
import { ProctoringService } from '@/lib/interview/proctor';
import type { ProctorState, ProctoringSummary } from '@/lib/interview/proctor';
import { ProctoringOverlay } from './ProctoringOverlay';

interface InterviewAgentProps {
  userName: string;
  interviewId: string;
  questions: string[];
  language?: string;
  onInterviewEnd: (feedbackData: FeedbackData, conversationHistory?: { role: string; content: string }[], proctoringSummary?: ProctoringSummary) => void;
}

interface InterviewState {
  callStatus: CallStatus;
  messages: { role: string; content: string }[];
  isRecording: boolean;
  isTranscribing: boolean;
  isGenerating: boolean;
  isSpeaking: boolean;
  isGeneratingFeedback: boolean;
  lastMessage: string;
}

type InterviewAction =
  | { type: 'SET_CALL_STATUS'; payload: CallStatus }
  | { type: 'ADD_MESSAGE'; payload: { role: string; content: string } }
  | { type: 'SET_RECORDING'; payload: boolean }
  | { type: 'SET_TRANSCRIBING'; payload: boolean }
  | { type: 'SET_GENERATING'; payload: boolean }
  | { type: 'SET_SPEAKING'; payload: boolean }
  | { type: 'SET_GENERATING_FEEDBACK'; payload: boolean }
  | { type: 'SET_LAST_MESSAGE'; payload: string };

const initialState: InterviewState = {
  callStatus: CallStatus.INACTIVE,
  messages: [],
  isRecording: false,
  isTranscribing: false,
  isGenerating: false,
  isSpeaking: false,
  isGeneratingFeedback: false,
  lastMessage: '',
};

function reducer(state: InterviewState, action: InterviewAction): InterviewState {
  switch (action.type) {
    case 'SET_CALL_STATUS':
      return { ...state, callStatus: action.payload };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        lastMessage: action.payload.content,
      };
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload };
    case 'SET_TRANSCRIBING':
      return { ...state, isTranscribing: action.payload };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload };
    case 'SET_SPEAKING':
      return { ...state, isSpeaking: action.payload };
    case 'SET_GENERATING_FEEDBACK':
      return { ...state, isGeneratingFeedback: action.payload };
    case 'SET_LAST_MESSAGE':
      return { ...state, lastMessage: action.payload };
    default:
      return state;
  }
}

export const InterviewAgent = ({
  userName,
  interviewId,
  questions,
  language = 'en',
  onInterviewEnd,
}: InterviewAgentProps) => {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, initialState);
  const handlerRef = useRef<ConversationHandler | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const spacebarDownRef = useRef(false);
  const proctorRef = useRef<ProctoringService | null>(null);
  const [proctorState, setProctorState] = useState<ProctorState | null>(null);

  // Initialize conversation handler — fresh instance every mount
  useEffect(() => {
    const handler = new ConversationHandler();
    handlerRef.current = handler;
    return () => {
      // Full reset: abort in-flight LLM/TTS/playback, clear history, release streams
      handler.reset();
      handlerRef.current = null;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  // Request camera access and initialize proctoring
  useEffect(() => {
    const initCameraAndProctor = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Initialize proctoring service
        const proctor = new ProctoringService();
        proctorRef.current = proctor;
        const loaded = await proctor.loadModels();
        if (loaded && videoRef.current) {
          proctor.start(
            videoRef.current,
            (newState) => setProctorState(newState),
            () => {
              // Auto-terminate on 3 strikes
              toast.error('Interview terminated due to repeated violations.');
              handleEndInterview();
            },
          );
        }
      } catch {
        // Camera not available, fallback to avatar
      }
    };
    initCameraAndProctor();

    return () => {
      if (proctorRef.current) {
        proctorRef.current.stop();
      }
    };
  }, []);

  // Register event listeners
  useEffect(() => {
    const handler = handlerRef.current;
    if (!handler) return;

    handler.on('call-start', () => {
      dispatch({ type: 'SET_CALL_STATUS', payload: CallStatus.ACTIVE });
    });

    handler.on('call-end', () => {
      dispatch({ type: 'SET_CALL_STATUS', payload: CallStatus.FINISHED });
    });

    handler.on('message', (msg: unknown) => {
      const message = msg as { role: string; content: string };
      dispatch({ type: 'ADD_MESSAGE', payload: message });
    });

    handler.on('speech-start', () => {
      dispatch({ type: 'SET_SPEAKING', payload: true });
    });

    handler.on('speech-end', () => {
      dispatch({ type: 'SET_SPEAKING', payload: false });
    });

    handler.on('error', (err: unknown) => {
      const error = err as Error;
      toast.error(error.message || t('interview.errorOccurred'));
    });

    handler.on('end-request', () => {
      toast.info('Ending interview and generating feedback...');
      handleEndInterview();
    });

    return () => {
      handler.off('call-start');
      handler.off('call-end');
      handler.off('message');
      handler.off('speech-start');
      handler.off('speech-end');
      handler.off('error');
      handler.off('end-request');
    };
  }, [t]);

  // Spacebar hold-to-speak
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spacebarDownRef.current && state.callStatus === CallStatus.ACTIVE) {
        e.preventDefault();
        spacebarDownRef.current = true;
        startRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spacebarDownRef.current) {
        e.preventDefault();
        spacebarDownRef.current = false;
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.callStatus]);

  const startRecording = useCallback(async () => {
    if (!handlerRef.current || isRecordingRef.current) return;
    isRecordingRef.current = true;
    dispatch({ type: 'SET_RECORDING', payload: true });
    await handlerRef.current.startManualRecording();
  }, []);

  const stopRecording = useCallback(async () => {
    if (!handlerRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    dispatch({ type: 'SET_RECORDING', payload: false });
    dispatch({ type: 'SET_TRANSCRIBING', payload: true });

    try {
      await handlerRef.current.stopManualRecording();
    } finally {
      dispatch({ type: 'SET_TRANSCRIBING', payload: false });
    }
  }, []);

  const handleStartInterview = async () => {
    if (!handlerRef.current) return;
    dispatch({ type: 'SET_CALL_STATUS', payload: CallStatus.CONNECTING });

    try {
      await handlerRef.current.start({
        id: interviewId,
        role: '',
        type: '',
        level: '',
        techstack: [],
        questions,
        language,
      });
    } catch (error) {
      dispatch({ type: 'SET_CALL_STATUS', payload: CallStatus.INACTIVE });
      toast.error(
        error instanceof Error ? error.message : t('interview.failedToStart'),
      );
    }
  };

  const handleEndInterview = async () => {
    if (!handlerRef.current) return;

    const transcript = handlerRef.current.getConversationHistory();
    // Full reset: abort all in-flight LLM/TTS/audio, clear conversation history
    handlerRef.current.reset();

    // Stop proctoring and get summary
    const procSummary = proctorRef.current?.getSummary() ?? undefined;
    proctorRef.current?.stop();

    dispatch({ type: 'SET_GENERATING_FEEDBACK', payload: true });

    try {
      console.log('[Interview] Generating feedback from', transcript.length, 'messages');
      const feedbackData = await feedbackGenerator.generateFeedback(transcript, language);
      console.log('[Interview] Feedback generated:', feedbackData.totalScore);
      onInterviewEnd(feedbackData, transcript, procSummary);
    } catch (error) {
      console.error('[Interview] Feedback generation error:', error);
      toast.error(
        error instanceof Error ? error.message : t('interview.feedbackFailed'),
      );
      onInterviewEnd({
        totalScore: 'Cannot be determined',
        categoryScores: [],
        strengths: [],
        areasForImprovement: [],
        finalAssessment: 'Feedback generation failed. Please try again.',
      }, transcript, procSummary);
    }
  };

  const getStatusText = () => {
    if (state.isRecording) return t('interview.statusRecording');
    if (state.isTranscribing) return t('interview.statusTranscribing');
    if (state.isSpeaking) return t('interview.statusSpeaking');
    if (state.isGeneratingFeedback) return t('interview.statusGeneratingFeedback');
    if (state.callStatus === CallStatus.CONNECTING) return t('interview.statusConnecting');
    if (state.callStatus === CallStatus.ACTIVE) return t('interview.statusReady');
    return '';
  };

  const getStatusIndicator = () => {
    if (state.isRecording) return 'bg-red-500';
    if (state.isTranscribing) return 'bg-blue-500';
    if (state.isSpeaking) return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <h2 className="text-lg font-semibold">{t('interview.title')}</h2>
          <Badge variant="secondary" className="bg-slate-700 text-slate-200">
            {state.callStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <User className="w-4 h-4" />
          <span>{userName}</span>
        </div>
      </div>

      {/* Main interview area */}
      <div className="flex-1 flex items-center justify-center gap-8 p-8">
        {/* User side */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-72 h-52 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Fallback avatar if no camera */}
            {!cameraStreamRef.current && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center">
                  <User className="w-10 h-10 text-slate-400" />
                </div>
              </div>
            )}
            {state.isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded-full bg-red-500/80 text-xs">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {t('interview.recording')}
              </div>
            )}
            {/* Proctoring overlay on camera feed */}
            <ProctoringOverlay proctorState={proctorState} />
          </div>
          <span className="text-sm text-slate-400 font-medium">{userName}</span>
        </div>

        {/* AI Interviewer side */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-72 h-52 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-xl flex items-center justify-center">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                state.isSpeaking
                  ? 'bg-primary/30 ring-4 ring-primary/50 animate-pulse'
                  : 'bg-slate-700'
              }`}
            >
              <Bot className="w-12 h-12 text-primary" />
            </div>
            {state.isSpeaking && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 16 + 8}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <span className="text-sm text-slate-400 font-medium">
            {t('interview.aiInterviewer')}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      {getStatusText() && (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${getStatusIndicator()}`} />
          <span className="text-sm text-slate-300">{getStatusText()}</span>
        </div>
      )}

      {/* Last message transcript */}
      {state.lastMessage && (
        <div className="mx-8 mb-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700 max-h-24 overflow-y-auto">
          <p className="text-sm text-slate-300 leading-relaxed">{state.lastMessage}</p>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4 px-6 py-6 bg-slate-800/80 border-t border-slate-700">
        {state.callStatus === CallStatus.INACTIVE && (
          <Button
            onClick={handleStartInterview}
            size="lg"
            className="gap-2 bg-green-600 hover:bg-green-700 text-white px-8"
          >
            <Play className="w-5 h-5" />
            {t('interview.startInterview')}
          </Button>
        )}

        {state.callStatus === CallStatus.CONNECTING && (
          <Button disabled size="lg" className="gap-2 px-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('interview.connecting')}
          </Button>
        )}

        {state.callStatus === CallStatus.ACTIVE && (
          <>
            {/* Hold-to-speak mic button */}
            <Button
              size="lg"
              variant={state.isRecording ? 'destructive' : 'default'}
              className={`rounded-full w-16 h-16 p-0 transition-all ${
                state.isRecording
                  ? 'bg-red-500 hover:bg-red-600 ring-4 ring-red-500/30 scale-110'
                  : 'bg-primary hover:bg-primary/90'
              }`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={() => {
                if (isRecordingRef.current) stopRecording();
              }}
            >
              {state.isRecording ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>

            <Button
              onClick={handleEndInterview}
              size="lg"
              variant="destructive"
              className="gap-2 px-6"
              disabled={state.isGeneratingFeedback}
            >
              {state.isGeneratingFeedback ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PhoneOff className="w-5 h-5" />
              )}
              {state.isGeneratingFeedback
                ? t('interview.generatingFeedback')
                : t('interview.endInterview')}
            </Button>
          </>
        )}

        {state.callStatus === CallStatus.FINISHED && (
          <div className="text-slate-400 text-sm">
            {t('interview.interviewEnded')}
          </div>
        )}
      </div>

      {/* Spacebar hint */}
      {state.callStatus === CallStatus.ACTIVE && !state.isRecording && (
        <div className="text-center pb-4 text-xs text-slate-500">
          {t('interview.spacebarHint')}
        </div>
      )}
    </div>
  );
};
