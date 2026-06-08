import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { DependencyStatus, InstallProgress } from "@/types/download";

export type SetupState = "checking" | "ready" | "needs_install" | "installing" | "error";

export function useSetup() {
  const [setupState, setSetupState] = useState<SetupState>("checking");
  const [deps, setDeps] = useState<DependencyStatus | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    checkDeps();
  }, []);

  const checkDeps = async () => {
    setSetupState("checking");
    try {
      const status = await invoke<DependencyStatus>("check_dependencies");
      setDeps(status);
      if (status.ytdlp_installed) {
        setSetupState("ready");
      } else {
        setSetupState("needs_install");
      }
    } catch (err) {
      setInstallError(String(err));
      setSetupState("error");
    }
  };

  const installYtDlp = async () => {
    setSetupState("installing");
    setInstallError(null);

    const unlisten = await listen<InstallProgress>("setup://progress", (event) => {
      setInstallProgress(event.payload);
    });

    try {
      await invoke("install_yt_dlp");
      unlisten();
      // 重新检测
      await checkDeps();
    } catch (err) {
      unlisten();
      setInstallError(String(err));
      setSetupState("error");
    }
  };

  return {
    setupState,
    deps,
    installProgress,
    installError,
    checkDeps,
    installYtDlp,
  };
}
