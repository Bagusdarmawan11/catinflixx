import type { Server as SocketIOServer, Socket } from "socket.io";

/**
 * Watch Party Socket.IO handlers.
 * Full implementation will be completed in Stage 7.
 * This scaffold ensures the server starts without errors.
 */
export function registerWatchPartyHandlers(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    const clientIp =
      socket.handshake.headers["x-forwarded-for"] ||
      socket.handshake.address;

    console.log(`[Socket] Client connected: ${socket.id} from ${clientIp}`);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} — ${reason}`);
    });

    // Watch Party events — implemented in Stage 7
    socket.on("room:join", () => {
      socket.emit("error:not_implemented", {
        message: "Watch Party coming soon",
      });
    });
  });
}
