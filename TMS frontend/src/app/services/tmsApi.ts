const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const networkErrorMessage =
  "Could not reach the local backend. Make sure start.bat is running, then refresh the page.";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };

    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadDataFile(file: File) {
  const contentBase64 = await fileToBase64(file);

  const response = await fetch(`${API_URL}/upload-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      content_base64: contentBase64,
    }),
  }).catch(() => {
    throw new Error(networkErrorMessage);
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail?.error || "File upload failed");
  }

  return response.json();
}

export async function queryTMS(question: string, datasetId?: string | null) {
  const response = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, dataset_id: datasetId || null }),
  }).catch(() => {
    throw new Error(networkErrorMessage);
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail?.error || "Query failed");
  }

  return response.json();
}

export async function downloadExcel(question: string, datasetId?: string | null) {
  const response = await fetch(`${API_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, dataset_id: datasetId || null }),
  }).catch(() => {
    throw new Error(networkErrorMessage);
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail?.error || "Export failed");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "TMS_Report.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function clearSemanticCache() {

    const response = await fetch(`${API_URL}/clear-cache`, {
      method: "POST",
    });

    if(!response.ok){

        throw new Error("Failed to clear semantic cache");

    }

    return response.json();

}