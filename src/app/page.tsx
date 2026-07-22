import { redirect } from "next/navigation";

/** Корень ведёт в портал «Мои проекты»; гостя перехватывает proxy.ts. */
export default function RootPage() {
  redirect("/projects");
}
