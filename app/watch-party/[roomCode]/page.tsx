"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  Share2, X, Check, ChevronDown, ChevronUp,
  MessageSquare, MessageSquareOff, WifiOff, Wifi,
  Users, UserX, MicOff, VideoOff,
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

function KickedModal({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center p-8 bg-gray-900 rounded-2xl border border-white/10 max-w-xs w-full mx-4 shadow-2xl">
        <div className="text-5xl mb-3">🚫</div>
        <h2 className="text-xl font-bold text-white mb-2">Kamu Dikeluarkan</h2>
        <p className="text-gray-400 text-sm mb-5">
          Host telah mengeluarkanmu dari room ini.
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
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  const prevConnectedRef = useRef(true);
  const reconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outerDivRef = useRef<HTMLDivElement>(null);

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
    if (isHostParam) { setRoomValid(true); return; }
    async function validateRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomCode}`);
        if (res.status === 503) { setTimeout(validateRoom, 2000); return; }
        setRoomValid(res.ok);
      } catch { setRoomValid(false); }
    }
    validateRoom();
  }, [roomCode, user, isHostParam]);

  const {
    socketRef, connected, members, messages,
    videoState, currentVideo, sendMessage, controlVideo, changeVideo,
    wasKicked, kickUser, muteUser, disableCamUser,
  } = useWatchParty({
    roomCode,
    userId: user?.id ?? 0,
    userName: user?.name ?? "Tamu",
    isHost: isHostParam,
    videoUrl: initialVideoUrl,
    videoTitle: initialVideoTitle,
  });

  useEffect(() => {
    if (wasKicked) { setTimeout(() => router.push("/watch-party"), 3000); }
  }, [wasKicked, router]);

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

  const { callActive, localStream, peers, camOn, micOn, vcParticipants, startCall, stopCall, toggleCam, toggleMic } =
    useVideoCall({ socketRef, roomCode, userId: user?.id ?? 0, userName: user?.name ?? "Tamu" });

  const handleControlVideo = useCallback((isPlaying: boolean, currentTime: number) => {
    controlVideo(isPlaying, currentTime);
  }, [controlVideo]);

  const handleFullscreenChange = useCallback((fs: boolean) => {
    setIsFullscreen(fs);
    if (fs) setChatVisible(false);
  }, []);

  function copyCode() {
    const url = `${window.location.origin}/watch-party/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
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

  function handleRetryConnect() { window.location.reload(); }

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
    vcParticipants,
    onToggleCam: toggleCam, onToggleMic: toggleMic,
  };

  return (
    <div
      ref={outerDivRef}
      className="bg-gray-950 flex flex-col overflow-hidden relative"
      style={{ height: "100svh" }}
    >
      {showDisconnect && !roomEnded && !wasKicked && (
        <DisconnectBanner onRetry={handleRetryConnect} />
      )}
      {showReconnected && <ReconnectedBanner />}
      {roomEnded && <RoomEndedModal onBack={() => router.push("/watch-party")} />}
      {wasKicked && <KickedModal onBack={() => router.push("/watch-party")} />}

      {/* FIX: Top Bar — hidden saat fullscreen */}
      {!isFullscreen && (
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
                <button
                  onClick={() => setShowMembersPanel((v) => !v)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {members.length} penonton · {isHostParam ? "Kamu Host" : "Tamu"}
                </button>
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
      )}

      {/* Members panel — hidden saat fullscreen */}
      {showMembersPanel && !isFullscreen && (
        <div className="absolute top-12 left-3 z-40 w-64 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-white">Penonton ({members.length})</span>
            </div>
            <button onClick={() => setShowMembersPanel(false)} className="text-gray-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5">
                <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-white font-bold">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-white flex-1 truncate">
                  {m.name}
                  {m.isHost && <span className="ml-1 text-[10px] text-purple-400 font-medium">Host</span>}
                  {m.userId === user?.id && !m.isHost && <span className="ml-1 text-[10px] text-gray-500">(Kamu)</span>}
                </span>
                {isHostParam && !m.isHost && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => muteUser(m.userId)}
                      className="p-1 rounded text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
                      title={`Mute mic ${m.name}`}
                    >
                      <MicOff className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => disableCamUser(m.userId)}
                      className="p-1 rounded text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                      title={`Matikan kamera ${m.name}`}
                    >
                      <VideoOff className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => kickUser(m.userId)}
                      className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title={`Keluarkan ${m.name}`}
                    >
                      <UserX className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change Video form — hidden saat fullscreen */}
      {showChangeVideo && isHostParam && !isFullscreen && (
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

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">

        {/* Area Video — saat fullscreen, isi seluruh layar */}
        <div
          className={[
            "bg-black relative overflow-hidden",
            isFullscreen
              ? "w-full h-full"
              : "w-full shrink-0 aspect-video sm:flex-1 sm:min-w-0 sm:aspect-auto sm:shrink",
          ].join(" ")}
        >
          <VideoPlayer
            videoUrl={currentVideo.url}
            videoTitle={currentVideo.title}
            videoState={videoState}
            isHost={isHostParam}
            onControl={handleControlVideo}
            onFullscreenChange={handleFullscreenChange}
            fullscreenContainerRef={outerDivRef}
          />
        </div>

        {/* Chat — hidden saat fullscreen */}
        {chatVisible && !isFullscreen && (
          <div
            className={[
              "flex flex-col min-h-0 overflow-hidden",
              "border-t border-white/10 bg-gray-900",
              "flex-1",
              "sm:w-72 lg:w-80 sm:flex-none sm:border-t-0 sm:border-l",
            ].join(" ")}
          >
            <VideoCall {...videoCallProps} mode="sidebar" />
            <Chat
              messages={messages}
              members={members}
              onSend={sendMessage}
              connected={connected}
            />
          </div>
        )}

        {/* Tombol chat saat tersembunyi (mobile, non-fullscreen) */}
        {!chatVisible && !isFullscreen && (
          <button
            onClick={() => setChatVisible(true)}
            className="fixed bottom-4 right-4 z-40 bg-purple-600 text-white rounded-full p-3 shadow-lg sm:hidden"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Floating VC — hanya saat fullscreen */}
      <VideoCall {...videoCallProps} mode="floating" />
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
