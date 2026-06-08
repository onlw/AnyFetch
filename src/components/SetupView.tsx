import { Zap, Download, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SetupState } from "@/hooks/useSetup";
import type { DependencyStatus, InstallProgress } from "@/types/download";

interface SetupViewProps {
  state: SetupState;
  deps: DependencyStatus | null;
  installProgress: InstallProgress | null;
  installError: string | null;
  onInstall: () => void;
  onRetry: () => void;
}

export function SetupView({
  state,
  deps,
  installProgress,
  installError,
  onInstall,
  onRetry,
}: SetupViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-6 text-center">
        {/* Logo */}
        <div className="flex justify-center">
          <div className={cn(
            "w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl",
            "bg-gradient-to-br from-brand-400 to-brand-700",
            state === "installing" && "animate-pulse"
          )}>
            {state === "checking" || state === "installing"
              ? <Loader2 className="w-10 h-10 text-white animate-spin" />
              : state === "error"
              ? <AlertTriangle className="w-10 h-10 text-white" />
              : <Zap className="w-10 h-10 text-white" />}
          </div>
        </div>

        {/* Content */}
        {state === "checking" && (
          <>
            <h1 className="text-xl font-bold text-slate-800">正在检测环境…</h1>
            <p className="text-sm text-slate-500">检测 yt-dlp 和 ffmpeg</p>
          </>
        )}

        {state === "needs_install" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-slate-800">需要安装依赖</h1>
              <p className="text-sm text-slate-500 mt-2">
                AnyFetch 需要 yt-dlp 才能工作。<br />
                点击下方按钮自动安装。
              </p>
            </div>

            {/* Dep status */}
            <div className="space-y-2 text-left">
              <DepItem name="yt-dlp" ok={deps?.ytdlp_installed ?? false} required />
              <DepItem name="ffmpeg" ok={deps?.ffmpeg_installed ?? false} hint="如需格式转换请安装: brew install ffmpeg" />
            </div>

            <Button onClick={onInstall} size="lg" className="w-full gap-2">
              <Download className="w-5 h-5" />
              自动安装 yt-dlp
            </Button>
            <p className="text-xs text-slate-400">将从 GitHub 下载至 ~/.local/bin/yt-dlp</p>
          </>
        )}

        {state === "installing" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-slate-800">正在安装…</h1>
              <p className="text-sm text-slate-500 mt-1">
                {installProgress?.message ?? "请稍候…"}
              </p>
            </div>
            <Progress value={installProgress?.progress ?? 0} glow className="h-2" />
            <p className="text-xs text-brand-600 font-semibold">
              {Math.round(installProgress?.progress ?? 0)}%
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div>
              <h1 className="text-xl font-bold text-slate-800">安装失败</h1>
              <p className="text-xs text-red-600 mt-2 break-all">{installError}</p>
            </div>
            <div className="space-y-2">
              <Button onClick={onRetry} variant="outline" className="w-full gap-2">
                <Loader2 className="w-4 h-4" />
                重试
              </Button>
              <p className="text-xs text-slate-400">
                或手动安装: brew install yt-dlp
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DepItem({ name, ok, required, hint }: {
  name: string; ok: boolean; required?: boolean; hint?: string;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 p-2.5 rounded-lg border",
      ok ? "border-emerald-200 bg-emerald-50/50" : required ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50/50"
    )}>
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : <AlertTriangle className={cn("w-4 h-4", required ? "text-amber-500" : "text-slate-400")} />}
      <div>
        <span className="text-sm font-medium text-slate-700">{name}</span>
        {!ok && hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      {!ok && required && (
        <span className="ml-auto text-xs text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">必需</span>
      )}
    </div>
  );
}
