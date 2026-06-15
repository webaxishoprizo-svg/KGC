import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  Mic,
  Send,
  Plus,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertTriangle,
  Image as ImageIcon,
  FileText,
  X,
  Square,
  Bot,
  Clock,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "../Logo";
import { useLang } from "@/lib/language";
import { useAuth } from "@/hooks/useKGC";
import { toast } from "sonner";
import { kgcAPI } from "@/api/kgc";
import { routeComplaint } from "@/lib/mock-data";

type Msg = {
  id: string;
  role: "user" | "ai";
  text?: string;
  draft_text?: string | null;
  is_violation?: boolean;
  feedback?: string | null;
  attachment_url?: string | null;
  attachment_mime_type?: string | null;
  time: string;
};

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const QUICK_CHIPS = ["Water Issue", "Power Cut", "Road Damage", "Health Services", "Agriculture"];

export function ChatPage() {
  const { t, lang } = useLang();
  const { isLoggedIn } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachment, setAttachment] = useState<{
    file: File | Blob;
    url?: string;
    mime_type: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const handleSelectSession = (e: any) => {
      setSessionId(e.detail);
    };
    window.addEventListener("kgc-select-session", handleSelectSession);
    return () => window.removeEventListener("kgc-select-session", handleSelectSession);
  }, []);

  useEffect(() => {
    if (sessionId) {
      loadHistory(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function loadHistory(id: string) {
    try {
      const cached = localStorage.getItem(`kgc_chat_cache_${id}`);
      if (cached) {
        setMessages(JSON.parse(cached));
      }

      const data = await kgcAPI.chat.getSessionHistory(id);
      const msgs: Msg[] = data.messages.map((m) => ({
        id: m.id || crypto.randomUUID(),
        role: m.role as "user" | "ai",
        text: m.text,
        draft_text: m.draft_text,
        is_violation: m.is_violation,
        feedback: m.feedback,
        attachment_url: m.attachment_url,
        attachment_mime_type: m.attachment_mime_type,
        time: m.created_at
          ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : now(),
      }));
      setMessages(msgs);
      localStorage.setItem(`kgc_chat_cache_${id}`, JSON.stringify(msgs));
    } catch (e) {
      toast.error("Failed to load chat history");
    }
  }

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`kgc_chat_cache_${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  function handleNewChat() {
    setSessionId(null);
    setMessages([]);
    setInput("");
    setAttachment(null);
    window.dispatchEvent(new CustomEvent("kgc-select-session", { detail: null }));
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAttachment({ file: audioBlob, mime_type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      toast.error("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachment({ file, mime_type: file.type });
    }
  };

  const handleSend = async (text: string) => {
    const tVal = text.trim();
    if (!tVal && !attachment) return;

    if (!isLoggedIn) {
      toast.error("Please sign in to link this grievance to your Aadhaar profile.");
      window.dispatchEvent(new Event("kgc-open-login"));
      return;
    }

    setIsTyping(true);
    let finalUrl = null;
    let finalMime = null;

    if (attachment) {
      setUploading(true);
      try {
        const res = await kgcAPI.chat.uploadFile(attachment.file);
        finalUrl = res.url;
        finalMime = res.mime_type;
      } catch (e) {
        toast.error("Failed to upload attachment");
        setUploading(false);
        setIsTyping(false);
        return;
      }
      setUploading(false);
    }

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      text: tVal || "Sent an attachment",
      attachment_url: finalUrl,
      attachment_mime_type: finalMime,
      time: now(),
    };

    setMessages((m) => [...m, userMsg]);
    setInput("");
    setAttachment(null);

    try {
      const res = await kgcAPI.chat.sendMessage(
        sessionId,
        tVal || "Sent an attachment",
        finalUrl,
        finalMime,
      );

      if (!sessionId) {
        setSessionId(res.session_id);
        window.dispatchEvent(new CustomEvent("kgc-select-session", { detail: res.session_id }));
        window.dispatchEvent(new Event("kgc-sessions-changed"));
      }

      const aiMsg: Msg = {
        id: crypto.randomUUID(),
        role: "ai",
        text: res.reply,
        draft_text: res.draft_ready ? res.draft_text : null,
        is_violation: res.is_violation,
        time: now(),
      };

      setMessages((m) => [...m, aiMsg]);
    } catch (err: any) {
      if (err.message === "ACCOUNT_SUSPENDED_POLICY_VIOLATION" || err.status === 403) {
        toast.error(
          "🚫 ACCOUNT SUSPENDED: You have been blocked for violating KGC safety policies.",
          { duration: 10000 },
        );
        kgcAPI.auth.logout();
        return;
      }
      toast.error(err.message || "Failed to communicate with AI");
      setMessages((prev) => prev.slice(0, -1)); // remove user msg if AI failed
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendComplaint = async (draftText: string, msgId: string) => {
    setIsTyping(true);
    try {
      // Find the message to get attachment URL if present
      const msg = messages.find((m) => m.id === msgId);
      // Currently the complaints.submit API doesn't accept attachments, but we could pass it here in the future

      const res = await kgcAPI.complaints.submit(draftText);
      const deptName = res.department || "General Services";
      const ticketId = `KGC-2026-${res.ticket_suffix || "GEN"}-${Math.floor(100000 + Math.random() * 900000)}`;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            return {
              ...m,
              draft_text: null,
              text: `✅ **Complaint Registered!**\n\nI have successfully submitted your complaint to the **${deptName}**. Your ticket ID is **${ticketId}**.\n\nYou can track its progress in your dashboard.`,
            };
          }
          return m;
        }),
      );
      toast.success("Complaint submitted successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit complaint");
    } finally {
      setIsTyping(false);
    }
  };

  const handleFeedback = async (msgId: string, rating: "up" | "down") => {
    // Optimistic update
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedback: rating } : m)));
    try {
      await kgcAPI.chat.submitFeedback(msgId, rating);
    } catch (e) {
      toast.error("Failed to submit feedback");
      // Revert on failure (optional, but good UX practice)
    }
  };

  const empty = messages.length === 0;
  const placeholderText =
    lang === "kn" ? "உங்கள் பிரச்சனையை இங்கே தெரிவிக்கவும்..." : t("inputPlaceholder");

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
          {empty ? (
            <WelcomeState onPick={(tVal) => setInput(tVal)} />
          ) : (
            <div className="max-w-3xl mx-auto flex flex-col gap-5">
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id || i}
                  msg={m}
                  onSendComplaint={(text) => handleSendComplaint(text, m.id)}
                  onFeedback={(rating) => handleFeedback(m.id, rating)}
                />
              ))}

              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3 items-start"
                  >
                    <div className="w-8 h-8 rounded-full bg-kgc-primary grid place-items-center text-white shrink-0 shadow-sm mt-1">
                      <Bot size={14} />
                    </div>
                    <div className="bg-gray-100 rounded-2xl px-4 py-3 flex gap-1 items-center border border-black/5">
                      <span className="w-1.5 h-1.5 bg-kgc-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-kgc-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-kgc-primary rounded-full animate-bounce"></span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 md:px-6 pb-4 md:pb-5 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 px-1">
              {QUICK_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => setInput(chip.replace(/\[|\]/g, "").trim())}
                  className="whitespace-nowrap px-3 py-1.5 rounded-xl border border-[#e5e5e5] bg-white text-[13px] font-medium text-kgc-text hover:bg-[#f9f9f9] transition shrink-0"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Attachment Preview */}
            <AnimatePresence>
              {attachment && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 glass-soft rounded-2xl p-2 inline-flex items-center gap-3 bg-white/70"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-kgc-primary/10 to-kgc-accent/10 grid place-items-center text-kgc-primary shrink-0">
                    {attachment.mime_type.startsWith("image/") ? (
                      <ImageIcon size={18} />
                    ) : attachment.mime_type.startsWith("audio/") ? (
                      <Mic size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>
                  <div className="text-xs font-semibold text-kgc-text pr-2">
                    {attachment.mime_type.startsWith("image/")
                      ? "Image attached"
                      : attachment.mime_type.startsWith("audio/")
                        ? "Voice message attached"
                        : "Document attached"}
                  </div>
                  <button
                    onClick={() => setAttachment(null)}
                    className="p-1.5 rounded-full hover:bg-black/5 text-kgc-muted"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-2xl border border-[#e5e5e5] px-3 py-2.5 flex items-end gap-2 shadow-sm bg-[#f4f4f4] focus-within:bg-white focus-within:border-[#ccc] transition-all">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 grid place-items-center rounded-xl text-[#888] hover:bg-[#e5e5e5] transition shrink-0"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                rows={1}
                placeholder={isRecording ? "Recording audio..." : placeholderText}
                className="flex-1 bg-transparent resize-none outline-none text-[15px] placeholder:text-[#888] py-1.5 max-h-40 text-kgc-text"
              />
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`w-9 h-9 grid place-items-center rounded-xl transition shrink-0 ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-[#888] hover:bg-[#e5e5e5]"}`}
              >
                {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
              </button>
              <button
                onClick={() => handleSend(input)}
                disabled={(!input.trim() && !attachment) || isTyping || uploading}
                className={`w-9 h-9 grid place-items-center rounded-xl text-white transition shrink-0 ${
                  (!input.trim() && !attachment) || isTyping || uploading
                    ? "bg-[#e5e5e5] text-[#aaa]"
                    : "bg-[#212121] hover:bg-black"
                }`}
              >
                {isTyping || uploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
            <div className="text-center text-[10px] text-kgc-muted pt-2">{t("dataNotice")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeState({ onPick }: { onPick: (tVal: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center text-center min-h-[60vh]">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-16 h-16 bg-white border border-[#e5e5e5] rounded-full grid place-items-center shadow-sm">
        <Logo size={40} withGradient={false} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-[28px] font-semibold mt-6 tracking-tight text-[#212121]"
      >
        How can I help you today?
      </motion.h1>
    </div>
  );
}

function MessageBubble({
  msg,
  onSendComplaint,
  onFeedback,
}: {
  msg: Msg;
  onSendComplaint: (text: string) => void;
  onFeedback: (rating: "up" | "down") => void;
}) {
  const isUser = msg.role === "user";
  const [draft, setDraft] = useState(msg.draft_text || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} w-full`}
    >
      {!isUser && (
        <div
          className={`w-8 h-8 rounded-full grid place-items-center text-white shrink-0 mt-0.5 ${msg.is_violation ? "bg-red-500" : "bg-[#10a37f]"}`}
        >
          {msg.is_violation ? <AlertTriangle size={14} /> : <Bot size={14} />}
        </div>
      )}
      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Render Attachments */}
        {msg.attachment_url && msg.attachment_mime_type && (
          <div
            className={`mb-2 rounded-xl overflow-hidden shadow-sm border border-black/5 ${isUser ? "bg-white/10" : "bg-black/5"}`}
          >
            {msg.attachment_mime_type.startsWith("image/") ? (
              <img
                src={`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://mubxii-kgc-backend.hf.space" : "http://localhost:8000")}${msg.attachment_url}`}
                alt="Attachment"
                className="max-w-full h-auto max-h-60 object-contain"
              />
            ) : msg.attachment_mime_type.startsWith("audio/") ? (
              <audio
                controls
                src={`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://mubxii-kgc-backend.hf.space" : "http://localhost:8000")}${msg.attachment_url}`}
                className="max-w-full h-10 m-2"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-white/50 backdrop-blur-sm text-sm text-kgc-primary font-medium">
                <FileText size={18} /> Document attached
              </div>
            )}
          </div>
        )}

        {msg.text && msg.text !== "Sent an attachment" && (
          <div
            className={
              isUser
                ? "rounded-2xl px-5 py-3 text-[15px] leading-relaxed text-kgc-text bg-[#f4f4f4]"
                : msg.is_violation
                  ? "rounded-xl px-4 py-3 text-[15px] leading-relaxed text-red-900 bg-red-50 border border-red-100 font-medium"
                  : "text-[15px] leading-relaxed text-[#212121] whitespace-pre-wrap py-1.5"
            }
          >
            {msg.text}
          </div>
        )}

        {!isUser &&
          !msg.is_violation &&
          msg.text &&
          /(water|tneb|power|health|road|highway|street|pipe|light)/i.test(msg.text) && (
            <div
              className="w-full mt-3 glass-soft rounded-xl border p-3 flex flex-col gap-2 shadow-sm overflow-hidden relative"
              style={{ borderColor: routeComplaint(msg.text).color + "40" }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: routeComplaint(msg.text).color }}
              />
              <div className="flex items-start justify-between gap-2 pl-2">
                <div>
                  <div className="text-[10px] font-bold tracking-wider text-kgc-muted uppercase">
                    Automated Routing
                  </div>
                  <div className="text-sm font-bold text-kgc-text flex items-center gap-1.5 mt-0.5">
                    {routeComplaint(msg.text).emoji} Routed to: {routeComplaint(msg.text).name}
                  </div>
                </div>
                <div className="px-2 py-1 rounded-full bg-orange-50 border border-orange-100 text-[10px] font-bold text-orange-700 flex items-center gap-1">
                  <Clock size={10} /> SLA: 48 Hrs
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-1 pl-2">
                <button className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white border border-black/10 hover:bg-black/5 transition text-kgc-text flex items-center gap-1">
                  Escalate <ChevronRight size={10} />
                </button>
                <button className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white border border-black/10 hover:bg-black/5 transition text-kgc-text flex items-center gap-1">
                  <ImageIcon size={10} /> Attach Photo
                </button>
                <button className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white border border-black/10 hover:bg-black/5 transition text-kgc-text flex items-center gap-1">
                  View Similar
                </button>
              </div>
            </div>
          )}

        {msg.draft_text && !msg.is_violation && (
          <div className="w-full mt-3 glass-soft rounded-2xl p-4 border border-kgc-primary/30 bg-white/60">
            <div className="flex items-center gap-2 text-[13px] font-bold text-kgc-primary mb-2">
              <Paperclip size={15} /> Complaint Draft (Editable)
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full h-32 text-[13px] p-3 rounded-xl border border-black/10 bg-white resize-none outline-none focus:border-kgc-primary/50"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => onSendComplaint(draft)}
                className="bg-kgc-primary hover:bg-kgc-accent text-white px-5 py-2 rounded-xl text-[13px] font-semibold lift shadow-sm flex items-center gap-2"
              >
                <Send size={14} /> Send Complaint
              </button>
            </div>
          </div>
        )}

        <div
          className={`flex items-center gap-2 mt-1 ${isUser ? "justify-end" : "justify-start w-full"}`}
        >
          <span className="text-[9px] text-kgc-muted">{msg.time}</span>
          {!isUser && !msg.is_violation && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => onFeedback("up")}
                className={`p-1 rounded-md transition ${msg.feedback === "up" ? "text-kgc-primary bg-kgc-primary/10" : "text-kgc-muted hover:bg-black/5"}`}
              >
                <ThumbsUp size={12} className={msg.feedback === "up" ? "fill-current" : ""} />
              </button>
              <button
                onClick={() => onFeedback("down")}
                className={`p-1 rounded-md transition ${msg.feedback === "down" ? "text-red-500 bg-red-500/10" : "text-kgc-muted hover:bg-black/5"}`}
              >
                <ThumbsDown size={12} className={msg.feedback === "down" ? "fill-current" : ""} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
