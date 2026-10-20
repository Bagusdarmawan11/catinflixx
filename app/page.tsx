export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center space-y-4 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-cf bg-cf-accent flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-3xl font-bold text-cf-text">CatinFlix</h1>
        </div>
        <p className="text-cf-text-secondary text-lg">
          Platform streaming film modern
        </p>
        <p className="text-cf-text-muted text-sm">
          Scaffolding selesai — Stage 1 ✓
        </p>
        <div className="flex gap-3 justify-center mt-8">
          <span className="px-3 py-1 rounded-full text-xs bg-cf-bg-elevated border border-cf-border text-cf-text-secondary">
            Next.js 14
          </span>
          <span className="px-3 py-1 rounded-full text-xs bg-cf-bg-elevated border border-cf-border text-cf-text-secondary">
            TypeScript
          </span>
          <span className="px-3 py-1 rounded-full text-xs bg-cf-bg-elevated border border-cf-border text-cf-text-secondary">
            Socket.IO
          </span>
          <span className="px-3 py-1 rounded-full text-xs bg-cf-bg-elevated border border-cf-border text-cf-text-secondary">
            Neon PostgreSQL
          </span>
        </div>
      </div>
    </main>
  );
}
