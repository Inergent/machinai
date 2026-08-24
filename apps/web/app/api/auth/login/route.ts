import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { newState } from "@/lib/session";

/** Start GitHub's user-to-server OAuth using the same App that gets webhooks. */
export async function GET(request: Request) {
  const clientId = process.env.GH_CLIENT_ID;
  if (!clientId) {
    return new Response("GH_CLIENT_ID is not configured", { status: 503 });
  }

  const state = newState();
  const store = await cookies();
  // Short-lived and httpOnly: it exists only to survive the round trip to
  // GitHub and prove the callback answers a request we made.
  store.set({
    name: "machinai_oauth_state",
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "redirect_uri",
    new URL("/api/auth/callback", request.url).toString(),
  );

  redirect(url.toString());
}
