import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      headingAs="h1"
      action={<ButtonLink href="/stores" variant="primary">Go to websites</ButtonLink>}
      className="mx-auto mt-10 max-w-lg"
    />
  );
}
