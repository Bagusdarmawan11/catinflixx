import MediaCard from "./MediaCard";

interface MediaItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  overview?: string;
}

interface MediaGridProps {
  items: MediaItem[];
  title?: string;
  loading?: boolean;
  emptyMessage?: string;
}

function SkeletonCard() {
  return (
    <div className="space-y-2">
      {/* Poster placeholder */}
      <div className="aspect-[2/3] rounded-xl skeleton-shimmer" />
      {/* Title line */}
      <div className="h-3.5 skeleton-shimmer rounded-md w-4/5" />
      {/* Year line */}
      <div className="h-3 skeleton-shimmer rounded-md w-2/5" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function MediaGrid({ items, title, loading, emptyMessage }: MediaGridProps) {
  if (loading) {
    return (
      <section>
        {title && <h2 className="text-white text-xl font-bold mb-4">{title}</h2>}
        <SkeletonGrid />
      </section>
    );
  }

  if (!items || items.length === 0) {
    return (
      <section>
        {title && <h2 className="text-white text-xl font-bold mb-4">{title}</h2>}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">🎬</span>
          </div>
          <p className="text-gray-400">{emptyMessage || "Tidak ada konten ditemukan."}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      {title && <h2 className="text-white text-xl font-bold mb-4">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <MediaCard key={`${item.mediaType}-${item.id}`} {...item} />
        ))}
      </div>
    </section>
  );
}

/* Named export so browse page can use the skeleton independently */
export { SkeletonGrid };
