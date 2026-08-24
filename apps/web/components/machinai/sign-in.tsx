import { Button } from "@/components/ui/button";
import { Page } from "./shell";
import { Panel } from "./pieces";

export function SignInPrompt() {
  return (
    <Page title="machinai" lead="Describe it. Walk away. Come back to a pull request.">
      <Panel className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in with the GitHub account this instance is configured for.
        </p>
        <Button className="mt-5" asChild>
          <a href="/api/auth/login">Continue with GitHub</a>
        </Button>
      </Panel>
    </Page>
  );
}
