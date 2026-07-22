"use client";

import { useRef } from "react";

import { updateLeadStatus } from "@/lib/actions/leads";
import { leadStatusLabel } from "@/lib/domain";

/** Смена этапа лида прямо в таблице: submit по выбору, без отдельной кнопки. */
export function LeadStatusSelect({
  projectId,
  leadId,
  status,
  statuses,
}: {
  projectId: string;
  leadId: string;
  status: string;
  statuses: readonly string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateLeadStatus}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="lead_id" value={leadId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label="Этап лида"
        className="h-8 rounded-[9px] border border-line bg-surface px-2 text-[12px] text-ink transition hover:border-brand-200 focus:border-brand-200 focus:outline-none"
      >
        {statuses.map((value) => (
          <option key={value} value={value}>
            {leadStatusLabel(value)}
          </option>
        ))}
      </select>
    </form>
  );
}
