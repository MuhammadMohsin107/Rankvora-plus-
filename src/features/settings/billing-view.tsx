"use client";

import { useState } from "react";

import { Tabs } from "@/components/ui/tabs";
import type { Store } from "@/types/core";
import type { BillingBase, PlanId, TeamMember } from "@/types/settings";

import { BillingHistory } from "./billing-history";
import { InvoicesTab } from "./billing-invoices";
import { PaymentTab } from "./billing-payment";
import { CancelDialog, ChangePlanDialog, PlanTab } from "./billing-plan";
import { UsageTab } from "./billing-usage";
import { useBilling, type PromptCountRow } from "./use-billing";

type Props = {
  base: BillingBase;
  stores: Store[];
  team: TeamMember[];
  promptRows: PromptCountRow[];
  organization: string;
};

/** Demonstration billing: plan, usage, invoices, payment method and history. No real payments, no card data. */
export function BillingView({ base, stores, team, promptRows, organization }: Props) {
  const billing = useBilling(base, stores, team, promptRows, organization);
  const [changeTo, setChangeTo] = useState<PlanId | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <>
      <Tabs
        label="Billing sections"
        tabs={[
          { id: "plan", label: "Plan", content: <PlanTab b={billing} onChange={setChangeTo} onCancel={() => setCancelOpen(true)} /> },
          { id: "usage", label: "Usage", content: <UsageTab b={billing} onChange={setChangeTo} /> },
          { id: "invoices", label: "Invoices", count: billing.invoices.length, content: <InvoicesTab b={billing} /> },
          { id: "payment", label: "Payment", content: <PaymentTab b={billing} /> },
          { id: "history", label: "History", content: <BillingHistory b={billing} /> },
        ]}
      />
      <ChangePlanDialog b={billing} targetId={changeTo} onTarget={setChangeTo} onClose={() => setChangeTo(null)} />
      <CancelDialog b={billing} open={cancelOpen} onClose={() => setCancelOpen(false)} />
    </>
  );
}
