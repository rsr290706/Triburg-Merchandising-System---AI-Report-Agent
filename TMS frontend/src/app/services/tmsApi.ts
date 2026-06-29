const API_URL = import.meta.env.VITE_API_URL;

export async function queryTMS(question: string) {
  const response = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail?.error || "Query failed");
  }

  return response.json();
}