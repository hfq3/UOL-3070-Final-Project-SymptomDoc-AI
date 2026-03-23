# SymptomDoc AI — Patient Symptom Documentation Assistant

A multi-modal AI-powered medical documentation assistant that processes voice, text, and image inputs to generate structured SOAP clinical notes. All AI inference runs **locally** on your machine — no cloud APIs, no patient data leaves your device.

---

## Project Structure

```
├── main.py              # Whisper Speech-to-Text API (port 8002)
├── ollama_api.py         # Medical AI API — note generation, image analysis, chat, TTS (port 8001)
├── auth.py               # Authentication module (JWT + bcrypt + SQLite)
├── test_evaluation.py    # Automated test suite (56 unit tests)
├── frontend/             # React + Vite + Tailwind CSS frontend (port 5173)
│   ├── src/App.jsx       # Main application component
│   ├── package.json      # Node.js dependencies
│   └── vite.config.js    # Vite configuration
├── Preliminary Report.md # Final report (Chapters 1–3, 5–6)
└── chapter4.md           # Chapter 4: Implementation
```

---

## Prerequisites

Before running the project, ensure you have the following installed:

| Software     | Version   | Download Link                          |
|-------------|-----------|----------------------------------------|
| Python      | 3.10+     | https://www.python.org/downloads/      |
| Node.js     | 18+       | https://nodejs.org/                    |
| Ollama      | Latest    | https://ollama.com/download            |
| Git         | Latest    | https://git-scm.com/downloads          |
| FFmpeg      | Latest    | https://ffmpeg.org/download.html       |

> **Note for macOS:** If you have Homebrew, you can install FFmpeg with `brew install ffmpeg`.
> **Note for Windows:** Download FFmpeg from the link above, extract it, and add the `bin` folder to your system PATH.

---

## Setup Instructions

### Step 1: Install Ollama and Pull AI Models

1. Download and install Ollama from https://ollama.com/download
2. Open a terminal and pull the two required models:

```bash
ollama pull qwen2.5:7b-instruct-q5_K_M
ollama pull qwen2.5vl:7b
```

> These downloads are ~5 GB total. Wait for each to complete before proceeding.

3. Verify Ollama is running:

```bash
ollama list
```

You should see both models listed.

---

### Step 2: Set Up the Python Backend

1. Open a terminal and navigate to the project root folder:

```bash
cd "/path/to/FP Exam"
```

2. Create a Python virtual environment:

```bash
python3 -m venv venv
```

3. Activate the virtual environment:

**macOS / Linux:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

4. Install all Python dependencies:

```bash
pip install fastapi uvicorn openai-whisper python-jose[cryptography] passlib[bcrypt] sqlalchemy pydantic[email] python-multipart pillow requests numpy soundfile kokoro
```

> The `openai-whisper` package will also install PyTorch. This may take a few minutes depending on your internet speed.

---

### Step 3: Set Up the React Frontend

1. Open a **new terminal** and navigate to the `frontend` folder:

```bash
cd "/path/to/FP Exam/frontend"
```

2. Install Node.js dependencies:

```bash
npm install
```

---

## Running the Application

You need **three terminals** running simultaneously, plus Ollama running in the background. Follow these steps in order:

### Terminal 1 — Ollama (AI Model Server)

Make sure Ollama is running. On macOS it usually starts automatically after installation. You can verify by running:

```bash
ollama list
```

If it is not running, start it:

```bash
ollama serve
```

> Leave this terminal open.

---

### Terminal 2 — Whisper Speech-to-Text API (port 8002)

```bash
cd "/path/to/FP Exam"
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate          # Windows

python main.py
```

Wait until you see:
```
🚀 STARTUP: Loading Whisper 'medium' model (CPU)...
✅ Whisper model loaded successfully!
```

> The first run downloads the Whisper model (~1.5 GB). This only happens once.
> Leave this terminal open.

---

### Terminal 3 — Medical AI API (port 8001)

```bash
cd "/path/to/FP Exam"
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate          # Windows

uvicorn ollama_api:app --host 0.0.0.0 --port 8001 --reload
```

Wait until you see:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
```

> Leave this terminal open.

---

### Terminal 4 — React Frontend (port 5173)

```bash
cd "/path/to/FP Exam/frontend"
npm run dev
```

Wait until you see:
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

---

### Step 4: Open the Application

Open your web browser and go to:

```
http://localhost:5173
```

You should see the SymptomDoc AI interface.

---

## Using the Application

1. **Register** — Click "Sign Up" and create an account (name, email, password).
2. **Log In** — Enter your credentials to access the dashboard.
3. **Voice Input** — Click the microphone button to record symptoms (max 30 seconds). The audio is transcribed by Whisper locally.
4. **Text Input** — Type patient symptoms directly into the chat box.
5. **Image Upload** — Drag and drop or click to upload a medical image (JPEG/PNG, max 5 MB). The vision model analyses it locally.
6. **Generate SOAP Note** — Click "Generate Medical Note" to produce a structured Subjective/Objective/Assessment/Plan note.
7. **Text-to-Speech** — Click the speaker icon on any note to hear it read aloud via Kokoro TTS.
8. **Export PDF** — Click "Export PDF" to download the consultation as a PDF document.
9. **History** — Previous consultations are saved and accessible from the sidebar.

---

## Running the Automated Tests

The project includes 56 unit tests covering patient fact extraction, medication generation, authentication, input validation, and more.

```bash
cd "/path/to/FP Exam"
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate          # Windows

pip install pytest
pytest test_evaluation.py -v
```

Expected output:
```
56 passed, 5 warnings in ~3s
```

---

## Port Summary

| Service                | Port  | File            |
|-----------------------|-------|-----------------|
| React Frontend        | 5173  | frontend/       |
| Medical AI API        | 8001  | ollama_api.py   |
| Whisper API           | 8002  | main.py         |
| Ollama Model Server   | 11434 | (system service) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ollama: command not found` | Install Ollama from https://ollama.com/download and restart your terminal |
| `ModuleNotFoundError: No module named 'whisper'` | Activate the virtual environment and run `pip install openai-whisper` |
| `Connection refused on port 11434` | Ollama is not running. Start it with `ollama serve` |
| `Whisper model download hangs` | Check your internet connection. The model is ~1.5 GB |
| `CORS error in browser console` | Ensure all three backend services are running on the correct ports |
| `FFmpeg not found` | Install FFmpeg: `brew install ffmpeg` (macOS) or download from https://ffmpeg.org |
| `npm install fails` | Ensure Node.js 18+ is installed: `node --version` |
| `Port already in use` | Kill the process using the port: `lsof -i :PORT_NUMBER` then `kill -9 PID` |
| `TTS not working` | Kokoro TTS is optional. The app works without it — install with `pip install kokoro` |

---
