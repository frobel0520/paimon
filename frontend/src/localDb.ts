import type { Meal, Modules, Note, User, WheelOption } from "./api";

const DB_KEY = "paimon_db_v1";

const DEFAULT_MODULES: Modules = {
  diet: true,
  games: false,
  notes: true,
  work: false,
};

const DEFAULT_FOOD = ["滷肉飯", "牛肉麵", "便當", "水餃", "披薩"];
const DEFAULT_DRINK = ["手搖茶", "咖啡", "可樂", "氣泡水", "豆漿"];

type DbShape = {
  users: User[];
  modules: Record<number, Modules>;
  notes: Note[];
  wheelOptions: Array<WheelOption & { user_id: number; wheel_type: "food" | "drink" }>;
  meals: Array<Meal & { user_id: number }>;
  nextUserId: number;
  nextNoteId: number;
  nextWheelId: number;
  nextMealId: number;
};

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function loadDb(): DbShape {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    return {
      users: [],
      modules: {},
      notes: [],
      wheelOptions: [],
      meals: [],
      nextUserId: 1,
      nextNoteId: 1,
      nextWheelId: 1,
      nextMealId: 1,
    };
  }
  return JSON.parse(raw) as DbShape;
}

function saveDb(db: DbShape): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function ensureModules(db: DbShape, userId: number): Modules {
  if (!db.modules[userId]) {
    db.modules[userId] = { ...DEFAULT_MODULES };
  }
  return db.modules[userId];
}

function seedWheels(db: DbShape, userId: number): void {
  for (const label of DEFAULT_FOOD) {
    db.wheelOptions.push({
      id: db.nextWheelId++,
      user_id: userId,
      wheel_type: "food",
      label,
    });
  }
  for (const label of DEFAULT_DRINK) {
    db.wheelOptions.push({
      id: db.nextWheelId++,
      user_id: userId,
      wheel_type: "drink",
      label,
    });
  }
}

export const localDb = {
  listUsers(): User[] {
    const db = loadDb();
    return [...db.users].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  },

  createUser(name: string): User {
    const db = loadDb();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");
    if (db.users.some((u) => u.name === trimmed)) {
      throw new Error("Profile name already exists");
    }
    const user: User = {
      id: db.nextUserId++,
      name: trimmed,
      created_at: nowIso(),
    };
    db.users.push(user);
    ensureModules(db, user.id);
    seedWheels(db, user.id);
    saveDb(db);
    return user;
  },

  getModules(userId: number): Modules {
    const db = loadDb();
    if (!db.users.some((u) => u.id === userId)) throw new Error("User not found");
    return { ...ensureModules(db, userId) };
  },

  patchModules(userId: number, body: Partial<Modules>): Modules {
    const db = loadDb();
    if (!db.users.some((u) => u.id === userId)) throw new Error("User not found");
    const mods = ensureModules(db, userId);
    for (const key of Object.keys(body) as (keyof Modules)[]) {
      const val = body[key];
      if (val === undefined) continue;
      if ((key === "games" || key === "work") && val) {
        throw new Error(`Module '${key}' is not available until Sprint 2`);
      }
      mods[key] = val;
    }
    saveDb(db);
    return { ...mods };
  },

  listNotes(userId: number, filter: "all" | "active" | "done"): Note[] {
    const db = loadDb();
    let list = db.notes.filter((n) => n.user_id === userId);
    if (filter === "active") list = list.filter((n) => !n.completed);
    if (filter === "done") list = list.filter((n) => n.completed);
    return list
      .map(({ user_id: _, ...n }) => n)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  createNote(userId: number, title: string, content: string): Note {
    const db = loadDb();
    const t = nowIso();
    const note: Note & { user_id: number } = {
      id: db.nextNoteId++,
      user_id: userId,
      title: title.trim(),
      content: content.trim(),
      completed: false,
      created_at: t,
      updated_at: t,
    };
    db.notes.push(note);
    saveDb(db);
    const { user_id: _, ...out } = note;
    return out;
  },

  updateNote(
    userId: number,
    noteId: number,
    body: Partial<Pick<Note, "title" | "content" | "completed">>
  ): Note {
    const db = loadDb();
    const note = db.notes.find((n) => n.id === noteId && n.user_id === userId);
    if (!note) throw new Error("Note not found");
    if (body.title !== undefined) note.title = body.title.trim();
    if (body.content !== undefined) note.content = body.content.trim();
    if (body.completed !== undefined) note.completed = body.completed;
    note.updated_at = nowIso();
    saveDb(db);
    const { user_id: _, ...out } = note;
    return out;
  },

  deleteNote(userId: number, noteId: number): void {
    const db = loadDb();
    const idx = db.notes.findIndex((n) => n.id === noteId && n.user_id === userId);
    if (idx < 0) throw new Error("Note not found");
    db.notes.splice(idx, 1);
    saveDb(db);
  },

  listWheelOptions(userId: number, type: "food" | "drink"): WheelOption[] {
    const db = loadDb();
    return db.wheelOptions
      .filter((o) => o.user_id === userId && o.wheel_type === type)
      .map(({ id, label }) => ({ id, label }));
  },

  addWheelOption(userId: number, type: "food" | "drink", label: string): WheelOption {
    const db = loadDb();
    const trimmed = label.trim();
    if (
      db.wheelOptions.some(
        (o) => o.user_id === userId && o.wheel_type === type && o.label === trimmed
      )
    ) {
      throw new Error("Option already exists");
    }
    const opt = {
      id: db.nextWheelId++,
      user_id: userId,
      wheel_type: type,
      label: trimmed,
    };
    db.wheelOptions.push(opt);
    saveDb(db);
    return { id: opt.id, label: opt.label };
  },

  deleteWheelOption(userId: number, type: "food" | "drink", optionId: number): void {
    const db = loadDb();
    const idx = db.wheelOptions.findIndex(
      (o) => o.id === optionId && o.user_id === userId && o.wheel_type === type
    );
    if (idx < 0) throw new Error("Option not found");
    db.wheelOptions.splice(idx, 1);
    saveDb(db);
  },

  spin(userId: number, type: "food" | "drink"): { label: string } {
    const opts = this.listWheelOptions(userId, type);
    if (opts.length === 0) throw new Error("Add at least one option before spinning");
    const pick = opts[Math.floor(Math.random() * opts.length)];
    return { label: pick.label };
  },

  listMeals(userId: number): Meal[] {
    const db = loadDb();
    return db.meals
      .filter((m) => m.user_id === userId)
      .map(({ user_id: _, ...m }) => m)
      .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at));
  },

  addMeal(userId: number, text: string): Meal {
    const db = loadDb();
    const meal: Meal & { user_id: number } = {
      id: db.nextMealId++,
      user_id: userId,
      text: text.trim(),
      eaten_at: nowIso(),
    };
    db.meals.push(meal);
    saveDb(db);
    const { user_id: _, ...out } = meal;
    return out;
  },

  deleteMeal(userId: number, mealId: number): void {
    const db = loadDb();
    const idx = db.meals.findIndex((m) => m.id === mealId && m.user_id === userId);
    if (idx < 0) throw new Error("Meal not found");
    db.meals.splice(idx, 1);
    saveDb(db);
  },
};
