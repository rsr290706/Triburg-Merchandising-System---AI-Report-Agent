import { queryTMS, downloadExcel } from "./services/tmsApi";
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
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const question = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    setQueryError(null);
    setResult(null);
    setGeneratedSQL(null);
    try {
      const data = await queryTMS(question);
      setGeneratedSQL(data.generated_sql);
      setResult(data.result);
      setLastQuestion(question);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!lastQuestion) return;

    try {
      setExporting(true);
      setExportError(null);

      await downloadExcel(lastQuestion);

    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setExporting(false);
    }
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
        className="flex-1 flex justify-center p-8 overflow-y-auto"
        style={{ background: dark ? "#0b0d11" : "#f3f4f6" }}
      >
        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{
            background: dark ? "#141720" : "#ffffff",
            alignSelf: "flex-start",
            width: "100%",
          }}
        >
          {/* Card inner padding wrapper */}
          <div className="p-8 pb-0">
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

            {/* Prompt input row */}
            <div className="flex items-center gap-2 mb-4">
              <div
                className="flex-1 rounded-xl border border-border overflow-hidden flex items-center"
                style={{ background: dark ? "#1e2230" : "#f9fafb" }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Example: Show me the total rejected inspection quantity for Vendor A in March 2025."
                  rows={1}
                  className="w-full resize-none overflow-hidden bg-transparent text-foreground placeholder:text-gray-300 dark:placeholder:text-gray-700 outline-none leading-snug px-3 py-1.5"
                  style={{
                    fontSize: 13.5,
                    minHeight: 28,
                    maxHeight: 160,
                    scrollbarWidth: "none",
                  }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
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
            <div className="pb-6">
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

          {/* Loading / error states — inside padding */}
          {loading && (
            <p className="text-muted-foreground px-8 pb-6 text-sm">Thinking...</p>
          )}

          {queryError && (
            <div className="mx-8 mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3">
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">Error</p>
              <p className="text-red-500 text-xs mt-1">{queryError}</p>
            </div>
          )}
          {exportError && (
            <div className="mx-8 mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p>{exportError}</p>
            </div>
          )}

          {/* Generated SQL — full-width flush section */}
          {generatedSQL && (
            <div
              className="border-t border-border px-8 py-5"
              style={{ background: dark ? "#111419" : "#f9fafb" }}
            >
              <p className="text-muted-foreground mb-2" style={{ fontSize: 12.5 }}>Generated SQL</p>
              <pre
                className="rounded-xl border border-border px-4 py-3 text-xs overflow-x-auto"
                style={{ background: dark ? "#1e2230" : "#ffffff" }}
              >
                {generatedSQL}
              </pre>
            </div>
          )}

          <div
            className="px-8 py-3 border-t border-border flex justify-end"
            style={{ background: dark ? "#111419" : "#f9fafb" }}
          >
            <button
              onClick={handleExport}
              disabled={!result || exporting}
              className="rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? "Exporting..." : "📥 Download Excel"}
            </button>
          </div>

          {/* Results table — full-width flush at the bottom */}
          {result && (
            <div
              className="border-t border-border"
              style={{ background: dark ? "#111419" : "#f9fafb" }}
            >
              <div className="px-8 pt-5 pb-3">
                <p className="text-muted-foreground" style={{ fontSize: 12.5 }}>
                  Results — {result.length} row{result.length !== 1 ? "s" : ""}
                </p>
              </div>
              {result.length > 0 ? (
                <div
                  className="overflow-x-auto overflow-y-auto"
                  style={{ maxHeight: "55vh" }}
                >
                  <table
                    className="min-w-full text-left"
                    style={{ fontSize: 12.5, borderCollapse: "separate", borderSpacing: 0 }}
                  >
                    <thead>
                      <tr>
                        {Object.keys(result[0]).map((col, idx) => (
                          <th
                            key={col}
                            className="py-2 font-semibold text-foreground whitespace-nowrap"
                            style={{
                              position: "sticky",
                              top: 0,
                              background: dark ? "#111419" : "#f9fafb",
                              boxShadow: dark
                                ? "0 1px 0 rgba(255,255,255,0.09)"
                                : "0 1px 0 rgba(0,0,0,0.09)",
                              zIndex: 1,
                              paddingLeft: idx === 0 ? 32 : 0,
                              paddingRight: 24,
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-accent/30 transition-colors"
                          style={{
                            borderBottom: i < result.length - 1
                              ? `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`
                              : "none",
                          }}
                        >
                          {Object.values(row).map((val, j) => (
                            <td
                              key={j}
                              className="py-2 text-foreground/80 whitespace-nowrap"
                              style={{
                                paddingLeft: j === 0 ? 32 : 0,
                                paddingRight: 24,
                              }}
                            >
                              {String(val ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Smooth bottom cap */}
                  <div className="h-6" />
                </div>
              ) : (
                <p className="text-muted-foreground px-8 pb-6 text-sm">No results found.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
