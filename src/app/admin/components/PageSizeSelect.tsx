// src/app/admin/media/components/PageSizeSelect.tsx
"use client";

export default function PageSizeSelect({
  options,
  value,
}: {
  options: number[];
  value: number;
}) {
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const url = new URL(window.location.href);
    url.searchParams.set("limit", next);
    url.searchParams.set("page", "1");
    window.location.assign(url.toString());
  }

  return (
    <label className="text-sm inline-flex items-center gap-2">
      Показывать по:
      <select className="border rounded p-1" value={String(value)} onChange={onChange}>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
