import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { neon } from "@neondatabase/serverless";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── Neon DB ───────────────────────────────────────────────────────────────────
let sql: ReturnType<typeof neon> | null = null;
function getDb() {
  if (!sql && process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface PersistedRoom {
  code: string;
  hostUserId: number;
  videoUrl: string;
  videoTitle: string;
  createdAt: number;
  lastActiveAt: number;
  videoState: { isPlaying: boolean; currentTime: number; updatedAt: number };
}

interface ChatMessage {
  id: number;
  userId: number;
  name: string;
  message: string;
  isSystem: boolean;
  timestamp: string;
}

interface RoomMember {
  userId: number;
  name: string;
  socketId: string;
  isHost: boolean;
}

interface RoomRuntime {
  members: Map<string, RoomMember>;
  messages: ChatMessage[];
  historyLoaded: boolean;
  hostDisconnectTimer?: ReturnType<typeof setTimeout>;
}

interface DbMessage {
  id: number;
  room_code: string;
  user_id: number;
  name: string;
  message: string;
  is_system: boolean;
  timestamp: string;
}

// ── DB: Room Operations ───────────────────────────────────────────────────────

async function loadRoomsFromDB(): Promise<Map<string, PersistedRoom>> {
  const map = new Map<string, PersistedRoom>();
  try {
    const db = getDb();
    if (!db) {
      console.warn("[Rooms] Tidak ada koneksi DB — mulai dengan room store kosong");
      return map;
    }
    const rows = await db`
      SELECT code, host_user_id, video_url, video_title,
             is_playing, current_time, created_at
      FROM watch_party_rooms
      WHERE expires_at > NOW()
    `;
    (rows as any[]).forEach((r) => {
      map.set(r.code, {
        code: r.code,
        hostUserId: r.host_user_id,
        videoUrl: r.video_url,
        videoTitle: r.video_title,
        createdAt: new Date(r.created_at).getTime(),
        lastActiveAt: Date.now(),
        videoState: {
          isPlaying: r.is_playing ?? false,
          currentTime: r.current_time ?? 0,
          updatedAt: Date.now(),
        },
      });
    });
    console.log(`[Rooms] Loaded ${map.size} active rooms from DB`);
  } catch (e) {
    console.error("[Rooms] Gagal load rooms dari DB:", e);
  }
  return map;
}

// Upsert room ke DB (saat buat baru atau ganti video)
async function saveRoomToDB(room: PersistedRoom): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db`
      INSERT INTO watch_party_rooms
        (code, host_user_id, video_url, video_title, is_playing, current_time, expires_at)
      VALUES
        (${room.code}, ${room.hostUserId}, ${room.videoUrl}, ${room.videoTitle},
         ${room.videoState.isPlaying}, ${room.videoState.currentTime}, ${expiresAt})
      ON CONFLICT (code) DO UPDATE SET
        video_url    = EXCLUDED.video_url,
        video_title  = EXCLUDED.video_title,
        is_playing   = EXCLUDED.is_playing,
        current_time = EXCLUDED.current_time,
        expires_at   = EXCLUDED.expires_at
    `;
  } catch (e) {
    console.error("[Rooms] Gagal save room ke DB:", e);
  }
}

async function deleteRoomFromDB(code: string): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    await db`DELETE FROM watch_party_rooms WHERE code = ${code}`;
  } catch (e) {
    console.error("[Rooms] Gagal delete room dari DB:", e);
  }
}

// ── DB: Chat History ──────────────────────────────────────────────────────────

async function loadChatHistory(roomCode: string): Promise<ChatMessage[]> {
  try {
    const db = getDb();
    if (!db) return [];
    const rows = (await db`
      SELECT id, user_id, name, message, is_system, timestamp
      FROM room_messages
      WHERE room_code = ${roomCode}
      ORDER BY timestamp ASC
      LIMIT 100
    `) as DbMessage[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      message: r.message,
      isSystem: r.is_system,
      timestamp:
        typeof r.timestamp === "string"
          ? r.timestamp
          : new Date(r.timestamp).toISOString(),
    }));
  } catch (e) {
    console.error("[Chat] Gagal load history:", e);
    return [];
  }
}

async function saveChatMessage(
  roomCode: string,
  userId: number,
  name: string,
  message: string,
  isSystem: boolean
): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    await db`
      INSERT INTO room_messages (room_code, user_id, name, message, is_system)
      VALUES (${roomCode}, ${userId}, ${name}, ${message}, ${isSystem})
    `;
  } catch (e) {
    console.error("[Chat] Gagal save message:", e);
  }
}

async function pruneRoomMessages(roomCode: string): Promise<void> {
  try {
    const db = getDb();
    if (!db) return;
    await db`
      DELETE FROM room_messages
      WHERE room_code = ${roomCode}
        AND id NOT IN (
          SELECT id FROM room_messages
          WHERE room_code = ${roomCode}
          ORDER BY timestamp DESC
          LIMIT 500
        )
    `;
  } catch {}
}

// ── In-memory state ───────────────────────────────────────────────────────────

const persistedRooms = new Map<string, PersistedRoom>();
const runtimes = new Map<string, RoomRuntime>();
const vcParticipants = new Map<
  string,
  Map<string, { userId: number; userName: string }>
>();

// Expose ke Next.js API routes (berjalan dalam 1 process)
(global as any).__catinfixRooms = persistedRooms;

// ── URL filter & spam throttle ────────────────────────────────────────────────
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

function containsUrl(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

const lastMessageAt = new Map<string, number>();
const CHAT_COOLDOWN_MS = 1_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateRuntime(roomCode: string): RoomRuntime {
  if (!runtimes.has(roomCode)) {
    runtimes.set(roomCode, {
      members: new Map(),
      messages: [],
      historyLoaded: false,
    });
  }
  return runtimes.get(roomCode)!;
}

function broadcastMembers(
  io: SocketIOServer,
  roomCode: string,
  runtime: RoomRuntime
) {
  const list = Array.from(runtime.members.values()).map((m) => ({
    userId: m.userId,
    name: m.name,
    isHost: m.isHost,
  }));
  io.to(roomCode).emit("room-members", list);
}

function nowIso(): string {
  return new Date().toISOString();
}

async function systemMsg(
  io: SocketIOServer,
  roomCode: string,
  message: string,
  runtime?: RoomRuntime
) {
  const msg: ChatMessage = {
    id: Date.now() + Math.random(),
    userId: 0,
    name: "Sistem",
    message,
    isSystem: true,
    timestamp: nowIso(),
  };
  io.to(roomCode).emit("chat-message", msg);
  if (runtime) {
    runtime.messages.push(msg);
    if (runtime.messages.length > 100) runtime.messages.shift();
  }
  saveChatMessage(roomCode, 0, "Sistem", message, true).catch(() => {});
}

function deleteRoom(roomCode: string) {
  persistedRooms.delete(roomCode);
  runtimes.delete(roomCode);
  vcParticipants.delete(roomCode);
  // Hapus dari DB (async, fire-and-forget)
  deleteRoomFromDB(roomCode).catch(console.error);
  console.log(`[Rooms] Room ${roomCode} dihapus`);
}

function broadcastVcParticipants(io: SocketIOServer, roomCode: string) {
  const vcRoom = vcParticipants.get(roomCode);
  const participants = vcRoom
    ? Array.from(vcRoom.entries()).map(([socketId, p]) => ({
        socketId,
        userId: p.userId,
        userName: p.userName,
      }))
    : [];
  io.to(roomCode).emit("vc:participants-update", { participants });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
app.prepare().then(async () => {
  // ── Load rooms dari DB (menggantikan /tmp file) ───────────────────────────
  const loaded = await loadRoomsFromDB();
  loaded.forEach((room, code) => persistedRooms.set(code, room));

  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
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
      async (data: {
        roomCode: string;
        userId: number;
        name: string;
        isHost: boolean;
        videoUrl: string;
        videoTitle: string;
        isReconnect?: boolean;
      }) => {
        const {
          roomCode, userId, name, isHost,
          videoUrl, videoTitle, isReconnect,
        } = data;

        if (!persistedRooms.has(roomCode)) {
          if (!isHost) {
            socket.emit("room-error", { message: "Room tidak ditemukan" });
            return;
          }
          // Buat room baru — simpan ke DB
          const newRoom: PersistedRoom = {
            code: roomCode,
            hostUserId: userId,
            videoUrl,
            videoTitle,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            videoState: { isPlaying: false, currentTime: 0, updatedAt: Date.now() },
          };
          persistedRooms.set(roomCode, newRoom);
          saveRoomToDB(newRoom).catch(console.error);
        }

        const persisted = persistedRooms.get(roomCode)!;
        persisted.lastActiveAt = Date.now();

        const runtime = getOrCreateRuntime(roomCode);

        // Batalkan grace period jika host kembali
        if (isHost && runtime.hostDisconnectTimer) {
          clearTimeout(runtime.hostDisconnectTimer);
          runtime.hostDisconnectTimer = undefined;
          console.log(`[Rooms] Host reconnected, grace period cancelled: ${roomCode}`);
        }

        // Hapus socket lama user yang sama jika ada
        let wasAlreadyInRoom = false;
        runtime.members.forEach((m, sid) => {
          if (m.userId === userId) {
            wasAlreadyInRoom = true;
            runtime.members.delete(sid);
          }
        });

        runtime.members.set(socket.id, {
          userId,
          name,
          socketId: socket.id,
          isHost,
        });
        socket.join(roomCode);

        socket.emit("video-state-sync", persisted.videoState);
        socket.emit("room-info", {
          videoUrl: persisted.videoUrl,
          videoTitle: persisted.videoTitle,
          hostUserId: persisted.hostUserId,
        });

        broadcastMembers(io, roomCode, runtime);
        broadcastVcParticipants(io, roomCode);

        // Load chat history dari DB (hanya sekali per runtime)
        if (!runtime.historyLoaded) {
          runtime.historyLoaded = true;
          const history = await loadChatHistory(roomCode);
          runtime.messages = history.slice(-100);
        }
        if (runtime.messages.length > 0) {
          socket.emit("chat-history", runtime.messages);
        }

        // System message hanya untuk join pertama kali (bukan reconnect)
        if (!wasAlreadyInRoom && !isReconnect) {
          const joinMsg = `${name} bergabung ke room`;
          const msgObj: ChatMessage = {
            id: Date.now() + Math.random(),
            userId: 0,
            name: "Sistem",
            message: joinMsg,
            isSystem: true,
            timestamp: nowIso(),
          };
          io.to(roomCode).emit("chat-message", msgObj);
          runtime.messages.push(msgObj);
          if (runtime.messages.length > 100) runtime.messages.shift();
          saveChatMessage(roomCode, 0, "Sistem", joinMsg, true).catch(() => {});
        }

        console.log(
          `[Socket] ${name} ${wasAlreadyInRoom ? "re-joined" : "joined"} room ${roomCode}`
        );
      }
    );

    // ── Host End Room ─────────────────────────────────────────────────────────
    socket.on(
      "end-room",
      (data: { roomCode: string; userId: number }) => {
        const persisted = persistedRooms.get(data.roomCode);
        if (!persisted) return;
        if (persisted.hostUserId !== data.userId) return;

        const runtime = runtimes.get(data.roomCode);
        systemMsg(io, data.roomCode, "Host telah mengakhiri room", runtime);
        io.to(data.roomCode).emit("room-ended");
        pruneRoomMessages(data.roomCode).catch(() => {});
        deleteRoom(data.roomCode);
      }
    );

    // ── Video Control ─────────────────────────────────────────────────────────
    socket.on(
      "video-control",
      (data: { roomCode: string; isPlaying: boolean; currentTime: number }) => {
        const persisted = persistedRooms.get(data.roomCode);
        const runtime = runtimes.get(data.roomCode);
        if (!persisted || !runtime) return;

        const member = runtime.members.get(socket.id);
        if (!member?.isHost) return;

        // Update in-memory saja (terlalu sering untuk DB)
        persisted.videoState = {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          updatedAt: Date.now(),
        };
        persisted.lastActiveAt = Date.now();
        socket.to(data.roomCode).emit("video-state-sync", persisted.videoState);
      }
    );

    // ── Chat Message ──────────────────────────────────────────────────────────
    socket.on(
      "send-message",
      (data: {
        roomCode: string;
        userId: number;
        name: string;
        message: string;
      }) => {
        const { roomCode, userId, name, message } = data;
        if (!message?.trim()) return;

        const now = Date.now();
        const last = lastMessageAt.get(socket.id) ?? 0;
        if (now - last < CHAT_COOLDOWN_MS) {
          socket.emit("chat-error", {
            message: "Pesan terlalu cepat. Tunggu sebentar.",
          });
          return;
        }
        lastMessageAt.set(socket.id, now);

        const trimmed = message.trim().slice(0, 300);
        const hasUrl = containsUrl(trimmed);

        const finalMessage = hasUrl
          ? "⚠️ Untuk keamanan bersama, tautan tidak diizinkan di ruang obrolan. Terima kasih! 😊"
          : trimmed;

        const payload: ChatMessage & { isUrlWarning?: boolean } = {
          id: Date.now() + Math.random(),
          userId,
          name,
          message: finalMessage,
          isSystem: false,
          isUrlWarning: hasUrl,
          timestamp: nowIso(),
        };

        io.to(roomCode).emit("chat-message", payload);

        const runtime = runtimes.get(roomCode);
        if (runtime) {
          runtime.messages.push(payload);
          if (runtime.messages.length > 100) runtime.messages.shift();
        }
        saveChatMessage(roomCode, userId, name, finalMessage, false).catch(() => {});
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

        // Simpan ke DB karena URL/title berubah
        saveRoomToDB(persisted).catch(console.error);

        io.to(data.roomCode).emit("room-info", {
          videoUrl: persisted.videoUrl,
          videoTitle: persisted.videoTitle,
          hostUserId: persisted.hostUserId,
        });
        io.to(data.roomCode).emit("video-state-sync", persisted.videoState);
      }
    );

    // ── Kick User ─────────────────────────────────────────────────────────────
    socket.on(
      "kick-user",
      (data: { roomCode: string; targetUserId: number }) => {
        const persisted = persistedRooms.get(data.roomCode);
        const runtime = runtimes.get(data.roomCode);
        if (!persisted || !runtime) return;

        const host = runtime.members.get(socket.id);
        if (!host?.isHost) return;

        let targetSocketId: string | null = null;
        let targetName = "Pengguna";
        runtime.members.forEach((m, sid) => {
          if (m.userId === data.targetUserId) {
            targetSocketId = sid;
            targetName = m.name;
          }
        });
        if (!targetSocketId) return;

        io.to(targetSocketId).emit("kicked");
        runtime.members.delete(targetSocketId);
        broadcastMembers(io, data.roomCode, runtime);

        const vcRoom = vcParticipants.get(data.roomCode);
        if (vcRoom?.has(targetSocketId)) {
          vcRoom.delete(targetSocketId);
          socket.to(data.roomCode).emit("vc:user-left", { socketId: targetSocketId });
          broadcastVcParticipants(io, data.roomCode);
        }

        systemMsg(
          io,
          data.roomCode,
          `${targetName} telah dikeluarkan dari room oleh host`,
          runtime
        );
        console.log(`[Rooms] ${targetName} kicked from ${data.roomCode}`);
      }
    );

    // ── Mute User ─────────────────────────────────────────────────────────────
    socket.on(
      "mute-user",
      (data: { roomCode: string; targetUserId: number }) => {
        const persisted = persistedRooms.get(data.roomCode);
        const runtime = runtimes.get(data.roomCode);
        if (!persisted || !runtime) return;

        const host = runtime.members.get(socket.id);
        if (!host?.isHost) return;

        let targetSocketId: string | null = null;
        runtime.members.forEach((m, sid) => {
          if (m.userId === data.targetUserId) targetSocketId = sid;
        });
        if (!targetSocketId) return;
        io.to(targetSocketId).emit("force-mute");
      }
    );

    // ── Disable Cam User ──────────────────────────────────────────────────────
    socket.on(
      "disable-cam-user",
      (data: { roomCode: string; targetUserId: number }) => {
        const persisted = persistedRooms.get(data.roomCode);
        const runtime = runtimes.get(data.roomCode);
        if (!persisted || !runtime) return;

        const host = runtime.members.get(socket.id);
        if (!host?.isHost) return;

        let targetSocketId: string | null = null;
        runtime.members.forEach((m, sid) => {
          if (m.userId === data.targetUserId) targetSocketId = sid;
        });
        if (!targetSocketId) return;
        io.to(targetSocketId).emit("force-disable-cam");
      }
    );

    // ── WebRTC Signaling ──────────────────────────────────────────────────────
    socket.on(
      "vc:join",
      (data: { roomCode: string; userId: number; userName: string }) => {
        const { roomCode, userId, userName } = data;
        if (!vcParticipants.has(roomCode)) vcParticipants.set(roomCode, new Map());
        const vcRoom = vcParticipants.get(roomCode)!;

        vcRoom.forEach((_, existingSocketId) => {
          io.to(existingSocketId).emit("vc:user-joined", {
            socketId: socket.id,
            userId,
            userName,
          });
        });
        vcRoom.set(socket.id, { userId, userName });
        broadcastVcParticipants(io, roomCode);
      }
    );

    socket.on(
      "vc:offer",
      (data: {
        roomCode: string;
        targetSocketId: string;
        offer: RTCSessionDescriptionInit;
      }) => {
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
      (data: {
        roomCode: string;
        targetSocketId: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        io.to(data.targetSocketId).emit("vc:answer", {
          fromSocketId: socket.id,
          answer: data.answer,
        });
      }
    );

    socket.on(
      "vc:ice-candidate",
      (data: {
        roomCode: string;
        targetSocketId: string;
        candidate: RTCIceCandidateInit;
      }) => {
        io.to(data.targetSocketId).emit("vc:ice-candidate", {
          fromSocketId: socket.id,
          candidate: data.candidate,
        });
      }
    );

    socket.on("vc:leave", (data: { roomCode: string; userId: number }) => {
      const vcRoom = vcParticipants.get(data.roomCode);
      if (vcRoom) {
        vcRoom.delete(socket.id);
        if (vcRoom.size === 0) vcParticipants.delete(data.roomCode);
      }
      socket.to(data.roomCode).emit("vc:user-left", { socketId: socket.id });
      broadcastVcParticipants(io, data.roomCode);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      lastMessageAt.delete(socket.id);

      // Bersihkan VC
      vcParticipants.forEach((vcRoom, roomCode) => {
        if (vcRoom.has(socket.id)) {
          vcRoom.delete(socket.id);
          socket.to(roomCode).emit("vc:user-left", { socketId: socket.id });
          if (vcRoom.size === 0) vcParticipants.delete(roomCode);
          broadcastVcParticipants(io, roomCode);
        }
      });

      // Bersihkan dari room
      runtimes.forEach((runtime, roomCode) => {
        const member = runtime.members.get(socket.id);
        if (!member) return;

        runtime.members.delete(socket.id);

        if (member.isHost) {
          console.log(`[Rooms] Host disconnect dari ${roomCode}, grace period 5 menit`);
          runtime.hostDisconnectTimer = setTimeout(() => {
            const rt = runtimes.get(roomCode);
            const hostBack = rt
              ? Array.from(rt.members.values()).some((m) => m.isHost)
              : false;
            if (!hostBack) {
              systemMsg(
                io,
                roomCode,
                "Host telah meninggalkan room. Room berakhir.",
                rt
              );
              io.to(roomCode).emit("room-ended");
              deleteRoom(roomCode);
            }
          }, 5 * 60 * 1000);
        } else {
          const leaveMsg = `${member.name} keluar dari room`;
          const msgObj: ChatMessage = {
            id: Date.now() + Math.random(),
            userId: 0,
            name: "Sistem",
            message: leaveMsg,
            isSystem: true,
            timestamp: nowIso(),
          };
          io.to(roomCode).emit("chat-message", msgObj);
          runtime.messages.push(msgObj);
          if (runtime.messages.length > 100) runtime.messages.shift();
          saveChatMessage(roomCode, 0, "Sistem", leaveMsg, true).catch(() => {});
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
