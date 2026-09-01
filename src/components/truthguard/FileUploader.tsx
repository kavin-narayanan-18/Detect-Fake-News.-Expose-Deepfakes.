import { useCallback, useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  accept: string;
  hint: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  label: string;
}

export function FileUploader({ accept, hint, file, onSelect, label }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const next = files?.[0] ?? null;
      onSelect(next);
    },
    [onSelect],
  );

  if (file) {
    return (
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || "unknown type"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)} aria-label="Remove file">
          <X aria-hidden="true" /> Remove
        </Button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "glass-card flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
      )}
    >
      <span className="gradient-surface flex h-14 w-14 items-center justify-center rounded-2xl">
        <UploadCloud aria-hidden="true" className="h-6 w-6 text-primary-foreground" />
      </span>
      <p className="font-medium">Drag &amp; drop, or click to browse</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
