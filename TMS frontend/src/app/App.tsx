import {
    queryTMS,
    downloadExcel,
    uploadDataFile,
    clearSemanticCache,
} from "./services/tmsApi";
import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Star,
  FileText,
  Plus,
  Clock,
  Settings,
  Paperclip,
  Send,
  BarChart2,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  PanelLeft,
  Trash2,
  Database,
} from "lucide-react";

const palette = {
  bg: "#0A0A0A",
  bgSecondary: "#111111",
  sidebar: "#171717",
  card: "#1A1A1A",
  border: "#2A2A2A",
  text: "#FAFAFA",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  hover: "#222222",
};

type Message={

id:string;

role:"user"|"assistant";

content:string;

generatedSQL?:string;

result?:Record<string,unknown>[];

cached?:boolean;

durationMs?:number;

timestamp:string;

}

type Conversation = {
    id: string;

    title: string;

    createdAt: string;

    updatedAt: string;

    messages: Message[];

    starred: boolean;

    pinned: boolean;

    datasetId?: string;

    datasetName?: string;

    preview?: string;

    totalMessages: number;
};

type ImportedDataset = {
  dataset_id: string;
  filename: string;
  row_count: number;
  columns: string[];
};

const tabs = [
  { icon: MessageSquare, label: "conversations" },
  { icon: Star, label: "Starred" },
];

const querySteps = [
  { label: "Checking cache", detail: "Looking for a matching previous question" },
  { label: "Reading schema", detail: "Finding the relevant TMS tables and columns" },
  { label: "Generating SQL", detail: "Translating your question into a safe query" },
  { label: "Running query", detail: "Fetching rows from the database" },
  { label: "Preparing table", detail: "Formatting the result for display" },
];

const formatDuration = (durationMs: number) => {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
};

const formatRelativeTime = (iso: string) => {

    const now = new Date();

    const date = new Date(iso);

    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "Just now";

    if (minutes < 60) {
        return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    }

    const days = Math.floor(hours / 24);

    if (days === 1) {
        return "Yesterday";
    }

    if (days < 7) {
        return `${days} days ago`;
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });

};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Record<string, unknown>[] | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedSQL, setGeneratedSQL] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [queryComplete, setQueryComplete] = useState(false);
  const [wasCached, setWasCached] = useState(false);
  const [showQueryProgress, setShowQueryProgress] = useState(false);
  const [queryDurationMs, setQueryDurationMs] = useState<number | null>(null);
  const [importedDataset, setImportedDataset] = useState<ImportedDataset | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastDatasetId, setLastDatasetId] = useState<string | null>(null);
  const [showSettingsMenu,setShowSettingsMenu]=useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState({
  database: "",
  tables: 0,
  });

  useEffect(() => {

    const savedConversations = localStorage.getItem("tms-conversations");

    if (savedConversations) {

        const parsed = JSON.parse(savedConversations);

        setConversations(parsed);

        if (parsed.length > 0) {
            setCurrentConversationId(parsed[0].id);
        }
    }

  }, []);

  useEffect(() => {
    localStorage.setItem(
        "tms-conversations",
        JSON.stringify(conversations)
    );
  }, [conversations]);

  useEffect(() => {

    const saved = localStorage.getItem("tms-conversations");

    if (!saved) {

        createConversation();

    }

  }, []);

  useEffect(() => {

    if (!currentConversationId) return;

    const conversation = conversations.find(
        c => c.id === currentConversationId
    );

    if (!conversation) return;

    const assistantMessages = conversation.messages.filter(
        m => m.role === "assistant"
    );

    const latest =
    assistantMessages[assistantMessages.length - 1];

    if (!latest) {

    setResult(null);
    setGeneratedSQL(null);

    setLastQuestion("");
    setInput("");

    if (textareaRef.current) {
        textareaRef.current.value = "";
        autoResize(textareaRef.current);
    }

    return;
    }

    setGeneratedSQL(latest.generatedSQL ?? null);
    setResult(latest.result ?? null);

    const lastUser = [...conversation.messages]
    .reverse()
    .find(m => m.role === "user");

    const latestPrompt = lastUser?.content ?? "";

    setLastQuestion(latestPrompt);
    setInput(latestPrompt);

    if (textareaRef.current) {
        textareaRef.current.value = latestPrompt;
        autoResize(textareaRef.current);
    }

  }, [currentConversationId, conversations]);

  useEffect(() => {
    if (!loading) return;

    const interval = window.setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, querySteps.length - 1));
    }, 1200);

    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!queryComplete) return;

    const timeout = window.setTimeout(() => {
      setShowQueryProgress(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [queryComplete]);

  useEffect(() => {

      async function loadDatabaseInfo() {

          try {

              const response = await fetch(
                  `${import.meta.env.VITE_API_URL}/database-info`
              );

              if (!response.ok)
                  throw new Error("Failed to fetch database info");

              const data = await response.json();

              setDatabaseInfo(data);

          }
          catch (err) {

              console.error(err);

          }

      }

      loadDatabaseInfo();

  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleClearCache=async()=>{

    try{

        await clearSemanticCache();

        alert("Semantic cache cleared.");

        setShowSettingsMenu(false);

    }

    catch(err: unknown){
        console.error(err);
        alert("Failed.");
    }

  }
  const createConversation = () => {

    const id = crypto.randomUUID();

    const conversation: Conversation = {
    id,
    title: "New Chat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    messages: [],

    starred: false,
    pinned: false,

    datasetId: undefined,
    datasetName: undefined,

    preview: "",

    totalMessages: 0,
    };

    setConversations(prev => [

        conversation,

        ...prev

    ]);

    setCurrentConversationId(id);
    setInput("");

    setResult(null);

    setGeneratedSQL(null);

    setQueryError(null);

    setExportError(null);

    setLastQuestion("");

    setQueryDurationMs(null);

    setShowQueryProgress(false);

    setQueryComplete(false);

    setWasCached(false);

    setLoading(false);

    setActiveStep(0);

    setImportedDataset(null);
    setLastDatasetId(null);
    setUploadError(null);

    if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }

  };

  const deleteConversation = (conversationId: string) => {
    setConversations(prev => {

        const updated = prev.filter(
            chat => chat.id !== conversationId
        );

        // If no conversations remain, create a new one
        if (updated.length === 0) {

            const newConversation: Conversation = {
                id: crypto.randomUUID(),
                title: "New Chat",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                messages: [],
                starred: false,
                pinned: false,
                datasetId: undefined,
                datasetName: undefined,
                preview: "",
                totalMessages: 0
            };

            setCurrentConversationId(newConversation.id);

            return [newConversation];
        }

        // If the deleted conversation was open,
        // switch to the first remaining conversation
        if (currentConversationId === conversationId) {
            setCurrentConversationId(updated[0].id);
        }

        return updated;
    });
  };

  const toggleStar = (conversationId: string) => {

      setConversations(prev => {

          const updated = prev.map(chat =>
              chat.id === conversationId
                  ? {
                      ...chat,
                      starred: !chat.starred
                  }
                  : chat
          );

          if (
              activeTab === 1 &&
              updated.every(chat => !chat.starred)
          ) {
              setActiveTab(0);
          }

          return updated;

      });

  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const handleFileUpload = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !["csv", "xls", "xlsx"].includes(extension)) {
      setUploadError("Upload a CSV, XLS, or XLSX file.");
      return;
    }

    try {
      setUploadingFile(true);
      setUploadError(null);
      const data = await uploadDataFile(file);
      setImportedDataset(data);
      setResult(null);
      setGeneratedSQL(null);
      setQueryDurationMs(null);
      setLastQuestion("");
      setLastDatasetId(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "File upload failed");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (uploadingFile)
    return;

if (!input.trim())
    if (uploadingFile)
        return;

    if (!input.trim())
        return;
    const question = input.trim();
    setInput(question);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    setQueryError(null);
    setUploadError(null);
    setResult(null);
    setGeneratedSQL(null);
    setActiveStep(0);
    setQueryComplete(false);
    setWasCached(false);
    setShowQueryProgress(true);
    setQueryDurationMs(null);
    try {
      const data = await queryTMS(question, importedDataset?.dataset_id);
      const userMessage : Message = {

          id: crypto.randomUUID(),

          role: "user",

          content: question,

          timestamp: new Date().toISOString()

      };

      const assistantMessage : Message = {

          id: crypto.randomUUID(),

          role: "assistant",

          content: "SQL generated",

          generatedSQL: data.generated_sql,

          result: data.result,

          timestamp: new Date().toISOString()

      };
      setGeneratedSQL(data.generated_sql);
      setResult(data.result);
      setLastQuestion(question);;
      setLastDatasetId(importedDataset?.dataset_id ?? null);
      setWasCached(Boolean(data.cached));
      setQueryDurationMs(typeof data.duration_ms === "number" ? data.duration_ms : null);
      setConversations(previous =>

          previous.map(chat => {

              if (chat.id !== currentConversationId)

                  return chat;

              return {
                  ...chat,

                  updatedAt: new Date().toISOString(),

                  title:
                      chat.messages.length === 0
                          ? question.slice(0, 40)
                          : chat.title,

                  preview: question,

                  totalMessages: chat.messages.length + 2,

                  datasetId: importedDataset?.dataset_id,

                  datasetName: importedDataset?.filename,

                  messages: [
                      ...chat.messages,
                      userMessage,
                      assistantMessage
                  ]
              };

          })

      );
      setActiveStep(querySteps.length - 1);
      setQueryComplete(true);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : "Something went wrong");
      setQueryComplete(false);
      setShowQueryProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!lastQuestion) return;

    try {
      setExporting(true);
      setExportError(null);

      await downloadExcel(lastQuestion, lastDatasetId);

    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setExporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (uploadingFile)
        return;

    if (e.key === "Enter" && !e.shiftKey) {

        e.preventDefault();

        handleSend();

    }
  };

  const starredChats = conversations
      .filter(chat => chat.starred)
      .sort(
          (a, b) =>
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
      );

  const historyChats = conversations
      .filter(chat => !chat.starred)
      .sort(
          (a, b) =>
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
      );

  const displayedChats =
      activeTab === 1
          ? starredChats
          : historyChats;

  return (
    <div
      className="flex h-full"
      style={{
        fontFamily:
          '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
        background: palette.bg,
        color: palette.text,
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          width: sidebarCollapsed ? 0 : 240,
          background: palette.sidebar,
          borderRight: sidebarCollapsed ? "none" : `1px solid ${palette.border}`,
        }}
      >
        <div
          className="flex flex-col h-full transition-opacity duration-200"
          style={{ width: 240, opacity: sidebarCollapsed ? 0 : 1 }}
        >
          {/* Top header */}
          <div
            className="flex items-center gap-2.5 px-4 py-4"
            style={{ borderBottom: `1px solid ${palette.border}` }}
          >
            <div
              className="flex items-center justify-center rounded-md shrink-0"
              style={{ width: 24, height: 24, background: palette.text }}
            >
              <BarChart2 style={{ width: 14, height: 14, color: palette.bg }} strokeWidth={2} />
            </div>
            <span
              className="font-semibold leading-tight truncate"
              style={{ fontSize: 13, flex: 1, color: palette.text }}
              title="Triburg Merchandising System"
            >
              Triburg TMS
            </span>
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-1 rounded-md transition-colors"
                style={{ color: palette.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = palette.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = palette.textMuted)}
              >
                <Settings size={14} />
              </button>

              {showSettingsMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-lg z-50 overflow-hidden shadow-lg"
                  style={{ background: palette.card, border: `1px solid ${palette.border}` }}
                >
                  <button
                    onClick={handleClearCache}
                    className="w-full flex items-center gap-2 text-left px-3.5 py-2.5 transition-colors"
                    style={{ fontSize: 12.5, color: "#f87171" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = palette.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Trash2 style={{ width: 13, height: 13 }} />
                    Clear semantic cache
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* New Chat */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={createConversation}
              className="w-full flex items-center justify-center gap-2 rounded-lg font-semibold transition-opacity hover:opacity-85"
              style={{ background: palette.text, color: palette.bg, fontSize: 12.5, padding: "9px 0" }}
            >
              <Plus style={{ width: 14, height: 14 }} strokeWidth={2.5} />
              New Chat
            </button>
          </div>

          {/* Nav / tabs */}
          <div className="flex flex-col gap-0.5 px-2 pb-3">
            {tabs.map(({ icon: Icon, label }, i) => {
              const active = activeTab === i;
              return (
                <button
                  key={label}
                  onClick={() => setActiveTab(i)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors capitalize"
                  style={{
                    fontSize: 12.5,
                    background: active ? palette.hover : "transparent",
                    color: active ? palette.text : palette.textSecondary,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = palette.hover;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon style={{ width: 15, height: 15 }} strokeWidth={1.75} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Chat list */}
          <p
            className="px-5 pb-2 font-semibold uppercase tracking-wide"
            style={{ fontSize: 10.5, color: palette.textMuted, letterSpacing: "0.06em" }}
          >
            {activeTab === 0 ? "History" : "Starred"}
          </p>
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
            {displayedChats.length === 0 ? (

                <div
                    className="flex flex-col items-center justify-center py-12"
                    style={{ color: palette.textMuted }}
                >
                    <Star size={22} />

                    <p className="mt-2 text-xs">
                        {activeTab === 1
                            ? "No starred conversations"
                            : "No conversations"}
                    </p>

                </div>

            ) : (

                displayedChats.map((chat) => {

                    const active = currentConversationId === chat.id;

                    return (
                      <button
                        key={chat.id}
                        onClick={() => setCurrentConversationId(chat.id)}
                        className="w-full text-left px-3 py-2.5 rounded-lg transition-colors group"
                        style={{ background: active ? palette.hover : "transparent" }}
                        onMouseEnter={(e) => {
                          if (!active) e.currentTarget.style.background = palette.hover;
                        }}
                        onMouseLeave={(e) => {
                          if (!active) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-medium leading-snug truncate"
                              style={{ fontSize: 12.5, color: active ? palette.text : palette.textSecondary }}
                            >
                              {chat.title}
                            </p>
                            <p
                              className="flex items-center gap-1 mt-1"
                              style={{ fontSize: 11, color: palette.textMuted }}
                            >
                              <Clock style={{ width: 10, height: 10 }} />
                              {formatRelativeTime(chat.updatedAt)}
                            </p>
                          </div>
                          <div
                              className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      deleteConversation(chat.id);
                                  }}
                                  className="p-1 rounded hover:bg-neutral-700"
                              >
                                  <Trash2
                                      size={12}
                                      color={palette.textMuted}
                                  />
                              </button>

                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStar(chat.id);
                                  }}
                                  className="p-1 rounded hover:bg-neutral-700"
                              >
                                  <Star
                                      size={12}
                                      fill={chat.starred ? "#facc15" : "none"}
                                      color={chat.starred ? "#facc15" : palette.textMuted}
                                      className="transition-colors group-hover:text-yellow-400"
                                  />
                              </button>
                          </div>
                        </div>
                      </button>
                    );
                  })
            )}
          </div>

          {/* Database status */}
          <div className="px-3 py-3" style={{ borderTop: `1px solid ${palette.border}` }}>
            <div
              className="flex flex-col gap-1 rounded-lg px-3 py-2.5"
              style={{ background: palette.card, border: `1px solid ${palette.border}` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.15)" }}
                />
                <span className="font-semibold" style={{ fontSize: 11.5, color: palette.text }}>
                  Database Connected
                </span>
              </div>
              <p className="pl-3.5" style={{ fontSize: 11, color: palette.textMuted }}>
                {databaseInfo.database
                  ? `${databaseInfo.database} · ${databaseInfo.tables} tables`
                  : "Loading..."}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: palette.bg }}>
        {/* Top bar */}
        <div
          className="flex items-center gap-3 px-5 shrink-0"
          style={{ height: 52, borderBottom: `1px solid ${palette.border}`, background: palette.bg }}
        >
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: palette.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.background = palette.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <PanelLeft style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ width: 1, height: 16, background: palette.border }} />
          <span className="font-semibold" style={{ fontSize: 13, color: palette.text }}>
            {importedDataset ? importedDataset.filename : "Ask your data"}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: palette.textMuted }}>
            <Database style={{ width: 12, height: 12 }} />
            {databaseInfo.database || "—"}
          </div>
        </div>

        {/* Scrollable content */}
        <main className="flex-1 flex justify-center px-8 py-8 overflow-y-auto">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: palette.card,
              border: `1px solid ${palette.border}`,
              alignSelf: "flex-start",
              width: "100%",
              maxWidth: 1040,
            }}
          >
            {/* Card inner padding wrapper */}
            <div className="p-6 pb-0">
              {/* Card header */}
              <div className="flex items-start gap-3 mb-6">
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{ width: 34, height: 34, background: palette.hover, border: `1px solid ${palette.border}` }}
                >
                  <BarChart2 style={{ width: 17, height: 17, color: palette.text }} strokeWidth={1.75} />
                </div>
                <div>
                  <h1 className="font-semibold" style={{ fontSize: 16, lineHeight: 1.3, color: palette.text }}>
                    Ask your data anything
                  </h1>
                  <p className="mt-0.5" style={{ fontSize: 12.5, color: palette.textSecondary }}>
                    Query your databases using plain English — no SQL knowledge required.
                  </p>
                </div>
              </div>

              {/* Prompt input row */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="flex-1 rounded-lg overflow-hidden flex items-center transition-colors"
                  style={{ background: palette.bgSecondary, border: `1px solid ${palette.border}` }}
                >
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      const value = e.target.value;
                      setInput(value);
                      autoResize(e.target);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={uploadingFile}
                    placeholder={
                      importedDataset
                        ? lastQuestion || "Ask a question about the imported file..."
                        : lastQuestion ||
                          "Example: Show me the total rejected inspection quantity for Vendor A in March 2025."
                    }
                    rows={1}
                    className="w-full resize-none overflow-hidden bg-transparent outline-none leading-snug px-3.5 py-2"
                    style={{
                      fontSize: 13,
                      minHeight: 34,
                      maxHeight: 160,
                      scrollbarWidth: "none",
                      color: palette.text,
                    }}
                  />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                <div className="relative group shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="flex items-center justify-center rounded-lg transition-all shrink-0 disabled:opacity-50"
                    style={{
                      width: 34,
                      height: 34,
                      background: importedDataset ? palette.hover : palette.bgSecondary,
                      border: `1px solid ${palette.border}`,
                      color: importedDataset ? palette.text : palette.textMuted,
                    }}
                  >
                    <Paperclip style={{ width: 15, height: 15 }} />
                  </button>

                  <div className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                    {importedDataset ? (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap shadow-lg"
                        style={{ background: palette.card, border: `1px solid ${palette.border}` }}
                      >
                        <FileText style={{ width: 14, height: 14, color: palette.text }} />
                        <span style={{ fontSize: 12, color: palette.text }}>{importedDataset.filename}</span>
                        <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                          {importedDataset.row_count.toLocaleString()} rows | {importedDataset.columns.length} columns
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImportedDataset(null);
                            setLastDatasetId(null);
                            setUploadError(null);
                          }}
                          style={{ color: palette.textMuted }}
                        >
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="rounded-lg px-3 py-2 whitespace-nowrap shadow-lg"
                        style={{ background: palette.card, border: `1px solid ${palette.border}` }}
                      >
                        <p style={{ fontSize: 12, color: palette.text }}>Attach a CSV or Excel file</p>
                        <p style={{ fontSize: 11, color: palette.textMuted }}>CSV, Excel (.xls, .xlsx) supported</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading || uploadingFile}
                  className="flex items-center justify-center rounded-lg transition-all shrink-0"
                  style={{
                    width: 34,
                    height: 34,
                    background: input.trim() ? palette.text : palette.bgSecondary,
                    border: `1px solid ${input.trim() ? palette.text : palette.border}`,
                    color: input.trim() ? palette.bg : palette.textMuted,
                    cursor: input.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  <Send style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {uploadError && (
                <p className="mb-4" style={{ fontSize: 12, color: "#f87171" }}>
                  {uploadError}
                </p>
              )}
              {uploadingFile && (
                <div
                  className="mb-4 rounded-lg px-4 py-3 flex items-center gap-3"
                  style={{ background: palette.bgSecondary, border: `1px solid ${palette.border}` }}
                >
                  <Loader2 className="animate-spin" style={{ color: palette.text }} size={16} />
                  <div>
                    <p className="font-medium" style={{ color: palette.text, fontSize: 12.5 }}>
                      Processing file...
                    </p>
                    <p style={{ color: palette.textMuted, fontSize: 11.5 }}>
                      Please wait while the AI prepares your spreadsheet.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Loading / error states — inside padding */}
            {showQueryProgress && (
              <div className="px-6 pb-6">
                <div
                  className="px-4 py-3 flex items-center justify-between gap-3"
                  style={{ borderBottom: `1px solid ${palette.border}` }}
                >
                  <div>
                    <p className="font-semibold" style={{ fontSize: 12.5, color: palette.text }}>
                      {queryComplete
                        ? "Table ready"
                        : importedDataset
                        ? "Preparing table"
                        : querySteps[activeStep].label}
                    </p>
                    <p className="mt-0.5" style={{ fontSize: 11.5, color: palette.textMuted }}>
                      {queryComplete
                        ? wasCached
                          ? "Used semantic cache, ran the SQL, and prepared the table."
                          : importedDataset
                          ? "Analyzed the imported file and prepared the table."
                          : "Generated SQL, ran the query, and prepared the table."
                        : importedDataset
                        ? "Formatting the result for display"
                        : querySteps[activeStep].detail}
                    </p>
                  </div>
                  {queryComplete ? (
                    <CheckCircle2 style={{ width: 16, height: 16, color: "#22c55e" }} />
                  ) : (
                    <Loader2 className="animate-spin" style={{ width: 16, height: 16, color: palette.text }} />
                  )}
                </div>
                <div className="h-[3px] rounded-full overflow-hidden" style={{ background: palette.border }}>
                  <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{
                      width: queryComplete
                        ? "100%"
                        : importedDataset
                        ? "100%"
                        : `${((activeStep + 1) / querySteps.length) * 100}%`,
                      background: queryComplete ? "#22c55e" : palette.text,
                    }}
                  />
                </div>
                {!importedDataset && (
                  <div
                    className="grid gap-2 px-1 py-3"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}
                  >
                    {querySteps.map((step, index) => {
                      const done = queryComplete || index < activeStep;
                      const current = loading && index === activeStep;
                      const Icon = done ? CheckCircle2 : current ? Loader2 : Circle;

                      return (
                        <div key={step.label} className="flex items-center gap-2 min-w-0">
                          <Icon
                            className={current ? "animate-spin" : undefined}
                            style={{
                              width: 13,
                              height: 13,
                              flexShrink: 0,
                              color: done ? "#22c55e" : current ? palette.text : palette.textMuted,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11.5,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: current || done ? palette.text : palette.textMuted,
                            }}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {queryError && (
              <div
                className="mx-6 mb-6 rounded-lg px-4 py-3"
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}
              >
                <p style={{ color: "#f87171", fontSize: 12.5 }} className="font-medium">
                  Error
                </p>
                <p style={{ color: "#fca5a5", fontSize: 11.5 }} className="mt-1">
                  {queryError}
                </p>
              </div>
            )}
            {exportError && (
              <div
                className="mx-6 mb-6 rounded-lg px-4 py-3"
                style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}
              >
                <p style={{ color: "#fca5a5", fontSize: 12 }}>{exportError}</p>
              </div>
            )}

            {/* Generated SQL — full-width flush section (hidden for file imports) */}
            {generatedSQL && !importedDataset && (
              <div className="px-6 py-5" style={{ borderTop: `1px solid ${palette.border}`, background: palette.bgSecondary }}>
                <p className="mb-2" style={{ fontSize: 11.5, color: palette.textMuted }}>
                  Generated SQL
                </p>
                <pre
                  className="rounded-lg px-4 py-3 overflow-x-auto"
                  style={{ background: palette.bg, border: `1px solid ${palette.border}`, fontSize: 12, color: palette.textSecondary }}
                >
                  {generatedSQL}
                </pre>
              </div>
            )}

            <div
              className="px-6 py-3 flex justify-end"
              style={{ borderTop: `1px solid ${palette.border}`, background: palette.bgSecondary }}
            >
              <button
                onClick={handleExport}
                disabled={!result || exporting}
                className="rounded-lg transition-colors disabled:opacity-40 font-medium"
                style={{
                  background: palette.text,
                  color: palette.bg,
                  fontSize: 12.5,
                  padding: "7px 14px",
                }}
              >
                {exporting ? "Exporting..." : "Download Excel"}
              </button>
            </div>

            {/* Results table — full-width flush at the bottom */}
            {result && (
              <div style={{ borderTop: `1px solid ${palette.border}`, background: palette.bgSecondary }}>
                <div className="px-6 pt-5 pb-3">
                  <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 11.5, color: palette.textMuted }}>
                    <span>
                      Results - {result.length} row{result.length !== 1 ? "s" : ""}
                    </span>
                    {queryDurationMs !== null && (
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{ background: palette.card, border: `1px solid ${palette.border}` }}
                      >
                        Time taken: {formatDuration(queryDurationMs)}
                      </span>
                    )}
                  </div>
                </div>
                {result.length > 0 ? (
                  <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "55vh" }}>
                    <table
                      className="min-w-full text-left"
                      style={{ fontSize: 12, borderCollapse: "separate", borderSpacing: 0 }}
                    >
                      <thead>
                        <tr>
                          {Object.keys(result[0]).map((col, idx) => (
                            <th
                              key={col}
                              className="py-2 font-semibold whitespace-nowrap"
                              style={{
                                position: "sticky",
                                top: 0,
                                background: palette.bgSecondary,
                                boxShadow: `0 1px 0 ${palette.border}`,
                                zIndex: 1,
                                paddingLeft: idx === 0 ? 24 : 0,
                                paddingRight: 20,
                                color: palette.textSecondary,
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
                            className="transition-colors"
                            style={{
                              borderBottom: i < result.length - 1 ? `1px solid ${palette.border}` : "none",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = palette.hover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {Object.values(row).map((val, j) => (
                              <td
                                key={j}
                                className="py-2 whitespace-nowrap"
                                style={{
                                  paddingLeft: j === 0 ? 24 : 0,
                                  paddingRight: 20,
                                  color: palette.textSecondary,
                                }}
                              >
                                {String(val ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="h-6" />
                  </div>
                ) : (
                  <p className="px-6 pb-6" style={{ fontSize: 12.5, color: palette.textMuted }}>
                    No results found.
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
