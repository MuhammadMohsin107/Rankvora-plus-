"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, SearchField, Select, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { cn } from "@/lib/cn";

type Faq = { id: string; question: string; answer: string };

const FAQS: Faq[] = [
  { id: "measure", question: "What does Rankvora AI measure?", answer: "How often AI assistants mention, recommend or cite your website across the prompts you track." },
  { id: "rates", question: "How is a rate calculated?", answer: "Every rate is a count over responses, for example 18 of 48. Failed requests are never counted as absent." },
  { id: "audit-vs-monitoring", question: "Audit or Monitoring?", answer: "An audit is a one-off deep check. Monitoring repeats a fixed prompt set on a schedule to show change over time." },
  { id: "add-website", question: "How do I add a website?", answer: "Open Websites & Brands and choose Add website. Connections are optional and can be added later." },
  { id: "fixes", question: "What happens when I apply a fix?", answer: "Nothing leaves your browser. Applying and verifying a fix is simulated and recorded in the activity timeline." },
  { id: "simulated", question: "What does Simulated mean?", answer: "The result was produced locally. No request was sent to an AI provider or to your website." },
  { id: "storage", question: "Where are my changes stored?", answer: "In this browser only. Use Reset demo data in the account menu to clear them." },
  { id: "export", question: "Can I export results?", answer: "Reports and audits offer HTML, CSV and JSON downloads and a print view." },
];

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Ctrl", "K"], action: "Open search (Cmd K on Mac)" },
  { keys: ["↑", "↓"], action: "Move through results and menus" },
  { keys: ["Enter"], action: "Open the selected result" },
  { keys: ["Esc"], action: "Close search, menus and dialogs" },
  { keys: ["Tab"], action: "Move to the next control" },
];

const GUIDES: { label: string; href: string }[] = [
  { label: "Add your first website", href: "/stores/new" },
  { label: "Connect integrations", href: "/integrations" },
  { label: "Usage and billing", href: "/settings/billing" },
];

const TOPICS = ["Question", "Something is not working", "Feature request", "Billing"] as const;

function FaqList({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const uid = useId();
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <ul className="divide-y divide-line-soft">
      {items.map((faq) => {
        const isOpen = open.has(faq.id);
        return (
          <li key={faq.id}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${uid}-${faq.id}`}
                onClick={() => toggle(faq.id)}
                className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-body font-medium text-fg hover:text-accent-text pointer-coarse:min-h-14"
              >
                {faq.question}
                <Icon name="chevron-down" size={18} className={cn("shrink-0 text-fg-subtle transition-transform duration-[var(--dur-fast)]", isOpen && "rotate-180")} />
              </button>
            </h3>
            <div id={`${uid}-${faq.id}`} hidden={!isOpen} className="pb-4 pr-8 text-body-sm text-fg-muted">
              {faq.answer}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type FormValues = { name: string; email: string; topic: string; message: string };
type FormErrors = Partial<Record<keyof FormValues, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL.test(values.email.trim())) errors.email = "Enter a valid email, like name@company.com.";
  if (values.message.trim().length < 10) errors.message = "Write at least 10 characters.";
  return errors;
}

/** Simulated contact form: validates, then confirms locally. Nothing is sent. */
function ContactForm() {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>({ name: "", email: "", topic: TOPICS[0], message: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const errors = validate(values);
  const shown = (key: keyof FormValues) => (touched[key] || submitted ? errors[key] : undefined);
  const set = (key: keyof FormValues) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const blur = (key: keyof FormValues) => () => setTouched((current) => ({ ...current, [key]: true }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      // Error summary takes focus so keyboard and screen reader users land on what to fix.
      window.setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
      toast.push(simulatedToast("Support message sent"));
    }, 600);
  };

  const reset = () => {
    setValues({ name: "", email: "", topic: TOPICS[0], message: "" });
    setTouched({});
    setSubmitted(false);
    setSent(false);
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <Badge tone="info" icon="layers">Simulated</Badge>
        <p className="text-body font-medium text-fg">Message recorded in this browser.</p>
        <p className="text-body-sm text-fg-muted">No email was sent. In a live account the team would reply to {values.email.trim()}.</p>
        <Button variant="secondary" onClick={reset}>Send another</Button>
      </div>
    );
  }

  const errorList = Object.entries(errors) as [keyof FormValues, string][];
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {submitted && errorList.length > 0 ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-control border border-danger/30 bg-danger-soft p-3 text-body-sm text-danger-text outline-none">
          <p className="font-medium">Fix {errorList.length === 1 ? "1 field" : `${errorList.length} fields`} to continue.</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([key, message]) => <li key={key}>{message}</li>)}
          </ul>
        </div>
      ) : null}
      <Field label="Name" required error={shown("name")}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" value={values.name} onChange={(e) => set("name")(e.target.value)} onBlur={blur("name")} />
        )}
      </Field>
      <Field label="Email" required error={shown("email")}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="email" aria-describedby={describedBy} invalid={invalid} autoComplete="email" value={values.email} onChange={(e) => set("email")(e.target.value)} onBlur={blur("email")} />
        )}
      </Field>
      <Field label="Topic">
        {({ id }) => (
          <Select id={id} value={values.topic} onChange={(e) => set("topic")(e.target.value)}>
            {TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Message" required error={shown("message")}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} rows={4} aria-describedby={describedBy} invalid={invalid} value={values.message} onChange={(e) => set("message")(e.target.value)} onBlur={blur("message")} />
        )}
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Badge tone="info" icon="layers">Simulated</Badge>
        <Button type="submit" variant="primary" loading={sending}>Send message</Button>
      </div>
    </form>
  );
}

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? FAQS.filter((faq) => `${faq.question} ${faq.answer}`.toLowerCase().includes(q)) : FAQS;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader title="Common questions" />
          <CardBody className="flex flex-col gap-3">
            <SearchField value={query} onChange={setQuery} label="Search help" placeholder="Search help" />
            {visible.length === 0 ? (
              <EmptyState
                title="No answers match"
                description="Try fewer words, or send us a message."
                action={<a href="#contact" className="inline-flex h-btn items-center rounded-control border border-line-strong bg-surface px-4 text-body font-medium text-fg hover:bg-surface-2">Contact support</a>}
                className="border-0 px-0"
              />
            ) : (
              <FaqList key={q} items={visible} />
            )}
            <p aria-live="polite" className="sr-only">{q ? `${visible.length} answers` : ""}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Keyboard shortcuts" />
          <CardBody>
            <dl className="divide-y divide-line-soft">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.action} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-body-sm text-fg-muted">{shortcut.action}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key) => (
                      <kbd key={key} className="min-w-7 rounded-control border border-line-strong bg-surface-2 px-1.5 py-0.5 text-center font-sans text-xs font-medium text-fg">{key}</kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <div id="contact" className="scroll-mt-24">
            <CardHeader title="Contact support" />
          </div>
          <CardBody>
            <ContactForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Guides" actions={<Badge tone="neutral">Demo</Badge>} />
          <CardBody className="pt-2">
            <ul className="flex flex-col">
              {GUIDES.map((guide) => (
                <li key={guide.href}>
                  <Link href={guide.href} className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-body-sm font-medium text-fg hover:bg-surface-2">
                    {guide.label}
                    <Icon name="arrow-right" size={16} className="shrink-0 text-fg-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
