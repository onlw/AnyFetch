export type DownloadStatus =
  | "pending"
  | "fetching"
  | "downloading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  format_id: string;
  audio_only: boolean;
  output_dir: string;
  filename?: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  size: string;
  error?: string;
  cookies_file?: string;
  cookies_from_browser?: string;
  created_at: number;
  completed_at?: number;
}

export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string;
  fps?: number;
  filesize?: number;
  vcodec: string;
  acodec: string;
  format_note: string;
  tbr?: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  webpage_url: string;
  formats: VideoFormat[];
  is_playlist: boolean;
  playlist_entries?: PlaylistEntry[];
  cookies_from_browser?: string;
  // Raw yt-dlp fields
  _type?: string;
  entries?: RawPlaylistEntry[];
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: number;
}

export interface RawPlaylistEntry {
  id: string;
  title: string;
  url?: string;
  webpage_url?: string;
  thumbnail?: string;
  duration?: number;
}

export interface ProgressEvent {
  task_id: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  size: string;
  error?: string;
}

export interface DependencyStatus {
  ytdlp_installed: boolean;
  ytdlp_version?: string;
  ytdlp_path?: string;
  ffmpeg_installed: boolean;
  ffmpeg_version?: string;
}

export interface InstallProgress {
  stage: string;
  progress: number;
  message: string;
}

export interface AppSettings {
  output_dir: string;
  max_concurrent: number;
  cookies_file?: string;
  default_format: string;
  audio_only: boolean;
  embed_thumbnail: boolean;
}
