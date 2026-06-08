import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Settings, FolderOpen, Cookie, CheckCircle2,
  XCircle, RefreshCw, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AppSettings, DependencyStatus } from "@/types/download";

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
}

export function SettingsView({ settings, onSettingsChange }: SettingsViewProps) {
  const [local, setLocal] = useState<AppSettings>(settings);
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { checkDeps(); }, []);

  const checkDeps = async () => {
    try {
      const d = await invoke<DependencyStatus>("check_dependencies");
      setDeps(d);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings: local });
      onSettingsChange(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBrowseOutput = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setLocal((prev) => ({ ...prev, output_dir: selected }));
    }
  };

  const handleBrowseCookies = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Cookies 文件", extensions: ["txt"] }],
    });
    if (selected && typeof selected === "string") {
      setLocal((prev) => ({ ...prev, cookies_file: selected }));
    }
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border">
        <Settings className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">设置</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

        {/* === 下载路径 === */}
        <Section title="下载路径">
          <div className="flex items-center gap-2">
            <Input
              value={local.output_dir}
              onChange={(e) => update("output_dir", e.target.value)}
              placeholder="~/Downloads/AnyFetch"
              className="flex-1 text-xs"
            />
            <Button variant="secondary" size="icon" onClick={handleBrowseOutput}>
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
        </Section>

        {/* === 下载格式 === */}
        <Section title="默认格式">
          <div className="flex gap-2">
            {[
              { id: "best", label: "最佳质量" },
              { id: "1080p", label: "1080p" },
              { id: "720p", label: "720p" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => update("default_format", opt.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs transition-all border cursor-default select-none",
                  local.default_format === opt.id
                    ? "bg-brand-500/10 text-brand-600 border-brand-500/30 font-medium"
                    : "border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* === 默认模式 === */}
        <Section title="默认下载模式">
          <div className="flex gap-2">
            <button
              onClick={() => update("audio_only", false)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-all border cursor-default select-none",
                !local.audio_only
                  ? "bg-brand-500/10 text-brand-600 border-brand-500/30 font-medium"
                  : "border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
            >
              视频
            </button>
            <button
              onClick={() => update("audio_only", true)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-all border cursor-default select-none",
                local.audio_only
                  ? "bg-purple-500/10 text-purple-600 border-purple-500/30 font-medium"
                  : "border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
            >
              仅音频 (MP3)
            </button>
          </div>
        </Section>

        {/* === 并发数 === */}
        <Section title={`最大并发下载数：${local.max_concurrent}`}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={8}
              value={local.max_concurrent}
              onChange={(e) => update("max_concurrent", Number(e.target.value))}
              className="w-full accent-brand-500"
            />
            <span className="text-sm font-mono text-brand-600 font-bold w-4">{local.max_concurrent}</span>
          </div>
        </Section>

        {/* === Cookies === */}
        <Section title="Cookies 文件" hint="用于下载需要登录的内容（如 B站大会员视频）">
          <div className="space-y-2">
            {local.cookies_file ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <Cookie className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-700 flex-1 truncate font-medium">{local.cookies_file}</span>
                <button
                  onClick={() => update("cookies_file", undefined)}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={handleBrowseCookies} className="text-xs">
                <Cookie className="w-3.5 h-3.5 mr-1.5" />
                导入 cookies.txt
              </Button>
            )}
            <p className="text-xs text-slate-400">
              使用浏览器扩展导出 Netscape 格式的 cookies.txt 文件
            </p>
          </div>
        </Section>

        {/* === 依赖状态 === */}
        <Section title="依赖状态">
          <div className="space-y-2">
            <DepRow
              name="yt-dlp"
              ok={deps?.ytdlp_installed ?? false}
              version={deps?.ytdlp_version}
              path={deps?.ytdlp_path}
            />
            <DepRow
              name="ffmpeg"
              ok={deps?.ffmpeg_installed ?? false}
              version={deps?.ffmpeg_version}
              hint="视频合并和格式转换所需"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={checkDeps} className="text-xs mt-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <RefreshCw className="w-3 h-3 mr-1.5" />
            重新检测
          </Button>
        </Section>

      </div>

      {/* Save bar */}
      <div className="px-4 py-3 border-t border-surface-border flex items-center justify-between">
        <p className="text-xs text-slate-400">设置将自动保存到本地</p>
        <Button size="sm" onClick={handleSave} className="gap-2">
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              已保存
            </>
          ) : "保存设置"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function DepRow({ name, ok, version, path, hint }: {
  name: string; ok: boolean; version?: string; path?: string; hint?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 p-2.5 rounded-lg border",
      ok ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
    )}>
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{name}</span>
          {version && <span className="text-xs text-slate-400">{version.split(" ")[0]}</span>}
        </div>
        {path && <p className="text-xs text-slate-400 truncate mt-0.5">{path}</p>}
        {hint && !ok && <p className="text-xs text-red-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
