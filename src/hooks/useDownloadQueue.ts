import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { DownloadTask, ProgressEvent } from "@/types/download";
import { generateId } from "@/lib/utils";

export function useDownloadQueue() {
  const [queue, setQueue] = useState<DownloadTask[]>([]);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // 监听下载进度事件
    const setup = async () => {
      const unlisten = await listen<ProgressEvent>("download://progress", (event) => {
        const ev = event.payload;
        setQueue((prev) =>
          prev.map((task) =>
            task.id === ev.task_id
              ? {
                  ...task,
                  status: ev.status,
                  progress: ev.progress,
                  speed: ev.speed,
                  eta: ev.eta,
                  size: ev.size,
                  error: ev.error,
                  completed_at:
                    ev.status === "completed" ? Date.now() : task.completed_at,
                }
              : task
          )
        );

        // 完成/失败时同步到历史记录
        if (ev.status === "completed" || ev.status === "failed") {
          setQueue((prev) => {
            const task = prev.find((t) => t.id === ev.task_id);
            if (task) {
              const updated = {
                ...task,
                status: ev.status,
                progress: ev.progress,
                completed_at: Date.now(),
              };
              invoke("add_to_history", { task: updated }).catch(console.error);
            }
            return prev;
          });
        }
      });
      unlistenRef.current = unlisten;
    };

    setup();
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const addTask = async (taskData: Omit<DownloadTask, "id" | "status" | "progress" | "speed" | "eta" | "size" | "created_at">) => {
    const task: DownloadTask = {
      ...taskData,
      id: generateId(),
      status: "pending",
      progress: 0,
      speed: "",
      eta: "",
      size: "",
      created_at: Date.now(),
    };

    setQueue((prev) => [task, ...prev]);

    try {
      await invoke("start_download_task", { task });
    } catch (err) {
      setQueue((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: "failed", error: String(err) }
            : t
        )
      );
    }

    return task.id;
  };

  const cancelTask = async (taskId: string) => {
    try {
      await invoke("cancel_download", { taskId });
      setQueue((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "cancelled" } : t
        )
      );
    } catch (err) {
      console.error("Cancel failed:", err);
    }
  };

  const removeTask = (taskId: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== taskId));
  };

  const clearCompleted = () => {
    setQueue((prev) =>
      prev.filter((t) => t.status !== "completed" && t.status !== "failed" && t.status !== "cancelled")
    );
  };

  const activeCount = queue.filter(
    (t) => t.status === "downloading" || t.status === "fetching" || t.status === "processing"
  ).length;

  return {
    queue,
    addTask,
    cancelTask,
    removeTask,
    clearCompleted,
    activeCount,
  };
}
