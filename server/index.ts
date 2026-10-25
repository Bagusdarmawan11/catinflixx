import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import * as fs from "fs";
import * as path from "path";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── Persistent room store ────────────────────────────────────────────────────
const ROOMS_FILE = path.join("/tmp", "catinflix-rooms.json");

interface PersistedRoom {
  code: string;
  hostUserId: number;
  videoUrl: string;
  videoTitle: string;
  createdAt: number;
  lastActiveAt: number;
  videoState: { isPlaying: boolean; currentTime: number; updatedAt: number };
}

function loadPersistedRooms(): Map<string, PersistedRoom> {
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const raw = fs.readFileSync(ROOMS_FILE, "utf-8");
      const arr: PersistedRoom[] = JSON.parse(raw);
      const now = Date.now();
      const map = new Map<string, PersistedRoom>();
      arr
        .filter((r) => now - r.lastActiveAt < 24 * 60 * 60 * 1000)
        .forEach((r) => map.set(r.code, r));
      console.log(`[Rooms] Loaded ${map.size} persisted rooms`);
      return map;
    }
  } catch (e) {
    console.error("[Rooms] Failed to load persisted rooms:", e);
  }
  return new Map();
}

// ── FIX: Throttle savePersistedRooms ─────────────────────────────────────────
// Sebelumnya dipanggil setiap video-control event (tiap detik saat play).
// Sekarang di-throttle: minimal 10 detik antar save.
let saveThrottleTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave = false;

function savePersistedRooms(map: Map<string, PersistedRoom>, immediate = false) {
  if (immediate) {
    // Untuk operasi penting (create/delete room), save langsung
    if (saveThrottleTimer) {
      clearTimeout(saveThrottleTimer);
      saveThrottleTimer = null;
    }
    pendingSave = false;
    _doSave(map);
    return;
  }

  // Throttle: delay 10 detik, cancel kalau ada save berikutnya
  pendingSave = true;
  if (!saveThrottleTimer) {
    saveThrottleTimer = setTimeout(() => {
      saveThrottleTimer = null;
      if (pendingSave) {
        pendingSave = false;
        _doSave(map);
      }
    }, 10_000);
  }
}

function _doSave(map: Map<string, PersistedRoom>) {
  try {
    const arr = Array.from(map.values());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (e) {
    console.error("[Rooms] Failed to save rooms:", e);
  }
}

// ── In-memory runtime state ───────────────────────────────────────────────────
interface RoomMember {
  userId: number;
  name: string;
  socketId: string;
  isHost: boolean;
}

interface RoomRuntime {
  members: Map<string, RoomMember>;
  hostDisconnectTimer?: ReturnType<typeof setTimeout>;
}

const persistedRooms = loadPersistedRooms();
const runtimes = new Map<string, RoomRuntime>();

// ── FIX FATAL: Expose persistedRooms ke global supaya API route bisa akses ──
// API route handlers (Next.js) dan custom server (server/index.ts) berjalan
// dalam process yang sama saat pakai custom server. Kita expose via global
// supaya /api/rooms/[code]/route.ts bisa cek room yang dibuat via Socket.IO.
(global as any).__catinfixRooms = persistedRooms;

// Video call participants
const vcParticipants = new Map<
  string,
  Map<string, { userId: number; userName: string }>
>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function getOrCreateRuntime(roomCode: string): RoomRuntime {
  if (!runtimes.has(roomCode)) {
    runtimes.set(roomCode, { members: new Map() });
  }
  return runtimes.get(roomCode)!;
}

function broadcastMembers(io: SocketIOServer, roomCode: string, runtime: RoomRuntime) {
  const list = Array.from(runtime.members.values()).map((m) => ({
    userId: m.userId,
    name: m.name,
    isHost: m.isHost,
  }));
  io.to(roomCode).emit("room-members", list);
}

function systemMsg(io: SocketIOServer, roomCode: string, message: string) {
  io.to(roomCode).emit("chat-message", {
    id: Date.now() + Math.random(),
    userId: 0,
    name: "Sistem",
    message,
    isSystem: true,
    timestamp: new Date().toISOString(),
  });
}

function deleteRoom(roomCode: string) {
  persistedRooms.delete(roomCode);
  runtimes.delete(roomCode);
  vcParticipants.delete(roomCode);
  savePersistedRooms(persistedRooms, true); // immediate: delete harus langsung disave
  console.log(`[Rooms] Room ${roomCode} deleted`);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    const clientUserId =
      parseInt(socket.handshake.query.userId as string) || 0;
    console.log(`[Socket] Connected: ${socket.id} (userId=${clientUserId})`);

    // ── Join Room ─────────────────────────────────────────────────────────────
    socket.on(
      "join-room",
      (data: {
        roomCode: string;
        userId: number;
        name: string;
        isHost: boolean;
        videoUrl: string;
        videoTitle: string;
        isReconnect?: boolean;
      }) => {
        const { roomCode, userId, name, isHost, videoUrl, videoTitle, isReconnect } = data;

        if (!persistedRooms.has(roomCode)) {
          if (!isHost) {
            socket.emit("room-error", { message: "Room tidak ditemukan" });
            return;
          }
          persistedRooms.set(roomCode, {
            code: roomCode,
            hostUserId: userId,
            videoUrl,
            videoTitle,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            videoState: { isPlaying: false, currentTime: 0, updatedAt: Date.now() },
          });
          savePersistedRooms(persistedRooms, true); // immediate: room baru
        }

        const persisted = persistedRooms.get(roomCode)!;
        persisted.lastActiveAt = Date.now();

        const runtime = getOrCreateRuntime(roomCode);
        if (isHost && runtime.hostDisconnectTimer) {
          clearTimeout(runtime.hostDisconnectTimer);
          runtime.hostDisconnectTimer = undefined;
          console.log(`[Rooms] Host reconnected, grace period cancelled for ${roomCode}`);
        }

        let wasAlreadyInRoom = false;
        runtime.members.forEach((m, sid) => {
          if (m.userId === userId) {
            wasAlreadyInRoom = true;
            runtime.members.delete(sid);
          }
        });

        runtime.members.set(socket.id, { userId, name, socketId: socket.id, isHost });
        socket.join(roomCode);

        socket.emit("video-state-sync", persisted.videoState);
        socket.emit("room-info", {
          videoUrl: persisted.videoUrl,
          videoTitle: persisted.videoTitle,
          hostUserId: persisted.hostUserId,
        });

        broadcastMembers(io, roomCode, runtime);

        if (!wasAlreadyInRoom && !isReconnect) {
          systemMsg(io, roomCode, `${name} bergabung ke room`);
        }

        console.log(
          `[Socket] ${name} ${wasAlreadyInRoom ? "re-joined" : "joined"} room ${roomCode}`
        );
      }
    );

    // ── Host end room ─────────────────────────────────────────────────────────
    socket.on("end-room", (data: { roomCode: string; userId: number }) => {
      const persisted = persistedRooms.get(data.roomCode);
      if (!persisted) return;
      if (persisted.hostUserId !== data.userId) return;

      systemMsg(io, data.roomCode, "Host telah mengakhiri room");
      io.to(data.roomCode).emit("room-ended");
      deleteRoom(data.roomCode);
    });

    // ── Video Control ─────────────────────────────────────────────────────────
    socket.on(
      "video-control",
      (data: { roomCode: string; isPlaying: boolean; currentTime: number }) => {
        const persisted = persistedRooms.get(data.roomCode);
        const runtime = runtimes.get(data.roomCode);
        if (!persisted || !runtime) return;
        const member = runtime.members.get(socket.id);
        if (!member?.isHost) return;

        persisted.videoState = {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          updatedAt: Date.now(),
        };
        persisted.lastActiveAt = Date.now();
        // Throttled save — tidak lagi save setiap detik
        savePersistedRooms(persistedRooms);

        socket.to(data.roomCode).emit("video-state-sync", persisted.videoState);
      }
    );

    // ── Chat Message ──────────────────────────────────────────────────────────
    socket.on(
      "send-message",
      (data: { roomCode: string; userId: number; name: string; message: string }) => {
        const { roomCode, userId, name, message } = data;
        if (!message?.trim()) return;
        const payload = {
          id: Date.now() + Math.random(),
          userId,
          name,
          message: message.trim().slice(0, 300),
          isSystem: false,
          timestamp: new Date().toISOString(),
        };
        io.to(roomCode).emit("chat-message", payload);
      }
    );

    // ── Change Video ──────────────────────────────────────────────────────────
    socket.on(
      "change-video",
      (data: { roomCode: string; videoUrl: string; videoTitle: string }) => {
        const persisted = persistedRooms.get(data.roomCode);
        const runtime = runtimes.get(data.roomCode);
        if (!persisted || !runtime) return;
        const member = runtime.members.get(socket.id);
        if (!member?.isHost) return;

        persisted.videoUrl = data.videoUrl;
        persisted.videoTitle = data.videoTitle;
        persisted.videoState = { isPlaying: false, currentTime: 0, updatedAt: Date.now() };
        persisted.lastActiveAt = Date.now();
        savePersistedRooms(persistedRooms, true); // immediate: ganti video

        io.to(data.roomCode).emit("room-info", {
          videoUrl: persisted.videoUrl,
          videoTitle: persisted.videoTitle,
          hostUserId: persisted.hostUserId,
        });
        io.to(data.roomCode).emit("video-state-sync", persisted.videoState);
      }
    );

    // ════════════════════════════════════════════════════════════════════════
    // ── WebRTC Signaling ──────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════

    socket.on(
      "vc:join",
      (data: { roomCode: string; userId: number; userName: string }) => {
        const { roomCode, userId, userName } = data;
        if (!vcParticipants.has(roomCode)) vcParticipants.set(roomCode, new Map());
        const vcRoom = vcParticipants.get(roomCode)!;
        vcRoom.forEach((_, existingSocketId) => {
          io.to(existingSocketId).emit("vc:user-joined", { socketId: socket.id, userId, userName });
        });
        vcRoom.set(socket.id, { userId, userName });
        console.log(`[VC] ${userName} joined vc (${vcRoom.size} total)`);
      }
    );

    socket.on(
      "vc:offer",
      (data: { roomCode: string; targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
        const runtime = runtimes.get(data.roomCode);
        const sender = runtime?.members.get(socket.id);
        io.to(data.targetSocketId).emit("vc:offer", {
          fromSocketId: socket.id,
          fromUserId: sender?.userId ?? 0,
          fromUserName: sender?.name ?? "Tamu",
          offer: data.offer,
        });
      }
    );

    socket.on(
      "vc:answer",
      (data: { roomCode: string; targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
        io.to(data.targetSocketId).emit("vc:answer", { fromSocketId: socket.id, answer: data.answer });
      }
    );

    socket.on(
      "vc:ice-candidate",
      (data: { roomCode: string; targetSocketId: string; candidate: RTCIceCandidateInit }) => {
        io.to(data.targetSocketId).emit("vc:ice-candidate", { fromSocketId: socket.id, candidate: data.candidate });
      }
    );

    socket.on("vc:leave", (data: { roomCode: string; userId: number }) => {
      const vcRoom = vcParticipants.get(data.roomCode);
      if (vcRoom) {
        vcRoom.delete(socket.id);
        if (vcRoom.size === 0) vcParticipants.delete(data.roomCode);
      }
      socket.to(data.roomCode).emit("vc:user-left", { socketId: socket.id });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      vcParticipants.forEach((vcRoom, roomCode) => {
        if (vcRoom.has(socket.id)) {
          vcRoom.delete(socket.id);
          socket.to(roomCode).emit("vc:user-left", { socketId: socket.id });
          if (vcRoom.size === 0) vcParticipants.delete(roomCode);
        }
      });

      runtimes.forEach((runtime, roomCode) => {
        const member = runtime.members.get(socket.id);
        if (!member) return;

        runtime.members.delete(socket.id);

        if (member.isHost) {
          console.log(`[Rooms] Host disconnected from ${roomCode}, starting 5min grace period`);
          runtime.hostDisconnectTimer = setTimeout(() => {
            const rt = runtimes.get(roomCode);
            const hostBack = rt
              ? Array.from(rt.members.values()).some((m) => m.isHost)
              : false;
            if (!hostBack) {
              systemMsg(io, roomCode, "Host telah meninggalkan room. Room berakhir.");
              io.to(roomCode).emit("room-ended");
              deleteRoom(roomCode);
            }
          }, 5 * 60 * 1000);
        } else {
          broadcastMembers(io, roomCode, runtime);
        }
      });

      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(
      `> CatinFlix ready on http://${hostname}:${port} [${dev ? "dev" : "prod"}]`
    );
  });
});
