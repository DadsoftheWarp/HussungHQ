import { NextRequest } from "next/server";

export interface MediaDetails {
  seasons?: number;          // TV only
  streamingOn: string[];     // US flatrate providers
  genres: string[];
  backdropUrl: string | null;
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type"); // "movie" | "show"
  if (!id || !type) return Response.json({ seasons: null, streamingOn: [] });

  const key = process.env.TMDB_API_KEY;
  const base = `https://api.themoviedb.org/3`;
  const tmdbType = type === "show" ? "tv" : "movie";

  const [detailRes, providersRes] = await Promise.all([
    fetch(`${base}/${tmdbType}/${id}?api_key=${key}&language=en-US`, { next: { revalidate: 3600 } }),
    fetch(`${base}/${tmdbType}/${id}/watch/providers?api_key=${key}`, { next: { revalidate: 3600 } }),
  ]);

  const [detail, providers] = await Promise.all([
    detailRes.ok ? detailRes.json() : null,
    providersRes.ok ? providersRes.json() : null,
  ]);

  const usProviders = providers?.results?.US;
  const streamingOn: string[] = (usProviders?.flatrate ?? []).map(
    (p: { provider_name: string }) => p.provider_name,
  );

  let seasons: number | undefined;
  if (type === "show" && Array.isArray(detail?.seasons)) {
    const today = new Date().toISOString().slice(0, 10);
    seasons = (detail.seasons as { season_number: number; air_date?: string }[])
      .filter((s) => s.season_number > 0 && s.air_date && s.air_date <= today)
      .length || undefined;
  }

  const genres: string[] = (detail?.genres ?? []).map(
    (g: { name: string }) => g.name,
  );

  const backdropUrl: string | null = detail?.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}`
    : null;

  const result: MediaDetails = { seasons, streamingOn, genres, backdropUrl };

  return Response.json(result);
}
