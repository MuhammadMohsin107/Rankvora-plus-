"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { SearchField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type Faq = { id: string; question: string; answer: string };

const FAQS: Faq[] = [
  { id: "measure", question: "What does Rankvora AI measure?", answer: "How often AI assistants mention, recommend or cite your website across the prompts you track." },
  { id: "rates", question: "How is a rate calculated?", answer: "Every rate is a count over responses, for example 18 of 48. Failed requests are never counted as absent." },
  { id: "add-website", question: "How do I add a website?", answer: "Open Websites & Brands and choose Add website." },
];

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Ctrl", "K"], action: "Open search (Cmd K on Mac)" },
  { keys: ["↑", "↓"], action: "Move through results and menus" },
  { keys: ["Enter"], action: "Open the selected result" },
  { keys: ["Esc"], action: "Close search, menus and dialogs" },
  { keys: ["Tab"], action: "Move to the next control" },
];

const GUIDES: { label: string; href: string }[] = [{ label: "Add your first website", href: "/stores/new" }];

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
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left text-body font-medium text-fg hover:text-accent-text pointer-coarse:min-h-14"
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

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? FAQS.filter((faq) => `${faq.question} ${faq.answer}`.toLowerCase().includes(q)) : FAQS;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardHeader title="Common questions" />
          <CardBody className="flex flex-col gap-3">
            <SearchField value={query} onChange={setQuery} label="Search help" placeholder="Search help" />
            {visible.length === 0 ? (
              <EmptyState title="No answers match" className="border-0 px-0" />
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
                <div key={shortcut.action} className="flex items-center justify-between gap-4 py-2">
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

      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardHeader title="Guides" />
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
