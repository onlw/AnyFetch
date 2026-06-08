use std::io::Write;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: String,
    pub progress: f64,
    pub message: String,
}

/// 检测 yt-dlp 是否可用
pub fn check_ytdlp() -> (bool, Option<String>, Option<PathBuf>) {
    // 检查 ~/.local/bin/yt-dlp
    if let Some(home) = dirs::home_dir() {
        let local_bin = home.join(".local").join("bin").join("yt-dlp");
        if local_bin.exists() {
            let version = get_version(&local_bin);
            return (true, version, Some(local_bin));
        }
    }

    // 检查系统 PATH（Homebrew 等）
    for path_str in &["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp"] {
        let p = PathBuf::from(path_str);
        if p.exists() {
            let version = get_version(&p);
            return (true, version, Some(p));
        }
    }

    // 最后尝试 which
    if let Ok(output) = Command::new("which").arg("yt-dlp").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                let p = PathBuf::from(&path_str);
                let version = get_version(&p);
                return (true, version, Some(p));
            }
        }
    }

    (false, None, None)
}

/// 检测 ffmpeg 是否可用
pub fn check_ffmpeg() -> (bool, Option<String>) {
    let brew_paths = [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ];

    for path_str in &brew_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            let version = get_ffmpeg_version(&p);
            return (true, version);
        }
    }

    // 尝试 which
    if let Ok(output) = Command::new("which").arg("ffmpeg").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                let p = PathBuf::from(&path_str);
                let version = get_ffmpeg_version(&p);
                return (true, version);
            }
        }
    }

    (false, None)
}

pub fn get_dependency_status() -> DependencyStatus {
    let (ytdlp_ok, ytdlp_ver, ytdlp_path) = check_ytdlp();
    let (ffmpeg_ok, ffmpeg_ver) = check_ffmpeg();

    DependencyStatus {
        ytdlp_installed: ytdlp_ok,
        ytdlp_version: ytdlp_ver,
        ytdlp_path: ytdlp_path.map(|p| p.to_string_lossy().to_string()),
        ffmpeg_installed: ffmpeg_ok,
        ffmpeg_version: ffmpeg_ver,
    }
}

fn get_version(path: &PathBuf) -> Option<String> {
    Command::new(path)
        .arg("--version")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn get_ffmpeg_version(path: &PathBuf) -> Option<String> {
    Command::new(path)
        .arg("-version")
        .output()
        .ok()
        .map(|o| {
            let s = String::from_utf8_lossy(&o.stdout);
            s.lines().next().unwrap_or("").to_string()
        })
}

/// 从 GitHub 自动下载安装 yt-dlp
pub async fn install_ytdlp(app: AppHandle) -> Result<PathBuf, String> {
    let emit_progress = |stage: &str, progress: f64, message: &str| {
        let _ = app.emit("setup://progress", InstallProgress {
            stage: stage.to_string(),
            progress,
            message: message.to_string(),
        });
    };

    emit_progress("fetch", 0.0, "正在获取最新版本信息...");

    // 确定目标路径
    let home = dirs::home_dir().ok_or("无法获取 home 目录")?;
    let local_bin = home.join(".local").join("bin");
    std::fs::create_dir_all(&local_bin).map_err(|e| format!("创建目录失败: {}", e))?;

    let target_path = local_bin.join("yt-dlp");

    // 确定平台架构
    let arch = std::env::consts::ARCH;
    let filename = match arch {
        "aarch64" => "yt-dlp_macos",
        "x86_64" => "yt-dlp_macos",
        _ => "yt-dlp_macos",
    };

    let download_url = format!(
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/{}",
        filename
    );

    emit_progress("download", 10.0, &format!("正在下载 yt-dlp ({})...", arch));

    // 使用 reqwest 下载（带进度）
    let client = reqwest::Client::builder()
        .user_agent("AnyFetch/0.1.0")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut file_bytes = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载中断: {}", e))?;
        downloaded += chunk.len() as u64;
        file_bytes.extend_from_slice(&chunk);

        if total > 0 {
            let pct = 10.0 + (downloaded as f64 / total as f64) * 80.0;
            emit_progress("download", pct, &format!("下载中... {}/{}", downloaded, total));
        }
    }

    emit_progress("install", 90.0, "正在安装...");

    // 写入文件
    let mut file = std::fs::File::create(&target_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;
    file.write_all(&file_bytes)
        .map_err(|e| format!("写入失败: {}", e))?;

    // 设置可执行权限
    #[cfg(unix)]
    {
        let mut perms = std::fs::metadata(&target_path)
            .map_err(|e| format!("读取权限失败: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&target_path, perms)
            .map_err(|e| format!("设置权限失败: {}", e))?;
    }

    emit_progress("done", 100.0, "yt-dlp 安装完成！");

    Ok(target_path)
}
