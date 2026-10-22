import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory room state
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

// In-memory video call participants per room: roomCode → Set<socketId>
const vcParticipants = new Map<string, Map<string, { userId: number; userName: string }>>();

const rooms = new Map<string, RoomState>();

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
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Join Room ──────────────────────────────────────────────────
    socket.on(
      "join-room",
      (data: { roomCode: string; userId: number; name: string; isHost: boolean; videoUrl: string; videoTitle: string }) => {
        const { roomCode, userId, name, isHost, videoUrl, videoTitle } = data;

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
        room.members.set(socket.id, { userId, name, socketId: socket.id, isHost });
        socket.join(roomCode);

        socket.emit("video-state-sync", room.videoState);
        socket.emit("room-info", {
          videoUrl: room.videoUrl,
          videoTitle: room.videoTitle,
          hostUserId: room.hostUserId,
        });

        const memberList = Array.from(room.members.values()).map((m) => ({
          userId: m.userId,
          name: m.name,
          isHost: m.isHost,
        }));
        io.to(roomCode).emit("room-members", memberList);

        socket.to(roomCode).emit("chat-message", {
          id: Date.now(),
          userId: 0,
          name: "Sistem",
          message: `${name} bergabung ke room`,
          isSystem: true,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Socket] ${name} joined room ${roomCode}`);
      }
    );

    // ── Video State ────────────────────────────────────────────────
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

    // ── Chat Message ───────────────────────────────────────────────
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

    // ── Change Video ───────────────────────────────────────────────
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

    // ════════════════════════════════════════════════════════════════
    // ── WebRTC Video Call Signaling ─────────────────────────────────
    // ════════════════════════════════════════════════════════════════

    // User join video call
    socket.on(
      "vc:join",
      (data: { roomCode: string; userId: number; userName: string }) => {
        const { roomCode, userId, userName } = data;

        if (!vcParticipants.has(roomCode)) {
          vcParticipants.set(roomCode, new Map());
        }
        const vcRoom = vcParticipants.get(roomCode)!;

        // Beritahu semua peserta vc yang sudah ada bahwa ada user baru
        vcRoom.forEach((_participant, existingSocketId) => {
          io.to(existingSocketId).emit("vc:user-joined", {
            socketId: socket.id,
            userId,
            userName,
          });
        });

        // Tambahkan diri sendiri ke daftar peserta vc
        vcRoom.set(socket.id, { userId, userName });

        console.log(`[VideoCall] ${userName} joined vc in room ${roomCode}`);
      }
    );

    // Relay WebRTC offer
    socket.on(
      "vc:offer",
      (data: { roomCode: string; targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const sender = room.members.get(socket.id);
        io.to(data.targetSocketId).emit("vc:offer", {
          fromSocketId: socket.id,
          fromUserId: sender?.userId ?? 0,
          fromUserName: sender?.name ?? "Tamu",
          offer: data.offer,
        });
      }
    );

    // Relay WebRTC answer
    socket.on(
      "vc:answer",
      (data: { roomCode: string; targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
        io.to(data.targetSocketId).emit("vc:answer", {
          fromSocketId: socket.id,
          answer: data.answer,
        });
      }
    );

    // Relay ICE candidate
    socket.on(
      "vc:ice-candidate",
      (data: { roomCode: string; targetSocketId: string; candidate: RTCIceCandidateInit }) => {
        io.to(data.targetSocketId).emit("vc:ice-candidate", {
          fromSocketId: socket.id,
          candidate: data.candidate,
        });
      }
    );

    // User leave video call (tanpa leave room)
    socket.on("vc:leave", (data: { roomCode: string; userId: number }) => {
      const vcRoom = vcParticipants.get(data.roomCode);
      if (vcRoom) {
        vcRoom.delete(socket.id);
        if (vcRoom.size === 0) vcParticipants.delete(data.roomCode);
      }
      socket.to(data.roomCode).emit("vc:user-left", { socketId: socket.id });
      console.log(`[VideoCall] User left vc in room ${data.roomCode}`);
    });

    // ── Disconnect ─────────────────────────────────────────────────
    socket.on("disconnect", () => {
      // Cleanup video call
      vcParticipants.forEach((vcRoom, roomCode) => {
        if (vcRoom.has(socket.id)) {
          vcRoom.delete(socket.id);
          socket.to(roomCode).emit("vc:user-left", { socketId: socket.id });
          if (vcRoom.size === 0) vcParticipants.delete(roomCode);
        }
      });

      // Cleanup watch party room
      rooms.forEach((room, roomCode) => {
        const member = room.members.get(socket.id);
        if (!member) return;

        room.members.delete(socket.id);

        if (room.members.size === 0) {
          rooms.delete(roomCode);
          console.log(`[Socket] Room ${roomCode} deleted (empty)`);
          return;
        }

        const memberList = Array.from(room.members.values()).map((m) => ({
          userId: m.userId,
          name: m.name,
          isHost: m.isHost,
        }));
        io.to(roomCode).emit("room-members", memberList);

        io.to(roomCode).emit("chat-message", {
          id: Date.now(),
          userId: 0,
          name: "Sistem",
          message: `${member.name} meninggalkan room`,
          isSystem: true,
          timestamp: new Date().toISOString(),
        });
      });

      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> CatinFlix ready on http://${hostname}:${port} [${dev ? "dev" : "prod"}]`);
  });
});
