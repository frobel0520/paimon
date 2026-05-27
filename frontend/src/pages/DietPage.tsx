import { useCallback, useEffect, useState } from "react";
import { api, Meal, WheelOption } from "../api";

function WheelSection({
  userId,
  type,
  title,
}: {
  userId: number;
  type: "food" | "drink";
  title: string;
}) {
  const [options, setOptions] = useState<WheelOption[]>([]);
  const [label, setLabel] = useState("");
  const [result, setResult] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.listWheelOptions(userId, type).then(setOptions).catch((e) => setError(e.message));
  }, [userId, type]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setError("");
    try {
      await api.addWheelOption(userId, type, label);
      setLabel("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "新增失敗");
    }
  };

  const remove = async (id: number) => {
    await api.deleteWheelOption(userId, type, id);
    load();
  };

  const spin = async () => {
    setSpinning(true);
    setResult("…");
    try {
      const r = await api.spin(userId, type);
      setTimeout(() => {
        setResult(r.label);
        setSpinning(false);
      }, 400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法轉動");
      setSpinning(false);
      setResult("");
    }
  };

  return (
    <div className="card">
      <h2>{title}</h2>
      <div className={`wheel-display${spinning ? " spinning" : ""}`}>
        {result || "按下轉動"}
      </div>
      <button className="btn" type="button" onClick={spin} disabled={options.length === 0}>
        轉輪盤
      </button>
      <input
        type="text"
        placeholder="新增選項"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        style={{ marginTop: "0.75rem" }}
      />
      <button className="btn secondary" type="button" onClick={add} disabled={!label.trim()}>
        加入選項
      </button>
      {error && <p className="error">{error}</p>}
      {options.map((o) => (
        <div key={o.id} className="option-item">
          <span style={{ flex: 1 }}>{o.label}</span>
          <button type="button" className="btn danger" onClick={() => remove(o.id)}>
            刪除
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DietPage({ userId }: { userId: number }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const loadMeals = useCallback(() => {
    api.listMeals(userId).then(setMeals).catch((e) => setError(e.message));
  }, [userId]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const addMeal = async () => {
    try {
      await api.addMeal(userId, text);
      setText("");
      loadMeals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "新增失敗");
    }
  };

  const removeMeal = async (id: number) => {
    await api.deleteMeal(userId, id);
    loadMeals();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <>
      <WheelSection userId={userId} type="food" title="食物輪盤" />
      <WheelSection userId={userId} type="drink" title="飲料輪盤" />
      <div className="card">
        <h2>這陣子吃過什麼</h2>
        <input
          type="text"
          placeholder="例如：滷肉飯 + 珍珠奶茶"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" type="button" onClick={addMeal} disabled={!text.trim()}>
          記錄
        </button>
        {error && <p className="error">{error}</p>}
        {meals.map((m) => (
          <div key={m.id} className="meal-item">
            <div style={{ flex: 1 }}>
              <div>{m.text}</div>
              <div className="sub">{formatDate(m.eaten_at)}</div>
            </div>
            <button type="button" className="btn danger" onClick={() => removeMeal(m.id)}>
              刪除
            </button>
          </div>
        ))}
        {meals.length === 0 && <p className="sub">尚無紀錄</p>}
      </div>
    </>
  );
}
