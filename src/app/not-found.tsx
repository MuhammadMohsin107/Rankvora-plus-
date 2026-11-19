import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="Not found"
      description="This item does not exist or you do not have access to it."
      action={<ButtonLink href="/stores" variant="primary">Go to stores</ButtonLink>}
      className="mt-10"
    />
  );
}
