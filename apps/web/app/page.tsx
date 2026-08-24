import { IdeaScreen } from "@/components/machinai/idea-screen";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;
  return <IdeaScreen />;
}
