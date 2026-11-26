"use client";

import { useState } from "react";

import { Tabs } from "@/components/ui/tabs";
import type { Store } from "@/types/core";
import type { BillingBase, PlanId } from "@/types/settings";

import { InvoicesTab } from "./billing-invoices";
import { ChangePlanDialog, PlanTab } from "./billing-plan";
import { UsageTab } from "./billing-usage";
import { useBilling, type PromptCountRow } from "./use-billing";

type Props = {
  base: BillingBase;
  stores: Store[];
  promptRows: PromptCountRow[];
  organization: string;
};

/** Demonstration billing: plan, usage by website and provider, and invoices. No real payments, no card data. */
export function BillingView({ base, stores, promptRows, organization }: Props) {
  const billing = useBilling(base, stores, promptRows, organization);
  const [changeTo, setChangeTo] = useState<PlanId | null>(null);

  return (
    <>
      <Tabs
        label="Billing sections"
        tabs={[
          { id: "plan", label: "Plan", content: <PlanTab b={billing} onChange={setChangeTo} /> },
          { id: "usage", label: "Usage", content: <UsageTab b={billing} onChange={setChangeTo} /> },
          { id: "invoices", label: "Invoices", count: billing.invoices.length, content: <InvoicesTab b={billing} /> },
        ]}
      />
      <ChangePlanDialog b={billing} targetId={changeTo} onTarget={setChangeTo} onClose={() => setChangeTo(null)} />
    </>
  );
}
