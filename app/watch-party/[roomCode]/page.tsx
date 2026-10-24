"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Share2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  MessageSquareOff,
} from "lucide-react";
import VideoPlayer from "@/components/watch-party/VideoPlayer";
import Chat from "@/components/watch-party/Chat";
import VideoCall from "@/components/watch-party/VideoCall";
import { useWatchParty } from "@/hooks/useWatchParty";
import { useVideoCall } from "@/hooks/useVideoCall";

interface UserInfo {
  id: number;
  name: string;
}

function RoomPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = (params.roomCode as string).toUpperCase();
  const isHostParam = searchParams.get("host") === "1";
  const initialVideoUrl = searchParams.get("videoUrl") || "";
  const initialVideoTitle = searchParams.get("videoTitle") || "Watch Party";

  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roomValid, setRoomValid] = useState<boolean | null>(null);

  const [chatVisible, setChatVisible] = useState(true);
  const [showChangeVideo, setShowChangeVideo] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [copied, setCopied] = useState(false);

  // Fullscreen state — diupdate dari VideoPlayer via callback
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Room ended banner
  const [roomEnded, setRoomEnded] = useState(false);

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.status === 401) {
          router.push(`/login?next=/watch-party/${roomCode}`);
          return;
        }
        const data = await res.json();
        if (data.success && data.user) {
          setUser({ id: data.user.id, name: data.user.name });
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, [roomCode, router]);

  // Validate room
  useEffect(() => {
    if (!user) return;
    async function validateRoom() {
      const res = await fetch(`/api/rooms/${roomCode}`);
      setRoomValid(res.ok);
    }
    validateRoom();
  }, [roomCode, user]);

  const {
    socketRef,
    connected,
    members,
    messages,
    videoState,
    currentVideo,
    sendMessage,
    controlVideo,
    changeVideo,
  } = useWatchParty({
    roomCode,
    userId: user?.id ?? 0,
    userName: user?.name ?? "Tamu",
    isHost: isHostParam,
    videoUrl: initialVideoUrl,
    videoTitle: initialVideoTitle,
  });

  // Dengarkan event room-ended dari server
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = () => {
      setRoomEnded(true);
      setTimeout(() => router.push("/watch-party"), 4000);
    };
    socket.on("room-ended", handler);
    return () => {
      socket.off("room-ended", handler);
    };
  }, [socketRef, router]);

  const {
    callActive,
    localStream,
    peers,
    camOn,
    micOn,
    startCall,
    stopCall,
    toggleCam,
    toggleMic,
  } = useVideoCall({
    socketRef,
    roomCode,
    userId: user?.id ?? 0,
    userName: user?.name ?? "Tamu",
  });

  const handleControlVideo = useCallback(
    (isPlaying: boolean, currentTime: number) => {
      controlVideo(isPlaying, currentTime);
    },
    [controlVideo]
  );

  const handleFullscreenChange = useCallback((fs: boolean) => {
    setIsFullscreen(fs);
  }, []);

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleChangeVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    changeVideo(newUrl.trim(), newTitle.trim() || "Watch Party");
    setNewUrl("");
    setNewTitle("");
    setShowChangeVideo(false);
  }

  function handleExitRoom() {
    if (isHostParam) {
      socketRef.current?.emit("end-room", { roomCode, userId: user?.id });
    }
    router.push("/watch-party");
  }

  if (authLoading || roomValid === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Memuat room...</p>
        </div>
      </div>
    );
  }

  if (!roomValid) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-white mb-2">Room Tidak Ditemukan</h2>
          <p className="text-gray-400 mb-6">
            Room dengan kode{" "}
            <span className="font-mono text-purple-400">{roomCode}</span> tidak
            ada atau sudah berakhir.
          </p>
          <button
            onClick={() => router.push("/watch-party")}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const videoCallProps = {
    callActive,
    localStream,
    peers,
    camOn,
    micOn,
    userName: user?.name ?? "Tamu",
    isFullscreen,
    onStart: startCall,
    onStop: stopCall,
    onToggleCam: toggleCam,
    onToggleMic: toggleMic,
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">

      {/* Banner room ended */}
      {roomEnded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center p-8 bg-gray-900 rounded-2xl border border-white/10">
            <div className="text-4xl mb-3">👋</div>
            <h2 className="text-xl font-bold text-white mb-2">Room telah berakhir</h2>
            <p className="text-gray-400 text-sm">Kamu akan dialihkan sebentar lagi...</p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-900 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleExitRoom}
            className="text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-xs">
              {currentVideo.title}
            </h1>
            <p className="text-xs text-gray-500">
              {members.length} penonton ·{" "}
              {isHostParam ? "Kamu Host" : "Tamu"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 transition-colors"
            title="Klik untuk salin kode"
          >
            <span className="font-mono text-xs sm:text-sm font-bold text-purple-400 tracking-wider">
              {roomCode}
            </span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>

          {isHostParam && (
            <button
              onClick={() => setShowChangeVideo(!showChangeVideo)}
              className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              Ganti Video
              {showChangeVideo ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            onClick={() => setChatVisible(!chatVisible)}
            className="text-gray-400 hover:text-white bg-gray-800 border border-white/10 rounded-lg p-1.5 transition-colors"
            title={chatVisible ? "Sembunyikan chat" : "Tampilkan chat"}
          >
            {chatVisible ? (
              <MessageSquareOff className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Change Video Panel */}
      {showChangeVideo && isHostParam && (
        <form
          onSubmit={handleChangeVideo}
          className="flex gap-2 px-4 py-2 bg-gray-900/80 border-b border-white/10 shrink-0"
        >
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="URL YouTube baru..."
            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Judul (opsional)"
            className="w-32 sm:w-40 bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Ganti
          </button>
        </form>
      )}

      {/*
       * LAYOUT:
       * Desktop (sm+): video kiri | chat+videocall kanan (side by side)
       * Mobile: video atas (16:9) | chat+videocall bawah (sisa ruang)
       */}

      {/* Desktop layout */}
      <div className="hidden sm:flex flex-1 min-h-0">
        {/* Video */}
        <div className="flex-1 min-w-0 min-h-0">
          <VideoPlayer
            videoUrl={currentVideo.url}
            videoTitle={currentVideo.title}
            videoState={videoState}
            isHost={isHostParam}
            onControl={handleControlVideo}
            onFullscreenChange={handleFullscreenChange}
          />
        </div>

        {/* Desktop: Chat + VideoCall */}
        {chatVisible && (
          <div className="w-72 lg:w-80 shrink-0 flex flex-col border-l border-white/10">
            <VideoCall {...videoCallProps} />
            <Chat
              messages={messages}
              members={members}
              onSend={sendMessage}
              connected={connected}
            />
          </div>
        )}
      </div>

      {/*
       * Mobile layout: video atas dengan aspect ratio 16:9, chat bawah mengisi sisa
       * Ini buat tampilan lebih proporsional seperti YouTube mobile
       */}
      <div className="sm:hidden flex flex-col flex-1 min-h-0">
        {/* Video area dengan aspect ratio 16:9 */}
        <div className="w-full shrink-0 bg-black" style={{ aspectRatio: "16/9" }}>
          <VideoPlayer
            videoUrl={currentVideo.url}
            videoTitle={currentVideo.title}
            videoState={videoState}
            isHost={isHostParam}
            onControl={handleControlVideo}
            onFullscreenChange={handleFullscreenChange}
          />
        </div>

        {/* Chat + VideoCall mengisi sisa ruang layar */}
        {chatVisible && (
          <div className="flex-1 min-h-0 flex flex-col border-t border-white/10 bg-gray-900">
            <VideoCall {...videoCallProps} />
            <Chat
              messages={messages}
              members={members}
              onSend={sendMessage}
              connected={connected}
            />
          </div>
        )}

        {/* Kalau chat disembunyikan, tampilkan tombol toggle yang floating */}
        {!chatVisible && (
          <button
            onClick={() => setChatVisible(true)}
            className="fixed bottom-4 right-4 z-40 bg-purple-600 text-white rounded-full p-3 shadow-lg"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* FloatingVideoCall saat fullscreen dirender oleh VideoCall sendiri */}
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RoomPageInner />
    </Suspense>
  );
}
