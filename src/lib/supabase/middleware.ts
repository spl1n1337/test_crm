import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/confirm",
  "/confirm-password",
  "/forgot",
  "/reset-password",
  "/blocked",
];

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/api/")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_blocked && pathname !== "/blocked") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/blocked";
      return NextResponse.redirect(redirect);
    }

    const meta = user.user_metadata as { is_approved?: boolean } | undefined;
    const waiting =
      Boolean(profile) &&
      profile?.is_blocked === false &&
      (profile?.is_approved === false || meta?.is_approved === false);
    if (waiting && pathname !== "/pending" && pathname !== "/blocked" && !isPublic(pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/pending";
      return NextResponse.redirect(redirect);
    }

    if (profile?.is_approved && (pathname === "/pending" || pathname === "/login" || pathname === "/register")) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/objects";
      return NextResponse.redirect(redirect);
    }

    if (!waiting && (pathname === "/login" || pathname === "/register") && profile && !profile.is_blocked) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/objects";
      return NextResponse.redirect(redirect);
    }

    if (pathname.startsWith("/admin") && profile?.role !== "admin") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/objects";
      return NextResponse.redirect(redirect);
    }
  }

  return supabaseResponse;
}
