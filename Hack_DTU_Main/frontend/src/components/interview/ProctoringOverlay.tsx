import { useEffect, useState } from 'react';
import { Eye, User, Monitor, AlertTriangle, XCircle } from 'lucide-react';
import type { ProctorState } from '@/lib/interview/proctor';

interface ProctoringOverlayProps {
  proctorState: ProctorState | null;
}

const WARNING_MESSAGES: Record<string, Record<number, string>> = {
  no_face: {
    1: 'Your face is not visible. Please look at the camera.',
    2: 'Second warning: Face not detected. Next violation will end the interview.',
    3: 'Interview terminated: Repeated face detection violations.',
  },
  multiple_faces: {
    1: 'Multiple faces detected. Only you should be visible.',
    2: 'Second warning: Multiple faces still detected.',
    3: 'Interview terminated: Multiple persons detected repeatedly.',
  },
  looking_away: {
    1: 'Please look at the camera while answering.',
    2: 'Second warning: You appear to be looking away from the screen.',
    3: 'Interview terminated: Repeated gaze violations.',
  },
  tab_switch: {
    1: 'Tab switch detected. Please stay on this page.',
    2: 'Second warning: Another tab switch detected.',
    3: 'Interview terminated: Repeated tab switching.',
  },
};

function getBorderColor(warningLevel: number): string {
  if (warningLevel === 0) return 'border-green-500/50';
  if (warningLevel === 1) return 'border-yellow-500';
  if (warningLevel === 2) return 'border-orange-500';
  return 'border-red-500';
}

function getBannerStyle(warningLevel: number): string {
  if (warningLevel === 1) return 'bg-yellow-500/90 text-yellow-950';
  if (warningLevel === 2) return 'bg-orange-500/90 text-orange-950';
  return 'bg-red-500/90 text-white';
}

export const ProctoringOverlay = ({ proctorState }: ProctoringOverlayProps) => {
  const [visibleWarning, setVisibleWarning] = useState<string | null>(null);
  const [lastViolationCount, setLastViolationCount] = useState(0);

  useEffect(() => {
    if (!proctorState) return;

    const currentCount = proctorState.violations.length;
    if (currentCount > lastViolationCount) {
      const latest = proctorState.violations[currentCount - 1];
      const level = Math.min(proctorState.warningLevel, 3);
      const message = WARNING_MESSAGES[latest.type]?.[level] || latest.details || 'Violation detected';
      setVisibleWarning(message);
      setLastViolationCount(currentCount);

      // Auto-hide after 5 seconds (unless terminated)
      if (level < 3) {
        const timer = setTimeout(() => setVisibleWarning(null), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [proctorState?.violations.length]);

  if (!proctorState) return null;

  const { warningLevel, faceCount, gazeDirection } = proctorState;

  return (
    <>
      {/* Warning Banner — slides in from top */}
      {visibleWarning && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300 ${getBannerStyle(warningLevel)}`}
        >
          {warningLevel >= 3 ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>
            {warningLevel >= 3 ? '' : `Strike ${warningLevel}/3 — `}
            {visibleWarning}
          </span>
        </div>
      )}

      {/* Camera border glow indicator */}
      <div
        className={`absolute inset-0 rounded-2xl border-2 pointer-events-none transition-colors duration-300 ${getBorderColor(warningLevel)}`}
      />

      {/* Bottom-right status indicators */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 bg-black/60 rounded-lg px-2 py-1.5 text-[10px] text-white">
        <div className="flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          <span>
            Gaze: {gazeDirection === 'center' ? 'Center' : gazeDirection}{' '}
            {gazeDirection === 'center' ? '✓' : '!'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="w-3 h-3" />
          <span>
            Face: {faceCount} {faceCount === 1 ? '✓' : '!'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Monitor className="w-3 h-3" />
          <span>Tab: Active ✓</span>
        </div>
      </div>
    </>
  );
};
