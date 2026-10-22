import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory room state (fast, no DB round-trips for real-time events)
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

        // Init room if not exists
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

        // Add member
        room.members.set(socket.id, { userId, name, socketId: socket.id, isHost });

        socket.join(roomCode);

        // Send current video state to new member
        socket.emit("video-state-sync", room.videoState);

        // Send current video info
        socket.emit("room-info", {
          videoUrl: room.videoUrl,
          videoTitle: room.videoTitle,
          hostUserId: room.hostUserId,
        });

        // Broadcast updated member list
        const memberList = Array.from(room.members.values()).map((m) => ({
          userId: m.userId,
          name: m.name,
          isHost: m.isHost,
        }));
        io.to(roomCode).emit("room-members", memberList);

        // Notify others
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

    // ── Video State (host only broadcasts) ────────────────────────
    socket.on(
      "video-control",
      (data: { roomCode: string; isPlaying: boolean; currentTime: number }) => {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const member = room.members.get(socket.id);
        if (!member?.isHost) return; // only host can control

        room.videoState = {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          updatedAt: Date.now(),
        };

        // Broadcast to everyone else in room
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

    // ── Change Video (host only) ───────────────────────────────────
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

    // ── Disconnect ─────────────────────────────────────────────────
    socket.on("disconnect", () => {
      rooms.forEach((room, roomCode) => {
        const member = room.members.get(socket.id);
        if (!member) return;

        room.members.delete(socket.id);

        if (room.members.size === 0) {
          rooms.delete(roomCode);
          console.log(`[Socket] Room ${roomCode} deleted (empty)`);
          return;
        }

        // Broadcast updated member list
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
