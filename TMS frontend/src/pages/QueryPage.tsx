import { useState, useMemo } from "react";
import { queryTMS, downloadExcel } from "C:/Users/rishi/OneDrive/Desktop/Internship/TMS frontend/src/app/services/tmsApi";

const PAGE_SIZE = 50;

type QueryResult = Record<string, unknown>;

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResult[] | null>(null);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setPage(1);

    try {
      const data = await queryTMS(question);
      setGeneratedSQL(data.generated_sql);
      setResult(data.result);
      setLastQuestion(question); // remember exactly what produced this table
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!lastQuestion) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadExcel(lastQuestion); // use the question that produced the table, not the live input
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.length / PAGE_SIZE)) : 1;

  const pagedRows = useMemo(() => {
    if (!result) return [];
    const start = (page - 1) * PAGE_SIZE;
    return result.slice(start, start + PAGE_SIZE);
  }, [result, page]);

  return (
    <div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question about your transport data..."
      />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Thinking..." : "Ask"}
      </button>

      <button onClick={handleExport} disabled={!result || exporting}>
        {exporting ? "Exporting..." : "Download Excel"}
      </button>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {exportError && <p style={{ color: "red" }}>Export error: {exportError}</p>}

      {generatedSQL && (
        <div>
          <h4>Generated SQL</h4>
          <pre>{generatedSQL}</pre>
        </div>
      )}

      {result && (
        <div>
          <h4>
              Results
              <span style={{ color: "#888" }}>
                  {" "}({result.length.toLocaleString()} rows)
              </span>
          </h4>
          {result.length > 0 ? (
            <>
              <div
                style={{
                  overflow: "auto",
                  overscrollBehavior: "contain",
                  maxHeight: "60vh",
                  maxWidth: "100%",
                  border: "1px solid #333",
                  borderRadius: 6,
                }}
              >
                <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
                  <thead>
                    `<tr>
                      <th
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#1a1a1a",
                          color: "#fff",
                          padding: "8px 12px",
                          borderBottom: "1px solid #444",
                          zIndex: 1,
                        }}
                      >
                        #
                      </th>

                      {Object.keys(result[0]).map((col) => (
                        <th
                          key={col}
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "#1a1a1a",
                            color: "#fff",
                            padding: "8px 12px",
                            textAlign: "left",
                            whiteSpace: "nowrap",
                            borderBottom: "1px solid #444",
                            zIndex: 1,
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
    `                {pagedRows.map((row, i) => (
                      <tr key={i}>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontWeight: "bold",
                            borderBottom: "1px solid #2a2a2a",
                          }}
                        >
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </td>

                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            style={{
                              padding: "8px 12px",
                              whiteSpace: "nowrap",
                              borderBottom: "1px solid #2a2a2a",
                            }}
                          >
                            {typeof val === "number"
                              ? val.toLocaleString()
                              : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    Prev
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <p>No results found.</p>
          )}
        </div>
      )}
    </div>
  );
}