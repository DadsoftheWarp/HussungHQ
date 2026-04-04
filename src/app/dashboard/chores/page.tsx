"use client";

import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Chore, ChoreFrequency } from "@/types";
import { shouldReset, getNewResetDates, getNextResetDate } from "@/lib/chores";
import { Plus, X, Trash2, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

const FREQUENCY_LABELS: Record<ChoreFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};

const FREQUENCY_COLORS: Record<ChoreFrequency, string> = {
  weekly: "#6366f1",
  biweekly: "#f59e0b",
  monthly: "#10b981",
};

export default function ChoresPage() {
  const { familyId, user } = useAuth();
  const [chores, setChores] = useState<Chore[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", frequency: "weekly" as ChoreFrequency });
  const [filterFreq, setFilterFreq] = useState<ChoreFrequency | "all">("all");
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!familyId) return;
    getDoc(doc(db, "families", familyId)).then(async (familySnap) => {
      if (!familySnap.exists()) return;
      const members: string[] = familySnap.data().members ?? [];
      const entries = await Promise.all(
        members.map(async (uid) => {
          const userSnap = await getDoc(doc(db, "users", uid));
          const name = userSnap.exists() ? (userSnap.data().displayName as string) : uid;
          return [uid, name] as [string, string];
        })
      );
      setMemberNames(Object.fromEntries(entries));
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "chores"), orderBy("title"));
    return onSnapshot(q, async (snap) => {
      const loaded: Chore[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chore));

      // Auto-reset chores whose period has passed
      const resets = loaded
        .filter((c) => shouldReset(c.nextResetDate))
        .map(async (c) => {
          const { lastResetDate, nextResetDate } = getNewResetDates(c.frequency);
          await updateDoc(doc(db, "families", familyId!, "chores", c.id), {
            completions: [],
            lastResetDate,
            nextResetDate,
          });
        });
      if (resets.length > 0) await Promise.all(resets);

      setChores(loaded);
    });
  }, [familyId]);

  const handleAddChore = async () => {
    if (!form.title.trim() || !familyId || !user) return;
    const { lastResetDate, nextResetDate } = getNewResetDates(form.frequency);
    await addDoc(collection(db, "families", familyId, "chores"), {
      title: form.title.trim(),
      description: form.description.trim(),
      frequency: form.frequency,
      completions: [],
      lastResetDate,
      nextResetDate,
      createdBy: user.uid,
    });
    setForm({ title: "", description: "", frequency: "weekly" });
    setShowForm(false);
  };

  const handleToggleComplete = async (chore: Chore) => {
    if (!familyId || !user) return;
    const alreadyDone = chore.completions.some((c) => c.completedBy === user.uid);
    const completions = alreadyDone
      ? chore.completions.filter((c) => c.completedBy !== user.uid)
      : [...chore.completions, { completedBy: user.uid, completedAt: new Date().toISOString() }];
    await updateDoc(doc(db, "families", familyId, "chores", chore.id), { completions });
  };

  const handleManualReset = async (chore: Chore) => {
    if (!familyId) return;
    const { lastResetDate, nextResetDate } = getNewResetDates(chore.frequency);
    await updateDoc(doc(db, "families", familyId, "chores", chore.id), {
      completions: [],
      lastResetDate,
      nextResetDate,
    });
  };

  const handleDelete = async (id: string) => {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "chores", id));
  };

  const filtered = filterFreq === "all" ? chores : chores.filter((c) => c.frequency === filterFreq);
  const incomplete = filtered.filter((c) => !(c.completions.length > 0));
  const complete = filtered.filter((c) => c.completions.length > 0);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>Chores</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white"
          style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> Add Chore
        </button>
      </div>

      {/* Frequency filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "weekly", "biweekly", "monthly"] as const).map((f) => (
          <button key={f} onClick={() => setFilterFreq(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium flex-shrink-0 transition-all"
            style={{
              background: filterFreq === f ? "var(--primary)" : "var(--muted)",
              color: filterFreq === f ? "white" : "var(--muted-foreground)",
            }}>
            {f === "all" ? "All" : FREQUENCY_LABELS[f]}
          </button>
        ))}
      </div>

      {chores.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
          No chores yet — add some to get started
        </p>
      )}

      {/* Incomplete */}
      <div className="space-y-2">
        {incomplete.map((chore) => {
          const isDone = chore.completions.length > 0;
          const myCompletion = chore.completions.find((c) => c.completedBy === user?.uid);
          return (
            <div key={chore.id} className="rounded-xl border p-3"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="flex items-start gap-3">
                <button onClick={() => handleToggleComplete(chore)} className="mt-0.5">
                  {myCompletion
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                    : <Circle className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{chore.title}</p>
                  {chore.description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{chore.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${FREQUENCY_COLORS[chore.frequency]}20`, color: FREQUENCY_COLORS[chore.frequency] }}>
                      {FREQUENCY_LABELS[chore.frequency]}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      Resets {format(parseISO(chore.nextResetDate), "MMM d")}
                    </span>
                  </div>
                  {chore.completions.length > 0 && (
                    <p className="text-xs mt-1" style={{ color: "#10b981" }}>
                      ✓ {chore.completions.map((c) => memberNames[c.completedBy] ?? c.completedBy).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => handleManualReset(chore)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                    <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                  <button onClick={() => handleDelete(chore.id)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      {complete.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            Completed ({complete.length})
          </p>
          {complete.map((chore) => {
            const myCompletion = chore.completions.find((c) => c.completedBy === user?.uid);
            return (
              <div key={chore.id} className="rounded-xl border p-3 opacity-60"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-start gap-3">
                  <button onClick={() => handleToggleComplete(chore)} className="mt-0.5">
                    {myCompletion
                      ? <CheckCircle2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                      : <Circle className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-through" style={{ color: "var(--muted-foreground)" }}>{chore.title}</p>
                    {chore.description && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{chore.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${FREQUENCY_COLORS[chore.frequency]}20`, color: FREQUENCY_COLORS[chore.frequency] }}>
                        {FREQUENCY_LABELS[chore.frequency]}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        Resets {format(parseISO(chore.nextResetDate), "MMM d")}
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#10b981" }}>
                      ✓ {chore.completions.map((c) => memberNames[c.completedBy] ?? c.completedBy).join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => handleManualReset(chore)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                      <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button onClick={() => handleDelete(chore.id)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                      <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 space-y-4"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>Add Chore</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} /></button>
            </div>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Chore name (e.g. Vacuum living room)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Notes (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="space-y-1.5">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>How often?</p>
              <div className="grid grid-cols-3 gap-2">
                {(["weekly", "biweekly", "monthly"] as ChoreFrequency[]).map((f) => (
                  <button key={f} onClick={() => setForm({ ...form, frequency: f })}
                    className="py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: form.frequency === f ? FREQUENCY_COLORS[f] : "var(--muted)",
                      color: form.frequency === f ? "white" : "var(--muted-foreground)",
                    }}>
                    {FREQUENCY_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAddChore} disabled={!form.title.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              Add Chore
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
