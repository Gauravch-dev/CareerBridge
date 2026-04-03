"""
Whisper STT Server - Speech-to-Text service using faster-whisper
Runs on port 5200
"""

import os
import tempfile
import subprocess
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        logger.info("Loading Whisper model (base)...")
        _model = WhisperModel("base", device="cpu", compute_type="int8")
        logger.info("Whisper model loaded successfully")
    return _model


def convert_to_wav(input_path: str) -> str:
    """Convert any audio format to 16kHz mono WAV using ffmpeg."""
    output_path = input_path.rsplit(".", 1)[0] + "_converted.wav"
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-ar", "16000",
                "-ac", "1",
                "-f", "wav",
                output_path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            logger.error(f"ffmpeg error: {result.stderr[:500]}")
            return input_path  # Fallback to original
        logger.info(f"Converted to WAV: {os.path.getsize(output_path)} bytes")
        return output_path
    except Exception as e:
        logger.error(f"ffmpeg conversion failed: {e}")
        return input_path


@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        if "audio" not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files["audio"]
        filename = audio_file.filename or "audio.wav"

        # Determine extension
        if "webm" in (audio_file.content_type or "") or filename.endswith(".webm"):
            ext = ".webm"
        elif "ogg" in (audio_file.content_type or ""):
            ext = ".ogg"
        else:
            ext = ".wav"

        # Save uploaded file
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        file_size = os.path.getsize(tmp_path)
        logger.info(f"Received audio: {file_size} bytes, format: {ext}")

        converted_path = None
        try:
            # Always convert to WAV via ffmpeg for reliable decoding
            if ext != ".wav":
                wav_path = convert_to_wav(tmp_path)
                if wav_path != tmp_path:
                    converted_path = wav_path
                    transcribe_path = wav_path
                else:
                    transcribe_path = tmp_path
            else:
                transcribe_path = tmp_path

            # Accept language from form data or query param; default to "en"
            language = request.form.get("language", "en")
            if language not in ("en", "hi", "mr", "ta", "te", "bn", "gu", "kn", "ml", "pa"):
                language = "en"

            model = get_model()
            segments, info = model.transcribe(
                transcribe_path,
                beam_size=5,
                language=language,
                vad_filter=False,
            )

            text_parts = []
            for segment in segments:
                text_parts.append(segment.text.strip())

            full_text = " ".join(text_parts)

            logger.info(f"Transcription: '{full_text[:100]}'")

            return jsonify({
                "text": full_text,
                "confidence": round(info.language_probability, 2) if info.language_probability else None,
                "duration": round(info.duration, 2) if info.duration else None,
                "language": info.language,
            })

        finally:
            os.unlink(tmp_path)
            if converted_path and os.path.exists(converted_path):
                os.unlink(converted_path)

    except Exception as e:
        logger.error(f"STT error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "whisper-stt"})


if __name__ == "__main__":
    logger.info("Starting Whisper STT Server on port 5200")
    app.run(host="0.0.0.0", port=5200, debug=False)
