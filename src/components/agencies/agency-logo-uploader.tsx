"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, X, Upload } from "lucide-react";
import { uploadAgencyLogo, removeAgencyLogo } from "@/app/(dashboard)/agencies/logo-actions";
import { AgencyLogo } from "@/components/agencies/agency-logo";

interface AgencyLogoUploaderProps {
  agencyId: string;
  currentLogoUrl: string | null;
  agencyName: string;
  onUpdate?: (newUrl: string | null) => void;
}

const MAX_DIMENSION = 400;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024;

async function compressImage(file: File): Promise<File> {
  // SVG : no canvas compression
  if (file.type === "image/svg+xml") return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file);
        return;
      }
      if (width > height) {
        height = Math.round((height / width) * MAX_DIMENSION);
        width = MAX_DIMENSION;
      } else {
        width = Math.round((width / height) * MAX_DIMENSION);
        height = MAX_DIMENSION;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/webp" }));
        },
        "image/webp",
        0.88
      );
    };
    img.onerror = () => reject(new Error("Image invalide"));
    img.src = url;
  });
}

export function AgencyLogoUploader({ agencyId, currentLogoUrl, agencyName, onUpdate }: AgencyLogoUploaderProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Format non supporté. Utilisez PNG, JPEG, WebP ou SVG.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Le fichier dépasse 2 Mo.");
      return;
    }

    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch {
      setError("Impossible de traiter l'image.");
      return;
    }

    // Optimistic preview
    const objectUrl = URL.createObjectURL(compressed);
    setPreviewUrl(objectUrl);

    const formData = new FormData();
    formData.append("file", compressed);

    startTransition(async () => {
      const result = await uploadAgencyLogo(agencyId, formData);
      URL.revokeObjectURL(objectUrl);
      if (result.ok && result.url) {
        setPreviewUrl(result.url);
        onUpdate?.(result.url);
      } else {
        setPreviewUrl(currentLogoUrl);
        setError("error" in result ? result.error : "Erreur lors de l'upload.");
      }
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAgencyLogo(agencyId);
      if (result.ok) {
        setPreviewUrl(null);
        onUpdate?.(null);
      } else {
        setError("error" in result ? result.error : "Erreur lors de la suppression.");
      }
    });
  }

  if (previewUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <AgencyLogo name={agencyName} logoUrl={previewUrl} size={64} />
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[6px] bg-black/40">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#c1411f] text-white hover:bg-[#a8361a] disabled:opacity-50 transition-colors"
            title="Supprimer le logo"
            aria-label="Supprimer le logo"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="text-[11px] text-[#1e5a8a] hover:underline disabled:opacity-50"
        >
          Changer
        </button>
        <input ref={inputRef} type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleChange} className="sr-only" />
        {error && <p className="text-[11px] text-[#c1411f]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isPending && inputRef.current?.click()}
        className={[
          "flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-[6px] border-2 border-dashed transition-colors",
          dragging ? "border-[#15323f] bg-[#f4f7fa]" : "border-[#e4e8eb] hover:border-[#15323f]/40 hover:bg-[#f6f7f8]",
          isPending ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
        role="button"
        tabIndex={0}
        aria-label="Uploader un logo"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {isPending ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#9aa7b0] border-t-[#15323f]" />
        ) : (
          <ImagePlus className="h-6 w-6 text-[#9aa7b0]" aria-hidden />
        )}
      </div>
      <p className="text-center text-[10px] text-[#9aa7b0]">
        PNG, JPG, WebP, SVG<br />2 Mo max
      </p>
      <input ref={inputRef} type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleChange} className="sr-only" />
      {error && <p className="text-[11px] text-[#c1411f]">{error}</p>}
    </div>
  );
}
