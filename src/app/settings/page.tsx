import { redirect } from "next/navigation";

/** There is no General settings page any more. The only organization page is Billing. */
export default function SettingsIndex() {
  redirect("/settings/billing");
}
