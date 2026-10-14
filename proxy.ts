import { NextResponse, type NextRequest } from "next/server";
import { isLang, pickLang } from "@/lib/langs";

// Första besöket på "/" går till användarens språk: tidigare val (cookie "lang"), annars webbläsarens
// språk (Accept-Language), annars svenska. Resten av sidorna ligger redan under /<språk>.
export function proxy(req: NextRequest) {
  const saved = req.cookies.get("lang")?.value;
  const lang = isLang(saved) ? saved : (pickLang(req.headers.get("accept-language")) ?? "sv");
  return NextResponse.redirect(new URL(`/${lang}`, req.url));
}

export const config = { matcher: "/" };
