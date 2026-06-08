import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sidebar, type ViewType } from "@/components/Sidebar";
import { URLInputBar } from "@/components/URLInputBar";
import { FormatDialog } from "@/components/FormatDialog";
import { DownloadQueue } from "@/components/DownloadQueue";
import { HistoryView } from "@/components/HistoryView";
import { SettingsView } from "@/components/SettingsView";
import { SetupView } from "@/components/SetupView";
import { useDownloadQueue } from "@/hooks/useDownloadQueue";
import { useSetup } from "@/hooks/useSetup";
import type { VideoInfo, AppSettings } from "@/types/download";
import "./index.css";

const DEFAULT_SETTINGS: AppSettings = {
  output_dir: "",
  max_concurrent: 3,
  cookies_file: undefined,
  default_format: "best",
  audio_only: false,
  embed_thumbnail: true,
};

export default function App() {
  const [view, setView] = useState<ViewType>("downloads");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [pendingInfo, setPendingInfo] = useState<{ info: VideoInfo; url: string } | null>(null);

  const { setupState, deps, installProgress, installError, installYtDlp, checkDeps } = useSetup();
  const { queue, addTask, cancelTask, removeTask, clearCompleted, activeCount } = useDownloadQueue();

  // 加载设置
  useEffect(() => {
    invoke<AppSettings | null>("load_settings_from_disk")
      .then((s) => {
        if (s) setSettings(s);
        else {
          // 设置默认下载路径
          invoke<string>("get_default_download_dir")
            .then((dir) => setSettings((prev) => ({ ...prev, output_dir: dir })))
            .catch(console.error);
        }
      })
      .catch(console.error);
  }, []);

  const handleInfoFetched = (info: VideoInfo, url: string) => {
    setPendingInfo({ info, url });
  };

  const handleFormatConfirm = async (
    formatId: string,
    audioOnly: boolean,
    selectedEntries?: string[]
  ) => {
    if (!pendingInfo) return;
    const { info } = pendingInfo;

    if (info.is_playlist && info.playlist_entries && selectedEntries) {
      // 批量下载选中的 playlist 条目
      for (const entry of info.playlist_entries) {
        if (selectedEntries.includes(entry.id)) {
          await addTask({
            url: entry.url || info.webpage_url,
            title: entry.title,
            thumbnail: entry.thumbnail,
            format_id: formatId,
            audio_only: audioOnly,
            output_dir: settings.output_dir,
            cookies_file: settings.cookies_file,
            cookies_from_browser: info.cookies_from_browser,
          });
        }
      }
    } else {
      // 单视频
      await addTask({
        url: info.webpage_url,
        title: info.title,
        thumbnail: info.thumbnail,
        format_id: formatId,
        audio_only: audioOnly,
        output_dir: settings.output_dir,
        cookies_file: settings.cookies_file,
        cookies_from_browser: info.cookies_from_browser,
      });
    }

    setPendingInfo(null);
    setView("downloads");
  };

  const isReady = setupState === "ready";

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base text-slate-800 select-none">
      {/* macOS traffic lights space (titleBarStyle: overlay) */}
      {isReady && (
        <div
          className="absolute top-0 left-0 right-0 z-10 h-7 flex items-center justify-center"
          data-tauri-drag-region
        >
          {/* Centered app title in titlebar */}
          <span className="text-xs font-medium text-slate-400/60 pointer-events-none">AnyFetch</span>
        </div>
      )}

      {/* Sidebar */}
      {isReady && (
        <div className="pt-7">
          <Sidebar
            activeView={view}
            onViewChange={setView}
            activeCount={activeCount}
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 pt-7">
        {!isReady ? (
          <SetupView
            state={setupState}
            deps={deps}
            installProgress={installProgress}
            installError={installError}
            onInstall={installYtDlp}
            onRetry={checkDeps}
          />
        ) : (
          <>
            {/* URL Input Bar — always visible when ready */}
            <URLInputBar
              onInfoFetched={handleInfoFetched}
              settings={settings}
            />

            {/* Views */}
            <div className="flex-1 min-h-0">
              {view === "downloads" && (
                <DownloadQueue
                  queue={queue}
                  onCancel={cancelTask}
                  onRemove={removeTask}
                  onClearCompleted={clearCompleted}
                  onRetry={(task) => {
                    addTask({
                      url: task.url,
                      title: task.title,
                      thumbnail: task.thumbnail,
                      format_id: task.format_id,
                      audio_only: task.audio_only,
                      output_dir: task.output_dir,
                      cookies_file: task.cookies_file,
                      cookies_from_browser: task.cookies_from_browser,
                    });
                  }}
                />
              )}
              {view === "history" && <HistoryView />}
              {view === "settings" && (
                <SettingsView
                  settings={settings}
                  onSettingsChange={setSettings}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Format selection dialog */}
      <FormatDialog
        info={pendingInfo?.info ?? null}
        open={!!pendingInfo}
        onClose={() => setPendingInfo(null)}
        onConfirm={handleFormatConfirm}
        settings={settings}
      />
    </div>
  );
}
