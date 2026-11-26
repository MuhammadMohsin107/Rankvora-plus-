import { Badge } from "@/components/ui/badge";

import type { Website } from "./websites-data";

type Verification = NonNullable<Website["domain"]>["verificationStatus"];

const LABEL: Record<Verification, { tone: "success" | "warning" | "neutral"; icon: "shield-check" | "clock" | "shield"; text: string }> = {
  verified: { tone: "success", icon: "shield-check", text: "Ownership verified" },
  pending: { tone: "warning", icon: "clock", text: "Waiting for DNS record" },
  unverified: { tone: "neutral", icon: "shield", text: "Ownership not verified" },
};

export function VerificationBadge({ status }: { status: Verification }) {
  const { tone, icon, text } = LABEL[status];
  return (
    <Badge tone={tone} icon={icon}>
      {text}
    </Badge>
  );
}
