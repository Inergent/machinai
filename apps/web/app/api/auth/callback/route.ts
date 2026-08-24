import { cookies } from "next/headers";
import { expiry, isAllowed, sessionCookie } from "@/lib/session";

/** Exchange the OAuth code for a user identity, then start a session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expected = store.get("machinai_oauth_state")?.value;
  store.delete("machinai_oauth_state");

  // Without this check, an attacker can complete a login the user never began.
  if (!state || !expected || state !== expected) {
    return deny("This sign-in did not come from a request machinai made.");
  }
  if (!code) return deny("GitHub did not return an authorization code.");

  const clientId = process.env.GH_CLIENT_ID;
  const clientSecret = process.env.GH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return deny("GitHub OAuth is not configured.");
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const token = (await tokenRes.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!token.access_token) {
    return deny(token.error_description ?? "GitHub refused the code exchange.");
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${token.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "machinai",
    },
  });
  if (!userRes.ok) return deny("Could not read your GitHub profile.");
  const user = (await userRes.json()) as { login: string; avatar_url: string };

  if (!isAllowed(user.login)) {
    return deny(
      `Signed in as ${user.login}, who is not on this instance's allowlist.`,
    );
  }

  // The GitHub token is deliberately not kept. Every read machinai does uses
  // the App's installation token, so a stolen session cookie cannot be turned
  // into access to the user's other repositories.
  store.set(
    sessionCookie({
      login: user.login,
      avatarUrl: user.avatar_url,
      exp: expiry(),
    }),
  );

  return Response.redirect(new URL("/", request.url), 303);
}

function deny(reason: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Sign-in failed</title>
     <style>body{background:#0b0d12;color:#e6e9ef;font:16px/1.6 ui-sans-serif,system-ui,sans-serif;
     display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
     div{max-width:30rem}h1{font-size:1.35rem;margin:0 0 .5rem}p{color:#8b93a7}
     a{color:#4c7dff}</style>
     <div><h1>Sign-in failed</h1><p>${reason}</p><p><a href="/api/auth/login">Try again</a></p></div>`,
    { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
