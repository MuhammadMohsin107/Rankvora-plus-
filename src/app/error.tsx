"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="This page could not load"
      detail="Try again. If it keeps happening, go back to the portfolio."
      action={
        <div className="flex gap-2">
          <Button variant="primary" icon="refresh" onClick={reset}>Try again</Button>
          <ButtonLink href="/">Portfolio</ButtonLink>
        </div>
      }
    />
  );
}
