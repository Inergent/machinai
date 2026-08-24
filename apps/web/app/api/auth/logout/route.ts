import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearedCookie } from "@/lib/session";

export async function POST() {
  const store = await cookies();
  store.set(clearedCookie);
  redirect("/");
}
