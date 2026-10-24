import * as tus from "tus-js-client";

type UploadOptions = {
  file: File;
  path: string;
  token: string;
  onProgress: (percentage: number) => void;
};

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Supabase is not configured.");
  const hostname = new URL(url).hostname;
  const suffix = ".supabase.co";
  if (!hostname.endsWith(suffix)) throw new Error("Invalid Supabase project URL.");
  return hostname.slice(0, -suffix.length);
}

export function uploadMatchMediaWithTus({ file, path, token, onProgress }: UploadOptions): Promise<void> {
  const projectRef = getProjectRef();
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      headers: { "x-signature": token },
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: "match-media",
        objectName: path,
        contentType: file.type,
        cacheControl: "31536000",
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(),
    });

    void upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length > 0) upload.resumeFromPreviousUpload(previousUploads[0]);
        upload.start();
      })
      .catch(reject);
  });
}

export function getVideoPoster(file: File): Promise<{
  blob: Blob;
  width: number;
  height: number;
  durationSeconds: number | null;
} | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const finish = (result: Awaited<ReturnType<typeof getVideoPoster>>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 8000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(1, video.duration / 4);
      }
    };
    video.onseeked = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return finish(null);
      const scale = Math.min(1, 640 / width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) return finish(null);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => finish(blob ? {
          blob,
          width,
          height,
          durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
        } : null),
        "image/webp",
        0.78
      );
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}
