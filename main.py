"""
Whisper Speech-to-Text API
Assignment Submission
- Transcribes patient audio descriptions (e.g., voice notes)
- Integrates with Ollama medical analysis service
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import os
from pydantic import BaseModel
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Whisper Medical Transcription API",
    description="Transcribes patient voice input for medical symptom documentation",
    version="1.0"
)

# CORS (for development only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Constants
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",      # .mp3
    "audio/wav",       # .wav
    "audio/x-wav",
    "audio/webm",      # .webm
    "audio/ogg",       # .ogg
    "audio/flac",      # .flac
    "audio/aac"
}
MAX_DURATION_SECONDS = 30  # Only transcribe first 30 seconds

# Global model
whisper_model = None


# ===============
# Pydantic Models
# ===============

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    language_probability: float

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


# ===============
# Startup Event
# ===============

@app.on_event("startup")
async def load_whisper_model():
    """Load Whisper model once at startup."""
    global whisper_model
    logger.info("=" * 50)
    logger.info("🚀 STARTUP: Loading Whisper 'medium' model (CPU)...")
    try:
        whisper_model = whisper.load_model("medium", device="cpu")
        logger.info("✅ Whisper model loaded successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to load Whisper model: {e}")
        raise
    logger.info("=" * 50)


# ===============
# Helper Functions
# ===============

def validate_audio_file(file: UploadFile) -> bytes:
    """Validate audio file type and size."""
    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing content type"
        )
    
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio type: {file.content_type}. "
                   f"Allowed: {', '.join(ALLOWED_AUDIO_TYPES)}"
        )
    
    contents = file.file.read()
    if len(contents) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio file too large. Max size: 10 MB"
        )
    
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )
    
    return contents


# ===============
# API Endpoints
# ===============

@app.get("/", response_model=HealthResponse)
def health_check():
    """Check if API and Whisper model are ready."""
    logger.info("🔍 Health check requested")
    return HealthResponse(
        status="running",
        model_loaded=whisper_model is not None
    )


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe the first 30 seconds of a medical voice note.
    Returns text, detected language, and confidence.
    """
    logger.info("=" * 50)
    logger.info("📝 NEW TRANSCRIPTION REQUEST")
    logger.info(f"File: {file.filename} | Type: {file.content_type}")
    logger.info("=" * 50)
    
    if whisper_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Whisper model not loaded"
        )
    
    # Validate input
    audio_bytes = validate_audio_file(file)
    
    tmp_path = None
    try:
        # Save to temporary file
        suffix = os.path.splitext(file.filename or "audio")[1].lower() or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        
        logger.info(f"✅ Saved to temp file: {tmp_path} ({len(audio_bytes)} bytes)")
        
        # Load and trim audio to MAX_DURATION_SECONDS
        audio = whisper.load_audio(tmp_path)
        audio = whisper.pad_or_trim(audio, MAX_DURATION_SECONDS * 16000)  # 16kHz sampling rate
        
        # Generate log-Mel spectrogram
        mel = whisper.log_mel_spectrogram(audio, n_mels=whisper_model.dims.n_mels).to(whisper_model.device)
        
        # Detect language
        _, probs = whisper_model.detect_language(mel)
        detected_lang = max(probs, key=probs.get)
        lang_prob = probs[detected_lang]
        
        # Log top predictions
        top_langs = sorted(probs.items(), key=lambda x: x[1], reverse=True)[:3]
        logger.info(f"🌍 Detected language: {detected_lang} ({lang_prob:.2%} confidence)")
        for lang, prob in top_langs:
            logger.info(f"   - {lang}: {prob:.2%}")
        
        # Transcribe
        options = whisper.DecodingOptions()
        result = whisper.decode(whisper_model, mel, options)
        transcript = result.text.strip()
        
        logger.info(f"✅ Transcription complete ({len(transcript)} chars): '{transcript}'")
        
        return TranscriptionResponse(
            text=transcript,
            language=detected_lang,
            language_probability=float(lang_prob)
        )
    
    except Exception as e:
        logger.error(f"❌ Transcription failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription error: {str(e)}"
        )
    
    finally:
        # Always clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.info(f"🗑️ Cleaned up temp file: {tmp_path}")
            except Exception as cleanup_error:
                logger.warning(f"⚠️ Failed to delete temp file: {cleanup_error}")


# ===============
# Entry Point
# ===============

if __name__ == "__main__":
    import uvicorn
    logger.info("🎙️ Starting Whisper Transcription API on http://0.0.0.0:8002")
    uvicorn.run(app, host="0.0.0.0", port=8002)