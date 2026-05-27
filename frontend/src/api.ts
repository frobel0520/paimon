import { localDb } from "./localDb";

export type User = { id: number; name: string; created_at: string };
export type Modules = { diet: boolean; games: boolean; notes: boolean; work: boolean };
export type Note = {
  id: number;
  title: string;
  content: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id?: number;
};
export type WheelOption = { id: number; label: string };
export type Meal = { id: number; text: string; eaten_at: string; user_id?: number };

/** GitHub Pages 使用 local；本機開發預設連後端 API */
export const useLocalStorage =
  import.meta.env.VITE_STORAGE_MODE === "local";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const remoteApi = {
  listUsers: () => request<User[]>("/api/users"),
  createUser: (name: string) =>
    request<User>("/api/users", { method: "POST", body: JSON.stringify({ name }) }),
  getModules: (userId: number) => request<Modules>(`/api/users/${userId}/modules`),
  patchModules: (userId: number, body: Partial<Modules>) =>
    request<Modules>(`/api/users/${userId}/modules`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listNotes: (userId: number, filter: "all" | "active" | "done") =>
    request<Note[]>(`/api/users/${userId}/notes?filter=${filter}`),
  createNote: (userId: number, title: string, content: string) =>
    request<Note>(`/api/users/${userId}/notes`, {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),
  updateNote: (userId: number, noteId: number, body: Partial<Note>) =>
    request<Note>(`/api/users/${userId}/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteNote: (userId: number, noteId: number) =>
    request<void>(`/api/users/${userId}/notes/${noteId}`, { method: "DELETE" }),
  listWheelOptions: (userId: number, type: "food" | "drink") =>
    request<WheelOption[]>(`/api/users/${userId}/diet/wheels/${type}/options`),
  addWheelOption: (userId: number, type: "food" | "drink", label: string) =>
    request<WheelOption>(`/api/users/${userId}/diet/wheels/${type}/options`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  deleteWheelOption: (userId: number, type: "food" | "drink", optionId: number) =>
    request<void>(`/api/users/${userId}/diet/wheels/${type}/options/${optionId}`, {
      method: "DELETE",
    }),
  spin: (userId: number, type: "food" | "drink") =>
    request<{ label: string }>(`/api/users/${userId}/diet/wheels/${type}/spin`, {
      method: "POST",
    }),
  listMeals: (userId: number) => request<Meal[]>(`/api/users/${userId}/diet/meals`),
  addMeal: (userId: number, text: string) =>
    request<Meal>(`/api/users/${userId}/diet/meals`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  deleteMeal: (userId: number, mealId: number) =>
    request<void>(`/api/users/${userId}/diet/meals/${mealId}`, { method: "DELETE" }),
};

const localApi = {
  listUsers: async () => localDb.listUsers(),
  createUser: async (name: string) => localDb.createUser(name),
  getModules: async (userId: number) => localDb.getModules(userId),
  patchModules: async (userId: number, body: Partial<Modules>) =>
    localDb.patchModules(userId, body),
  listNotes: async (userId: number, filter: "all" | "active" | "done") =>
    localDb.listNotes(userId, filter),
  createNote: async (userId: number, title: string, content: string) =>
    localDb.createNote(userId, title, content),
  updateNote: async (userId: number, noteId: number, body: Partial<Note>) =>
    localDb.updateNote(userId, noteId, body),
  deleteNote: async (userId: number, noteId: number) => {
    localDb.deleteNote(userId, noteId);
  },
  listWheelOptions: async (userId: number, type: "food" | "drink") =>
    localDb.listWheelOptions(userId, type),
  addWheelOption: async (userId: number, type: "food" | "drink", label: string) =>
    localDb.addWheelOption(userId, type, label),
  deleteWheelOption: async (userId: number, type: "food" | "drink", optionId: number) => {
    localDb.deleteWheelOption(userId, type, optionId);
  },
  spin: async (userId: number, type: "food" | "drink") => localDb.spin(userId, type),
  listMeals: async (userId: number) => localDb.listMeals(userId),
  addMeal: async (userId: number, text: string) => localDb.addMeal(userId, text),
  deleteMeal: async (userId: number, mealId: number) => {
    localDb.deleteMeal(userId, mealId);
  },
};

export const api = useLocalStorage ? localApi : remoteApi;
