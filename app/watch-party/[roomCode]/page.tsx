"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Share2, X, Check, ChevronDown, ChevronUp,
  MessageSquare, MessageSquareOff, WifiOff, Wifi,
} from "lucide-react";
import VideoPlayer from "@/components/watch-party/VideoPlayer";
import Chat from "@/components/watch-party/Chat";
import VideoCall from "@/components/watch-party/VideoCall";
import { useWatchParty } from "@/hooks/useWatchParty";
import { useVideoCall } from "@/hooks/useVideoCall";

interface UserInfo { id: number; name: string; }

function DisconnectBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex justify-center pt-2 px-3 pointer-events-none">
      <div className="flex items-center gap-2.5 bg-orange-950/90 border border-orange-700/60 text-orange-300 rounded-xl px-4 py-2.5 shadow-xl pointer-events-auto max-w-sm w-full">
        <WifiOff className="w-4 h-4 shrink-0 text-orange-400" />
        <span className="text-xs flex-1">Koneksi terputus. Mencoba menghubungkan ulang...</span>
        <button
          onClick={onRetry}
          className="text-[11px] bg-orange-700 hover:bg-orange-600 px-2.5 py-1 rounded-lg transition-colors shrink-0"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}

function ReconnectedBanner() {
  return (
    <div className="absolute inset-x-0 top-0 z-50 flex justify-center pt-2 px-3 pointer-events-none">
      <div className="flex items-center gap-2 bg-green-950/90 border border-green-700/60 text-green-300 rounded-xl px-4 py-2.5 shadow-xl max-w-sm w-full">
        <Wifi className="w-4 h-4 shrink-0 text-green-400" />
        <span className="text-xs">Terhubung kembali!</span>
      </div>
    </div>
  );
}

function RoomEndedModal({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center p-8 bg-gray-900 rounded-2xl border border-white/10 max-w-xs w-full mx-4 shadow-2xl">
        <div className="text-5xl mb-3">👋</div>
        <h2 className="text-xl font-bold text-white mb-2">Room Telah Berakhir</h2>
        <p className="text-gray-400 text-sm mb-5">
          Host telah mengakhiri sesi nonton bareng ini.
        </p>
        <button
          onClick={onBack}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
        >
          Kembali ke Watch Party
        </button>
      </div>
    </div>
  );
}

function RoomNotFoundModal({ roomCode, onBack }: { roomCode: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-white mb-2">Room Tidak Ditemukan</h2>
        <p className="text-gray-400 mb-6">
          Room dengan kode <span className="font-mono text-purple-400">{roomCode}</span> tidak ada atau sudah berakhir.
        </p>
        <button
          onClick={onBack}
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          Kembali
        </button>
      </div>
    </div>
  );
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  const prevConnectedRef = useRef(true);
  const reconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.status === 401) { router.push(`/login?next=/watch-party/${roomCode}`); return; }
        const data = await res.json();
        if (data.success && data.user) setUser({ id: data.user.id, name: data.user.name });
        else router.push("/login");
      } catch { router.push("/login"); }
      setAuthLoading(false);
    }
    checkAuth();
  }, [roomCode, router]);

  useEffect(() => {
    if (!user) return;
    async function validateRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.status === 503) {
          setTimeout(validateRoom, 2000);
          return;
        }
        setRoomValid(res.ok);
      } catch {
        setRoomValid(false);
      }
    }
    validateRoom();
  }, [roomCode, user]);

  const {
    socketRef, connected, members, messages,
    videoState, currentVideo, sendMessage, controlVideo, changeVideo,
  } = useWatchParty({
    roomCode,
    userId: user?.id ?? 0,
    userName: user?.name ?? "Tamu",
    isHost: isHostParam,
    videoUrl: initialVideoUrl,
    videoTitle: initialVideoTitle,
  });

  // Notifikasi disconnect/reconnect
  useEffect(() => {
    if (!connected && prevConnectedRef.current) {
      setShowDisconnect(true);
      setShowReconnected(false);
    } else if (connected && !prevConnectedRef.current) {
      setShowDisconnect(false);
      setShowReconnected(true);
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
      reconnectedTimerRef.current = setTimeout(() => setShowReconnected(false), 3000);
    }
    prevConnectedRef.current = connected;
  }, [connected]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleRoomEnded = () => {
      setRoomEnded(true);
      setTimeout(() => router.push("/watch-party"), 4000);
    };

    const handleRoomError = (data: { message: string }) => {
      console.warn("[Room] Error:", data.message);
      setRoomValid(false);
    };

    socket.on("room-ended", handleRoomEnded);
    socket.on("room-error", handleRoomError);

    return () => {
      socket.off("room-ended", handleRoomEnded);
      socket.off("room-error", handleRoomError);
    };
  }, [socketRef, router]);

  const { callActive, localStream, peers, camOn, micOn, startCall, stopCall, toggleCam, toggleMic } =
    useVideoCall({ socketRef, roomCode, userId: user?.id ?? 0, userName: user?.name ?? "Tamu" });

  const handleControlVideo = useCallback((isPlaying: boolean, currentTime: number) => {
    controlVideo(isPlaying, currentTime);
  }, [controlVideo]);

  const handleFullscreenChange = useCallback((fs: boolean) => setIsFullscreen(fs), []);

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
    setNewUrl(""); setNewTitle(""); setShowChangeVideo(false);
  }

  function handleExitRoom() {
    if (isHostParam) socketRef.current?.emit("end-room", { roomCode, userId: user?.id });
    router.push("/watch-party");
  }

  function handleRetryConnect() {
    window.location.reload();
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
      <RoomNotFoundModal
        roomCode={roomCode}
        onBack={() => router.push("/watch-party")}
      />
    );
  }

  const videoCallProps = {
    callActive, localStream, peers, camOn, micOn,
    userName: user?.name ?? "Tamu",
    isFullscreen,
    onStart: startCall, onStop: stopCall,
    onToggleCam: toggleCam, onToggleMic: toggleMic,
  };

  return (
    /*
     * FIX: Gunakan h-[100svh] (small viewport height) — memperhitungkan
     * browser chrome (address bar) di mobile, sehingga chat input tidak
     * terpotong di bawah.
     */
    <div
      className="bg-gray-950 flex flex-col overflow-hidden relative"
      style={{ height: "100svh" }}
    >
      {showDisconnect && !roomEnded && (
        <DisconnectBanner onRetry={handleRetryConnect} />
      )}
      {showReconnected && (
        <ReconnectedBanner />
      )}
      {roomEnded && (
        <RoomEndedModal onBack={() => router.push("/watch-party")} />
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-900 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={handleExitRoom} className="text-gray-400 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-xs">
              {currentVideo.title}
            </h1>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-gray-500">
                {members.length} penonton · {isHostParam ? "Kamu Host" : "Tamu"}
              </p>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  connected ? "bg-green-400" : "bg-orange-400 animate-pulse"
                }`}
                title={connected ? "Terhubung" : "Terputus"}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 transition-colors"
          >
            <span className="font-mono text-xs sm:text-sm font-bold text-purple-400 tracking-wider">{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          {isHostParam && (
            <button
              onClick={() => setShowChangeVideo(!showChangeVideo)}
              className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              Ganti Video
              {showChangeVideo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={() => setChatVisible(!chatVisible)}
            className="text-gray-400 hover:text-white bg-gray-800 border border-white/10 rounded-lg p-1.5 transition-colors"
          >
            {chatVisible ? <MessageSquareOff className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showChangeVideo && isHostParam && (
        <form onSubmit={handleChangeVideo} className="flex gap-2 px-4 py-2 bg-gray-900/80 border-b border-white/10 shrink-0">
          <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
            placeholder="URL YouTube baru..."
            className="flex-1 bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Judul (opsional)"
            className="w-32 sm:w-40 bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            Ganti
          </button>
        </form>
      )}

      {/*
       * FIX: Layout utama — SATU VideoPlayer untuk mobile dan desktop.
       *
       * Mobile (< sm): flex-col
       *   - Video: aspect-video (16:9), shrink-0
       *   - Chat: flex-1, min-h-0 → mengisi sisa tinggi layar
       *
       * Desktop (>= sm): flex-row
       *   - Video: flex-1, min-w-0, aspect-auto → mengisi lebar tersisa
       *   - Chat: w-72/w-80, shrink-0 → sidebar tetap
       *
       * Sebelumnya ada DUA VideoPlayer terpisah (mobile & desktop) dengan
       * ID yang sama, menyebabkan konflik init YouTube API dan video hitam.
       */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

        {/* Area Video — SATU instance untuk semua ukuran layar */}
        <div
          className={[
            "bg-black relative overflow-hidden",
            // Mobile: ratio 16:9, tidak shrink
            "w-full shrink-0 aspect-video",
            // Desktop: hapus ratio, isi sisa width & height
            "sm:flex-1 sm:min-w-0 sm:aspect-auto sm:shrink",
          ].join(" ")}
        >
          <VideoPlayer
            videoUrl={currentVideo.url}
            videoTitle={currentVideo.title}
            videoState={videoState}
            isHost={isHostParam}
            onControl={handleControlVideo}
            onFullscreenChange={handleFullscreenChange}
          />
        </div>

        {/* Chat & VideoCall */}
        {chatVisible && (
          <div
            className={[
              "flex flex-col min-h-0 overflow-hidden",
              "border-t border-white/10 bg-gray-900",
              // Mobile: flex-1 → mengisi sisa ruang setelah video
              "flex-1",
              // Desktop: sidebar tetap, border kiri
              "sm:w-72 lg:w-80 sm:flex-none sm:border-t-0 sm:border-l",
            ].join(" ")}
          >
            <VideoCall {...videoCallProps} />
            <Chat
              messages={messages}
              members={members}
              onSend={sendMessage}
              connected={connected}
            />
          </div>
        )}

        {/* Tombol chat saat tersembunyi (mobile) */}
        {!chatVisible && (
          <button
            onClick={() => setChatVisible(true)}
            className="fixed bottom-4 right-4 z-40 bg-purple-600 text-white rounded-full p-3 shadow-lg sm:hidden"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RoomPageInner />
    </Suspense>
  );
}
