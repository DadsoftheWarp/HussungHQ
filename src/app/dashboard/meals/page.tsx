"use client";

import { useState, useEffect } from "react";
import {
  doc, setDoc, getDoc, collection, addDoc, deleteDoc, onSnapshot, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { MealPlan, MealDay, Meal, GroceryItem } from "@/types";
import { getCurrentWeekStart, getWeekDates, MEAL_TYPES, MealType } from "@/lib/meals";
import { format, parseISO, addWeeks, subWeeks } from "date-fns";
import { Plus, X, ChevronLeft, ChevronRight, ShoppingCart, Trash2, Check } from "lucide-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function MealsPage() {
  const { familyId, user } = useAuth();
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"planner" | "grocery">("planner");
  const [editModal, setEditModal] = useState<{ dayIndex: number; mealType: MealType } | null>(null);
  const [mealForm, setMealForm] = useState<Meal>({ name: "", notes: "", prepTime: undefined, calories: undefined });
  const [newGrocery, setNewGrocery] = useState("");
  const weekDates = getWeekDates(weekStart);

  // Load meal plan
  useEffect(() => {
    if (!familyId) return;
    const planRef = doc(db, "families", familyId, "mealPlans", weekStart);
    return onSnapshot(planRef, (snap) => {
      if (snap.exists()) {
        setMealPlan(snap.data() as MealPlan);
      } else {
        // Initialize empty week
        const emptyPlan: MealPlan = {
          id: weekStart,
          weekStartDate: weekStart,
          days: weekDates.map((date) => ({ date })),
        };
        setMealPlan(emptyPlan);
      }
    });
  }, [familyId, weekStart]);

  // Load groceries
  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "groceries"), where("weekStartDate", "==", weekStart));
    return onSnapshot(q, (snap) => {
      setGroceries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroceryItem)));
    });
  }, [familyId, weekStart]);

  const handleSaveMeal = async () => {
    if (!mealForm.name.trim() || !editModal || !familyId || !mealPlan) return;
    const { dayIndex, mealType } = editModal;
    const updatedDays = [...mealPlan.days];
    updatedDays[dayIndex] = {
      ...updatedDays[dayIndex],
      [mealType]: { ...mealForm, name: mealForm.name.trim() },
    };
    await setDoc(doc(db, "families", familyId, "mealPlans", weekStart), {
      ...mealPlan,
      days: updatedDays,
    });
    setEditModal(null);
    setMealForm({ name: "", notes: "", prepTime: undefined, calories: undefined });
  };

  const handleRemoveMeal = async (dayIndex: number, mealType: MealType) => {
    if (!familyId || !mealPlan) return;
    const updatedDays = [...mealPlan.days];
    const day = { ...updatedDays[dayIndex] };
    delete (day as Record<string, unknown>)[mealType];
    updatedDays[dayIndex] = day;
    await setDoc(doc(db, "families", familyId, "mealPlans", weekStart), {
      ...mealPlan,
      days: updatedDays,
    });
  };

  const handleAddGrocery = async () => {
    if (!newGrocery.trim() || !familyId || !user) return;
    await addDoc(collection(db, "families", familyId, "groceries"), {
      name: newGrocery.trim(),
      checked: false,
      weekStartDate: weekStart,
    });
    setNewGrocery("");
  };

  const handleToggleGrocery = async (item: GroceryItem) => {
    if (!familyId) return;
    await setDoc(doc(db, "families", familyId, "groceries", item.id), { ...item, checked: !item.checked });
  };

  const handleDeleteGrocery = async (id: string) => {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "groceries", id));
  };

  const prevWeek = () => setWeekStart(format(subWeeks(parseISO(weekStart + "T00:00:00"), 1), "yyyy-MM-dd"));
  const nextWeek = () => setWeekStart(format(addWeeks(parseISO(weekStart + "T00:00:00"), 1), "yyyy-MM-dd"));

  const unchecked = groceries.filter((g) => !g.checked);
  const checked = groceries.filter((g) => g.checked);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--muted)" }}>
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--foreground)" }} />
        </button>
        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Week of {format(parseISO(weekStart + "T00:00:00"), "MMM d")}
        </p>
        <button onClick={nextWeek} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--muted)" }}>
          <ChevronRight className="w-5 h-5" style={{ color: "var(--foreground)" }} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--card-border)" }}>
        {(["planner", "grocery"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-sm font-medium capitalize flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: activeTab === tab ? "var(--primary)" : "var(--muted)",
              color: activeTab === tab ? "white" : "var(--muted-foreground)",
            }}>
            {tab === "grocery" && <ShoppingCart className="w-3.5 h-3.5" />}
            {tab === "planner" ? "Meal Planner" : `Grocery List${groceries.length > 0 ? ` (${unchecked.length})` : ""}`}
          </button>
        ))}
      </div>

      {activeTab === "planner" && mealPlan && (
        <div className="space-y-3">
          {mealPlan.days.map((day, dayIndex) => (
            <div key={day.date} className="rounded-2xl border overflow-hidden"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="px-4 py-2 border-b flex items-center justify-between"
                style={{ borderColor: "var(--card-border)", background: "var(--muted)" }}>
                <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                  {DAY_NAMES[dayIndex]} · {format(parseISO(day.date + "T00:00:00"), "MMM d")}
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                {MEAL_TYPES.map((mealType) => {
                  const meal = day[mealType];
                  return (
                    <div key={mealType} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="text-xs w-16 flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        {MEAL_LABELS[mealType]}
                      </span>
                      {meal ? (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{meal.name}</p>
                            {meal.calories && (
                              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{meal.calories} cal</p>
                            )}
                          </div>
                          <button onClick={() => handleRemoveMeal(dayIndex, mealType)} className="p-1 rounded-lg" style={{ background: "var(--muted)" }}>
                            <X className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditModal({ dayIndex, mealType }); setMealForm({ name: "", notes: "", prepTime: undefined, calories: undefined }); }}
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "var(--muted-foreground)" }}>
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "grocery" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Add item..."
              value={newGrocery}
              onChange={(e) => setNewGrocery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGrocery()}
            />
            <button onClick={handleAddGrocery} disabled={!newGrocery.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>

          {groceries.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>No items yet</p>
          )}

          <div className="space-y-2">
            {unchecked.map((item) => (
              <div key={item.id} className="rounded-xl border p-3 flex items-center gap-3"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <button onClick={() => handleToggleGrocery(item)}
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                  style={{ borderColor: "var(--muted-foreground)" }} />
                <p className="flex-1 text-sm" style={{ color: "var(--foreground)" }}>{item.name}</p>
                <button onClick={() => handleDeleteGrocery(item.id)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            ))}
          </div>

          {checked.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>In cart ({checked.length})</p>
              {checked.map((item) => (
                <div key={item.id} className="rounded-xl border p-3 flex items-center gap-3 opacity-60"
                  style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                  <button onClick={() => handleToggleGrocery(item)}
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: "#10b981" }}>
                    <Check className="w-3 h-3 text-white" />
                  </button>
                  <p className="flex-1 text-sm line-through" style={{ color: "var(--muted-foreground)" }}>{item.name}</p>
                  <button onClick={() => handleDeleteGrocery(item.id)} className="p-1.5 rounded-lg" style={{ background: "var(--muted)" }}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add meal modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditModal(null)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 space-y-4"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
                {MEAL_LABELS[editModal.mealType]} · {DAY_NAMES[editModal.dayIndex]}
              </h3>
              <button onClick={() => setEditModal(null)}><X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} /></button>
            </div>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Meal name"
              value={mealForm.name}
              onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })}
              autoFocus
            />
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Notes (optional)"
              value={mealForm.notes ?? ""}
              onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                placeholder="Calories (optional)"
                value={mealForm.calories ?? ""}
                onChange={(e) => setMealForm({ ...mealForm, calories: e.target.value ? parseInt(e.target.value) : undefined })}
              />
              <input
                type="number"
                inputMode="numeric"
                className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                placeholder="Prep time (min)"
                value={mealForm.prepTime ?? ""}
                onChange={(e) => setMealForm({ ...mealForm, prepTime: e.target.value ? parseInt(e.target.value) : undefined })}
              />
            </div>
            <button onClick={handleSaveMeal} disabled={!mealForm.name.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              Save Meal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
