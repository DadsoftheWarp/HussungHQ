"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WatchlistItem } from "@/types";
import { MediaResult } from "@/app/api/search-media/route";
import { MediaDetails } from "@/app/api/media-details/route";
import { Tv, Plus, Trash2, Check, Eye, Play, Search, X } from "lucide-react";
import Image from "next/image";

type Viewer = "logan" | "jennie" | "both";

const VIEWER_TABS: { key: Viewer; label: string }[] = [
  { key: "logan", label: "Logan" },
  { key: "jennie", label: "Jennie" },
  { key: "both", label: "Both" },
];

export default function MoviesPage() {
  const { user, familyId } = useAuth();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [activeViewer, setActiveViewer] = useState<Viewer>("both");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!familyId) return;
    const q = query(
      collection(db, "families", familyId, "watchlist"),
      orderBy("addedAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WatchlistItem));
    });
  }, [familyId]);

  const filtered = items.filter((i) => i.viewer === activeViewer);
  const wantList = filtered.filter((i) => i.status === "want");
  const watchingList = filtered.filter((i) => i.status === "watching");
  const watchedList = filtered.filter((i) => i.status === "watched");

  async function handleAdd(
    selected: MediaResult,
    detail: MediaDetails,
    viewer: Viewer,
  ) {
    if (!familyId || !user) return;
    await addDoc(collection(db, "families", familyId, "watchlist"), {
      title: selected.title,
      type: selected.type,
      viewer,
      status: "want",
      addedAt: new Date().toISOString(),
      addedBy: user.uid,
      tmdbId: selected.tmdbId,
      posterUrl: selected.posterUrl ?? null,
      year: selected.year ?? null,
      overview: selected.overview ?? null,
      seasons: detail.seasons ?? null,
      streamingOn: detail.streamingOn ?? [],
      genres: detail.genres ?? [],
      backdropUrl: detail.backdropUrl ?? null,
    });
    setShowModal(false);
  }

  async function toggleStatus(item: WatchlistItem) {
    if (!familyId) return;
    const next = item.status === "want" ? "watching" : item.status === "watching" ? "watched" : "want";
    await updateDoc(doc(db, "families", familyId, "watchlist", item.id), { status: next });
  }

  async function handleDelete(id: string) {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "watchlist", id));
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5" style={{ color: "#10b981" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Movies & Shows
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{ background: "#10b981", color: "#fff" }}
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Viewer tabs */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        {VIEWER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveViewer(key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: activeViewer === key ? "#10b981" : "transparent",
              color: activeViewer === key ? "#fff" : "var(--muted-foreground)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Want to Watch */}
      <Section title="Want to Watch" count={wantList.length}>
        {wantList.length === 0 ? (
          <EmptyState message="Nothing in the queue yet" />
        ) : (
          wantList.map((item) => (
            <ItemCard key={item.id} item={item} onToggle={() => toggleStatus(item)} onDelete={() => handleDelete(item.id)} />
          ))
        )}
      </Section>

      {/* Watching */}
      <Section title="Watching" count={watchingList.length}>
        {watchingList.length === 0 ? (
          <EmptyState message="Nothing in progress" />
        ) : (
          watchingList.map((item) => (
            <ItemCard key={item.id} item={item} onToggle={() => toggleStatus(item)} onDelete={() => handleDelete(item.id)} />
          ))
        )}
      </Section>

      {/* Watched */}
      <Section title="Watched" count={watchedList.length}>
        {watchedList.length === 0 ? (
          <EmptyState message="Nothing watched yet" />
        ) : (
          watchedList.map((item) => (
            <ItemCard key={item.id} item={item} onToggle={() => toggleStatus(item)} onDelete={() => handleDelete(item.id)} />
          ))
        )}
      </Section>

      {showModal && (
        <AddModal
          onAdd={(selected, detail, viewer) => handleAdd(selected, detail, viewer)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ── Add Modal ──────────────────────────────────────────────────────────────────

function AddModal({
  onAdd,
  onClose,
}: {
  onAdd: (selected: MediaResult, detail: MediaDetails, viewer: Viewer) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [selected, setSelected] = useState<MediaResult | null>(null);
  const [detail, setDetail] = useState<MediaDetails | null>(null);
  const [viewer, setViewer] = useState<Viewer>("both");
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) {
      setResults([]);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/search-media?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          setSearchError(`Search failed (${res.status})`);
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults(data.results ?? []);
      } catch (e) {
        setSearchError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query, selected]);

  async function handleSelect(result: MediaResult) {
    setSelected(result);
    setResults([]);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/media-details?id=${result.tmdbId}&type=${result.type}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: MediaDetails = await res.json();
      setDetail(data);
    } catch {
      // Detail enrichment failed — still allow adding with basic info
      setDetail({ streamingOn: [], genres: [], backdropUrl: null });
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleSave() {
    if (!selected || !detail) return;
    setSaving(true);
    await onAdd(selected, detail, viewer);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl p-5 space-y-4"
        style={{ background: "var(--card)" }}
      >
        <h2 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
          Add to Watchlist
        </h2>

        {/* Search / selected preview */}
        {selected ? (
          <SelectedPreview
            result={selected}
            detail={detail}
            loadingDetail={loadingDetail}
            onClear={() => { setSelected(null); setDetail(null); setQuery(""); }}
          />
        ) : (
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--muted-foreground)" }}
            />
            <input
              autoFocus
              type="text"
              placeholder="Search movies & shows…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "var(--background)",
                color: "var(--foreground)",
                border: "1px solid var(--card-border)",
              }}
            />
          </div>
        )}

        {/* Search error */}
        {!selected && searchError && (
          <p className="text-xs px-1" style={{ color: "#ef4444" }}>
            {searchError}
          </p>
        )}

        {/* Results list */}
        {!selected && (results.length > 0 || searching) && (
          <div
            className="rounded-xl overflow-hidden border divide-y max-h-56 overflow-y-auto"
            style={{ borderColor: "var(--card-border)" }}
          >
            {searching && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-center" style={{ color: "var(--muted-foreground)" }}>
                Searching…
              </div>
            )}
            {results.map((r) => (
              <button
                key={r.tmdbId}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-opacity hover:opacity-80"
                style={{ background: "var(--background)" }}
              >
                {r.posterUrl ? (
                  <Image
                    src={r.posterUrl}
                    alt={r.title}
                    width={32}
                    height={48}
                    className="rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-12 rounded flex-shrink-0"
                    style={{ background: "var(--card-border)" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {r.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {r.type === "movie" ? "Movie" : "TV Show"}{r.year ? ` · ${r.year}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Viewer toggle — only show once something is selected */}
        {selected && (
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
              Who&apos;s watching?
            </p>
            <div className="flex gap-2">
              {VIEWER_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewer(key)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium border transition-all"
                  style={{
                    background: viewer === key ? "#10b98120" : "transparent",
                    borderColor: viewer === key ? "#10b981" : "var(--card-border)",
                    color: viewer === key ? "#10b981" : "var(--muted-foreground)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: "var(--card-border)", color: "var(--muted-foreground)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || !detail || loadingDetail || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "#10b981", color: "#fff" }}
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectedPreview({
  result,
  detail,
  loadingDetail,
  onClear,
}: {
  result: MediaResult;
  detail: MediaDetails | null;
  loadingDetail: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-xl border"
      style={{ background: "var(--background)", borderColor: "#10b981" }}
    >
      {result.posterUrl ? (
        <Image
          src={result.posterUrl}
          alt={result.title}
          width={32}
          height={48}
          className="rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-12 rounded flex-shrink-0" style={{ background: "var(--card-border)" }} />
      )}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
          {result.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          {result.type === "movie" ? "Movie" : "TV Show"}{result.year ? ` · ${result.year}` : ""}
          {detail?.seasons ? ` · ${detail.seasons} season${detail.seasons !== 1 ? "s" : ""}` : ""}
        </p>
        {loadingDetail && (
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Loading details…</p>
        )}
        {!loadingDetail && detail && detail.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {detail.genres.map((g) => (
              <span key={g} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "#6366f120", color: "#6366f1" }}>
                {g}
              </span>
            ))}
          </div>
        )}
        {!loadingDetail && detail && detail.streamingOn.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {detail.streamingOn.map((p) => (
              <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "#10b98120", color: "#10b981" }}>
                {p}
              </span>
            ))}
          </div>
        )}
        {!loadingDetail && detail && detail.streamingOn.length === 0 && (
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Not on US streaming</p>
        )}
      </div>
      <button onClick={onClear} className="flex-shrink-0 p-1 rounded-lg" style={{ color: "var(--muted-foreground)" }}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
        {message}
      </p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {title}
        </p>
        <span
          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
          style={{
            background: "var(--card)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--card-border)",
          }}
        >
          {count}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ItemCard({
  item,
  onToggle,
  onDelete,
}: {
  item: WatchlistItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { status } = item;
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "var(--card)",
        borderColor: "var(--card-border)",
        opacity: status === "watched" ? 0.7 : 1,
      }}
    >
      {/* Backdrop banner */}
      {item.backdropUrl ? (
        <div className="relative w-full overflow-hidden" style={{ height: "7rem" }}>
          <Image
            src={item.backdropUrl}
            alt={item.title}
            width={780}
            height={440}
            sizes="(max-width: 512px) 100vw, 512px"
            className="w-full h-full object-cover"
            style={{ filter: status === "watched" ? "grayscale(60%)" : "none" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)" }} />
        </div>
      ) : (
        <div className="w-full h-16" style={{ background: "var(--card-border)" }} />
      )}

      {/* Info + actions */}
      <div className="flex items-start gap-3 px-3 py-3">
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{
              color: "var(--foreground)",
              textDecoration: status === "watched" ? "line-through" : "none",
            }}
          >
            {item.title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {item.type === "movie" ? "Movie" : "TV Show"}
            {item.year ? ` · ${item.year}` : ""}
            {item.seasons ? ` · ${item.seasons} season${item.seasons !== 1 ? "s" : ""}` : ""}
          </p>
          {item.genres && item.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.genres.map((g) => (
                <span key={g} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "#6366f120", color: "#6366f1" }}>
                  {g}
                </span>
              ))}
            </div>
          )}
          {item.streamingOn && item.streamingOn.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.streamingOn.map((p) => (
                <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: "#10b98120", color: "#10b981" }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status cycle button: want → watching → watched → want */}
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-95 border"
          style={{
            background: status === "watched" ? "#10b981" : status === "watching" ? "#f59e0b20" : "transparent",
            borderColor: status === "watched" ? "#10b981" : status === "watching" ? "#f59e0b" : "var(--card-border)",
          }}
        >
          {status === "watched" && <Check className="w-4 h-4 text-white" />}
          {status === "watching" && <Play className="w-4 h-4" style={{ color: "#f59e0b" }} />}
          {status === "want" && <Eye className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
