mod downloader;
mod installer;

#[allow(unused_imports)]
use downloader::{
    DownloadTask, DownloadStatus,
    ProcessMap, new_process_map, fetch_video_info, fetch_playlist_info, start_download,
};
use installer::{DependencyStatus, get_dependency_status, install_ytdlp};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};
use serde_json::Value;

// ──── State ────────────────────────────────────────────────────────────────
struct AppState {
    process_map: ProcessMap,
    history: Arc<Mutex<Vec<DownloadTask>>>,
    settings: Arc<Mutex<AppSettings>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct AppSettings {
    output_dir: String,
    max_concurrent: u32,
    cookies_file: Option<String>,
    default_format: String,
    audio_only: bool,
    embed_thumbnail: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let downloads = dirs::download_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
            .join("AnyFetch")
            .to_string_lossy()
            .to_string();
        Self {
            output_dir: downloads,
            max_concurrent: 3,
            cookies_file: None,
            default_format: "best".to_string(),
            audio_only: false,
            embed_thumbnail: true,
        }
    }
}

// ──── Commands ─────────────────────────────────────────────────────────────

#[tauri::command]
async fn check_dependencies() -> Result<DependencyStatus, String> {
    Ok(get_dependency_status())
}

#[tauri::command]
async fn install_yt_dlp(app: AppHandle) -> Result<String, String> {
    install_ytdlp(app)
        .await
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
async fn fetch_info(
    url: String,
    cookies_file: Option<String>,
) -> Result<Value, String> {
    // 先尝试作为 playlist 获取
    let info = fetch_playlist_info(&url, cookies_file.as_deref()).await?;

    // 判断是否是 playlist
    if info.get("_type").and_then(|v| v.as_str()) == Some("playlist") {
        return Ok(info);
    }

    // 单视频
    fetch_video_info(&url, cookies_file.as_deref()).await
}

#[tauri::command]
async fn start_download_task(
    task: DownloadTask,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let task_id = task.id.clone();
    let process_map = state.process_map.clone();

    // 确保输出目录存在
    std::fs::create_dir_all(&task.output_dir)
        .map_err(|e| format!("创建输出目录失败: {}", e))?;

    start_download(app, task, process_map);
    Ok(task_id)
}

#[tauri::command]
async fn cancel_download(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let map = state.process_map.lock().unwrap();
    if let Some(&pid) = map.get(&task_id) {
        #[cfg(unix)]
        {
            let _ = std::process::Command::new("kill")
                .arg("-TERM")
                .arg(pid.to_string())
                .status();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut s = state.settings.lock().unwrap();
    *s = settings.clone();

    // 持久化到文件
    if let Some(config_dir) = dirs::config_dir() {
        let app_config = config_dir.join("anyfetch");
        let _ = std::fs::create_dir_all(&app_config);
        let settings_path = app_config.join("settings.json");
        let json = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("序列化失败: {}", e))?;
        std::fs::write(settings_path, json)
            .map_err(|e| format!("保存失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn load_settings_from_disk() -> Option<AppSettings> {
    dirs::config_dir().and_then(|config_dir| {
        let path = config_dir.join("anyfetch").join("settings.json");
        std::fs::read_to_string(path).ok()
            .and_then(|s| serde_json::from_str(&s).ok())
    })
}

#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Vec<DownloadTask> {
    state.history.lock().unwrap().clone()
}

#[tauri::command]
fn add_to_history(
    task: DownloadTask,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    history.retain(|t| t.id != task.id);
    history.insert(0, task);
    // 最多保留 200 条
    history.truncate(200);

    // 持久化
    save_history_to_disk(&history)
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    let mut history = state.history.lock().unwrap();
    history.clear();
    save_history_to_disk(&history)
}

fn save_history_to_disk(history: &[DownloadTask]) -> Result<(), String> {
    if let Some(config_dir) = dirs::config_dir() {
        let app_config = config_dir.join("anyfetch");
        let _ = std::fs::create_dir_all(&app_config);
        let path = app_config.join("history.json");
        let json = serde_json::to_string(history)
            .map_err(|e| format!("序列化失败: {}", e))?;
        std::fs::write(path, json)
            .map_err(|e| format!("保存历史记录失败: {}", e))?;
    }
    Ok(())
}

fn load_history_from_disk() -> Vec<DownloadTask> {
    dirs::config_dir()
        .and_then(|d| {
            let path = d.join("anyfetch").join("history.json");
            std::fs::read_to_string(path).ok()
                .and_then(|s| serde_json::from_str(&s).ok())
        })
        .unwrap_or_default()
}

#[tauri::command]
fn open_file_location(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件位置: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_default_download_dir() -> String {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("AnyFetch")
        .to_string_lossy()
        .to_string()
}

// ──── App Entry ────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let history = load_history_from_disk();
    let settings = load_settings_from_disk().unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            process_map: new_process_map(),
            history: Arc::new(Mutex::new(history)),
            settings: Arc::new(Mutex::new(settings)),
        })
        .invoke_handler(tauri::generate_handler![
            check_dependencies,
            install_yt_dlp,
            fetch_info,
            start_download_task,
            cancel_download,
            get_settings,
            save_settings,
            load_settings_from_disk,
            get_history,
            add_to_history,
            clear_history,
            open_file_location,
            get_default_download_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AnyFetch");
}
