"use client";

import { useState, type FormEvent } from "react";
import DEFAULT_RETRIEVAL_TEXT from "@/data/DefaultRetrievalText";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export function UploadDocumentsForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  // const [document, setDocument] = useState(DEFAULT_RETRIEVAL_TEXT);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile?.type !== "application/pdf") {
      setStatusMessage("Please upload a PDF file.");
      return;
    }
    setFile(uploadedFile);
    setStatusMessage(""); // Clear previous status
  };
  const ingest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setStatusMessage("No file selected.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    // formData.append("messages", JSON.stringify([]));

    const response = await fetch("/api/retrieval/ingest", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setStatusMessage("✅ PDF uploaded and processed successfully!");
    } else {
      const json = await response.json();
      setStatusMessage(`❌ Error: ${json.error || "Upload failed."}`);
    }

    setIsLoading(false);
  };
  return (
    <form onSubmit={ingest} className="flex flex-col gap-4 w-full">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="bg-transparent text-white"
      />

      <Button type="submit" disabled={isLoading || !file}>
        <div
          role="status"
          className={`${isLoading ? "" : "hidden"} flex justify-center`}
        >
          <svg
            aria-hidden="true"
            className="w-6 h-6 text-white animate-spin fill-sky-800"
            viewBox="0 0 100 101"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591..."
              fill="currentColor"
            />
            <path
              d="M93.9676 39.0409C96.393 38.4038..."
              fill="currentFill"
            />
          </svg>
          <span className="sr-only">Loading...</span>
        </div>
        <span className={isLoading ? "hidden" : ""}>Upload</span>
      </Button>

      {statusMessage && (
        <p className="text-sm text-center text-white">{statusMessage}</p>
      )}
    </form>
  );
}
