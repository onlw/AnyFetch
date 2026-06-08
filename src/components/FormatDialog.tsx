import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Video, Music, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import type { VideoInfo, VideoFormat, AppSettings } from "@/types/download";

interface FormatDialogProps {
  info: VideoInfo | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (formatId: string, audioOnly: boolean, selectedEntries?: string[]) => void;
  settings: AppSettings;
}

interface FormatGroup {
  label: string;
  formats: VideoFormat[];
}

function groupFormats(formats: VideoFormat[]): FormatGroup[] {
  const video = formats.filter(
    (f) => f.vcodec !== "none" && f.acodec !== "none" && !f.format_id.includes("audio")
  );
  const videoOnly = formats.filter(
    (f) => f.vcodec !== "none" && f.acodec === "none"
  );
  const audio = formats.filter(
    (f) => f.vcodec === "none" && f.acodec !== "none"
  );

  const groups: FormatGroup[] = [];
  if (video.length > 0) groups.push({ label: "视频 + 音频", formats: video });
  if (videoOnly.length > 0) groups.push({ label: "仅视频（需合并）", formats: videoOnly });
  if (audio.length > 0) groups.push({ label: "仅音频", formats: audio });
  return groups;
}

function getResolutionLabel(format: VideoFormat): string {
  if (format.resolution && format.resolution !== "audio only") return format.resolution;
  if (format.format_note) return format.format_note;
  return "音频";
}

function getQualityBadge(format: VideoFormat) {
  const res = format.resolution?.toLowerCase() ?? "";
  if (res.includes("2160") || res.includes("4k")) return { label: "4K", variant: "default" as const };
  if (res.includes("1440")) return { label: "2K", variant: "default" as const };
  if (res.includes("1080")) return { label: "1080p", variant: "success" as const };
  if (res.includes("720")) return { label: "720p", variant: "secondary" as const };
  if (res.includes("480")) return { label: "480p", variant: "secondary" as const };
  return null;
}

export function FormatDialog({ info, open, onClose, onConfirm, settings }: FormatDialogProps) {
  const [audioOnly, setAudioOnly] = useState(settings.audio_only);
  const [selectedFormat, setSelectedFormat] = useState("best");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());

  if (!info) return null;

  const groups = groupFormats(info.formats);
  const isPlaylist = info.is_playlist && (info.playlist_entries?.length ?? 0) > 0;

  const handleConfirm = () => {
    const entries = isPlaylist ? Array.from(selectedEntries) : undefined;
    onConfirm(audioOnly ? "bestaudio" : selectedFormat, audioOnly, entries);
    onClose();
  };

  const toggleEntry = (id: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEntries = () => {
    if (info.playlist_entries) {
      setSelectedEntries(new Set(info.playlist_entries.map((e) => e.id)));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-fade-in z-40" />
        <Dialog.Content className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
          "w-[640px] max-w-[calc(100vw-32px)] max-h-[80vh]",
          "bg-surface-overlay border border-slate-200 rounded-2xl shadow-2xl",
          "flex flex-col animate-slide-in overflow-hidden"
        )}>
          {/* Header */}
          <div className="flex items-start gap-3 p-5 pb-4 border-b border-surface-border">
            {info.thumbnail && (
              <img
                src={info.thumbnail}
                alt={info.title}
                className="w-20 h-14 rounded-lg object-cover shrink-0 bg-slate-100 border border-slate-200/50"
              />
            )}
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                {info.title}
              </Dialog.Title>
              <div className="flex items-center gap-2 mt-1.5">
                {info.uploader && (
                  <span className="text-xs text-slate-500">{info.uploader}</span>
                )}
                {info.duration && (
                  <span className="text-xs text-slate-400">{formatDuration(info.duration)}</span>
                )}
                {isPlaylist && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border border-slate-200">{info.playlist_entries?.length} 个视频</Badge>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" className="shrink-0 -mt-1 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 px-5 py-3 border-b border-surface-border bg-slate-50/50">
            <button
              onClick={() => setAudioOnly(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all cursor-default select-none",
                !audioOnly
                  ? "bg-brand-500/10 text-brand-600 border border-brand-500/25 font-medium"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
            >
              <Video className="w-4 h-4" />
              视频
            </button>
            <button
              onClick={() => setAudioOnly(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all cursor-default select-none",
                audioOnly
                  ? "bg-purple-500/10 text-purple-600 border border-purple-500/25 font-medium"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
            >
              <Music className="w-4 h-4" />
              仅音频 (MP3)
            </button>
          </div>

          {/* Format list / Playlist list */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            {isPlaylist ? (
              /* Playlist entries */
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">选择要下载的视频</span>
                  <Button variant="ghost" size="sm" onClick={selectAllEntries} className="text-xs h-6 px-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100">
                    全选
                  </Button>
                </div>
                {info.playlist_entries?.map((entry, idx) => (
                  <button
                    key={entry.id}
                    onClick={() => toggleEntry(entry.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all cursor-default select-none",
                      selectedEntries.has(entry.id)
                        ? "bg-brand-500/10 border border-brand-500/30"
                        : "hover:bg-slate-50 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                      selectedEntries.has(entry.id)
                        ? "bg-brand-500 border-brand-500"
                        : "border-slate-300"
                    )}>
                      {selectedEntries.has(entry.id) && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 w-6 shrink-0 font-medium">{idx + 1}</span>
                    {entry.thumbnail && (
                      <img src={entry.thumbnail} alt="" className="w-12 h-8 rounded object-cover bg-slate-100 shrink-0 border border-slate-200/50" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 font-medium truncate">{entry.title}</p>
                      {entry.duration && (
                        <p className="text-xs text-slate-400 mt-0.5">{formatDuration(entry.duration)}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Format groups */
              !audioOnly && (
                <div className="space-y-4">
                  {/* Best quality shortcut */}
                  <button
                    onClick={() => setSelectedFormat("best")}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border cursor-default select-none",
                      selectedFormat === "best"
                        ? "bg-brand-500/10 border-brand-500/30 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      selectedFormat === "best" ? "border-brand-500" : "border-slate-300"
                    )}>
                      {selectedFormat === "best" && <div className="w-2 h-2 rounded-full bg-brand-500 animate-fade-in" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">最佳质量</p>
                      <p className="text-xs text-slate-500 mt-0.5">自动选择最高画质（推荐）</p>
                    </div>
                    <Badge variant="success" className="ml-auto">推荐</Badge>
                  </button>

                  {groups.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</p>
                      <div className="space-y-1">
                        {group.formats.slice(0, 8).map((format) => {
                          const qBadge = getQualityBadge(format);
                          return (
                            <button
                              key={format.format_id}
                              onClick={() => setSelectedFormat(format.format_id)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all cursor-default select-none",
                                selectedFormat === format.format_id
                                  ? "bg-brand-500/10 text-brand-700 font-medium"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                              )}
                            >
                              <div className={cn(
                                "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                                selectedFormat === format.format_id ? "border-brand-500" : "border-slate-300"
                              )}>
                                {selectedFormat === format.format_id && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                )}
                              </div>
                              <span className="text-sm flex-1">{getResolutionLabel(format)}</span>
                              {format.fps && format.fps > 30 && (
                                <span className="text-xs text-slate-400">{format.fps}fps</span>
                              )}
                              {qBadge && <Badge variant={qBadge.variant}>{qBadge.label}</Badge>}
                              <span className="text-xs text-slate-400 uppercase">{format.ext}</span>
                              {format.filesize && (
                                <span className="text-xs text-slate-400">{formatBytes(format.filesize)}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-surface-border bg-slate-50/30">
            <div className="text-xs text-slate-400">
              {isPlaylist
                ? `已选 ${selectedEntries.size} / ${info.playlist_entries?.length ?? 0} 个`
                : audioOnly
                ? "将提取为 MP3 格式"
                : `格式: ${selectedFormat === "best" ? "最佳质量" : selectedFormat}`}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>取消</Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={isPlaylist && selectedEntries.size === 0}
              >
                {isPlaylist ? `下载 ${selectedEntries.size} 个` : "开始下载"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
