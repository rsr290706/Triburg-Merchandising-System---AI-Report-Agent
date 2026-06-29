const BASE_URL = "http://localhost:8000";

export async function queryTMS(question: string) {
  const response = await fetch(`${BASE_URL}/query`, {
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