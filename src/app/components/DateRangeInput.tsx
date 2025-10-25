"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { ru } from "date-fns/locale";
import "react-day-picker/dist/style.css";

type Props = {
  from?: string;
  to?: string;
  nameFrom?: string;
  nameTo?: string;
  className?: string;
  inputClassName?: string;
  label?: string;
  placeholder?: string;
};

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtRU(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

export default function DateRangeInput({
  from,
  to,
  nameFrom = "from",
  nameTo = "to",
  className = "",
  inputClassName = "",
  label = "Дата",
  placeholder = "Выберите дату или период",
}: Props) {
  const initFrom = parseISO(from);
  const initTo = parseISO(to);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() =>
    initFrom ? { from: initFrom, to: initTo ?? initFrom } : undefined
  );
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keyup", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keyup", onEsc);
    };
  }, []);

  const display = useMemo(() => {
    if (!range?.from) return "";
    if (!range.to) return fmtRU(range.from);
    if (range.from.getTime() === range.to.getTime()) return fmtRU(range.from);
    return `${fmtRU(range.from)} — ${fmtRU(range.to)}`;
  }, [range]);

  const isoFrom = range?.from ? toISO(range.from) : "";
  const isoTo = range?.to ? toISO(range.to) : isoFrom;

  return (
    <div className={className} ref={boxRef}>
      <label className="mb-1 block text-xs text-neutral-600">{label}</label>
      <div className="relative">
        <input
          readOnly
          value={display}
          placeholder={placeholder}
          onClick={() => setOpen((v) => !v)}
          className={`w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-600 ${inputClassName}`}
        />
        {display && (
          <button
            type="button"
            onClick={() => setRange(undefined)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Очистить"
          >
            ×
          </button>
        )}
        <input type="hidden" name={nameFrom} value={isoFrom} />
        <input type="hidden" name={nameTo} value={isoTo} />

        {open && (
          <div className="absolute z-50 mt-2 w-[320px] rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
            <DayPicker
              mode="range"
              locale={ru}
              selected={range}
              onSelect={(v) => setRange(v ? { from: v.from ?? undefined, to: v.to ?? v.from ?? undefined } : undefined)}
              defaultMonth={range?.from ?? new Date()}
              showOutsideDays
              numberOfMonths={1}
              footer={
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRange(undefined)}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-neutral-300 hover:bg-neutral-100"
                  >
                    Сбросить
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
                  >
                    Готово
                  </button>
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
