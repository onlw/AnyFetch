use std::io::{BufRead, BufReader};
#[cfg(unix)]
#[allow(unused_imports)]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DownloadStatus {
    Pending,
    Fetching,
    Downloading,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub format_id: String,
    pub audio_only: bool,
    pub output_dir: String,
    pub filename: Option<String>,
    pub status: DownloadStatus,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub size: String,
    pub error: Option<String>,
    pub cookies_file: Option<String>,
    pub cookies_from_browser: Option<String>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: String,
    pub fps: Option<f64>,
    pub filesize: Option<u64>,
    pub vcodec: String,
    pub acodec: String,
    pub format_note: String,
    pub tbr: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub uploader: Option<String>,
    pub webpage_url: String,
    pub formats: Vec<VideoFormat>,
    pub is_playlist: bool,
    pub playlist_entries: Option<Vec<PlaylistEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub task_id: String,
    pub status: DownloadStatus,
    pub progress: f64,
    pub speed: String,
    pub eta: String,
    pub size: String,
    pub error: Option<String>,
}

// ProcessMap: task_id -> child PID
pub type ProcessMap = Arc<Mutex<HashMap<String, u32>>>;

pub fn new_process_map() -> ProcessMap {
    Arc::new(Mutex::new(HashMap::new()))
}

pub fn get_ytdlp_path() -> PathBuf {
    // 优先检查 ~/.local/bin/yt-dlp
    if let Some(home) = dirs::home_dir() {
        let local_bin = home.join(".local").join("bin").join("yt-dlp");
        if local_bin.exists() {
            return local_bin;
        }
    }
    // 回退到系统 PATH
    which_binary("yt-dlp").unwrap_or_else(|| PathBuf::from("yt-dlp"))
}

pub fn get_ffmpeg_path() -> Option<PathBuf> {
    // 检查常见 Homebrew 路径
    let brew_paths = [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ];
    for p in &brew_paths {
        let path = PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
    }
    which_binary("ffmpeg")
}

fn which_binary(name: &str) -> Option<PathBuf> {
    Command::new("which")
        .arg(name)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if s.is_empty() { None } else { Some(PathBuf::from(s)) }
            } else {
                None
            }
        })
}

pub async fn fetch_video_info(
    url: &str,
    cookies_file: Option<&str>,
) -> Result<serde_json::Value, String> {
    let ytdlp = get_ytdlp_path();

    // 如果没有配置 cookies 并且是 bilibili 视频，我们优先尝试从 chrome 读取 cookies
    if cookies_file.is_none() && (url.contains("bilibili.com") || url.contains("b23.tv")) {
        let mut cmd = Command::new(&ytdlp);
        cmd.arg("--dump-json")
            .arg("--no-playlist")
            .arg("--no-warnings")
            .arg("--cookies-from-browser")
            .arg("chrome")
            .arg(url);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                    if let Some(obj) = json.as_object_mut() {
                        obj.insert("cookies_from_browser".to_string(), serde_json::Value::String("chrome".to_string()));
                    }
                    return Ok(json);
                }
            }
        }
    }

    let mut cmd = Command::new(&ytdlp);
    cmd.arg("--dump-json")
        .arg("--no-playlist")
        .arg("--no-warnings")
        .arg(url);

    if let Some(cf) = cookies_file {
        cmd.arg("--cookies").arg(cf);
    }

    let output = cmd.output().map_err(|e| format!("启动 yt-dlp 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // 如果失败是 412 风控，且还没有尝试过 chrome，我们做一次 Chrome cookies 重试
        if (stderr.contains("412") || stderr.contains("Precondition Failed")) && cookies_file.is_none() {
            let mut retry_cmd = Command::new(&ytdlp);
            retry_cmd.arg("--dump-json")
                .arg("--no-playlist")
                .arg("--no-warnings")
                .arg("--cookies-from-browser")
                .arg("chrome")
                .arg(url);
            if let Ok(retry_output) = retry_cmd.output() {
                if retry_output.status.success() {
                    let stdout = String::from_utf8_lossy(&retry_output.stdout);
                    if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        if let Some(obj) = json.as_object_mut() {
                            obj.insert("cookies_from_browser".to_string(), serde_json::Value::String("chrome".to_string()));
                        }
                        return Ok(json);
                    }
                }
            }
        }
        return Err(format!("yt-dlp 错误: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout).map_err(|e| format!("解析失败: {}", e))
}

pub async fn fetch_playlist_info(
    url: &str,
    cookies_file: Option<&str>,
) -> Result<serde_json::Value, String> {
    let ytdlp = get_ytdlp_path();

    if cookies_file.is_none() && (url.contains("bilibili.com") || url.contains("b23.tv")) {
        let mut cmd = Command::new(&ytdlp);
        cmd.arg("--dump-json")
            .arg("--flat-playlist")
            .arg("--no-warnings")
            .arg("--cookies-from-browser")
            .arg("chrome")
            .arg(url);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let first_line = stdout.lines().next().unwrap_or("{}");
                if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(first_line) {
                    if let Some(obj) = json.as_object_mut() {
                        obj.insert("cookies_from_browser".to_string(), serde_json::Value::String("chrome".to_string()));
                    }
                    return Ok(json);
                }
            }
        }
    }

    let mut cmd = Command::new(&ytdlp);
    cmd.arg("--dump-json")
        .arg("--flat-playlist")
        .arg("--no-warnings")
        .arg(url);

    if let Some(cf) = cookies_file {
        cmd.arg("--cookies").arg(cf);
    }

    let output = cmd.output().map_err(|e| format!("启动 yt-dlp 失败: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let first_line = stdout.lines().next().unwrap_or("{}");
        serde_json::from_str(first_line).map_err(|e| format!("解析失败: {}", e))
    } else {
        // 非 playlist，回退到单视频
        fetch_video_info(url, cookies_file).await
    }
}

pub fn build_ytdlp_command(task: &DownloadTask, ffmpeg_path: Option<&PathBuf>) -> Command {
    let ytdlp = get_ytdlp_path();
    let mut cmd = Command::new(&ytdlp);

    // 格式选择
    if task.audio_only {
        cmd.arg("-f").arg("bestaudio/best");
        cmd.arg("-x");
        cmd.arg("--audio-format").arg("mp3");
        cmd.arg("--audio-quality").arg("0");
    } else if task.format_id == "best" || task.format_id.is_empty() {
        cmd.arg("-f").arg("bestvideo+bestaudio/best");
        cmd.arg("--merge-output-format").arg("mp4");
    } else {
        cmd.arg("-f").arg(&task.format_id);
        cmd.arg("--merge-output-format").arg("mp4");
    }

    // 输出路径
    let output_template = format!("{}/%(title)s.%(ext)s", task.output_dir);
    cmd.arg("-o").arg(&output_template);

    // ffmpeg 路径
    if let Some(ff) = ffmpeg_path {
        cmd.arg("--ffmpeg-location").arg(ff);
    }

    // Cookies
    if let Some(cf) = &task.cookies_file {
        cmd.arg("--cookies").arg(cf);
    } else if let Some(cfb) = &task.cookies_from_browser {
        cmd.arg("--cookies-from-browser").arg(cfb);
    } else if task.url.contains("bilibili.com") || task.url.contains("b23.tv") {
        // 对于 bilibili 默认也尝试读取 chrome 的 cookies 规避 412 风控
        cmd.arg("--cookies-from-browser").arg("chrome");
    }

    // 进度格式（机器可读）
    cmd.arg("--progress")
        .arg("--newline")
        .arg("--no-warnings");

    // 嵌入字幕/缩略图（可选）
    cmd.arg("--embed-thumbnail");

    cmd.arg(&task.url);

    cmd.stdout(Stdio::piped())
       .stderr(Stdio::piped());

    cmd
}

pub fn start_download(
    app: AppHandle,
    task: DownloadTask,
    process_map: ProcessMap,
) {
    let task_id = task.id.clone();

    std::thread::spawn(move || {
        // 发送 Downloading 状态
        let _ = app.emit("download://progress", ProgressEvent {
            task_id: task_id.clone(),
            status: DownloadStatus::Downloading,
            progress: 0.0,
            speed: String::new(),
            eta: String::new(),
            size: String::new(),
            error: None,
        });

        let ffmpeg = get_ffmpeg_path();
        let mut cmd = build_ytdlp_command(&task, ffmpeg.as_ref());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("download://progress", ProgressEvent {
                    task_id: task_id.clone(),
                    status: DownloadStatus::Failed,
                    progress: 0.0,
                    speed: String::new(),
                    eta: String::new(),
                    size: String::new(),
                    error: Some(format!("启动失败: {}", e)),
                });
                return;
            }
        };

        // 记录 PID
        let pid = child.id();
        {
            let mut map = process_map.lock().unwrap();
            map.insert(task_id.clone(), pid);
        }

        // 读取 stdout 解析进度
        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);
        let progress_re = regex::Regex::new(
            r"\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+/s)\s+ETA\s+([\d:]+)"
        ).unwrap();

        for line in reader.lines().flatten() {
            if let Some(caps) = progress_re.captures(&line) {
                let progress: f64 = caps[1].parse().unwrap_or(0.0);
                let size = caps[2].to_string();
                let speed = caps[3].to_string();
                let eta = caps[4].to_string();

                let _ = app.emit("download://progress", ProgressEvent {
                    task_id: task_id.clone(),
                    status: DownloadStatus::Downloading,
                    progress,
                    speed,
                    eta,
                    size,
                    error: None,
                });
            } else if line.contains("[Merger]") || line.contains("[ExtractAudio]") {
                let _ = app.emit("download://progress", ProgressEvent {
                    task_id: task_id.clone(),
                    status: DownloadStatus::Processing,
                    progress: 99.0,
                    speed: String::new(),
                    eta: String::new(),
                    size: String::new(),
                    error: None,
                });
            }
        }

        let exit_status = child.wait();
        let success = exit_status.map(|s| s.success()).unwrap_or(false);

        // 清理 PID
        {
            let mut map = process_map.lock().unwrap();
            map.remove(&task_id);
        }

        if success {
            let _ = app.emit("download://progress", ProgressEvent {
                task_id: task_id.clone(),
                status: DownloadStatus::Completed,
                progress: 100.0,
                speed: String::new(),
                eta: String::new(),
                size: String::new(),
                error: None,
            });
        } else {
            let _ = app.emit("download://progress", ProgressEvent {
                task_id: task_id.clone(),
                status: DownloadStatus::Failed,
                progress: 0.0,
                speed: String::new(),
                eta: String::new(),
                size: String::new(),
                error: Some("下载失败，请检查 URL 或网络连接".to_string()),
            });
        }
    });
}
