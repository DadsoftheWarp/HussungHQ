"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Transaction, BUDGET_CATEGORIES } from "@/types";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { Plus, X, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function BudgetPage() {
  const { familyId, user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: "", description: "", category: "Other", type: "expense" as "income" | "expense", date: format(new Date(), "yyyy-MM-dd"),
  });
  const [filterMonth] = useState(new Date());

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "transactions"), orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
    });
  }, [familyId]);

  const monthTransactions = transactions.filter((t) => {
    try {
      return isWithinInterval(parseISO(t.date), {
        start: startOfMonth(filterMonth),
        end: endOfMonth(filterMonth),
      });
    } catch { return false; }
  });

  const totalIncome = monthTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = monthTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpenses;

  const handleAdd = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || !form.description.trim() || !familyId || !user) return;
    await addDoc(collection(db, "families", familyId, "transactions"), {
      amount,
      description: form.description.trim(),
      category: form.category,
      type: form.type,
      date: form.date,
      createdBy: user.uid,
    });
    setForm({ amount: "", description: "", category: "Other", type: "expense", date: format(new Date(), "yyyy-MM-dd") });
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "transactions", id));
  };

  // Group by category
  const expenseByCategory = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h2 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
        {format(filterMonth, "MMMM yyyy")}
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Income", value: totalIncome, icon: TrendingUp, color: "#10b981" },
          { label: "Expenses", value: totalExpenses, icon: TrendingDown, color: "#ef4444" },
          { label: "Balance", value: balance, icon: DollarSign, color: balance >= 0 ? "#10b981" : "#ef4444" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border p-3 text-center"
            style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</p>
            <p className="font-bold text-sm" style={{ color }}>
              ${Math.abs(value).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {Object.keys(expenseByCategory).length > 0 && (
        <div className="rounded-2xl border p-4 space-y-2"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Spending by Category</p>
          {Object.entries(expenseByCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-2">
                <p className="text-xs flex-1" style={{ color: "var(--foreground)" }}>{cat}</p>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                  <div className="h-full rounded-full" style={{ background: "#ef4444", width: `${Math.min((amount / totalExpenses) * 100, 100)}%` }} />
                </div>
                <p className="text-xs font-medium w-16 text-right" style={{ color: "var(--foreground)" }}>${amount.toFixed(2)}</p>
              </div>
            ))}
        </div>
      )}

      {/* Add button */}
      <button onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-white"
        style={{ background: "var(--primary)" }}>
        <Plus className="w-4 h-4" /> Add Transaction
      </button>

      {/* Transactions list */}
      <div className="space-y-2">
        {monthTransactions.length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>No transactions this month</p>
        )}
        {monthTransactions.map((t) => (
          <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3"
            style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: t.type === "income" ? "#10b98120" : "#ef444420" }}>
              {t.type === "income"
                ? <TrendingUp className="w-4 h-4" style={{ color: "#10b981" }} />
                : <TrendingDown className="w-4 h-4" style={{ color: "#ef4444" }} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{t.description}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t.category} · {format(parseISO(t.date), "MMM d")}</p>
            </div>
            <p className="font-semibold text-sm flex-shrink-0"
              style={{ color: t.type === "income" ? "#10b981" : "#ef4444" }}>
              {t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}
            </p>
            <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg ml-1" style={{ background: "var(--muted)" }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 space-y-4"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>Add Transaction</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} /></button>
            </div>
            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--card-border)" }}>
              {(["expense", "income"] as const).map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t })}
                  className="flex-1 py-2.5 text-sm font-medium capitalize transition-all"
                  style={{
                    background: form.type === t ? (t === "income" ? "#10b981" : "#ef4444") : "var(--muted)",
                    color: form.type === t ? "white" : "var(--muted-foreground)",
                  }}>
                  {t}
                </button>
              ))}
            </div>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <input
              type="number"
              inputMode="decimal"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <select
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <button
              onClick={handleAdd}
              disabled={!form.amount || !form.description.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              Add Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
