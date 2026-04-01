"use client";

import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Goal, Milestone, GOAL_CATEGORIES } from "@/types";
import { Plus, X, Trash2, CheckCircle2, Circle, Target } from "lucide-react";
import { format, parseISO } from "date-fns";

const GOAL_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function GoalsPage() {
  const { familyId, user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [newMilestoneText, setNewMilestoneText] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "", description: "", category: "Home Improvement", targetDate: "", color: GOAL_COLORS[0],
  });

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "goals"), orderBy("title"));
    return onSnapshot(q, (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)));
    });
  }, [familyId]);

  const handleAddGoal = async () => {
    if (!form.title.trim() || !familyId || !user) return;
    await addDoc(collection(db, "families", familyId, "goals"), {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      targetDate: form.targetDate,
      progress: 0,
      milestones: [],
      createdBy: user.uid,
      completed: false,
      color: form.color,
    });
    setForm({ title: "", description: "", category: "Home Improvement", targetDate: "", color: GOAL_COLORS[0] });
    setShowForm(false);
  };

  const handleAddMilestone = async (goal: Goal) => {
    const text = newMilestoneText[goal.id]?.trim();
    if (!text || !familyId) return;
    const newMilestone: Milestone = {
      id: Date.now().toString(),
      text,
      completed: false,
    };
    const updated = [...goal.milestones, newMilestone];
    const progress = updated.length === 0 ? 0 : Math.round((updated.filter((m) => m.completed).length / updated.length) * 100);
    await updateDoc(doc(db, "families", familyId, "goals", goal.id), {
      milestones: updated,
      progress,
    });
    setNewMilestoneText((prev) => ({ ...prev, [goal.id]: "" }));
  };

  const handleToggleMilestone = async (goal: Goal, milestoneId: string) => {
    if (!familyId) return;
    const updated = goal.milestones.map((m) =>
      m.id === milestoneId ? { ...m, completed: !m.completed } : m
    );
    const progress = updated.length === 0 ? 0 : Math.round((updated.filter((m) => m.completed).length / updated.length) * 100);
    const completed = progress === 100;
    await updateDoc(doc(db, "families", familyId, "goals", goal.id), {
      milestones: updated,
      progress,
      completed,
    });
  };

  const handleDeleteGoal = async (id: string) => {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "goals", id));
    if (expandedGoal === id) setExpandedGoal(null);
  };

  const active = goals.filter((g) => !g.completed);
  const completed = goals.filter((g) => g.completed);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>Goals & Projects</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white"
          style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>

      {goals.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No goals yet — add a house project to track!</p>
        </div>
      )}

      {/* Active goals */}
      <div className="space-y-3">
        {active.map((goal) => {
          const isExpanded = expandedGoal === goal.id;
          return (
            <div key={goal.id} className="rounded-2xl border overflow-hidden"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="w-full p-4 cursor-pointer" onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: goal.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{goal.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {goal.category}{goal.targetDate ? ` · Due ${format(parseISO(goal.targetDate), "MMM d, yyyy")}` : ""}
                    </p>
                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ background: goal.color, width: `${goal.progress}%` }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                      {goal.progress}% · {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length} milestones
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                    className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3 space-y-2" style={{ borderColor: "var(--card-border)" }}>
                  {goal.description && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{goal.description}</p>
                  )}
                  {goal.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <button onClick={() => handleToggleMilestone(goal, m.id)}>
                        {m.completed
                          ? <CheckCircle2 className="w-4 h-4" style={{ color: goal.color }} />
                          : <Circle className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
                      </button>
                      <p className={`text-sm flex-1 ${m.completed ? "line-through opacity-50" : ""}`}
                        style={{ color: "var(--foreground)" }}>{m.text}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input
                      className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                      placeholder="Add milestone..."
                      value={newMilestoneText[goal.id] ?? ""}
                      onChange={(e) => setNewMilestoneText((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleAddMilestone(goal)}
                    />
                    <button onClick={() => handleAddMilestone(goal)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--primary)" }}>
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Completed ({completed.length})</p>
          {completed.map((goal) => (
            <div key={goal.id} className="rounded-xl border p-3 flex items-center gap-3 opacity-60"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#10b981" }} />
              <p className="flex-1 text-sm line-through" style={{ color: "var(--muted-foreground)" }}>{goal.title}</p>
              <button onClick={() => handleDeleteGoal(goal.id)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 space-y-4"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>New Goal</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} /></button>
            </div>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Goal title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Description (optional)"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {GOAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full"
                  style={{ background: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
            <button onClick={handleAddGoal} disabled={!form.title.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              Create Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
