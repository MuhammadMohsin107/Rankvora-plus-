import { redirect } from "next/navigation";

/** There is no General settings page any more. Organization pages are Team, Billing and Notifications. */
export default function SettingsIndex() {
  redirect("/settings/members");
}
