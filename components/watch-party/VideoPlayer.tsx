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

function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
  } catch {}
  return null;
}

// Lock/unlock orientasi layar
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
  const wrapperRef = useRef<HTMLDivElement>(null); // container fullscreen
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const syncLockRef = useRef(false);

  const videoId = extractYouTubeId(videoUrl);

  // Load YouTube IFrame API
  useEffect(() => {
    if ((window as any).YT?.Player) {
      setApiReady(true);
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => setApiReady(true);
    return () => {
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, []);

  // Init player
  useEffect(() => {
    if (!apiReady || !videoId || !playerDivRef.current) return;
    if (playerRef.current) playerRef.current.destroy();

    playerRef.current = new (window as any).YT.Player(playerDivRef.current, {
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        disablekb: isHost ? 0 : 1,
        fs: 0,          // matikan fullscreen button bawaan YouTube
        playsinline: 1, // hindari native fullscreen iOS agar custom FS bisa kerja
      },
      events: {
        onReady: (e: any) => {
          setDuration(e.target.getDuration());
        },
        onStateChange: (e: any) => {
          const YT = (window as any).YT.PlayerState;
          if (e.data === YT.PLAYING) setIsPlaying(true);
          if (e.data === YT.PAUSED || e.data === YT.ENDED)
            setIsPlaying(false);
          if (isHost && !syncLockRef.current) {
            const playing = e.data === YT.PLAYING;
            const ct = playerRef.current?.getCurrentTime() ?? 0;
            onControl(playing, ct);
          }
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, videoId]);

  // Sync dari socket (guest)
  useEffect(() => {
    if (!playerRef.current || isHost) return;
    syncLockRef.current = true;
    const p = playerRef.current;
    const serverTime =
      videoState.currentTime + (Date.now() - videoState.updatedAt) / 1000;
    const clientTime = p.getCurrentTime?.() ?? 0;
    if (Math.abs(serverTime - clientTime) > 3) p.seekTo?.(serverTime, true);
    if (videoState.isPlaying) p.playVideo?.();
    else p.pauseVideo?.();
    setTimeout(() => {
      syncLockRef.current = false;
    }, 500);
  }, [videoState, isHost]);

  // Progress tracker
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
        setDuration(playerRef.current.getDuration() || 0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Detect browser fullscreen change (dari tombol custom kita)
  useEffect(() => {
    function onFsChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      onFullscreenChange?.(fs);
      if (fs) lockLandscape();
      else unlockOrientation();
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, [onFullscreenChange]);

  // Toggle fullscreen pada wrapper div (bukan iframe YouTube)
  const toggleFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if ((el as any).webkitRequestFullscreen)
          await (el as any).webkitRequestFullscreen();
      } catch (e) {
        console.error("Fullscreen error:", e);
      }
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen)
        await (document as any).webkitExitFullscreen();
    }
  }, []);

  function togglePlay() {
    if (!isHost || !playerRef.current) return;
    const p = playerRef.current;
    const playing =
      p.getPlayerState() === (window as any).YT?.PlayerState?.PLAYING;
    if (playing) {
      p.pauseVideo();
      onControl(false, p.getCurrentTime());
    } else {
      p.playVideo();
      onControl(true, p.getCurrentTime());
    }
  }

  function toggleMute() {
    if (!playerRef.current) return;
    if (muted) playerRef.current.unMute();
    else playerRef.current.mute();
    setMuted(!muted);
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isHost || !playerRef.current) return;
    const t = Number(e.target.value);
    playerRef.current.seekTo(t, true);
    onControl(isPlaying, t);
  }

  function restart() {
    if (!isHost || !playerRef.current) return;
    playerRef.current.seekTo(0, true);
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
    // wrapperRef = target fullscreen — meliputi iframe + custom controls
    <div ref={wrapperRef} className="flex flex-col h-full bg-black">
      {/* Iframe area */}
      <div className="relative flex-1 bg-black min-h-0">
        <div className="w-full h-full">
          <div ref={playerDivRef} className="w-full h-full" />
        </div>

        {/* Tombol fullscreen overlay — pojok kanan bawah iframe */}
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
      </div>

      {/* Custom Controls (tersembunyi saat fullscreen agar layar bersih) */}
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
                  title="Mulai ulang"
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
              title="Buka di YouTube"
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
