import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Copy, Check, Film, ImageIcon, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const VIDEO_ACCEPT = ".mp4,.webm";
const IMAGE_ACCEPT = ".webp,.jpg,.jpeg,.png";
const VIDEO_MAX_MB = 25;
const IMAGE_MAX_MB = 2;

interface UploadedAsset {
  path: string;
  name: string;
  type: "video" | "image";
}

function sanitizeFolder(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function V8MediaUploader() {
  const [uploads, setUploads] = useState<UploadedAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [lessonFolder, setLessonFolder] = useState("");
  const videoRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null, type: "video" | "image") => {
    if (!files || files.length === 0) return;
    const maxMB = type === "video" ? VIDEO_MAX_MB : IMAGE_MAX_MB;

    const sanitized = sanitizeFolder(lessonFolder);

    if (!sanitized) {
      toast.error("Defina uma pasta válida antes do upload (letras, números e hífens).");
      return;
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > maxMB * 1024 * 1024) {
          toast.error(`${file.name} excede ${maxMB}MB`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `v8-media/${sanitized}/${safeName}`;

        const { error } = await supabase.storage
          .from("lesson-audios")
          .upload(path, file, { upsert: true });

        if (error) {
          toast.error(`Erro no upload de ${file.name}: ${error.message}`);
        } else {
          setUploads(prev => [...prev, { path, name: safeName, type }]);
          toast.success(`${safeName} enviado`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const copyTag = (asset: UploadedAsset, idx: number) => {
    const tag = `[VIDEO]\nsrc: ${asset.path}\ncaption: `;
    navigator.clipboard.writeText(tag);
    setCopiedIdx(idx);
    toast.success("Tag copiada!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sanitizedFolder = sanitizeFolder(lessonFolder);
  const folderValid = sanitizedFolder.length > 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Upload className="w-4 h-4" />
        Upload de Mídia V8
      </h3>

      <div className="space-y-2">
        <Label htmlFor="v8-lesson-folder" className="flex items-center gap-1.5 text-xs">
          <FolderOpen className="w-3.5 h-3.5" />
          Pasta da aula
        </Label>
        <Input
          id="v8-lesson-folder"
          placeholder="dissecando-midjourney"
          value={lessonFolder}
          onChange={(e) => setLessonFolder(e.target.value)}
          className="h-9 text-sm"
        />
        {folderValid ? (
          <p className="text-[11px] rounded-md px-2 py-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Destino: <code className="font-mono">v8-media/{sanitizedFolder}/</code>
          </p>
        ) : (
          <p className="text-[11px] rounded-md px-2 py-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            Defina a pasta da aula antes de enviar (apenas letras minúsculas, números e hífens).
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <input
          ref={videoRef}
          type="file"
          accept={VIDEO_ACCEPT}
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files, "video")}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => videoRef.current?.click()}
          disabled={uploading || !folderValid}
        >
          <Film className="w-4 h-4 mr-1" />
          Vídeo (max {VIDEO_MAX_MB}MB)
        </Button>

        <input
          ref={imageRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files, "image")}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => imageRef.current?.click()}
          disabled={uploading || !folderValid}
        >
          <ImageIcon className="w-4 h-4 mr-1" />
          Imagem (max {IMAGE_MAX_MB}MB)
        </Button>

        {uploading && <Loader2 className="w-4 h-4 animate-spin self-center text-muted-foreground" />}
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((asset, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg px-3 py-2">
              {asset.type === "video" ? (
                <Film className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span className="truncate flex-1 font-mono">{asset.path}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => copyTag(asset, i)}
              >
                {copiedIdx === i ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
