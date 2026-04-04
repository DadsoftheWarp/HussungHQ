"use client";

import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { TodoList, TodoItem } from "@/types";
import { Plus, X, Trash2, CheckCircle2, Circle, ChevronRight, ArrowLeft, RefreshCw } from "lucide-react";

export default function TodosPage() {
  const { familyId, user } = useAuth();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [selectedList, setSelectedList] = useState<TodoList | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newItemText, setNewItemText] = useState("");

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "todoLists"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TodoList)));
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "todoItems"), orderBy("createdAt"));
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TodoItem)));
    });
  }, [familyId]);

  const handleCreateList = async () => {
    if (!newListName.trim() || !familyId || !user) return;
    await addDoc(collection(db, "families", familyId, "todoLists"), {
      name: newListName.trim(),
      createdBy: user.uid,
      shared: true,
    });
    setNewListName("");
    setShowNewList(false);
  };

  const handleDeleteList = async (listId: string) => {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "todoLists", listId));
    // Delete all items in list
    const listItems = items.filter((i) => i.listId === listId);
    await Promise.all(listItems.map((i) => deleteDoc(doc(db, "families", familyId!, "todoItems", i.id))));
    if (selectedList?.id === listId) setSelectedList(null);
  };

  const handleAddItem = async () => {
    if (!newItemText.trim() || !selectedList || !familyId || !user) return;
    await addDoc(collection(db, "families", familyId, "todoItems"), {
      listId: selectedList.id,
      text: newItemText.trim(),
      completed: false,
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
    });
    setNewItemText("");
  };

  const handleToggleItem = async (item: TodoItem) => {
    if (!familyId) return;
    await updateDoc(doc(db, "families", familyId, "todoItems", item.id), {
      completed: !item.completed,
    });
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!familyId) return;
    await deleteDoc(doc(db, "families", familyId, "todoItems", itemId));
  };

  const handleResetList = async () => {
    if (!familyId || !selectedList) return;
    await Promise.all(
      completedItems.map((item) =>
        updateDoc(doc(db, "families", familyId!, "todoItems", item.id), { completed: false })
      )
    );
  };

  const listItems = selectedList ? items.filter((i) => i.listId === selectedList.id) : [];
  const activeItems = listItems.filter((i) => !i.completed);
  const completedItems = listItems.filter((i) => i.completed);

  if (selectedList) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedList(null)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--muted)" }}>
            <ArrowLeft className="w-5 h-5" style={{ color: "var(--foreground)" }} />
          </button>
          <h2 className="font-semibold text-lg flex-1" style={{ color: "var(--foreground)" }}>{selectedList.name}</h2>
          {completedItems.length > 0 && (
            <button onClick={handleResetList} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}>
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>

        {/* Add item input */}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
            placeholder="Add a task..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <button onClick={handleAddItem} disabled={!newItemText.trim()}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
            style={{ background: "var(--primary)" }}>
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Active items */}
        <div className="space-y-2">
          {activeItems.length === 0 && completedItems.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>No tasks yet</p>
          )}
          {activeItems.map((item) => (
            <div key={item.id} className="rounded-xl border p-3 flex items-center gap-3"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <button onClick={() => handleToggleItem(item)}>
                <Circle className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              </button>
              <p className="flex-1 text-sm" style={{ color: "var(--foreground)" }}>{item.text}</p>
              <button onClick={() => handleDeleteItem(item.id)} style={{ background: "var(--muted)" }} className="p-1.5 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          ))}
        </div>

        {/* Completed */}
        {completedItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Completed ({completedItems.length})</p>
            {completedItems.map((item) => (
              <div key={item.id} className="rounded-xl border p-3 flex items-center gap-3 opacity-60"
                style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <button onClick={() => handleToggleItem(item)}>
                  <CheckCircle2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </button>
                <p className="flex-1 text-sm line-through" style={{ color: "var(--muted-foreground)" }}>{item.text}</p>
                <button onClick={() => handleDeleteItem(item.id)} style={{ background: "var(--muted)" }} className="p-1.5 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>To-Do Lists</h2>
        <button onClick={() => setShowNewList(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white"
          style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> New List
        </button>
      </div>

      {lists.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>
          No lists yet — create one to get started
        </p>
      )}

      <div className="space-y-2">
        {lists.map((list) => {
          const listItemCount = items.filter((i) => i.listId === list.id).length;
          const completedCount = items.filter((i) => i.listId === list.id && i.completed).length;
          return (
            <div key={list.id} className="rounded-xl border p-4 flex items-center gap-3"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <button onClick={() => setSelectedList(list)} className="flex-1 flex items-center gap-3 text-left">
                <div>
                  <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{list.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {completedCount}/{listItemCount} tasks
                  </p>
                </div>
              </button>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <button onClick={() => handleDeleteList(list.id)} style={{ background: "var(--muted)" }} className="p-1.5 rounded-lg flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          );
        })}
      </div>

      {showNewList && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowNewList(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 space-y-4"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>New List</h3>
              <button onClick={() => setShowNewList(false)}><X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} /></button>
            </div>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="List name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
              autoFocus
            />
            <button onClick={handleCreateList} disabled={!newListName.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              Create List
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
