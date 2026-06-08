import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { History, Trash2, FolderOpen, CheckCircle2, AlertCircle, Inbox, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn, formatDuration, extractDomain } from "@/lib/utils";
import type { DownloadTask } from "@/types/download";

export function HistoryView() {
  const [history, setHistory] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const h = await invoke<DownloadTask[]>("get_history");
      setHistory(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    await invoke("clear_history");
    setHistory([]);
  };

  const handleOpen = (task: DownloadTask) => {
    invoke("open_file_location", { path: task.output_dir }).catch(console.error);
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">历史记录</span>
          {history.length > 0 && (
            <span className="text-xs text-slate-400">{history.length} 条</span>
          )}
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 h-7"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            清空历史
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100/80 flex items-center justify-center border border-slate-200/50">
                <Inbox className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">暂无历史记录</p>
            </div>
          ) : (
            history.map((task) => (
              <HistoryItem key={task.id} task={task} onOpen={handleOpen} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function HistoryItem({ task, onOpen }: { task: DownloadTask; onOpen: (t: DownloadTask) => void }) {
  const success = task.status === "completed";
  const date = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white hover:border-slate-200/80 hover:shadow-xs transition-all border border-transparent">
      {/* Thumbnail */}
      <div className="relative shrink-0 w-14 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/50">
        {task.thumbnail ? (
          <img src={task.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {task.audio_only
              ? <Music className="w-4 h-4 text-slate-300" />
              : <Video className="w-4 h-4 text-slate-300" />}
          </div>
        )}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-slate-900/5"
        )}>
          {success
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <AlertCircle className="w-4 h-4 text-red-500" />}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 font-medium truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">{extractDomain(task.url)}</span>
          {date && <span className="text-xs text-slate-400">{date}</span>}
          {task.audio_only && <Badge variant="audio" className="text-[10px] py-0 h-3.5">MP3</Badge>}
        </div>
      </div>

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onOpen(task)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        title="在 Finder 中显示"
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
