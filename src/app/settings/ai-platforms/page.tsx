import { redirect } from "next/navigation";

/** AI platforms are managed in Integrations (organization level). The old address keeps working. */
export default function AiPlatformsRedirect() {
  redirect("/integrations");
}
