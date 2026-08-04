"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { setOfficeLocation, type OfficeState } from "@/lib/actions/attendance";
import { Button } from "@/components/ui/button";

/**
 * Геозона офиса: владелец/директор задаёт координаты и радиус. Кнопка «взять мои
 * координаты» подставляет текущее местоположение браузера — проще всего задать,
 * стоя в офисе.
 */

const INITIAL: OfficeState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Сохраняем…" : "Сохранить геозону"}
    </Button>
  );
}

export function OfficeLocationForm({
  projectId,
  lat,
  lng,
  radius,
}: {
  projectId: string;
  lat: number | null;
  lng: number | null;
  radius: number;
}) {
  const [state, formAction] = useActionState(setOfficeLocation, INITIAL);
  const [coords, setCoords] = useState({
    lat: lat != null ? String(lat) : "",
    lng: lng != null ? String(lng) : "",
  });
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const takeCurrent = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Браузер не поддерживает геолокацию.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => {
        setGeoError("Не удалось получить геолокацию. Разрешите доступ и попробуйте снова.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const inputClass =
    "h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink focus:border-brand-200 focus:outline-none";

  return (
    <form action={formAction} className="card p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Геозона офиса</h3>
          <p className="mt-1 max-w-[460px] text-[12.5px] leading-relaxed text-muted">
            Сотрудник отмечается о приходе в боте (шарит геолокацию). Если он в радиусе от
            офиса — встаёт на смену и получает лиды. Задайте точку прямо из офиса.
          </p>
        </div>
        <button
          type="button"
          onClick={takeCurrent}
          disabled={locating}
          className="shrink-0 rounded-[10px] border border-line px-3 py-1.5 text-[12px] text-muted transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-50"
        >
          {locating ? "Определяем…" : "📍 Взять мои координаты"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] text-faint">Широта (lat)</span>
          <input
            name="lat"
            required
            value={coords.lat}
            onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))}
            placeholder="43.238900"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] text-faint">Долгота (lng)</span>
          <input
            name="lng"
            required
            value={coords.lng}
            onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))}
            placeholder="76.889700"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] text-faint">Радиус, м</span>
          <input
            name="radius"
            type="number"
            min="10"
            step="10"
            required
            defaultValue={radius}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.message ? <span className="text-[12px] text-brand-700">{state.message}</span> : null}
        {state.error ? <span className="text-[12px] text-rose-600">{state.error}</span> : null}
        {geoError ? <span className="text-[12px] text-rose-600">{geoError}</span> : null}
      </div>
    </form>
  );
}
