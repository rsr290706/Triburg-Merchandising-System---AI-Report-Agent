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
  Moon,
  Sun,
  CheckCircle2,
  Circle,
  Loader2,
  X,
} from "lucide-react";

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
  { icon: FileText, label: "Files" },
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
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });
  const [dragging, setDragging] = useState(false);
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
  const [databaseInfo, setDatabaseInfo] = useState({
  database: "",
  tables: 0,
  });

  useEffect(() => {
      document.documentElement.classList.toggle("dark", dark);

      localStorage.setItem(
          "theme",
          dark ? "dark" : "light"
      );
  }, [dark]);

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
      setDragging(false);
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
            <div className="relative">
                <button
                    onClick={() =>
                        setShowSettingsMenu(!showSettingsMenu)
                    }
                    className="
                        p-1
                        rounded-lg
                        text-muted-foreground
                        hover:text-foreground
                        hover:bg-accent
                        transition-all
                        duration-200
                        -translate-x-1
                        translate-y-px
                    "
                >
                    <Settings size={15} />
                </button>

                {showSettingsMenu && (

                    <div
                        className="
                            absolute
                            right-0
                            mt-2
                            w-64
                            rounded-lg
                            border
                            bg-background
                            shadow-lg
                            z-50
                        "
                    >

                        <button
                            onClick={handleClearCache}
                            className="
                                w-full
                                text-left
                                px-4
                                py-3
                                hover:bg-accent
                                text-red-500
                            "
                        >
                            🗑 Clear Cache
                        </button>

                    </div>

                )}

            </div>
        </div>

        {/* New Chat */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={createConversation}
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
          {conversations.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setCurrentConversationId(chat.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                currentConversationId === chat.id
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              }`}
            >
              <div className="group flex justify-between items-start">

                  <div className="flex-1 min-w-0">

                      <p
                          className={`font-medium leading-snug ${
                              currentConversationId === chat.id
                                  ? "text-foreground"
                                  : "text-foreground/80"
                          }`}
                          style={{ fontSize: 12.5 }}
                      >
                          {chat.title}
                      </p>

                      <p
                          className="flex items-center gap-1 text-muted-foreground mt-0.5"
                          style={{ fontSize: 11 }}
                      >
                          <Clock
                              style={{
                                  width: 10,
                                  height: 10
                              }}
                          />

                          {formatRelativeTime(chat.updatedAt)}
                      </p>

                  </div>

                  <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition"

                      onClick={(e) => {

                          e.stopPropagation();

                          deleteConversation(chat.id);

                      }}
                  >
                      🗑
                  </button>

              </div>
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
            <p
                className="text-muted-foreground pl-4"
                style={{ fontSize: 11 }}
            >
                {databaseInfo.database
                    ? `${databaseInfo.database} · ${databaseInfo.tables} tables`
                    : "Loading..."}
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
                  onChange={(e) => {

                      const value = e.target.value;

                      setInput(value);

                      autoResize(e.target);

                  }}
                  onKeyDown={handleKeyDown}
                  disabled={uploadingFile}
                  placeholder={
                      importedDataset
                          ? (
                              lastQuestion ||
                              "Ask a question about the imported file..."
                            )
                          : (
                              lastQuestion ||
                              "Example: Show me the total rejected inspection quantity for Vendor A in March 2025."
                            )
                  }
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
                  className="flex items-center justify-center rounded-xl transition-all shrink-0 disabled:opacity-50"
                  style={{
                    width: 34,
                    height: 34,
                    background: importedDataset ? (dark ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.08)") : dark ? "#1e2230" : "#e5e7eb",
                    color: importedDataset ? "#2563eb" : dark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  <Paperclip style={{ width: 16, height: 16 }} />
                </button>

                <div
                  className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10"
                >
                  {importedDataset ? (
                    <div
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 whitespace-nowrap shadow-lg"
                      style={{ background: dark ? "#10131a" : "#ffffff" }}
                    >
                      <FileText style={{ width: 15, height: 15, color: "#2563eb" }} />
                      <span className="text-foreground" style={{ fontSize: 12.5 }}>
                        {importedDataset.filename}
                      </span>
                      <span className="text-muted-foreground" style={{ fontSize: 12 }}>
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
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg border border-border px-3 py-2 whitespace-nowrap shadow-lg"
                      style={{ background: dark ? "#10131a" : "#ffffff" }}
                    >
                      <p className="text-foreground" style={{ fontSize: 12.5 }}>
                        Attach a CSV or Excel file
                      </p>
                      <p className="text-muted-foreground" style={{ fontSize: 11.5 }}>
                        CSV, Excel (.xls, .xlsx) supported
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || uploadingFile}
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

            {uploadError && (
              <p className="text-red-500 mb-4" style={{ fontSize: 12 }}>
                {uploadError}
              </p>
            )}
            {uploadingFile && (
                <div
                    className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 flex items-center gap-3"
                >
                    <Loader2
                        className="animate-spin text-blue-500"
                        size={18}
                    />
                    <div>
                        <p className="font-medium text-blue-500">
                            Processing file...
                        </p>
                        <p
                            className="text-muted-foreground"
                            style={{ fontSize: 12 }}
                        >
                            Please wait while the AI prepares your spreadsheet.
                        </p>
                    </div>
                </div>
            )}
          </div>

          {/* Loading / error states — inside padding */}
          {showQueryProgress && (
            <div className="px-8 pb-6">
              <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-border">
                  <div>
                    <p className="font-semibold text-foreground" style={{ fontSize: 13 }}>
                      {queryComplete
                        ? "Table ready"
                        : importedDataset
                          ? "Preparing table"
                          : querySteps[activeStep].label}
                    </p>
                    <p className="text-muted-foreground mt-0.5" style={{ fontSize: 12 }}>
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
                    <CheckCircle2 style={{ width: 18, height: 18, color: "#16a34a" }} />
                  ) : (
                    <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "#2563eb" }} />
                  )}
                </div>
                <div className="h-1" style={{ background: dark ? "#202635" : "#e5e7eb" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: queryComplete
                        ? "100%"
                        : importedDataset
                          ? "100%"
                          : `${((activeStep + 1) / querySteps.length) * 100}%`,
                      background: queryComplete ? "#16a34a" : "#2563eb",
                    }}
                  />
                </div>
                {!importedDataset && (
                  <div className="grid gap-2 px-4 py-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                    {querySteps.map((step, index) => {
                      const done = queryComplete || index < activeStep;
                      const current = loading && index === activeStep;
                      const Icon = done ? CheckCircle2 : current ? Loader2 : Circle;

                      return (
                        <div key={step.label} className="flex items-center gap-2 min-w-0">
                          <Icon
                            className={current ? "animate-spin" : undefined}
                            style={{
                              width: 14,
                              height: 14,
                              flexShrink: 0,
                              color: done ? "#16a34a" : current ? "#2563eb" : dark ? "#4b5563" : "#9ca3af",
                            }}
                          />
                          <span
                            className={current || done ? "text-foreground" : "text-muted-foreground"}
                            style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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

          {/* Generated SQL — full-width flush section (hidden for file imports) */}
          {generatedSQL && !importedDataset && (
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
                <div className="flex items-center gap-3 flex-wrap text-muted-foreground" style={{ fontSize: 12.5 }}>
                  <span>
                    Results - {result.length} row{result.length !== 1 ? "s" : ""}
                  </span>
                  {queryDurationMs !== null && (
                    <span
                      className="rounded-full border border-border px-2 py-0.5"
                      style={{ background: dark ? "#10131a" : "#ffffff" }}
                    >
                      Time taken: {formatDuration(queryDurationMs)}
                    </span>
                  )}
                </div>
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
