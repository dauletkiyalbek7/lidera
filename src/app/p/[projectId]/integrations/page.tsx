import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { hasSecretsKey } from "@/lib/crypto";
import { disconnectIntegration } from "@/lib/actions/integrations";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations";
import { sectionBlockTitle } from "@/lib/navigation";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import { loadIntegrations } from "@/lib/queries/integrations";

import { ConnectIntegrationDialog } from "./connect-dialog";

/** Интеграции: что подключено и что нет (ТЗ, Блок 4). Секреты остаются на сервере. */
export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ role, canManage }, integrations] = await Promise.all([
    requireSectionAccess(projectId, "integrations"),
    loadIntegrations(projectId),
  ]);

  const mayManage = canManage || role === "director";
  const serverReady = hasSecretsKey() && hasServiceRoleKey();

  const stateByProvider = new Map(integrations.map((row) => [row.provider, row]));
  const connectedCount = integrations.filter((row) => row.status === "connected").length;

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("integrations")}
        title="Интеграции"
        subtitle={`Подключено ${formatNumber(connectedCount)} из ${formatNumber(INTEGRATION_PROVIDERS.length)} ${plural(INTEGRATION_PROVIDERS.length, ["сервиса", "сервисов", "сервисов"])}`}
      />

      <section className="card mt-6 flex items-start gap-4 p-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-50 text-brand">
          <Icon name="shield" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-ink">Ключи не покидают сервер</h2>
          <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
            Токены шифруются алгоритмом AES-256-GCM и лежат в отдельной таблице, к которой у
            браузера нет доступа вообще: на ней включён RLS и не заведено ни одной политики.
            Платформа умеет только заменить ключ — показать сохранённый она не может.
          </p>
          {!serverReady ? (
            <p className="mt-2.5 rounded-[10px] bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
              Сервер не готов принимать ключи: не заданы{" "}
              {[
                hasSecretsKey() ? null : "LIDERA_SECRETS_KEY",
                hasServiceRoleKey() ? null : "SUPABASE_SERVICE_ROLE_KEY",
              ]
                .filter(Boolean)
                .join(" и ")}
              . Добавьте их в переменные окружения.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {INTEGRATION_PROVIDERS.map((provider) => {
          const state = stateByProvider.get(provider.key);
          const connected = state?.status === "connected";

          return (
            <CardSection
              key={provider.key}
              title={provider.title}
              hint={provider.summary}
              icon={provider.icon}
              action={
                <Badge tone={connected ? "positive" : "muted"}>
                  {connected ? "Подключено" : "Не подключено"}
                </Badge>
              }
            >
              <dl className="flex flex-col gap-2.5 text-[13px]">
                {provider.accountLabel ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-faint">{provider.accountLabel}</dt>
                    <dd className="tabular truncate text-ink">{state?.account ?? "—"}</dd>
                  </div>
                ) : null}

                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-faint">{provider.secretLabel}</dt>
                  <dd className="tabular text-ink">
                    {connected ? (state?.hint ?? "сохранён") : "не сохранён"}
                  </dd>
                </div>

                {state?.secretUpdatedAt ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-faint">Обновлён</dt>
                    <dd className="text-muted">{formatDate(state.secretUpdatedAt)}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  Что оживёт
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {provider.powers.map((item) => (
                    <li key={item}>
                      <Badge tone="neutral">{item}</Badge>
                    </li>
                  ))}
                </ul>
              </div>

              {mayManage ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <ConnectButton
                    projectId={projectId}
                    provider={provider}
                    connected={connected}
                    account={state?.account ?? null}
                    disabled={!serverReady}
                  />
                  {connected ? (
                    <form action={disconnectIntegration}>
                      <input type="hidden" name="project_id" value={projectId} />
                      <input type="hidden" name="provider" value={provider.key} />
                      <Button type="submit" size="sm" variant="danger">
                        Отключить
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 border-t border-line pt-4 text-[12px] text-faint">
                  Подключением занимается директор проекта.
                </p>
              )}
            </CardSection>
          );
        })}
      </div>
    </main>
  );
}

/** Кнопка подключения: пока сервер не готов, показываем причину вместо неработающей формы. */
function ConnectButton({
  projectId,
  provider,
  connected,
  account,
  disabled,
}: {
  projectId: string;
  provider: (typeof INTEGRATION_PROVIDERS)[number];
  connected: boolean;
  account: string | null;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span className="text-[12px] text-faint">
        Подключение недоступно, пока на сервере нет ключей шифрования.
      </span>
    );
  }

  return (
    <ConnectIntegrationDialog
      projectId={projectId}
      provider={{
        key: provider.key,
        title: provider.title,
        secretLabel: provider.secretLabel,
        secretPlaceholder: provider.secretPlaceholder,
        accountLabel: provider.accountLabel,
        accountPlaceholder: provider.accountPlaceholder,
        where: provider.where,
      }}
      connected={connected}
      currentAccount={account}
    />
  );
}
