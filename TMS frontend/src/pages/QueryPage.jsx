import { useState } from "react";
import { queryTMS } from "../app/services/tmsApi";

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState(null);
  const [generatedSQL, setGeneratedSQL] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await queryTMS(question);
      setGeneratedSQL(data.generated_sql);
      setResult(data.result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {generatedSQL && (
        <div>
          <h4>Generated SQL</h4>
          <pre>{generatedSQL}</pre>
        </div>
      )}

      {result && (
        <div>
          <h4>Results ({result.length} rows)</h4>
          {result.length > 0 ? (
            <table>
              <thead>
                <tr>
                  {Object.keys(result[0]).map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No results found.</p>
          )}
        </div>
      )}
    </div>
  );
}