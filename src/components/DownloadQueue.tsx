import { Download, Trash2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DownloadCard } from "@/components/DownloadCard";
import type { DownloadTask } from "@/types/download";

interface DownloadQueueProps {
  queue: DownloadTask[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onRetry?: (task: DownloadTask) => void;
  onClearCompleted: () => void;
}

export function DownloadQueue({
  queue,
  onCancel,
  onRemove,
  onRetry,
  onClearCompleted,
}: DownloadQueueProps) {
  const hasCompleted = queue.some(
    (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled"
  );
  const activeCount = queue.filter(
    (t) => t.status === "downloading" || t.status === "fetching" || t.status === "processing"
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">下载队列</span>
          {queue.length > 0 && (
            <span className="text-xs text-slate-400">
              {activeCount > 0 ? `${activeCount} 个进行中` : `${queue.length} 个`}
            </span>
          )}
        </div>
        {hasCompleted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCompleted}
            className="text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 h-7"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            清除已完成
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-4 pb-4 space-y-2">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100/80 flex items-center justify-center border border-slate-200/50">
                <Inbox className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">无下载任务</p>
                <p className="text-xs text-slate-400 mt-1">粘贴视频链接开始下载</p>
              </div>
            </div>
          ) : (
            queue.map((task) => (
              <DownloadCard
                key={task.id}
                task={task}
                onCancel={onCancel}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
