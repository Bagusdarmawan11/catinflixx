"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  ExternalLink,
  Maximize,
  Minimize,
} from "lucide-react";
import type { VideoState } from "@/hooks/useWatchParty";

interface Props {
  videoUrl: string;
  videoTitle: string;
  videoState: VideoState;
  isHost: boolean;
  onControl: (isPlaying: boolean, currentTime: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

// ID stabil untuk player — 1 player per halaman
const YT_PLAYER_ID = "catinflix-yt-player";

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com"))
      return parsed.searchParams.get("v");
  } catch {}
  return null;
}

async function lockLandscape() {
  try {
    const scr = window.screen as any;
    if (scr.orientation?.lock) await scr.orientation.lock("landscape");
  } catch {}
}
async function unlockOrientation() {
  try {
    const scr = window.screen as any;
    if (scr.orientation?.unlock) scr.orientation.unlock();
  } catch {}
}

export default function VideoPlayer({
  videoUrl,
  videoTitle,
  videoState,
  isHost,
  onControl,
  onFullscreenChange,
}: Props) {
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const syncLockRef = useRef(false);

  // Simpan videoState terbaru di ref supaya onReady bisa akses tanpa stale closure
  const videoStateRef = useRef(videoState);
  useEffect(() => {
    videoStateRef.current = videoState;
  }, [videoState]);

  const videoId = extractYouTubeId(videoUrl);

  // Load YouTube IFrame API sekali
  useEffect(() => {
    if ((window as any).YT?.Player) {
      setApiReady(true);
      return;
    }
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      (window as any).onYouTubeIframeAPIReady = () => setApiReady(true);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  // Init / reinit player saat apiReady atau videoId berubah
  useEffect(() => {
    if (!apiReady || !videoId) return;

    // Reset playerReady saat videoId berubah
    setPlayerReady(false);

    const timer = setTimeout(() => {
      const el = document.getElementById(YT_PLAYER_ID);
      if (!el) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }

      playerRef.current = new (window as any).YT.Player(YT_PLAYER_ID, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          disablekb: isHost ? 0 : 1,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            setDuration(e.target.getDuration() || 0);

            // Force iframe fill container
            try {
              const iframe = e.target.getIframe();
              if (iframe) {
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.display = "block";
              }
            } catch {}

            // ─── FIX UTAMA: apply videoState saat player pertama ready ───
            // Ini yang menyebabkan YouTube tidak muncul di sisi user:
            // user menerima video-state-sync sebelum player siap,
            // jadi sync effect-nya no-op. Sekarang kita apply ulang di sini.
            if (!isHost) {
              const state = videoStateRef.current;
              const serverTime =
                state.currentTime + (Date.now() - state.updatedAt) / 1000;
              try {
                e.target.seekTo(serverTime, true);
                if (state.isPlaying) {
                  e.target.playVideo();
                } else {
                  e.target.pauseVideo();
                }
              } catch {}
            }

            setPlayerReady(true);
          },
          onStateChange: (e: any) => {
            const YT = (window as any).YT?.PlayerState;
            if (!YT) return;
            if (e.data === YT.PLAYING) setIsPlaying(true);
            if (e.data === YT.PAUSED || e.data === YT.ENDED)
              setIsPlaying(false);
            if (isHost && !syncLockRef.current) {
              const playing = e.data === YT.PLAYING;
              const ct = playerRef.current?.getCurrentTime?.() ?? 0;
              onControl(playing, ct);
            }
          },
        },
      });
    }, 200);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId]);

  // Sync state dari socket (untuk guest) — hanya aktif setelah player ready
  useEffect(() => {
    if (!playerRef.current || isHost || !playerReady) return;
    syncLockRef.current = true;
    const p = playerRef.current;
    const serverTime =
      videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000;
    const clientTime = p.getCurrentTime?.() ?? 0;
    if (Math.abs(serverTime - clientTime) > 3) p.seekTo?.(serverTime, true);
    if (videoState.isPlaying) p.playVideo?.();
    else p.pauseVideo?.();
    setTimeout(() => { syncLockRef.current = false; }, 500);
  }, [videoState, isHost, playerReady]);

  // Update progress setiap detik
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
        const dur = playerRef.current.getDuration?.() || 0;
        if (dur) setDuration(dur);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup orientation saat unmount
  useEffect(() => {
    return () => { unlockOrientation(); };
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      onFullscreenChange?.(next);
      if (next) lockLandscape();
      else unlockOrientation();
      return next;
    });
  }, [onFullscreenChange]);

  function togglePlay() {
    if (!isHost || !playerRef.current) return;
    const YT = (window as any).YT?.PlayerState;
    const p = playerRef.current;
    const playing = p.getPlayerState?.() === YT?.PLAYING;
    if (playing) {
      p.pauseVideo?.();
      onControl(false, p.getCurrentTime?.() ?? 0);
    } else {
      p.playVideo?.();
      onControl(true, p.getCurrentTime?.() ?? 0);
    }
  }

  function toggleMute() {
    if (!playerRef.current) return;
    if (muted) playerRef.current.unMute?.();
    else playerRef.current.mute?.();
    setMuted(!muted);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isHost || !playerRef.current) return;
    const t = Number(e.target.value);
    playerRef.current.seekTo?.(t, true);
    onControl(isPlaying, t);
  }

  function restart() {
    if (!isHost || !playerRef.current) return;
    playerRef.current.seekTo?.(0, true);
    onControl(false, 0);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4 text-gray-400">
        <p className="text-lg">URL video tidak valid</p>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-purple-400 hover:underline text-sm"
        >
          <ExternalLink className="w-4 h-4" /> Buka di browser
        </a>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-black ${isFullscreen ? "" : "h-full w-full"}`}
      style={
        isFullscreen
          ? {
              position: "fixed",
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 100,
            }
          : undefined
      }
    >
      {/* YouTube Player Area */}
      <div className="relative flex-1 bg-black min-h-0 overflow-hidden">
        <div
          id={YT_PLAYER_ID}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Overlay "Menghubungkan video..." saat player belum ready (hanya untuk user/guest) */}
        {!playerReady && !isHost && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-400">Menghubungkan video...</p>
            </div>
          </div>
        )}

        {/* Tombol fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 transition-colors"
          title={isFullscreen ? "Keluar fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>

        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 left-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 transition-colors"
          >
            <Minimize className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Custom Controls */}
      {!isFullscreen && (
        <div className="bg-gray-950 border-t border-white/10 px-3 sm:px-4 py-2 sm:py-3 space-y-1.5 shrink-0">
          <p className="text-xs sm:text-sm font-medium text-white truncate">
            {videoTitle}
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs text-gray-400 w-9 shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={seek}
              disabled={!isHost}
              className="flex-1 h-1 accent-purple-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            />
            <span className="text-xs text-gray-400 w-9 shrink-0 text-right">
              {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isHost && (
              <>
                <button
                  onClick={restart}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={togglePlay}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-1.5 sm:p-2 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </>
            )}
            <button
              onClick={toggleMute}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            {!isHost && (
              <span className="text-[10px] sm:text-xs text-gray-500 italic">
                Hanya host yang bisa mengontrol video
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
