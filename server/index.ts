import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── Types ─────────────────────────────────────────────────────────────────────
interface RoomMember {
  userId: number;
  name: string;
  socketId: string;
  isHost: boolean;
}

interface RoomState {
  code: string;
  hostUserId: number;
  videoUrl: string;
  videoTitle: string;
  members: Map<string, RoomMember>; // socketId → member
  videoState: {
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
  };
}

// ── In-memory stores ──────────────────────────────────────────────────────────
const rooms = new Map<string, RoomState>();

// Video call participants: roomCode → Map<socketId, { userId, userName }>
const vcParticipants = new Map<
  string,
  Map<string, { userId: number; userName: string }>
>();

// ── Helper ────────────────────────────────────────────────────────────────────
function broadcastMembers(
  io: SocketIOServer,
  roomCode: string,
  room: RoomState
) {
  const memberList = Array.from(room.members.values()).map((m) => ({
    userId: m.userId,
    name: m.name,
    isHost: m.isHost,
  }));
  io.to(roomCode).emit("room-members", memberList);
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

// ── Main ──────────────────────────────────────────────────────────────────────
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
    const clientUserId = parseInt(socket.handshake.query.userId as string) || 0;
    console.log(`[Socket] Connected: ${socket.id} (userId=${clientUserId})`);

    // ── Join Room ────────────────────────────────────────────────────────────
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

        // Buat room jika belum ada
        if (!rooms.has(roomCode)) {
          rooms.set(roomCode, {
            code: roomCode,
            hostUserId: userId,
            videoUrl,
            videoTitle,
            members: new Map(),
            videoState: { isPlaying: false, currentTime: 0, updatedAt: Date.now() },
          });
        }

        const room = rooms.get(roomCode)!;

        // Cek apakah userId ini sudah ada di room (reconnect dari device lain / refresh)
        let wasAlreadyInRoom = false;
        room.members.forEach((m) => {
          if (m.userId === userId) {
            wasAlreadyInRoom = true;
            // Hapus entri socket lama
            room.members.delete(m.socketId);
          }
        });

        // Daftarkan socket baru
        room.members.set(socket.id, {
          userId,
          name,
          socketId: socket.id,
          isHost,
        });
        socket.join(roomCode);

        // Kirim state ke user yang baru join
        socket.emit("video-state-sync", room.videoState);
        socket.emit("room-info", {
          videoUrl: room.videoUrl,
          videoTitle: room.videoTitle,
          hostUserId: room.hostUserId,
        });

        // Broadcast member list terbaru
        broadcastMembers(io, roomCode, room);

        // Sistem message: "bergabung" atau "kembali"
        if (wasAlreadyInRoom || isReconnect) {
          // Tidak tampilkan pesan apapun untuk reconnect agar tidak spam
          // (opsional: aktifkan baris di bawah kalau mau ada notif kembali)
          // systemMsg(io, roomCode, `${name} kembali ke room`);
        } else {
          systemMsg(io, roomCode, `${name} bergabung ke room`);
        }

        console.log(
          `[Socket] ${name} ${wasAlreadyInRoom ? "re-joined" : "joined"} room ${roomCode}`
        );
      }
    );

    // ── Video Control ────────────────────────────────────────────────────────
    socket.on(
      "video-control",
      (data: { roomCode: string; isPlaying: boolean; currentTime: number }) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;
        const member = room.members.get(socket.id);
        if (!member?.isHost) return;

        room.videoState = {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          updatedAt: Date.now(),
        };
        socket.to(data.roomCode).emit("video-state-sync", room.videoState);
      }
    );

    // ── Chat Message ─────────────────────────────────────────────────────────
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

    // ── Change Video ─────────────────────────────────────────────────────────
    socket.on(
      "change-video",
      (data: { roomCode: string; videoUrl: string; videoTitle: string }) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;
        const member = room.members.get(socket.id);
        if (!member?.isHost) return;

        room.videoUrl = data.videoUrl;
        room.videoTitle = data.videoTitle;
        room.videoState = { isPlaying: false, currentTime: 0, updatedAt: Date.now() };

        io.to(data.roomCode).emit("room-info", {
          videoUrl: room.videoUrl,
          videoTitle: room.videoTitle,
          hostUserId: room.hostUserId,
        });
        io.to(data.roomCode).emit("video-state-sync", room.videoState);
      }
    );

    // ════════════════════════════════════════════════════════════════════════
    // ── WebRTC Signaling ────────────────────────────────────────────────────
    // ════════════════════════════════════════════════════════════════════════

    // User join video call dalam room
    socket.on(
      "vc:join",
      (data: { roomCode: string; userId: number; userName: string }) => {
        const { roomCode, userId, userName } = data;

        if (!vcParticipants.has(roomCode)) {
          vcParticipants.set(roomCode, new Map());
        }
        const vcRoom = vcParticipants.get(roomCode)!;

        // Beritahu semua peserta vc yang sudah ada bahwa ada user baru → mereka yang inisiasi offer
        vcRoom.forEach((_p, existingSocketId) => {
          io.to(existingSocketId).emit("vc:user-joined", {
            socketId: socket.id,
            userId,
            userName,
          });
        });

        // Daftarkan diri
        vcRoom.set(socket.id, { userId, userName });
        console.log(`[VC] ${userName} joined vc in room ${roomCode} (${vcRoom.size} total)`);
      }
    );

    // Relay WebRTC offer (caller → callee)
    socket.on(
      "vc:offer",
      (data: {
        roomCode: string;
        targetSocketId: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        const room = rooms.get(data.roomCode);
        const sender = room?.members.get(socket.id);

        io.to(data.targetSocketId).emit("vc:offer", {
          fromSocketId: socket.id,
          fromUserId: sender?.userId ?? 0,
          fromUserName: sender?.name ?? "Tamu",
          offer: data.offer,
        });
      }
    );

    // Relay WebRTC answer (callee → caller)
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

    // Relay ICE candidate (keduanya arah)
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

    // User keluar dari video call tapi tetap di room
    socket.on("vc:leave", (data: { roomCode: string; userId: number }) => {
      const vcRoom = vcParticipants.get(data.roomCode);
      if (vcRoom) {
        vcRoom.delete(socket.id);
        if (vcRoom.size === 0) vcParticipants.delete(data.roomCode);
      }
      socket.to(data.roomCode).emit("vc:user-left", { socketId: socket.id });
      console.log(`[VC] User left vc in room ${data.roomCode}`);
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      // Cleanup video call
      vcParticipants.forEach((vcRoom, roomCode) => {
        if (vcRoom.has(socket.id)) {
          vcRoom.delete(socket.id);
          socket.to(roomCode).emit("vc:user-left", { socketId: socket.id });
          if (vcRoom.size === 0) vcParticipants.delete(roomCode);
        }
      });

      // Cleanup watch party
      rooms.forEach((room, roomCode) => {
        const member = room.members.get(socket.id);
        if (!member) return;

        room.members.delete(socket.id);

        if (room.members.size === 0) {
          // Delay delete room 30 detik untuk toleransi reconnect
          setTimeout(() => {
            if (rooms.get(roomCode)?.members.size === 0) {
              rooms.delete(roomCode);
              console.log(`[Socket] Room ${roomCode} deleted (empty)`);
            }
          }, 30_000);
          return;
        }

        broadcastMembers(io, roomCode, room);
        // Tidak tampilkan sistem pesan saat disconnect agar tidak spam saat refresh
        // (reconnect akan join ulang dalam beberapa detik)
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
