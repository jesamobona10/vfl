"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  currentUrl?: string;
  teamId: number;
  onUploadComplete: (url: string) => void;
}

export function ImageUpload({ currentUrl, teamId, onUploadComplete }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("File too large. Max 2MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("teamId", String(teamId));

      const res = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      onUploadComplete(data.url);
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
    }
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-20 h-20 rounded-xl bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Team logo"
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon size={28} className="text-muted/40" />
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="btn-ghost text-xs py-1"
      >
        {uploading ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload size={12} />
            {currentUrl ? "Change Logo" : "Upload Logo"}
          </>
        )}
      </button>
    </div>
  );
}
