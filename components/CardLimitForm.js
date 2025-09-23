// components/CardLimitForm.js
import React from "react";

const DEFAULTS = {
  Housing: 5000,
  Youth: 3000,
};

export function CardLimitForm({ limits, setLimits }) {
  const onChange = (k, v) => {
    const n = Number(v);
    setLimits((cur) => {
      const next = { ...cur, [k]: Number.isFinite(n) ? n : 0 };
      localStorage.setItem("cc-limits", JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {Object.keys({ Housing: 0, Youth: 0 }).map((k) => (
        <label key={k} className="flex items-center gap-2">
          <span className="w-28">{k} limit</span>
          <input
            type="number"
            className="border rounded px-2 py-1 w-40"
            value={limits[k] ?? DEFAULTS[k]}
            onChange={(e) => onChange(k, e.target.value)}
            step="0.01"
            min="0"
          />
        </label>
      ))}
    </div>
  );
}

export function useCardLimits() {
  const [limits, setLimits] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("cc-limits") || "{}");
    } catch {
      return {};
    }
  });
  React.useEffect(() => {
    if (!localStorage.getItem("cc-limits")) {
      localStorage.setItem(
        "cc-limits",
        JSON.stringify({ Housing: 5000, Youth: 3000 })
      );
      setLimits({ Housing: 5000, Youth: 3000 });
    }
  }, []);
  return [limits, setLimits];
}
