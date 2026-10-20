import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { registerWatchPartyHandlers } from "./socket/watchPartyHandlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Attach io to global so API routes can emit if needed
  (global as unknown as { io: SocketIOServer }).io = io;

  // Register Socket.IO event handlers
  registerWatchPartyHandlers(io);

  httpServer.listen(port, hostname, () => {
    console.log(
      `> CatinFlix server ready on http://${hostname}:${port} [${dev ? "dev" : "prod"}]`
    );
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("> Shutting down server...");
    io.close();
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
