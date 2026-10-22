"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Share2, X, Check, ChevronDown, ChevronUp, MessageSquare, MessageSquareOff } from "lucide-react";
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

  // Chat visibility toggle
  const [chatVisible, setChatVisible] = useState(true);

  // Change video (host)
  const [showChangeVideo, setShowChangeVideo] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");

  // Copy code
  const [copied, setCopied] = useState(false);

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
    socket,
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

  // Video Call (WebRTC)
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
    socket,
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
            Room dengan kode <span className="font-mono text-purple-400">{roomCode}</span> tidak ada atau sudah berakhir.
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

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden pt-16">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-gray-900 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push("/watch-party")}
            className="text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate max-w-[140px] sm:max-w-xs">
              {currentVideo.title}
            </h1>
            <p className="text-xs text-gray-500">
              {members.length} penonton · {isHostParam ? "Kamu Host" : "Tamu"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Room code */}
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

          {/* Change video (host) */}
          {isHostParam && (
            <button
              onClick={() => setShowChangeVideo(!showChangeVideo)}
              className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-white bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 transition-colors"
            >
              Ganti Video
              {showChangeVideo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Toggle Chat */}
          <button
            onClick={() => setChatVisible(!chatVisible)}
            className="text-gray-400 hover:text-white bg-gray-800 border border-white/10 rounded-lg p-1.5 transition-colors"
            title={chatVisible ? "Sembunyikan chat" : "Tampilkan chat"}
          >
            {chatVisible ? <MessageSquareOff className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
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

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Video */}
        <div className="flex-1 min-w-0 min-h-0">
          <VideoPlayer
            videoUrl={currentVideo.url}
            videoTitle={currentVideo.title}
            videoState={videoState}
            isHost={isHostParam}
            onControl={handleControlVideo}
          />
        </div>

        {/* Chat + VideoCall — desktop (side panel) */}
        {chatVisible && (
          <div className="w-72 lg:w-80 shrink-0 hidden sm:flex sm:flex-col border-l border-white/10">
            {/* Video Call panel di atas chat */}
            <VideoCall
              callActive={callActive}
              localStream={localStream}
              peers={peers}
              camOn={camOn}
              micOn={micOn}
              userName={user?.name ?? "Tamu"}
              onStart={startCall}
              onStop={stopCall}
              onToggleCam={toggleCam}
              onToggleMic={toggleMic}
            />
            <Chat
              messages={messages}
              members={members}
              onSend={sendMessage}
              connected={connected}
            />
          </div>
        )}
      </div>

      {/* Chat + VideoCall — mobile (bottom) */}
      {chatVisible && (
        <div className="sm:hidden border-t border-white/10 bg-gray-900 shrink-0" style={{ maxHeight: "45vh" }}>
          {/* Video Call di atas chat mobile */}
          <VideoCall
            callActive={callActive}
            localStream={localStream}
            peers={peers}
            camOn={camOn}
            micOn={micOn}
            userName={user?.name ?? "Tamu"}
            onStart={startCall}
            onStop={stopCall}
            onToggleCam={toggleCam}
            onToggleMic={toggleMic}
          />
          <Chat
            messages={messages}
            members={members}
            onSend={sendMessage}
            connected={connected}
          />
        </div>
      )}
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
