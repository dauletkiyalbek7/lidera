/** Поля ежедневного отчёта сотрудника (РМП). Хранятся в employee_reports.content. */
export const REPORT_FIELDS = [
  {
    name: "done",
    label: "Что сделано за день",
    placeholder: "Обработал 24 лида, записал 6 на пробный урок",
    rows: 3,
    required: true,
  },
  {
    name: "numbers",
    label: "Цифры дня",
    placeholder: "Лиды: 24 · Пробные: 6 · Продажи: 2",
    rows: 2,
    required: false,
  },
  {
    name: "blockers",
    label: "Что мешало",
    placeholder: "Не дозвонился до 5 лидов, нет записи звонков",
    rows: 2,
    required: false,
  },
  {
    name: "plans",
    label: "План на завтра",
    placeholder: "Прозвонить вчерашние лиды, добить пробные",
    rows: 2,
    required: false,
  },
] as const;
