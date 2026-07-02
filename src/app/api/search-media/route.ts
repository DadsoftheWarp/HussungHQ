import { NextRequest } from "next/server";

export interface MediaResult {
  tmdbId: number;
  title: string;
  type: "movie" | "show";
  year: string;
  posterUrl: string | null;
  overview: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  const key = process.env.TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return Response.json({ results: [] }, { status: res.status });

  const data = await res.json();

  const results: MediaResult[] = (data.results ?? [])
    .filter((r: { media_type: string }) => r.media_type === "movie" || r.media_type === "tv")
    .slice(0, 8)
    .map((r: {
      id: number;
      media_type: string;
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
      poster_path?: string;
      overview?: string;
    }) => ({
      tmdbId: r.id,
      title: r.media_type === "movie" ? (r.title ?? "") : (r.name ?? ""),
      type: r.media_type === "movie" ? "movie" : "show",
      year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
      posterUrl: r.poster_path
        ? `https://image.tmdb.org/t/p/w92${r.poster_path}`
        : null,
      overview: r.overview ?? "",
    }));

  return Response.json({ results });
}
