import * as faceapi from 'face-api.js';

export interface ProctorViolation {
  timestamp: string;
  type: 'no_face' | 'multiple_faces' | 'looking_away' | 'tab_switch';
  duration: number;
  confidence: number;
  details?: string;
}

export interface ProctorState {
  faceCount: number;
  isLookingAway: boolean;
  gazeDirection: 'center' | 'left' | 'right';
  violations: ProctorViolation[];
  warningLevel: number;
  integrityScore: number;
  isModelLoaded: boolean;
}

export interface ProctoringSummary {
  integrityScore: number;
  totalViolations: number;
  violations: ProctorViolation[];
  summary: {
    tabSwitches: number;
    lookAwayEvents: number;
    multipleFaceEvents: number;
    noFaceEvents: number;
    autoTerminated: boolean;
  };
}

export class ProctoringService {
  private videoElement: HTMLVideoElement | null = null;
  private detectionInterval: ReturnType<typeof setInterval> | null = null;
  private violations: ProctorViolation[] = [];
  private warningLevel = 0;
  private isRunning = false;
  private onStateChange: ((state: ProctorState) => void) | null = null;
  private onAutoTerminate: (() => void) | null = null;

  // Grace period tracking
  private noFaceStart: number | null = null;
  private lookAwayStart: number | null = null;

  // Thresholds
  private readonly DETECTION_INTERVAL_MS = 500;
  private readonly NO_FACE_GRACE_MS = 2000;
  private readonly LOOK_AWAY_GRACE_MS = 2000;
  private readonly MAX_WARNINGS = 3;

  async loadModels(): Promise<boolean> {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      console.log('[Proctor] Models loaded');
      return true;
    } catch (error) {
      console.error('[Proctor] Failed to load models:', error);
      return false;
    }
  }

  start(
    videoElement: HTMLVideoElement,
    onStateChange: (state: ProctorState) => void,
    onAutoTerminate?: () => void,
  ): void {
    this.videoElement = videoElement;
    this.onStateChange = onStateChange;
    this.onAutoTerminate = onAutoTerminate || null;
    this.violations = [];
    this.warningLevel = 0;
    this.isRunning = true;
    this.noFaceStart = null;
    this.lookAwayStart = null;

    this.detectionInterval = setInterval(() => {
      this.detect();
    }, this.DETECTION_INTERVAL_MS);

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);

    console.log('[Proctor] Started');
    this.emitState(0, null);
  }

  stop(): ProctorViolation[] {
    this.isRunning = false;

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);

    console.log('[Proctor] Stopped. Violations:', this.violations.length);
    return [...this.violations];
  }

  getViolations(): ProctorViolation[] {
    return [...this.violations];
  }

  getWarningLevel(): number {
    return this.warningLevel;
  }

  getSummary(): ProctoringSummary {
    const summary = {
      tabSwitches: 0,
      lookAwayEvents: 0,
      multipleFaceEvents: 0,
      noFaceEvents: 0,
      autoTerminated: this.warningLevel >= this.MAX_WARNINGS,
    };

    for (const v of this.violations) {
      switch (v.type) {
        case 'tab_switch': summary.tabSwitches++; break;
        case 'looking_away': summary.lookAwayEvents++; break;
        case 'multiple_faces': summary.multipleFaceEvents++; break;
        case 'no_face': summary.noFaceEvents++; break;
      }
    }

    return {
      integrityScore: this.calculateIntegrityScore(),
      totalViolations: this.violations.length,
      violations: [...this.violations],
      summary,
    };
  }

  private async detect(): Promise<void> {
    if (!this.isRunning || !this.videoElement) return;

    try {
      const detections = await faceapi
        .detectAllFaces(this.videoElement, new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.5,
        }))
        .withFaceLandmarks();

      const faceCount = detections.length;

      if (faceCount === 0) {
        // Grace period for no face
        if (this.noFaceStart === null) {
          this.noFaceStart = Date.now();
        } else if (Date.now() - this.noFaceStart > this.NO_FACE_GRACE_MS) {
          this.addViolation('no_face', 0.9, 'No face detected in camera');
          this.noFaceStart = Date.now(); // reset so it doesn't fire every 500ms
        }
        this.lookAwayStart = null;
      } else if (faceCount > 1) {
        this.addViolation('multiple_faces', 0.85, `${faceCount} faces detected`);
        this.noFaceStart = null;
        this.lookAwayStart = null;
      } else {
        // Exactly 1 face — all good
        this.noFaceStart = null;
        this.lookAwayStart = null;
      }

      this.emitState(
        faceCount,
        detections.length === 1 ? detections[0].landmarks : null,
      );
    } catch (error) {
      console.warn('[Proctor] Detection error:', error);
    }
  }

  private analyzeGaze(landmarks: faceapi.FaceLandmarks68): {
    isLookingAway: boolean;
    direction: 'center' | 'left' | 'right';
    confidence: number;
  } {
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    // === Method 1: Head pose via nose-bridge position relative to jaw ===
    // Use nose bridge point (index 0 = point 27) for more stable reading
    const faceLeft = jaw[0].x;
    const faceRight = jaw[16].x;
    const faceWidth = faceRight - faceLeft;
    if (faceWidth <= 0) return { isLookingAway: false, direction: 'center', confidence: 0.5 };

    // Nose tip (point 30) is more reliable for head turn detection
    const noseTip = nose[3]; // index 3 in getNose() = landmark point 30
    const noseRelative = (noseTip.x - faceLeft) / faceWidth;

    // === Method 2: Face symmetry ratio ===
    // Compare distance from nose to left jaw vs nose to right jaw
    const distToLeft = noseTip.x - faceLeft;
    const distToRight = faceRight - noseTip.x;
    const symmetryRatio = distToLeft / (distToLeft + distToRight); // 0.5 = symmetric

    // === Method 3: Eye position asymmetry ===
    // When head turns, one eye appears narrower than the other
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const leftEyeWidth = leftEye[3].x - leftEye[0].x;
    const rightEyeWidth = rightEye[3].x - rightEye[0].x;
    const eyeWidthRatio = leftEyeWidth > 0 && rightEyeWidth > 0
      ? Math.min(leftEyeWidth, rightEyeWidth) / Math.max(leftEyeWidth, rightEyeWidth)
      : 1;
    // eyeWidthRatio < 0.65 means significant asymmetry = head turn

    // === Method 4: Iris detection via canvas pixel analysis ===
    const irisRatio = this.detectIrisPosition(leftEye, rightEye);

    // === Combined decision ===
    // Head pose: most reliable for large turns
    const headTurnedLeft = noseRelative < 0.38 || symmetryRatio < 0.38;
    const headTurnedRight = noseRelative > 0.62 || symmetryRatio > 0.62;

    // Eye asymmetry: detects moderate head turns
    const eyeAsymmetry = eyeWidthRatio < 0.65;

    // Iris: detects eye-only gaze shifts
    const irisLeft = irisRatio !== null && irisRatio > 0.62;
    const irisRight = irisRatio !== null && irisRatio < 0.38;

    const isLookingLeft = headTurnedLeft || (eyeAsymmetry && noseRelative < 0.45) || irisLeft;
    const isLookingRight = headTurnedRight || (eyeAsymmetry && noseRelative > 0.55) || irisRight;
    const isLookingAway = isLookingLeft || isLookingRight;

    // Higher confidence when multiple signals agree
    let confidence = 0.5;
    if (isLookingAway) {
      let signals = 0;
      if (headTurnedLeft || headTurnedRight) signals++;
      if (eyeAsymmetry) signals++;
      if (irisLeft || irisRight) signals++;
      confidence = Math.min(0.95, 0.5 + signals * 0.15);
    }

    return {
      isLookingAway,
      direction: isLookingLeft ? 'left' : isLookingRight ? 'right' : 'center',
      confidence,
    };
  }

  /**
   * Detect iris position by analyzing dark pixel concentration within eye regions.
   * Returns a ratio 0-1 where 0.5 = centered, <0.38 = looking right, >0.62 = looking left.
   * Returns null if video element is unavailable.
   */
  private detectIrisPosition(
    leftEye: faceapi.Point[],
    rightEye: faceapi.Point[],
  ): number | null {
    if (!this.videoElement) return null;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const vw = this.videoElement.videoWidth;
      const vh = this.videoElement.videoHeight;
      if (vw === 0 || vh === 0) return null;

      canvas.width = vw;
      canvas.height = vh;
      ctx.drawImage(this.videoElement, 0, 0, vw, vh);

      // Scale landmark coords to video dimensions
      const dw = this.videoElement.clientWidth || vw;
      const dh = this.videoElement.clientHeight || vh;
      const sx = vw / dw;
      const sy = vh / dh;

      const analyzeEye = (eyePoints: faceapi.Point[]): number => {
        const minX = Math.floor(Math.min(...eyePoints.map(p => p.x)) * sx);
        const maxX = Math.ceil(Math.max(...eyePoints.map(p => p.x)) * sx);
        const minY = Math.floor(Math.min(...eyePoints.map(p => p.y)) * sy);
        const maxY = Math.ceil(Math.max(...eyePoints.map(p => p.y)) * sy);

        const w = maxX - minX;
        const h = maxY - minY;
        if (w <= 2 || h <= 2) return 0.5;

        const imageData = ctx!.getImageData(
          Math.max(0, minX), Math.max(0, minY),
          Math.min(w, vw - minX), Math.min(h, vh - minY),
        );
        const data = imageData.data;

        // Find the darkest column (iris = darkest part of the eye)
        const colBrightness: number[] = new Array(imageData.width).fill(0);
        const colCount: number[] = new Array(imageData.width).fill(0);

        for (let y = 0; y < imageData.height; y++) {
          for (let x = 0; x < imageData.width; x++) {
            const i = (y * imageData.width + x) * 4;
            const brightness = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            colBrightness[x] += brightness;
            colCount[x]++;
          }
        }

        // Find the column with lowest average brightness (darkest = iris)
        let darkestCol = 0;
        let darkestAvg = Infinity;
        for (let x = 0; x < imageData.width; x++) {
          if (colCount[x] === 0) continue;
          const avg = colBrightness[x] / colCount[x];
          if (avg < darkestAvg) {
            darkestAvg = avg;
            darkestCol = x;
          }
        }

        return imageData.width > 0 ? darkestCol / imageData.width : 0.5;
      };

      const leftRatio = analyzeEye(leftEye);
      const rightRatio = analyzeEye(rightEye);

      return (leftRatio + rightRatio) / 2;
    } catch {
      return null;
    }
  }

  private addViolation(
    type: ProctorViolation['type'],
    confidence: number,
    details: string,
    duration = 0,
  ): void {
    const violation: ProctorViolation = {
      timestamp: new Date().toISOString(),
      type,
      duration,
      confidence,
      details,
    };

    this.violations.push(violation);
    this.warningLevel = Math.min(this.warningLevel + 1, this.MAX_WARNINGS);

    console.log(`[Proctor] Violation #${this.warningLevel}: ${type} — ${details}`);

    if (this.warningLevel >= this.MAX_WARNINGS && this.onAutoTerminate) {
      this.onAutoTerminate();
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden && this.isRunning) {
      this.addViolation('tab_switch', 1.0, 'Switched to another tab/window');
      this.emitState(0, null);
    }
  };

  private handleWindowBlur = (): void => {
    if (this.isRunning) {
      this.addViolation('tab_switch', 0.8, 'Window lost focus');
      this.emitState(0, null);
    }
  };

  private emitState(faceCount: number, _landmarks: faceapi.FaceLandmarks68 | null): void {
    if (!this.onStateChange) return;

    this.onStateChange({
      faceCount,
      isLookingAway: false,
      gazeDirection: 'center',
      violations: [...this.violations],
      warningLevel: this.warningLevel,
      integrityScore: this.calculateIntegrityScore(),
      isModelLoaded: true,
    });
  }

  private calculateIntegrityScore(): number {
    let score = 100;

    const penalties: Record<string, number> = {
      tab_switch: 10,
      no_face: 5,
      multiple_faces: 15,
      looking_away: 3,
    };

    for (const v of this.violations) {
      score -= penalties[v.type] || 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}
