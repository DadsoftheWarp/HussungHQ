export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  familyId?: string;
}

export interface FamilyMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  color: string; // for calendar color coding
}

// Calendar
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string
  endDate?: string;
  time?: string;
  endTime?: string;
  allDay: boolean;
  description?: string;
  createdBy: string;
  color?: string;
  recurring?: "none" | "weekly" | "biweekly" | "monthly" | "yearly";
  source?: "app" | "google";      // where the event came from
  googleEventId?: string;         // Google Calendar event id
  syncedBy?: string;              // uid of the user who synced it
}

// Budget
export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense";
  date: string;
  createdBy: string;
}

export const BUDGET_CATEGORIES = [
  "Housing",
  "Groceries",
  "Dining Out",
  "Transportation",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Clothing",
  "Personal Care",
  "Savings",
  "Income",
  "Other",
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

// Todos
export interface TodoList {
  id: string;
  name: string;
  createdBy: string;
  shared: boolean;
}

export interface TodoItem {
  id: string;
  listId: string;
  text: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: string;
  createdBy: string;
  createdAt: string;
}

// Goals
export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  progress: number; // 0-100
  milestones: Milestone[];
  createdBy: string;
  completed: boolean;
  color: string;
}

export interface Milestone {
  id: string;
  text: string;
  completed: boolean;
}

export const GOAL_CATEGORIES = [
  "Home Improvement",
  "Finances",
  "Health & Fitness",
  "Family",
  "Garden",
  "Other",
] as const;

// Chores
export type ChoreFrequency = "weekly" | "biweekly" | "monthly";

export interface Chore {
  id: string;
  title: string;
  description?: string;
  frequency: ChoreFrequency;
  assignedTo?: string; // uid, or undefined for anyone
  completions: ChoreCompletion[];
  lastResetDate: string; // ISO date string
  nextResetDate: string; // ISO date string
  createdBy: string;
}

export interface ChoreCompletion {
  completedBy: string;
  completedAt: string;
}

// Meals
export interface MealPlan {
  id: string;
  weekStartDate: string; // Monday ISO date
  days: MealDay[];
}

export interface MealDay {
  date: string;
  breakfast?: Meal;
  lunch?: Meal;
  dinner?: Meal;
  snack?: Meal;
}

export interface Meal {
  name: string;
  notes?: string;
  prepTime?: number; // minutes
  calories?: number;
  prepDay?: string; // when to prep this ahead of time
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  checked: boolean;
  weekStartDate: string;
}
