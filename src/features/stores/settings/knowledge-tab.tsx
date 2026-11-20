"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Segmented, Switch, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast } from "@/demo-state";
import { formatDate } from "@/lib/format";
import type { BrandKnowledgeBase, BrandKnowledgeState } from "@/types/settings";

import { validateOptionalUrl } from "../validation";
import { nextId } from "./util";

type Section = "profile" | "facts" | "content" | "crawlers";

type Props = {
  storeId: string;
  state: BrandKnowledgeState;
  crawlers: BrandKnowledgeBase["crawlers"];
  auditId: string | null;
  readOnly: boolean;
  onChange: (next: BrandKnowledgeState, logTitle: string) => void;
  /** The brand profile editor (name, aliases, description, versions), shown as the first section. */
  profile: ReactNode;
};

/** Facts, FAQs, website content context, source pages and the AI crawler summary. Everything here is demonstration content. */
export function KnowledgeTab({ storeId, state, crawlers, auditId, readOnly, onChange, profile }: Props) {
  const [section, setSection] = useState<Section>("profile");
  return (
    <div className="flex flex-col gap-4">
      <Segmented<Section>
        label="Brand knowledge section"
        value={section}
        onChange={setSection}
        options={[
          { value: "profile", label: "Brand profile" },
          { value: "facts", label: "Facts and FAQs", count: state.facts.length + state.faqs.length },
          { value: "content", label: "Website content", count: state.sourcePages.length },
          { value: "crawlers", label: "AI crawlers", count: crawlers.length },
        ]}
      />
      {section === "profile" ? profile : null}
      {section === "facts" ? <FactsSection state={state} readOnly={readOnly} onChange={onChange} /> : null}
      {section === "content" ? <ContentSection storeId={storeId} state={state} auditId={auditId} readOnly={readOnly} onChange={onChange} /> : null}
      {section === "crawlers" ? <CrawlersSection storeId={storeId} crawlers={crawlers} auditId={auditId} /> : null}
    </div>
  );
}

function FactsSection({ state, readOnly, onChange }: Pick<Props, "state" | "readOnly" | "onChange">) {
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [touched, setTouched] = useState(false);
  const urlError = validateOptionalUrl(sourceUrl);

  const addFact = () => {
    setTouched(true);
    if (!label.trim() || !value.trim() || urlError) return;
    const fact = { id: nextId("local-fact", state.facts.map((f) => f.id)), label: label.trim(), value: value.trim(), sourceUrl: sourceUrl.trim() };
    onChange({ ...state, facts: [...state.facts, fact] }, `Brand fact added: ${fact.label}`);
    toast.push(simulatedToast("Brand fact added"));
    setLabel("");
    setValue("");
    setSourceUrl("");
    setTouched(false);
  };
  const addFaq = () => {
    if (!question.trim() || !answer.trim()) return;
    const faq = { id: nextId("local-faq", state.faqs.map((f) => f.id)), question: question.trim(), answer: answer.trim() };
    onChange({ ...state, faqs: [...state.faqs, faq] }, `FAQ added: ${faq.question}`);
    toast.push(simulatedToast("FAQ added"));
    setQuestion("");
    setAnswer("");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Brand facts" info="Short statements the brand stands behind. Used for prompt ideas and fix drafts (demo)." />
        <CardBody className="flex flex-col gap-4">
          {state.facts.length === 0 ? (
            <EmptyState icon="file-text" title="No facts yet" />
          ) : (
            <ul className="divide-y divide-line rounded-control border border-line">
              {state.facts.map((fact) => (
                <li key={fact.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-body-sm text-fg"><span className="font-medium">{fact.label}:</span> {fact.value}</p>
                    {fact.sourceUrl ? <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-helper text-accent-text hover:underline">{fact.sourceUrl.replace(/^https?:\/\//, "")}</a> : null}
                  </div>
                  <IconButton icon="trash" label={`Remove ${fact.label}`} size="sm" disabled={readOnly} onClick={() => { onChange({ ...state, facts: state.facts.filter((f) => f.id !== fact.id) }, `Brand fact removed: ${fact.label}`); toast.push(simulatedToast("Brand fact removed")); }} />
                </li>
              ))}
            </ul>
          )}
          <form noValidate className="grid grid-cols-[minmax(0,1fr)] gap-3" onSubmit={(e) => { e.preventDefault(); addFact(); }}>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <Field label="Label">{({ id }) => <Input id={id} disabled={readOnly} value={label} placeholder="Delivery" onChange={(e) => setLabel(e.target.value)} />}</Field>
              <Field label="Fact">{({ id }) => <Input id={id} disabled={readOnly} value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
            </div>
            <Field label="Source page" hint="Optional" error={touched ? (urlError ?? undefined) : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} disabled={readOnly} inputMode="url" value={sourceUrl} placeholder="https://" onChange={(e) => setSourceUrl(e.target.value)} />}
            </Field>
            <Button type="submit" variant="secondary" icon="plus" disabled={readOnly} className="self-start">Add fact</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="FAQs" />
        <CardBody className="flex flex-col gap-4">
          {state.faqs.length === 0 ? (
            <EmptyState icon="help" title="No FAQs yet" />
          ) : (
            <ul className="divide-y divide-line rounded-control border border-line">
              {state.faqs.map((faq) => (
                <li key={faq.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-fg">{faq.question}</p>
                    <p className="text-helper text-fg-muted">{faq.answer}</p>
                  </div>
                  <IconButton icon="trash" label={`Remove ${faq.question}`} size="sm" disabled={readOnly} onClick={() => { onChange({ ...state, faqs: state.faqs.filter((f) => f.id !== faq.id) }, `FAQ removed: ${faq.question}`); toast.push(simulatedToast("FAQ removed")); }} />
                </li>
              ))}
            </ul>
          )}
          <form noValidate className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); addFaq(); }}>
            <Field label="Question">{({ id }) => <Input id={id} disabled={readOnly} value={question} onChange={(e) => setQuestion(e.target.value)} />}</Field>
            <Field label="Answer">{({ id }) => <Textarea id={id} rows={2} disabled={readOnly} value={answer} onChange={(e) => setAnswer(e.target.value)} />}</Field>
            <Button type="submit" variant="secondary" icon="plus" disabled={readOnly} className="self-start">Add FAQ</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function ContentSection({ storeId, state, auditId, readOnly, onChange }: Pick<Props, "storeId" | "state" | "auditId" | "readOnly" | "onChange">) {
  const toast = useToast();
  const [context, setContext] = useState(state.contentContext);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const dirty = context !== state.contentContext;

  const addPage = () => {
    const error = validateOptionalUrl(url) ?? (url.trim() ? null : "Enter a page address.");
    setUrlError(error);
    if (error) return;
    const page = { id: nextId("local-src", state.sourcePages.map((p) => p.id)), url: url.trim(), title: url.trim().replace(/^https?:\/\//, ""), type: "page", confirmed: true };
    onChange({ ...state, sourcePages: [...state.sourcePages, page] }, `Source page added: ${page.title}`);
    toast.push(simulatedToast("Source page added"));
    setUrl("");
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Content context" info="A short summary of what the site covers. Used for prompt ideas and fix drafts (demo)." />
        <CardBody className="flex flex-col gap-3">
          <Field label="Summary" hint={`${context.length} / 600`} error={context.length > 600 ? "Keep the summary to 600 characters." : undefined}>
            {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={4} disabled={readOnly} value={context} placeholder="Key pages, categories and locations" onChange={(e) => setContext(e.target.value)} />}
          </Field>
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={readOnly || !dirty || context.length > 600} onClick={() => { onChange({ ...state, contentContext: context.trim() }, "Content context saved"); toast.push(simulatedToast("Content context saved")); }}>Save summary</Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => setContext(state.contentContext)}>Reset</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Source pages"
          subtitle={state.scannedAt ? `Scan ${formatDate(state.scannedAt)}${auditId ? ` · ${auditId}` : ""}` : "Not scanned yet"}
          actions={
            <Button size="sm" variant="secondary" icon="refresh" disabled={readOnly} onClick={() => { onChange({ ...state, scannedAt: demoNow() }, "Website rescan recorded"); toast.push({ ...simulatedToast("Rescan recorded"), description: "No pages were fetched. Confirm pages by hand." }); }}>
              Rescan
            </Button>
          }
        />
        <CardBody className="flex flex-col gap-4">
          {state.sourcePages.length === 0 ? (
            <EmptyState icon="globe" title="No source pages yet" />
          ) : (
            <ul className="divide-y divide-line rounded-control border border-line">
              {state.sourcePages.map((page) => (
                <li key={page.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-fg">{page.title}</p>
                    <p className="truncate text-helper text-fg-muted">{page.url.replace(/^https?:\/\//, "")} · {page.type}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={page.confirmed}
                      disabled={readOnly}
                      label={`${page.confirmed ? "Unconfirm" : "Confirm"} ${page.title}`}
                      onChange={(confirmed) => onChange({ ...state, sourcePages: state.sourcePages.map((p) => (p.id === page.id ? { ...p, confirmed } : p)) }, `Source page ${confirmed ? "confirmed" : "unconfirmed"}: ${page.title}`)}
                    />
                    <IconButton icon="trash" label={`Remove ${page.title}`} size="sm" disabled={readOnly} onClick={() => onChange({ ...state, sourcePages: state.sourcePages.filter((p) => p.id !== page.id) }, `Source page removed: ${page.title}`)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form noValidate className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" onSubmit={(e) => { e.preventDefault(); addPage(); }}>
            <Field label="Add a page" error={urlError ?? undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} disabled={readOnly} inputMode="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />}
            </Field>
            <Button type="submit" variant="secondary" icon="plus" disabled={readOnly} className="sm:mt-[26px]">Add</Button>
          </form>
          {auditId ? <Link href={`/stores/${storeId}/audits/${auditId}/website`} className="self-start rounded text-body-sm font-medium text-accent-text hover:underline">Open pages in the audit</Link> : null}
        </CardBody>
      </Card>
    </div>
  );
}

function CrawlersSection({ storeId, crawlers, auditId }: Pick<Props, "storeId" | "crawlers" | "auditId">) {
  return (
    <Card>
      <CardHeader title="AI crawler access" subtitle="From the latest audit. Reported apart from visibility metrics." actions={auditId ? <Link href={`/stores/${storeId}/audits/${auditId}/website`} className="rounded text-body-sm font-medium text-accent-text hover:underline">Open audit</Link> : null} />
      <CardBody>
        {crawlers.length === 0 ? (
          <EmptyState icon="audit" title="No audit yet" description="Run an audit to see which AI crawlers can reach the site." action={<Link href={`/stores/${storeId}/audits/new`} className="rounded text-body-sm font-medium text-accent-text hover:underline">Start audit</Link>} />
        ) : (
          <ul className="divide-y divide-line">
            {crawlers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-fg">{c.name}</p>
                  <p className="text-helper text-fg-muted">{c.purpose}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.findingId ? <Link href={`/stores/${storeId}/fixes/findings/${c.findingId}`} className="rounded text-helper font-medium text-accent-text hover:underline">{c.findingId}</Link> : null}
                  {c.allowed ? <Badge tone="success" icon="check">Allowed</Badge> : <Badge tone="danger" icon="x-circle">Blocked</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
