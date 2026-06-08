import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link2, Loader2, ArrowRight, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoInfo, AppSettings } from "@/types/download";

interface URLInputBarProps {
  onInfoFetched: (info: VideoInfo, url: string) => void;
  settings: AppSettings;
}

export function URLInputBar({ onInfoFetched, settings }: URLInputBarProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFetch = useCallback(async (targetUrl?: string) => {
    const fetchUrl = (targetUrl ?? url).trim();
    if (!fetchUrl) return;

    setLoading(true);
    setError(null);

    try {
      const raw = await invoke<Record<string, unknown>>("fetch_info", {
        url: fetchUrl,
        cookiesFile: settings.cookies_file ?? null,
      });

      // 解析 yt-dlp JSON 为 VideoInfo
      const info = parseVideoInfo(raw, fetchUrl);
      onInfoFetched(info, fetchUrl);
      setUrl("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [url, settings.cookies_file, onInfoFetched]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleFetch();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (droppedUrl) {
      setUrl(droppedUrl);
      handleFetch(droppedUrl);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith("http")) {
        setUrl(text);
      }
    } catch {}
  };

  return (
    <div className="px-4 py-3 border-b border-surface-border">
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-xl border transition-all duration-200",
          isDragOver
            ? "border-brand-500/60 bg-brand-500/8"
            : error
            ? "border-red-300 bg-red-50/50"
            : "border-slate-200 bg-white focus-within:border-brand-500/50 focus-within:ring-2 focus-within:ring-brand-500/15"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
      >
        {/* Icon */}
        <div className="pl-3 text-slate-400">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder="粘贴视频链接，或将链接拖放至此…"
          className={cn(
            "flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400",
            "py-2.5 focus:outline-none min-w-0"
          )}
          disabled={loading}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 pr-2">
          {!url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePaste}
              className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 h-7 px-2 text-xs"
            >
              粘贴
            </Button>
          )}
          {url && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setUrl("");
                  settings.audio_only;
                  // Quick audio mode toggle handled by default settings
                }}
                title="切换音频模式"
                className={cn(
                  "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                  settings.audio_only && "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                )}
              >
                {settings.audio_only ? <Music className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="sm"
                onClick={() => handleFetch()}
                disabled={loading}
                className="h-7 px-3 gap-1"
              >
                获取
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1.5 px-1 text-xs text-red-600 animate-fade-in">
          {error.replace("ERROR: ", "")}
        </p>
      )}

      {/* Drag hint */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-brand-400 text-sm font-medium">松开以添加下载</p>
        </div>
      )}
    </div>
  );
}

function parseVideoInfo(raw: Record<string, unknown>, url: string): VideoInfo {
  const isPlaylist = raw._type === "playlist" || Array.isArray(raw.entries);

  const formats = Array.isArray(raw.formats)
    ? (raw.formats as Record<string, unknown>[]).map((f) => ({
        format_id: String(f.format_id ?? ""),
        ext: String(f.ext ?? "mp4"),
        resolution: String(f.resolution ?? f.width ? `${f.width}x${f.height}` : "audio"),
        fps: typeof f.fps === "number" ? f.fps : undefined,
        filesize: typeof f.filesize === "number" ? f.filesize : undefined,
        vcodec: String(f.vcodec ?? "none"),
        acodec: String(f.acodec ?? "none"),
        format_note: String(f.format_note ?? ""),
        tbr: typeof f.tbr === "number" ? f.tbr : undefined,
      }))
    : [];

  const entries = Array.isArray(raw.entries)
    ? (raw.entries as Record<string, unknown>[]).slice(0, 50).map((e) => ({
        id: String(e.id ?? ""),
        title: String(e.title ?? "未知标题"),
        url: String(e.url ?? e.webpage_url ?? ""),
        thumbnail: typeof e.thumbnail === "string" ? e.thumbnail : undefined,
        duration: typeof e.duration === "number" ? e.duration : undefined,
      }))
    : undefined;

  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? raw.playlist_title ?? "未知标题"),
    thumbnail: typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
    uploader: typeof raw.uploader === "string" ? raw.uploader : undefined,
    webpage_url: String(raw.webpage_url ?? url),
    formats,
    is_playlist: isPlaylist,
    playlist_entries: entries,
    cookies_from_browser: typeof raw.cookies_from_browser === "string" ? raw.cookies_from_browser : undefined,
    _type: typeof raw._type === "string" ? raw._type : undefined,
    entries: isPlaylist ? entries : undefined,
  };
}
