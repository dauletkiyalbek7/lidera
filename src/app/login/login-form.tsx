"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type AuthFormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: AuthFormState = { error: null };

const FIELD_CLASS =
  "h-11 w-full rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink " +
  "placeholder:text-faint transition focus:border-brand-200 focus:bg-surface focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Входим…" : "Войти"}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@company.kz"
          className={FIELD_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Пароль</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={FIELD_CLASS}
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[12px] bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-600"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
