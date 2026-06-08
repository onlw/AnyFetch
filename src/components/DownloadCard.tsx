import { invoke } from "@tauri-apps/api/core";
import {
  X, FolderOpen, RotateCcw, Music, Video,
  CheckCircle2, AlertCircle, Loader2, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, extractDomain } from "@/lib/utils";
import type { DownloadTask } from "@/types/download";

interface DownloadCardProps {
  task: DownloadTask;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry?: (task: DownloadTask) => void;
}

const statusConfig = {
  pending:     { label: "等待中", color: "text-slate-400",  bg: "bg-slate-50/50 border-slate-200" },
  fetching:    { label: "解析中", color: "text-brand-600", bg: "bg-brand-50/10 border-brand-100" },
  downloading: { label: "下载中", color: "text-brand-600", bg: "bg-brand-50/10 border-brand-100" },
  processing:  { label: "处理中", color: "text-amber-600", bg: "bg-amber-50/20 border-amber-200" },
  completed:   { label: "完成",   color: "text-emerald-600", bg: "border-emerald-200 bg-emerald-50/20" },
  failed:      { label: "失败",   color: "text-red-600",   bg: "border-red-200 bg-red-50/20" },
  cancelled:   { label: "已取消", color: "text-slate-400",  bg: "bg-slate-50/50 border-slate-200" },
} as const;

export function DownloadCard({ task, onCancel, onRemove, onRetry }: DownloadCardProps) {
  const config = statusConfig[task.status];
  const isActive = task.status === "downloading" || task.status === "fetching" || task.status === "processing";
  const domain = extractDomain(task.url);

  const handleOpenFolder = () => {
    if (task.filename) {
      invoke("open_file_location", { path: task.filename }).catch(console.error);
    } else {
      invoke("open_file_location", { path: task.output_dir }).catch(console.error);
    }
  };

  return (
    <div className={cn(
      "group flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 animate-slide-in shadow-xs",
      "bg-white border-slate-200/80 hover:bg-slate-50/30 hover:border-slate-300",
      config.bg,
      task.status === "completed" && "hover:border-emerald-500/20",
      task.status === "failed" && "hover:border-red-500/20"
    )}>
      {/* Thumbnail */}
      <div className="relative shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/50">
        {task.thumbnail ? (
          <img
            src={task.thumbnail}
            alt={task.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {task.audio_only
              ? <Music className="w-6 h-6 text-slate-300" />
              : <Video className="w-6 h-6 text-slate-300" />}
          </div>
        )}

        {/* Status overlay */}
        {task.status === "completed" && (
          <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
        )}
        {task.status === "failed" && (
          <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 bg-slate-900/5 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-slate-800 line-clamp-1 leading-snug">
            {task.title || "解析中…"}
          </p>
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status === "completed" && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleOpenFolder}
                title="在 Finder 中显示"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </Button>
            )}
            {task.status === "failed" && onRetry && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRetry(task)}
                title="重试"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            )}
            {isActive && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onCancel(task.id)}
                title="取消"
                className="text-slate-400 hover:text-red-500 hover:bg-red-50"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {!isActive && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemove(task.id)}
                title="移除"
                className="text-slate-300 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mt-1">
          <Globe className="w-3 h-3 text-slate-300 shrink-0" />
          <span className="text-xs text-slate-400">{domain}</span>
          {task.audio_only && <Badge variant="audio" className="text-[10px] py-0 h-4">MP3</Badge>}
        </div>

        {/* Progress */}
        {isActive && (
          <div className="mt-2 space-y-1.5">
            <Progress value={task.progress} glow className="h-1" />
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className={cn("font-medium", config.color)}>
                {config.label}
                {task.status === "downloading" && ` ${task.progress.toFixed(1)}%`}
              </span>
              <div className="flex gap-3">
                {task.speed && <span>{task.speed}</span>}
                {task.eta && <span>剩余 {task.eta}</span>}
                {task.size && <span>{task.size}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Status for non-active */}
        {!isActive && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn("text-xs", config.color)}>{config.label}</span>
            {task.status === "completed" && task.size && (
              <span className="text-xs text-slate-400">{task.size}</span>
            )}
            {task.status === "failed" && task.error && (
              <span className="text-xs text-red-500 truncate max-w-[200px]">
                {task.error}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
