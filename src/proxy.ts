import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Маршруты, доступные без входа.
 * /api/intake и /api/webhooks — приём заявок с сайтов, событий чат-бота и Telegram:
 * там свой токен вместо сессии, и редирект на /login сломал бы интеграцию у клиента.
 *
 * На Vercel этого мало: если включить Deployment Protection, до маршрута
 * запрос вообще не дойдёт. Смотри README, раздел «Деплой».
 */
const PUBLIC_ROUTES = ["/login", "/api/intake", "/api/webhooks"];

/**
 * Обновляет сессию Supabase на каждом запросе и не пускает гостя в кабинет.
 * Полноценная проверка прав — всё равно в RLS и на страницах (ТЗ, раздел 3).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Подпись токена проверяется локально по ключам проекта — без похода в Supabase на каждый
  // запрос. Сессия при этом продлевается, а полноценная проверка прав живёт в RLS и страницах.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? claims.claims : null;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(loginUrl);
  }

  // Вошедшего уводим с экрана входа, но не с приёма заявок:
  // тот же браузер может отправлять форму сайта, и редирект её сломает.
  if (user && isPublic && pathname.startsWith("/login")) {
    const portalUrl = request.nextUrl.clone();
    portalUrl.pathname = "/projects";
    portalUrl.search = "";
    return NextResponse.redirect(portalUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
