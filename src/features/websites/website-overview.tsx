"use client";

import { useParams } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { siteTypeLabel } from "@/lib/labels";
import { countryName, languageName } from "@/lib/locale-options";
import { formatDate } from "@/lib/format";

import { VerificationBadge } from "./verification-badge";
import { useWebsites } from "./websites-data";

/** One website's saved profile. Results such as audits and monitoring arrive with later backend phases. */
export function WebsiteOverview() {
  const { storeId } = useParams<{ storeId: string }>();
  const { status, websites } = useWebsites();
  if (status === "loading") return <SkeletonCard lines={5} />;
  const site = websites.find((item) => item.id === storeId);
  if (!site) {
    return (
      <>
        <PageHeader title="Website not found" />
        <EmptyState icon="globe" title="This website is not in your organization" action={<ButtonLink href="/stores">Go to websites</ButtonLink>} />
      </>
    );
  }
  return (
    <>
      <PageHeader title={site.name} meta={<Status kind="store" value={site.status} />} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <KeyValue
              items={[
                { label: "Domain", value: site.domain ? <span className="flex flex-wrap items-center gap-2">{site.domain.host}<VerificationBadge status={site.domain.verificationStatus} /></span> : "No domain" },
                { label: "Site type", value: siteTypeLabel(site.siteType) },
                { label: "Market", value: countryName(site.market) },
                { label: "Language", value: languageName(site.language) },
                { label: "Time zone", value: site.timezone },
                { label: "Added", value: formatDate(site.createdAt) },
                { label: "Business category", value: site.businessCategory ?? <span className="text-fg-muted">Not set</span> },
                { label: "Description", value: site.businessDescription ?? <span className="text-fg-muted">Not set</span> },
              ]}
            />
          </CardBody>
        </Card>
        <EmptyState icon="monitoring" title="Results are not available yet" />
      </div>
    </>
  );
}
