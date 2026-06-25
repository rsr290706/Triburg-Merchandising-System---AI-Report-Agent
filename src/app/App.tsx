import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Star,
  FileText,
  Plus,
  Clock,
  Settings,
  Upload,
  Send,
  BarChart2,
  Moon,
  Sun,
} from "lucide-react";

type Chat = {
  id: string;
  title: string;
  time: string;
};

const chats: Chat[] = [
  { id: "1", title: "March 2025 Rejection Analysis", time: "2h ago" },
  { id: "2", title: "Vendor B Performance Q1", time: "Yesterday" },
  { id: "3", title: "Shipment Delay Summary", time: "2 days ago" },
  { id: "4", title: "Top Quality Vendors 2024", time: "Last week" },
  { id: "5", title: "Monthly Inspection Trends", time: "Last week" },
];

const quickPrompts = [
  "Vendor Performance",
  "Monthly Inspection Report",
  "Rejection Analysis",
  "Quality Trends",
  "Shipment Summary",
  "Top Performing Vendors",
  "Delay Analysis",
];

const tabs = [
  { icon: MessageSquare, label: "Chats" },
  { icon: Star, label: "Starred" },
  { icon: FileText, label: "Files" },
];

export default function App() {
  const [activeChat, setActiveChat] = useState("1");
  const [activeTab, setActiveTab] = useState(0);
  const [input, setInput] = useState("");
  const [dark, setDark] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full bg-background text-foreground" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

        {/* ── Sidebar ── */}
        <aside
          className="flex flex-col shrink-0 border-r border-border"
          style={{ width: 210, background: "var(--sidebar)" }}
        >
          {/* Top header */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
            <div
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{ width: 28, height: 28, background: "#2563eb" }}
            >
              <BarChart2 className="text-white" style={{ width: 15, height: 15 }} strokeWidth={2} />
            </div>
            <span
              className="text-foreground font-semibold leading-tight"
              style={{ fontSize: 12.5, flex: 1 }}
            >
              Triburg Merchandising System
            </span>
            <button
              onClick={() => setDark((d) => !d)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              {dark
                ? <Sun style={{ width: 15, height: 15 }} />
                : <Moon style={{ width: 15, height: 15 }} />
              }
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* New Chat */}
          <div className="px-3 pt-3 pb-2">
            <button
              className="w-full flex items-center justify-center gap-2 rounded-xl text-white font-semibold text-sm py-2.5 transition-opacity hover:opacity-90"
              style={{ background: "#2563eb" }}
            >
              <Plus style={{ width: 16, height: 16 }} strokeWidth={2.5} />
              New Chat
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pb-3">
            {tabs.map(({ icon: Icon, label }, i) => (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-lg transition-colors ${
                  activeTab === i
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon style={{ width: 15, height: 15 }} strokeWidth={1.75} />
              </button>
            ))}
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                  activeChat === chat.id
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <p
                  className={`font-medium leading-snug ${activeChat === chat.id ? "text-foreground" : "text-foreground/80"}`}
                  style={{ fontSize: 12.5 }}
                >
                  {chat.title}
                </p>
                <p className="flex items-center gap-1 text-muted-foreground mt-0.5" style={{ fontSize: 11 }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {chat.time}
                </p>
              </button>
            ))}
          </div>

          {/* Database status */}
          <div className="px-3 py-3 border-t border-border">
            <div
              className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5"
              style={{ background: dark ? "#0f291f" : "#f0fdf4" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: "#22c55e" }}
                />
                <span className="font-semibold text-foreground" style={{ fontSize: 12 }}>
                  Database Connected
                </span>
              </div>
              <p className="text-muted-foreground pl-4" style={{ fontSize: 11 }}>
                TMS_PROD · 14 tables
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main
          className="flex-1 flex items-center justify-center p-8 overflow-y-auto"
          style={{ background: dark ? "#0b0d11" : "#f3f4f6" }}
        >
          <div
            className="w-full rounded-2xl border border-border p-8"
            style={{
              maxWidth: 720,
              background: dark ? "#141720" : "#ffffff",
            }}
          >
            {/* Card header */}
            <div className="flex items-start gap-3 mb-6">
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 38, height: 38, background: "#2563eb" }}
              >
                <BarChart2 className="text-white" style={{ width: 20, height: 20 }} strokeWidth={2} />
              </div>
              <div>
                <h1 className="font-semibold text-foreground" style={{ fontSize: 20, lineHeight: 1.3 }}>
                  Ask your data anything
                </h1>
                <p className="text-muted-foreground mt-0.5" style={{ fontSize: 13.5 }}>
                  Query your databases using plain English — no SQL knowledge required.
                </p>
              </div>
            </div>

            {/* Prompt input row — textarea + send button to the right */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex-1 rounded-xl border border-border overflow-hidden"
                style={{ background: dark ? "#1e2230" : "#f9fafb" }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Example: Show me the total rejected inspection quantity for Vendor A in March 2025."
                  rows={1}
                  className="w-full resize-none overflow-hidden bg-transparent text-foreground placeholder:text-muted-foreground outline-none leading-snug px-3 py-2"
                  style={{
                    fontSize: 13.5,
                    minHeight: 30,
                    maxHeight: 160,
                    scrollbarWidth: "none",
                  }}
                />
              </div>
              {/* Send button — right of textarea */}
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex items-center justify-center rounded-xl transition-all shrink-0"
                style={{
                  width: 34,
                  height: 34,
                  background: input.trim() ? "#2563eb" : dark ? "#1e2230" : "#e5e7eb",
                  color: input.trim() ? "#ffffff" : dark ? "#4b5563" : "#9ca3af",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                }}
              >
                <Send style={{ width: 17, height: 17 }} />
              </button>
            </div>

            {/* File drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); }}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-5 mb-5 transition-colors"
              style={{
                borderColor: dragging ? "#2563eb" : dark ? "rgba(255,255,255,0.12)" : "#d1d5db",
                background: dragging
                  ? dark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.04)"
                  : "transparent",
              }}
            >
              <Upload
                className="mb-2"
                style={{ width: 20, height: 20, color: dark ? "#6b7280" : "#9ca3af" }}
                strokeWidth={1.75}
              />
              <p className="font-semibold text-foreground" style={{ fontSize: 13 }}>
                Drop files to attach
              </p>
              <p className="text-muted-foreground mt-0.5" style={{ fontSize: 12 }}>
                CSV, Excel (.xlsx), PDF supported
              </p>
            </div>

            {/* Quick prompts */}
            <div>
              <p className="text-muted-foreground mb-2.5" style={{ fontSize: 12.5 }}>
                Quick prompts
              </p>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-border text-foreground hover:border-primary hover:text-primary transition-colors"
                    style={{
                      fontSize: 12.5,
                      paddingLeft: 14,
                      paddingRight: 14,
                      paddingTop: 6,
                      paddingBottom: 6,
                      background: "transparent",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
  );
}
