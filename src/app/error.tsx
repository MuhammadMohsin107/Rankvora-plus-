"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";

type ErrorProps = {
  error: unknown;
  /** Re-fetches and re-renders the failed segment (Next.js 16). */
  retry?: () => void;
  /** Clears the error without re-fetching. */
  reset?: () => void;
};

export default function Error({ retry, reset }: ErrorProps) {
  const tryAgain = retry ?? reset;
  return (
    <ErrorState
      title="This page could not load"
      headingAs="h1"
      detail="Try again, or go back to your websites."
      className="mx-auto mt-10 max-w-lg"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {tryAgain ? <Button variant="primary" icon="refresh" onClick={() => tryAgain()}>Try again</Button> : null}
          <ButtonLink href="/stores">Websites</ButtonLink>
        </div>
      }
    />
  );
}
