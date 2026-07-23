"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { autoDistribute, toggleShift, type DistributeState } from "@/lib/actions/distribution";
import { Button } from "@/components/ui/button";

/**
 * Управление раздачей на странице «Лиды».
 * РОП жмёт «Авто-раздача» — накопленные лиды уходят по кругу. Менеджер видит
 * тумблер смены: на смене — лиды приходят, ушёл — нет.
 */

const INITIAL: DistributeState = { message: null, error: null };

function DistributeButton({ unassigned }: { unassigned: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || unassigned === 0}>
      {pending ? "Раздаём…" : `Авто-раздача${unassigned > 0 ? ` · ${unassigned}` : ""}`}
    </Button>
  );
}

export function LeadOps({
  projectId,
  mayDistribute,
  unassigned,
  isManager,
  onShift,
}: {
  projectId: string;
  mayDistribute: boolean;
  unassigned: number;
  isManager: boolean;
  onShift: boolean;
}) {
  const [state, formAction] = useActionState(autoDistribute, INITIAL);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isManager ? (
        <form action={toggleShift}>
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="on_shift" value={onShift ? "0" : "1"} />
          <Button type="submit" variant={onShift ? "secondary" : "primary"} size="sm">
            {onShift ? "🔴 Уйти со смены" : "🟢 Встать на смену"}
          </Button>
        </form>
      ) : null}

      {mayDistribute ? (
        <div className="flex items-center gap-2">
          <form action={formAction}>
            <input type="hidden" name="project_id" value={projectId} />
            <DistributeButton unassigned={unassigned} />
          </form>
          {state.message ? (
            <span className="text-[12px] text-brand-700">{state.message}</span>
          ) : null}
          {state.error ? <span className="text-[12px] text-rose-600">{state.error}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
