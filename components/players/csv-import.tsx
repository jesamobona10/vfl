"use client";

import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Upload, AlertCircle, CheckCircle, X } from "lucide-react";

export function CsvImport() {
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const importPlayers = useAppStore((s) => s.importPlayers);
  const teams = useAppStore((s) => s.teams);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const result = importPlayers(text, teams);
        const total = result.imported.length + result.errors.length;
        let msg = `Imported ${result.imported.length} of ${total} player(s).`;
        if (result.errors.length > 0) {
          msg +=
            "<br>" +
            result.errors
              .map((er) => `&bull; ${er}`)
              .join("<br>");
        }
        setFeedback({
          type:
            result.errors.length === 0 && result.imported.length > 0
              ? "success"
              : "error",
          message: msg,
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: `Error: ${err.message}`,
        });
      }
    };
    reader.onerror = () => {
      setFeedback({
        type: "error",
        message: "Error reading file.",
      });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="btn-ghost"
      >
        <Upload size={16} />
        Import CSV
      </button>

      {feedback && (
        <div
          className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-lg z-50 ${
            feedback.type === "success"
              ? "bg-brand text-white"
              : "bg-danger text-white"
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.type === "success" ? (
              <CheckCircle size={18} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
            )}
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{
                __html: feedback.message,
              }}
            />
            <button
              onClick={() => setFeedback(null)}
              className="shrink-0 ml-2"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
