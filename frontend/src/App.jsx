import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Image as ImageIcon,
  Send,
  Sparkles,
  Loader2,
  AlertCircle,
  Trash2,
  Upload,
  FileText,
  Eye,
  LogOut,
  History,
  Download,
  Edit2,
  Check,
  X,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";

// API Base URLs
const TRANSCRIPTION_API = "http://localhost:8002";
const MEDICAL_API = "http://localhost:8001";

export default function MedicalSymptomSystem() {
  const [currentPage, setCurrentPage] = useState("login");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState("");

  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [playingNoteId, setPlayingNoteId] = useState(null);

  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const audioRef = useRef(null);

  const categories = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General Medicine" },
  { value: "dermatology", label: "Dermatology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "ent", label: "ENT" },
  { value: "orthopedics", label: "Orthopedics" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "gynecology", label: "Gynecology" },
  { value: "neurology", label: "Neurology" },
  { value: "pulmonology", label: "Pulmonology" },
  { value: "psychiatry", label: "Psychiatry" },
  { value: "ophthalmology", label: "Ophthalmology" },
  { value: "gastroenterology", label: "Gastroenterology" },
  { value: "nephrology", label: "Nephrology" },
  { value: "urology", label: "Urology" },
  { value: "endocrinology", label: "Endocrinology" },
  { value: "rheumatology", label: "Rheumatology" },
  { value: "oncology", label: "Oncology" },
  { value: "hematology", label: "Hematology" },
  { value: "other", label: "Other" },
];

  const loadHistory = async (search = "", category = "all") => {
    if (!token) return;

    setHistoryLoading(true);
    try {
      let url = `${MEDICAL_API}/history?limit=100`;

      if (search.trim()) {
        url += `&q=${encodeURIComponent(search.trim())}`;
      }
      if (category && category !== "all") {
        url += `&category=${encodeURIComponent(category)}`;
      }

      const res = await authFetch(url);
      if (!res.ok) throw new Error("Could not load history");

      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("medToken");
    const savedUser = localStorage.getItem("medUser");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setCurrentPage("app");
    }
  }, []);

  useEffect(() => {
    if (token && currentPage === "history") {
      loadHistory(searchQuery, selectedCategory);
    }
  }, [token, currentPage, searchQuery, selectedCategory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transcribing]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!authName || !authEmail || !authPassword) {
      setError("Please fill all fields");
      return;
    }

    try {
      const res = await fetch(`${MEDICAL_API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName.trim(),
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.detail || "Registration failed");
        return;
      }

      await performLogin(authEmail.trim(), authPassword);
    } catch (err) {
      setError("Network error. Is the backend running on port 8001?");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!authEmail || !authPassword) {
      setError("Please enter email and password");
      return;
    }
    await performLogin(authEmail.trim(), authPassword);
  };

  const performLogin = async (email, password) => {
    try {
      const res = await fetch(`${MEDICAL_API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: email,
          password: password,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.detail || "Invalid email or password");
        return;
      }

      const data = await res.json();
      const newUser = { email, name: authName || email.split("@")[0] };

      setToken(data.access_token);
      setUser(newUser);
      localStorage.setItem("medToken", data.access_token);
      localStorage.setItem("medUser", JSON.stringify(newUser));

      setCurrentPage("app");
      setError("");
      setAuthName("");
      setAuthEmail("");
      setAuthPassword("");
    } catch (err) {
      setError("Login failed. Check backend connection.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("medToken");
    localStorage.removeItem("medUser");
    setCurrentPage("login");
    setMessages([]);
    setError("");
  };

  const authFetch = async (url, options = {}) => {
    if (!token) throw new Error("No authentication token");

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      setError("Session expired. Logging you out...");
      handleLogout();
      throw new Error("Unauthorized");
    }

    return res;
  };

  const sendChatToAI = async (userText) => {
    if (!token) {
      setError("Please log in to chat with AI");
      return;
    }

    setMessages((prev) => [
      ...prev,
      { type: "assistant", content: "Typing...", loading: true },
    ]);

    try {
      const res = await authFetch(`${MEDICAL_API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          session_id: user?.email || "anonymous",
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          type: "assistant",
          content: data.reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      setError("AI chat failed: " + err.message);
    }
  };

  const playNoteAudio = async (noteText, messageIndex) => {
    if (!token) {
      setError("Please log in to use voice playback");
      return;
    }

    setPlayingNoteId(messageIndex);

    try {
      const res = await authFetch(`${MEDICAL_API}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: noteText,
          voice: "af_bella",
          lang_code: "a",
        }),
      });

      if (!res.ok) throw new Error("TTS request failed");

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch((e) => {
          console.error("Audio playback failed:", e);
          setError("Could not play audio – check browser permissions");
        });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to generate speech: " + err.message);
    } finally {
      setPlayingNoteId(null);
    }
  };

  const analyzeImage = async (file) => {
    setAnalyzingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await authFetch(`${MEDICAL_API}/analyze-image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();

      const previewUrl = URL.createObjectURL(file);

      setMessages((prev) => {
        const uploadIndex = prev.findIndex(
          (m) => m.type === "image-upload" && m.preview === previewUrl
        );

        let newMessages = [...prev];

        if (uploadIndex !== -1) {
          newMessages[uploadIndex] = {
            ...newMessages[uploadIndex],
            fullAnalysis: data.analysis,
            findings: data.medical_findings,
          };
        }

        newMessages.push({
          type: "image-analysis",
          content: data.medical_findings || "No significant findings detected.",
          fullAnalysis: data.analysis,
          timestamp: new Date(),
        });

        return newMessages;
      });

      setUploadPreview(null);
      setUploadedFile(null);
    } catch (err) {
      setError("Image analysis failed: " + err.message);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setUploadPreview(preview);
    setUploadedFile(file);

    setMessages((prev) => [
      ...prev,
      { type: "image-upload", preview, timestamp: new Date() },
    ]);

    if (token) await analyzeImage(file);
    else setError("Please log in to analyze images.");
  };

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      setRecording(false);
      setTranscribing(true);
      mediaRecorderRef.current.stop();
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch(`${TRANSCRIPTION_API}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Transcription failed");

      const data = await response.json();
      const text = data.text?.trim();

      if (text) {
        setMessages((prev) => [
          ...prev,
          { type: "voice", content: text, timestamp: new Date() },
        ]);

        await sendChatToAI(text);
      }
    } catch (err) {
      setError("Transcription failed. Is Whisper running on port 8002?");
    } finally {
      setTranscribing(false);
    }
  };

  const sendText = async () => {
    if (!inputValue.trim()) return;

    const text = inputValue.trim();

    setMessages((prev) => [
      ...prev,
      { type: "text", content: text, timestamp: new Date() },
    ]);

    setInputValue("");
    await sendChatToAI(text);
  };

const buildChatHistory = () => {
  const patientStatements = [];

  messages.forEach((msg) => {
    // ONLY include patient's own input
    if (msg.type === "text" || msg.type === "voice") {
      patientStatements.push(msg.content);
    }
    // Include image findings (objective data only)
    else if (msg.type === "image-analysis") {
      patientStatements.push(`Image Analysis: ${msg.fullAnalysis || msg.content}`);
    }
  });

  return patientStatements.join("\n\n");
};

const generateMedicalNote = async () => {
  const chatHistory = buildChatHistory();

  if (!chatHistory.trim()) {
    setError("Please have a conversation first before generating a note.");
    return;
  }

  // Check if image exists in current session
  const hasCurrentImage = messages.some(
    (m) => m.type === "image-upload" || m.type === "image-analysis"
  );

  let imageAnalysis = null;
  if (hasCurrentImage) {
    const recentImageMsg = messages
      .slice()
      .reverse()
      .find((m) => m.type === "image-analysis");

    if (recentImageMsg) {
      imageAnalysis = recentImageMsg.fullAnalysis || recentImageMsg.content;
    }
  }

  setAnalyzing(true);
  setMessages((prev) => [...prev, { type: "generating", timestamp: new Date() }]);

  try {
    // Extract symptoms
    const symRes = await authFetch(`${MEDICAL_API}/extract-symptoms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chatHistory }),
    });

    if (!symRes.ok) throw new Error(await symRes.text());
    const { response: symptomsText } = await symRes.json();

    // Generate medical note
    const noteRes = await authFetch(`${MEDICAL_API}/generate-medical-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_description: chatHistory,
        image_analysis: imageAnalysis,
        chat_history: chatHistory,
      }),
    });

    if (!noteRes.ok) throw new Error(await noteRes.text());
    const { response: noteText } = await noteRes.json();

    // ============================================
    // CATEGORY EXTRACTION WITH FALLBACK TO "OTHER"
    // ============================================
    
    let category = "other"; // ✅ Default to "other" if nothing matches
    let cleanNote = noteText.trim();

    // Define all valid categories (must match your categories array)
    const validCategories = [
      "dermatology",
      "ent",
      "cardiology",
      "orthopedics",
      "pediatrics",
      "gynecology",
      "neurology",
      "psychiatry",
      "ophthalmology",
      "gastroenterology",
      "pulmonology",
      "nephrology",
      "urology",
      "endocrinology",
      "rheumatology",
      "oncology",
      "hematology",
      "general",
    ];

    // Comprehensive regex pattern for specialty detection
    const specialtyPattern = [
      "dermatology",
      "ent",
      "ear\\s*nose\\s*throat",
      "cardiology",
      "orthopedics",
      "orthopaedics",
      "pediatrics",
      "paediatrics",
      "gynecology",
      "gynaecology",
      "neurology",
      "psychiatry",
      "ophthalmology",
      "gastroenterology",
      "pulmonology",
      "nephrology",
      "urology",
      "endocrinology",
      "rheumatology",
      "oncology",
      "hematology",
      "general\\s*medicine",
      "general",
      "other"
    ].join("|");

    const deptRegex = new RegExp(
      `(specialty|department|field)\\s*[:\\-]?\\s*(${specialtyPattern})`,
      "i"
    );

    const match = cleanNote.match(deptRegex);

    if (match) {
      const raw = match[2].toLowerCase().replace(/\s+/g, "");
      
      // Comprehensive mapping (including variations)
      const mapping = {
        dermatology: "dermatology",
        ent: "ent",
        earnosethroat: "ent",
        cardiology: "cardiology",
        orthopedics: "orthopedics",
        orthopaedics: "orthopedics",
        pediatrics: "pediatrics",
        paediatrics: "pediatrics",
        gynecology: "gynecology",
        gynaecology: "gynecology",
        neurology: "neurology",
        psychiatry: "psychiatry",
        ophthalmology: "ophthalmology",
        gastroenterology: "gastroenterology",
        pulmonology: "pulmonology",
        nephrology: "nephrology",
        urology: "urology",
        endocrinology: "endocrinology",
        rheumatology: "rheumatology",
        oncology: "oncology",
        hematology: "hematology",
        generalmedicine: "general",
        general: "general",
        other: "other",
      };

      const detectedCategory = mapping[raw];
      
      // ✅ Validate: Only use if it's in our valid categories list
      if (detectedCategory && validCategories.includes(detectedCategory)) {
        category = detectedCategory;
      } else {
        category = "other"; // ✅ Unknown specialty → "other"
      }
      
      // Remove the specialty line from the note
      cleanNote = cleanNote.replace(match[0], "").trim();
    } else {
      // ============================================
      // FALLBACK: Content-based detection using keywords
      // ============================================
      const contentLower = cleanNote.toLowerCase();
      
      const keywordMapping = [
        { keywords: ["skin", "rash", "acne", "eczema", "psoriasis", "dermatology"], category: "dermatology" },
        { keywords: ["ear", "nose", "throat", "tonsil", "sinus", "ent"], category: "ent" },
        { keywords: ["heart", "cardiac", "chest pain", "hypertension", "cardiology"], category: "cardiology" },
        { keywords: ["bone", "joint", "fracture", "arthritis", "orthopedic"], category: "orthopedics" },
        { keywords: ["child", "infant", "pediatric", "vaccination"], category: "pediatrics" },
        { keywords: ["pregnancy", "menstrual", "gynecology", "uterus", "ovarian"], category: "gynecology" },
        { keywords: ["brain", "seizure", "migraine", "stroke", "neuro"], category: "neurology" },
        { keywords: ["depression", "anxiety", "psychiatric", "mental health"], category: "psychiatry" },
        { keywords: ["eye", "vision", "cataract", "glaucoma", "ophthalmology"], category: "ophthalmology" },
        { keywords: ["stomach", "gastro", "digestive", "intestine", "colon"], category: "gastroenterology" },
        { keywords: ["lung", "respiratory", "asthma", "breathing", "pulmonology"], category: "pulmonology" },
        { keywords: ["kidney", "renal", "dialysis", "nephrology"], category: "nephrology" },
        { keywords: ["bladder", "urinary", "prostate", "urology"], category: "urology" },
        { keywords: ["diabetes", "thyroid", "hormone", "endocrinology"], category: "endocrinology" },
        { keywords: ["arthritis", "lupus", "autoimmune", "rheumatology"], category: "rheumatology" },
        { keywords: ["cancer", "tumor", "chemotherapy", "oncology"], category: "oncology" },
        { keywords: ["blood", "anemia", "leukemia", "hematology"], category: "hematology" },
      ];

      // Try to find a match based on keywords
      for (const { keywords, category: cat } of keywordMapping) {
        if (keywords.some(keyword => contentLower.includes(keyword))) {
          category = cat;
          break; // Stop at first match
        }
      }
      
      // If still no match after keyword search, keep "other" as default
    }

    // ============================================
    // FINAL VALIDATION: Ensure category is valid
    // ============================================
    if (!validCategories.includes(category) && category !== "other") {
      console.warn(`Unknown category detected: ${category}, defaulting to "other"`);
      category = "other";
    }

    // Update messages with extracted symptoms and generated note
    setMessages((prev) => [
      ...prev.slice(0, -1),
      { type: "symptoms", content: symptomsText, timestamp: new Date() },
      { type: "note", content: cleanNote, timestamp: new Date() },
    ]);

    // Save to history
    await saveCurrentSessionToHistory(symptomsText, cleanNote, category);

  } catch (err) {
    setError("Failed to generate note: " + err.message);
    setMessages((prev) => prev.slice(0, -1));
  } finally {
    setAnalyzing(false);
  }
};

  const saveCurrentSessionToHistory = async (symptomsText, noteText, category = "general") => {
    const noteMsg = noteText || messages.find((m) => m.type === "note")?.content;
    const symptomsMsg = symptomsText || messages.find((m) => m.type === "symptoms")?.content;

    if (!noteMsg) return;

    const title = `Consult - ${new Date().toLocaleDateString()}`;

    const payload = {
      title,
      category,
      symptoms: symptomsMsg || "No symptoms recorded",
      note: noteMsg,
      date: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await authFetch(`${MEDICAL_API}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save session");

      if (currentPage === "history") {
        await loadHistory(searchQuery, selectedCategory);
      }
    } catch (err) {
      setError("Could not save to history: " + err.message);
    }
  };

  const deleteHistory = async (id) => {
    if (!window.confirm("Delete this entry?")) return;

    try {
      const res = await authFetch(`${MEDICAL_API}/history/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError("Failed to delete entry");
    }
  };

  const startEdit = (id, currentTitle) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      const res = await authFetch(`${MEDICAL_API}/history/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim() }),
      });

      if (!res.ok) throw new Error("Update failed");

      setHistory((prev) =>
        prev.map((item) =>
          item.id === editingId ? { ...item, title: editTitle.trim() } : item
        )
      );

      setEditingId(null);
      setEditTitle("");
    } catch (err) {
      setError("Failed to update title");
    }
  };

  const downloadPDF = (entry) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("QuickMed AI - Medical Note", 20, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${entry.date}`, 20, 35);
    doc.text(`Title: ${entry.title}`, 20, 45);
    doc.setFontSize(14);
    doc.text("Symptoms:", 20, 60);
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(entry.symptoms || "N/A", 170), 20, 70);
    doc.setFontSize(14);
    doc.text("Medical Note:", 20, 100);
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(entry.note || "", 170), 20, 110);
    doc.save(`${entry.title.replace(/[^a-z0-9]/gi, "_") || "note"}.pdf`);
  };

  const loadHistorySession = (entry) => {
    setMessages([
      { type: "symptoms", content: entry.symptoms || "No symptoms recorded", timestamp: new Date(entry.date) },
      { type: "note", content: entry.note, timestamp: new Date(entry.date) },
    ]);
    setCurrentPage("app");
  };

  // FIXED: Complete reset for true new session
  const clearAll = () => {
    setMessages([]);
    setUploadPreview(null);
    setUploadedFile(null);
    setInputValue("");
    setError("");

    // Revoke old preview URL to free memory
    if (uploadPreview) {
      URL.revokeObjectURL(uploadPreview);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    dropRef.current?.classList.add("border-green-500", "bg-green-50");
  };

  const handleDragLeave = () => {
    dropRef.current?.classList.remove("border-green-500", "bg-green-50");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleDragLeave();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload({ target: { files: [file] } });
    }
  };

  // ===================== RENDER =====================

  if (currentPage === "login" || currentPage === "signup") {
    const isSignup = currentPage === "signup";
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl rounded-3xl p-10 w-full max-w-md border border-white/20"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl mx-auto mb-4">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              {isSignup ? "Create Account" : "Welcome Back"}
            </h1>
          </div>

          {error && <p className="text-red-400 text-center mb-4">{error}</p>}

          <form onSubmit={isSignup ? handleRegister : handleLogin} className="space-y-5">
            {isSignup && (
              <input
                type="text"
                placeholder="Full Name"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
              required
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
              required
            />
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold hover:from-cyan-600 hover:to-blue-700 transition text-white"
            >
              {isSignup ? "Sign Up" : "Login"}
            </button>
          </form>

          <p className="text-center text-white/70 mt-6">
            {isSignup ? "Already have an account?" : "No account yet?"}{" "}
            <button
              onClick={() => {
                setCurrentPage(isSignup ? "login" : "signup");
                setError("");
              }}
              className="text-cyan-400 hover:underline"
            >
              {isSignup ? "Log in" : "Sign up"}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  if (currentPage === "history") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white flex flex-col">
        <header className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Session History</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentPage("app")}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20"
              >
                Back to Chat
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, symptoms or note..."
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
            />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-56 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-cyan-400"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value} className="bg-slate-900 text-white">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {historyLoading ? (
            <div className="text-center py-20">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-white" />
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-20 text-white/50">
              <History className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">
                {searchQuery.trim() || selectedCategory !== "all"
                  ? "No matching sessions found"
                  : "No history yet"}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {history.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    {editingId === entry.id ? (
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-white/20 px-3 py-1 rounded-lg flex-1 mr-2 text-white"
                        autoFocus
                      />
                    ) : (
                      <h3 className="font-semibold text-lg">{entry.title}</h3>
                    )}
                    <div className="flex items-center gap-1">
                      {editingId === entry.id ? (
                        <>
                          <button onClick={saveEdit}>
                            <Check className="w-4 h-4 text-green-400" />
                          </button>
                          <button onClick={() => setEditingId(null)}>
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(entry.id, entry.title)}>
                          <Edit2 className="w-4 h-4 opacity-60 hover:opacity-100" />
                        </button>
                      )}
                    </div>
                  </div>

                  {entry.category && (
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-cyan-500/30 text-cyan-200">
                      {categories.find(c => c.value === entry.category)?.label || entry.category}
                    </span>
                  )}

                  <p className="text-sm opacity-70">{entry.date}</p>
                  <p className="text-sm line-clamp-3 opacity-90">
                    {entry.note?.substring(0, 120) || "No note"}...
                  </p>

                  <div className="flex justify-between items-center pt-4 border-t border-white/10">
                    <button
                      onClick={() => loadHistorySession(entry)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2 text-sm"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadPDF(entry)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteHistory(entry.id)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white flex flex-col">
      <header className="bg-black/30 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">QuickMed AI</h1>
              <p className="text-sm opacity-80">Hello, {user?.name || "Doctor"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage("history")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20"
            >
              <History className="w-5 h-5" /> History
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
            <button 
              onClick={clearAll} 
              className="px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-medium transition"
            >
              New Session
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-7xl mx-auto px-6 mt-4"
          >
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex gap-3 items-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm flex-1">{error}</p>
              <button onClick={() => setError("")} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} className="hidden" />

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex gap-6">
        <div className="flex-1 bg-black/20 backdrop-blur-lg rounded-3xl border border-white/10 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-semibold text-lg">Patient Session</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence>
              {messages.length === 0 && !transcribing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 text-white/50"
                >
                  <Sparkles className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg">Start describing symptoms</p>
                  <p className="text-sm mt-2">Use text, voice, or upload medical images</p>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${["note", "symptoms", "image-analysis"].includes(msg.type) ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-3xl rounded-2xl p-5 shadow-xl relative ${
                      msg.type === "text" || msg.type === "voice"
                        ? "bg-white/10 border border-white/20"
                        : msg.type.includes("image")
                        ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/30"
                        : msg.type === "symptoms"
                        ? "bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-400/30"
                        : msg.type === "note"
                        ? "bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-400/30"
                        : "bg-white/5"
                    }`}
                  >
                    {msg.type === "text" && <p className="whitespace-pre-wrap">{msg.content}</p>}

                    {msg.type === "voice" && (
                      <>
                        <div className="flex items-center gap-2 mb-2 text-cyan-300">
                          <Mic className="w-4 h-4" /> Voice Input
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </>
                    )}

                    {msg.type === "image-upload" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-300">
                          <ImageIcon className="w-4 h-4" /> Image Uploaded
                        </div>
                        <img
                          src={msg.preview}
                          alt="Uploaded medical image"
                          className="rounded-xl max-h-96 object-contain"
                        />
                        {analyzingImage && (
                          <div className="flex items-center gap-2 text-cyan-300">
                            <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                          </div>
                        )}
                      </div>
                    )}

                    {msg.type === "image-analysis" && (
                      <>
                        <div className="flex items-center gap-2 mb-2 text-purple-300">
                          <Eye className="w-4 h-4" /> AI Image Findings
                        </div>
                        <p className="whitespace-pre-wrap text-sm">
                          {msg.fullAnalysis || msg.content}
                        </p>
                      </>
                    )}

                    {msg.type === "symptoms" && (
                      <>
                        <div className="flex items-center gap-2 mb-2 text-blue-300">
                          <FileText className="w-4 h-4" /> Extracted Symptoms
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      </>
                    )}

                    {msg.type === "note" && (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-emerald-300 text-lg font-semibold">
                            <Sparkles className="w-5 h-5" /> AI-Generated Medical Note
                          </div>
                          <button
                            onClick={() => playNoteAudio(msg.content, i)}
                            disabled={playingNoteId === i}
                            className="text-emerald-300 hover:text-emerald-200 transition disabled:opacity-50"
                            title="Read aloud (TTS)"
                          >
                            {playingNoteId === i ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Volume2 className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </>
                    )}

                    {msg.type === "generating" && (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating medical note...</span>
                      </div>
                    )}

                    {msg.type === "assistant" && (
                      <>
                        <div className="flex items-center gap-2 mb-2 text-yellow-300">
                          <Sparkles className="w-4 h-4" /> AI Assistant
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}

              {transcribing && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex justify-end"
                >
                  <div className="max-w-3xl rounded-2xl p-5 bg-white/10 border border-white/20 shadow-xl">
                    <div className="flex items-center gap-3 text-cyan-300">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Transcribing voice...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="self-end mb-32"
          >
            <button
              onClick={generateMedicalNote}
              disabled={analyzing}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-5 px-8 rounded-2xl shadow-2xl flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-70"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" /> Generate Medical Note
                </>
              )}
            </button>
          </motion.div>
        )}
      </div>

      <div className="bg-black/40 backdrop-blur-2xl border-t border-white/10 p-6">
        <div className="max-w-5xl mx-auto">
          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="bg-white/10 rounded-2xl border-2 border-dashed border-white/20 transition-all p-4"
          >
            <div className="flex items-end gap-3">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendText())
                }
                placeholder="Describe symptoms or ask questions..."
                className="flex-1 bg-transparent outline-none resize-none text-white placeholder-white/50 min-h-[44px] max-h-32"
                rows={1}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl hover:bg-white/20 transition"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />

                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing}
                  className={`p-3 rounded-xl transition ${
                    recording ? "bg-red-500 animate-pulse" : "hover:bg-white/20"
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>

                <button
                  onClick={sendText}
                  disabled={!inputValue.trim() || transcribing}
                  className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {uploadPreview && (
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={uploadPreview}
                  alt="Preview"
                  className="h-20 rounded-lg object-cover"
                />
                <button
                  onClick={() => {
                    setUploadPreview(null);
                    setUploadedFile(null);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}