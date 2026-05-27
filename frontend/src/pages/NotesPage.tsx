import { useCallback, useEffect, useState } from "react";
import { api, Note } from "../api";

type Filter = "all" | "active" | "done";

export default function NotesPage({ userId }: { userId: number }) {
  const [filter, setFilter] = useState<Filter>("active");
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.listNotes(userId, filter).then(setNotes).catch((e) => setError(e.message));
  }, [userId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setError("");
    try {
      await api.createNote(userId, title, content);
      setTitle("");
      setContent("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "新增失敗");
    }
  };

  const toggle = async (note: Note) => {
    await api.updateNote(userId, note.id, { completed: !note.completed });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("確定刪除這則記事？")) return;
    await api.deleteNote(userId, id);
    load();
  };

  return (
    <div className="card">
      <h2>日常記事</h2>
      <div className="tabs">
        {(["active", "all", "done"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`tab${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "active" ? "未完成" : f === "done" ? "已完成" : "全部"}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="標題（可留空）"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        placeholder="內容"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button className="btn" type="button" onClick={add} disabled={!title.trim() && !content.trim()}>
        新增
      </button>
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: "1rem" }}>
        {notes.map((n) => (
          <div key={n.id} className={`note-item${n.completed ? " done" : ""}`}>
            <input type="checkbox" checked={n.completed} onChange={() => toggle(n)} />
            <div style={{ flex: 1 }}>
              <div className="note-title">{n.title || "（無標題）"}</div>
              {n.content && <div className="sub">{n.content}</div>}
            </div>
            <button type="button" className="btn danger" onClick={() => remove(n.id)}>
              刪除
            </button>
          </div>
        ))}
        {notes.length === 0 && <p className="sub">沒有項目</p>}
      </div>
    </div>
  );
}
