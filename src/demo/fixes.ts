/**
 * DEMONSTRATION DATA — not real.
 * Fixes module detail around the shared findings and registry tasks of each store:
 * runpro-pk (fnd-001…011, task-001…008) and runpro-ae (fnd-ae-001…006, task-ae-001…006).
 * Fixed timestamps only. Read through src/services/fixes.ts.
 *
 * Wording rules honoured here: no causal claims, "Applied" is never "verified",
 * causes are classified confirmed / likely / hypothesis.
 */
import type {
  FindingExtras,
  Recommendation,
  TaskDetailData,
} from "@/types/fixes";

const RP_URL = "https://runpro.pk";

/** Deterministic demo digest (FNV-1a based). Not a real SHA-256; labelled as a demo digest in the UI. */
export function demoDigest(seed: string): string {
  let out = "";
  for (let word = 0; word < 8; word += 1) {
    let h = 0x811c9dc5 ^ (word * 0x9e3779b1);
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Finding extras: rationale, criteria, evidence, observations
// ---------------------------------------------------------------------------

const PK_FINDING_EXTRAS: Record<string, FindingExtras> = {
  "fnd-001": {
    severityRationale: "Medium: the product page omits facts that shoppers and AI answers need for suitability questions. Nothing is broken.",
    priorityRationale: "P2: affects one product page and two tracked prompts; no revenue-critical error.",
    verificationCriteria: ["Page states surface suitability", "Page states cushioning level", "Page states weight with the size it applies to", "Re-crawl shows all three attributes"],
    evidence: [
      { id: "e1", kind: "page", url: `${RP_URL}/products/glide-2`, note: "Crawl: 3 of 5 expected attributes missing", auditId: "aud-002" },
      { id: "e2", kind: "prompt", promptId: "p-005", note: "Tracked prompt about long-distance suitability" },
      { id: "e3", kind: "prompt", promptId: "p-010", note: "Paused prompt about marathon training" },
    ],
    observations: [
      { id: "o1", at: "2026-10-20T05:34:00Z", source: "Full audit — October", sourceHref: "audits/aud-002", note: "Crawl of the product page" },
      { id: "o2", at: "2026-11-19T08:55:00Z", source: "Full audit — November", sourceHref: "audits/aud-004", note: "Audit still running", provisional: true },
    ],
  },
  "fnd-002": {
    severityRationale: "High: structured data contradicts the visible price. Conflicting prices can also fail merchant-listing validation.",
    priorityRationale: "P1: one page, but the price is customer-facing and the fix is small and reviewable.",
    verificationCriteria: ["JSON-LD offers.price equals the visible price", "Structured data validates without price warnings", "Re-crawl shows no price mismatch"],
    evidence: [{ id: "e1", kind: "page", url: `${RP_URL}/products/glide-2`, note: "JSON-LD price PKR 13,500 vs visible PKR 12,900", auditId: "aud-002" }],
    observations: [{ id: "o1", at: "2026-10-20T05:40:00Z", source: "Full audit — October", sourceHref: "audits/aud-002", note: "Mismatch confirmed on re-check 19 Nov" }],
  },
  "fnd-003": {
    severityRationale: "Medium: broken internal links waste crawl paths and send visitors to error pages.",
    priorityRationale: "P2: two links on two collection pages; low-risk change.",
    verificationCriteria: ["Both links resolve with HTTP 200", "No internal link to a discontinued product remains on the two pages"],
    evidence: [
      { id: "e1", kind: "page", url: `${RP_URL}/collections/road`, note: "1 internal link returns HTTP 404", auditId: "aud-002" },
      { id: "e2", kind: "page", url: `${RP_URL}/collections/sale`, note: "1 internal link returns HTTP 404", auditId: "aud-002" },
    ],
    observations: [
      { id: "o1", at: "2026-10-20T05:28:00Z", source: "Full audit — October", sourceHref: "audits/aud-002" },
      { id: "o2", at: "2026-11-12T07:15:00Z", source: "Verification — Glide 2 product facts", sourceHref: "audits/aud-003" },
      { id: "o3", at: "2026-11-19T08:50:00Z", source: "Full audit — November", sourceHref: "audits/aud-004", note: "Audit still running", provisional: true },
    ],
  },
  "fnd-004": {
    severityRationale: "High: a core neutral prompt on one channel shows the brand in fewer samples than before. Based on 2 samples only.",
    priorityRationale: "P1: core prompt; confidence is medium because the sample is small.",
    verificationCriteria: ["Re-run on the same channel with at least 3 samples", "Report mention counts with numerator and denominator", "Failed requests are reported separately"],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-run-008-09", note: "Gemini · latest monitoring run · sample 1" },
      { id: "e2", kind: "response", responseId: "resp-run-008-10", note: "Gemini · latest monitoring run · sample 2" },
      { id: "e3", kind: "prompt", promptId: "p-002", note: "Neutral recommendation prompt" },
    ],
    observations: [{ id: "o1", at: "2026-11-17T04:44:00Z", source: "Weekly monitoring — 17 Nov", sourceHref: "monitoring/runs/run-008" }],
  },
  "fnd-005": {
    severityRationale: "Low: inconsistent spelling can split brand mentions across two names. No functional impact.",
    priorityRationale: "P3: cosmetic fix on two pages.",
    verificationCriteria: ["About page and footer use “RunPro”", "No “Run Pro” on the six core pages"],
    evidence: [
      { id: "e1", kind: "page", url: `${RP_URL}/pages/about`, note: "“Run Pro” in body copy", auditId: "aud-003" },
      { id: "e2", kind: "page", url: `${RP_URL}/`, note: "“Run Pro” in the footer", auditId: "aud-003" },
    ],
    observations: [{ id: "o1", at: "2026-11-12T07:20:00Z", source: "Verification — Glide 2 product facts", sourceHref: "audits/aud-003" }],
  },
  "fnd-006": {
    severityRationale: "High: a crawler is disallowed. This may be deliberate, so it is reported for a decision, not as an error.",
    priorityRationale: "P1: crawler access is a site-wide policy; a decision is needed before anything changes.",
    verificationCriteria: ["Policy per crawler is documented", "robots.txt matches the decision", "Each crawler is reported separately in the next audit"],
    evidence: [{ id: "e1", kind: "page", url: `${RP_URL}/robots.txt`, note: "OAI-SearchBot: Disallow /", auditId: "aud-002" }],
    observations: [
      { id: "o1", at: "2026-10-20T05:22:00Z", source: "Full audit — October", sourceHref: "audits/aud-002" },
      { id: "o2", at: "2026-11-02T04:10:00Z", source: "Scheduled robots.txt check" },
      { id: "o3", at: "2026-11-12T07:12:00Z", source: "Verification — Glide 2 product facts", sourceHref: "audits/aud-003" },
      { id: "o4", at: "2026-11-19T08:44:00Z", source: "Full audit — November", sourceHref: "audits/aud-004", note: "Audit still running", provisional: true },
    ],
  },
  "fnd-007": {
    severityRationale: "Medium: no page answers a tracked beginner question. AI channels may use other sources for it.",
    priorityRationale: "P2: content gap on one informational prompt; a guide is now published and awaiting re-check.",
    verificationCriteria: ["Guide page returns 200 and is indexable", "Guide is linked from the guides index", "Guide appears in Search Console once indexed", "Prompt p-007 re-run with the same channels"],
    evidence: [
      { id: "e1", kind: "page", url: `${RP_URL}/blogs/guides`, note: "Guides index: no page on choosing a running shoe", auditId: "aud-001" },
      { id: "e2", kind: "prompt", promptId: "p-007", note: "Informational beginner prompt" },
      { id: "e3", kind: "response", responseId: "resp-run-008-37", note: "OpenAI · latest monitoring run · sample 1" },
      { id: "e4", kind: "response", responseId: "resp-run-008-39", note: "Gemini · latest monitoring run · sample 1" },
    ],
    observations: [
      { id: "o1", at: "2026-08-12T06:30:00Z", source: "Initial audit", sourceHref: "audits/aud-001" },
      { id: "o2", at: "2026-10-20T05:36:00Z", source: "Full audit — October", sourceHref: "audits/aud-002" },
      { id: "o3", at: "2026-11-15T09:00:00Z", source: "Publish check", note: "Guide published; not yet re-crawled" },
    ],
  },
  "fnd-008": {
    severityRationale: "Low: markup is incomplete but nothing is wrong on the page.",
    priorityRationale: "P3: single site-wide markup block.",
    verificationCriteria: ["Organization JSON-LD includes sameAs", "Organization JSON-LD includes contactPoint", "Markup validates"],
    evidence: [{ id: "e1", kind: "page", url: `${RP_URL}/`, note: "Home page Organization markup", auditId: "aud-003" }],
    observations: [{ id: "o1", at: "2026-08-12T06:33:00Z", source: "Initial audit", sourceHref: "audits/aud-001", note: "Verified present on 12 Nov re-crawl" }],
  },
  "fnd-009": {
    severityRationale: "Medium: a competitor domain is cited more often than the owned domain on comparison prompts. Citation-capable responses only.",
    priorityRationale: "P2: affects two comparison prompts; the cause is not established.",
    verificationCriteria: ["Owned-domain citations counted on the same prompts with n / d", "Same channels, models and search modes as the baseline", "Failed requests excluded and reported"],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-run-008-19", note: "OpenAI · cites brandx.example" },
      { id: "e2", kind: "response", responseId: "resp-run-008-21", note: "Gemini · cites brandx.example" },
      { id: "e3", kind: "response", responseId: "resp-run-008-24", note: "Perplexity · cites brandx.example" },
      { id: "e4", kind: "prompt", promptId: "p-004", note: "Alternatives prompt" },
      { id: "e5", kind: "prompt", promptId: "p-003", note: "Head-to-head prompt" },
    ],
    observations: [{ id: "o1", at: "2026-11-17T04:50:00Z", source: "Weekly monitoring — 17 Nov", sourceHref: "monitoring/runs/run-008" }],
  },
  "fnd-010": {
    severityRationale: "Low: reviewed and closed as a false positive.",
    priorityRationale: "P3: no action.",
    verificationCriteria: ["None. Closed as false positive on review."],
    evidence: [{ id: "e1", kind: "page", url: `${RP_URL}/collections/road`, note: "Titles differ by pagination suffix", auditId: "aud-001" }],
    observations: [
      { id: "o1", at: "2026-08-12T06:36:00Z", source: "Initial audit", sourceHref: "audits/aud-001" },
    ],
    duplicate: { ofId: "fnd-003", reason: "Same URL: /collections/road" },
  },
  "fnd-011": {
    severityRationale: "Low: lab LCP slightly above target; no field data to confirm real-user impact.",
    priorityRationale: "P3: accepted by the owner; review in January.",
    verificationCriteria: ["Re-measure lab LCP in January", "Add field data if available"],
    evidence: [{ id: "e1", kind: "page", url: `${RP_URL}/blogs/guides`, note: "Lab LCP 3.1 s on mobile", auditId: "aud-002" }],
    observations: [{ id: "o1", at: "2026-10-20T05:45:00Z", source: "Full audit — October", sourceHref: "audits/aud-002", note: "Accepted risk" }],
    duplicate: { ofId: "fnd-007", reason: "Same URL: /blogs/guides" },
  },
};

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

const rec = (x: Partial<Recommendation> & Pick<Recommendation, "id" | "findingId" | "title" | "problem" | "action" | "why" | "expectedOutcome" | "cause" | "evidenceIds">): Recommendation => ({
  effort: "small",
  risk: "low",
  suggestedMode: "ai_draft",
  dependencies: [],
  limitations: [],
  verificationPlan: [],
  status: "proposed",
  taskId: null,
  ...x,
});

const PK_RECOMMENDATIONS: Recommendation[] = [
  rec({
    id: "rec-fnd-001-a",
    findingId: "fnd-001",
    title: "Add surface, cushioning and weight to the Glide 2 description",
    problem: "The product page lists price and sizes only. Surface suitability, cushioning level and weight are missing.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Crawl on 20 Oct and 12 Nov shows the three attributes absent from page copy." },
    action: "Add surface suitability, cushioning level and weight (with the size it applies to) to the description of /products/glide-2.",
    why: "Shoppers and AI answers can only quote facts that the page states. This does not guarantee a mention or a ranking.",
    expectedOutcome: "The three attributes are present on the page and match the merchant spec sheet.",
    effort: "small",
    risk: "medium",
    suggestedMode: "ai_draft",
    dependencies: ["Merchant spec sheet for Glide 2"],
    limitations: ["Facts come from the 4 Nov spec sheet only", "Page copy is edited by a person; no CMS write"],
    verificationPlan: ["Re-crawl /products/glide-2", "Confirm all three attributes appear", "Re-run prompt p-005 as context only"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-10-22T09:30:00Z",
    taskId: "task-001",
  }),
  rec({
    id: "rec-fnd-001-b",
    findingId: "fnd-001",
    title: "Add a specification table to the Glide 2 page",
    problem: "Attributes would be easier to scan as a table than as prose.",
    evidenceIds: ["e1"],
    cause: { classification: "hypothesis", basis: "Untested. No evidence that tables change how channels use the page." },
    action: "Add a four-row specification table (surface, cushioning, weight, drop) below the description on /products/glide-2.",
    why: "A structured layout may help shoppers compare. No effect on AI answers is claimed.",
    expectedOutcome: "A table whose values match the description copy.",
    effort: "medium",
    risk: "low",
    suggestedMode: "cms_staged",
    dependencies: ["task-001 copy approved first"],
    limitations: ["Theme must support tables on product pages", "Hypothesis only"],
    verificationPlan: ["Re-crawl the page", "Check table values equal description values"],
  }),
  rec({
    id: "rec-fnd-002-a",
    findingId: "fnd-002",
    title: "Set the Glide 2 JSON-LD price to PKR 12,900",
    problem: "Structured data says PKR 13,500; the visible price and the Shopify variant price are PKR 12,900.",
    evidenceIds: ["e1"],
    cause: { classification: "confirmed", basis: "Crawl and a read-only Shopify product lookup agree on 12,900; the stale 13,500 comes from the structured-data field." },
    action: "Change offers.price from 13500 to 12900 in the JSON-LD of /products/glide-2.",
    why: "Conflicting prices can fail merchant-listing checks and confuse systems that read structured data. No ranking effect is claimed.",
    expectedOutcome: "JSON-LD price equals the visible price.",
    effort: "small",
    risk: "high",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff"],
    limitations: ["Writes to a live product page", "Cached copies may show the old price for a short time"],
    verificationPlan: ["Re-crawl the page", "Compare JSON-LD price to the visible price", "Run structured-data validation"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-17T10:00:00Z",
    taskId: "task-002",
  }),
  rec({
    id: "rec-fnd-003-a",
    findingId: "fnd-003",
    title: "Replace two broken links on road and sale collections",
    problem: "One link on each collection page points to a discontinued product and returns 404.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Both URLs return HTTP 404 on every crawl." },
    action: "Replace the discontinued-product link on /collections/road and on /collections/sale with the matching live collection URL.",
    why: "Broken links lead visitors and crawlers to error pages.",
    expectedOutcome: "Both links return HTTP 200.",
    effort: "small",
    risk: "low",
    suggestedMode: "cms_staged",
    verificationPlan: ["Re-crawl both pages", "Confirm each replaced link returns 200"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-10-23T08:00:00Z",
    taskId: "task-003",
  }),
  rec({
    id: "rec-fnd-004-a",
    findingId: "fnd-004",
    title: "Review the Gemini answers before changing any content",
    problem: "The brand appears in fewer Gemini samples for the affordable-shoes prompt than earlier. Only 2 samples exist.",
    evidenceIds: ["e1", "e2", "e3"],
    cause: { classification: "hypothesis", basis: "Variation between samples is normal; the drop may not persist." },
    action: "Compare the two Gemini samples of prompt p-002 with the previous run and note which sources were cited.",
    why: "A change on a core prompt deserves a look, but 2 samples are not a trend.",
    expectedOutcome: "A short note: persistent change, or normal variation.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["Two samples cannot support a trend", "Provider answers vary between runs"],
    verificationPlan: ["Re-run p-002 on Gemini with 3 or more samples", "Report mention counts as n / d"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-18T08:20:00Z",
    taskId: "task-007",
  }),
  rec({
    id: "rec-fnd-005-a",
    findingId: "fnd-005",
    title: "Use “RunPro” on the About page and footer",
    problem: "“Run Pro” appears on two of six core pages.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Text found verbatim on both pages in the 12 Nov crawl." },
    action: "Replace “Run Pro” with “RunPro” in the About page body and the site footer.",
    why: "One spelling keeps the brand name consistent for shoppers and for systems that match names.",
    expectedOutcome: "No “Run Pro” on the six core pages.",
    effort: "small",
    risk: "low",
    suggestedMode: "ai_draft",
    verificationPlan: ["Re-crawl the six core pages", "Search for “Run Pro”"],
  }),
  rec({
    id: "rec-fnd-006-a",
    findingId: "fnd-006",
    title: "Decide the OAI-SearchBot policy, then update robots.txt only if intended",
    problem: "robots.txt disallows OAI-SearchBot while GPTBot and ChatGPT-User follow the default rule.",
    evidenceIds: ["e1"],
    cause: { classification: "confirmed", basis: "The rule is present in robots.txt on every check." },
    action: "Record the intended access policy for OAI-SearchBot and edit the matching robots.txt rule only if the policy is to allow it.",
    why: "The rule controls whether this crawler may fetch pages. Allowing it does not guarantee inclusion in any answer.",
    expectedOutcome: "robots.txt matches a documented, deliberate policy.",
    effort: "small",
    risk: "high",
    suggestedMode: "guidance",
    dependencies: ["Client decision on crawler policy"],
    limitations: ["Policy decision, not a technical defect", "Each crawler is reported separately"],
    verificationPlan: ["Re-fetch robots.txt", "Report each crawler separately in the next audit"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-05T11:00:00Z",
    taskId: "task-006",
  }),
  rec({
    id: "rec-fnd-007-a",
    findingId: "fnd-007",
    title: "Publish a beginner guide: how to choose a running shoe",
    problem: "No page answers the tracked beginner question.",
    evidenceIds: ["e1", "e2", "e3", "e4"],
    cause: { classification: "likely", basis: "No indexed page covers the topic; answers cite third-party guides instead." },
    action: "Publish /blogs/guides/how-to-choose-a-running-shoe and link it from the guides index.",
    why: "A page that answers the question gives shoppers and channels an owned source. No ranking or citation is guaranteed.",
    expectedOutcome: "A live, indexable guide linked from the guides index.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "cms_staged",
    dependencies: ["Editor review of the draft"],
    limitations: ["Indexing time is outside our control", "Answers vary between runs"],
    verificationPlan: ["Check the page returns 200 and is indexable", "Check Search Console once indexed", "Re-run p-007 with the same channels"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-10-24T09:00:00Z",
    taskId: "task-004",
  }),
  rec({
    id: "rec-fnd-008-a",
    findingId: "fnd-008",
    title: "Add sameAs and contactPoint to Organization markup",
    problem: "Organization JSON-LD has no sameAs or contactPoint.",
    evidenceIds: ["e1"],
    cause: { classification: "confirmed", basis: "Markup read directly from the home page." },
    action: "Add sameAs (official profiles) and one contactPoint to the Organization JSON-LD on the home page.",
    why: "Explicit identity links help systems tell which profiles belong to the brand.",
    expectedOutcome: "Both properties present and valid.",
    effort: "small",
    risk: "medium",
    suggestedMode: "ai_draft",
    verificationPlan: ["Re-crawl the home page", "Validate the markup"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-10-30T09:00:00Z",
    taskId: "task-005",
  }),
  rec({
    id: "rec-fnd-009-a",
    findingId: "fnd-009",
    title: "Add an FAQ block to the Marathon Elite page",
    problem: "A competitor domain is cited in 5 comparison responses; the owned domain in 2.",
    evidenceIds: ["e1", "e2", "e3", "e4", "e5"],
    cause: { classification: "hypothesis", basis: "The owned site may lack a direct comparison answer. Not established." },
    action: "Add a four-question FAQ block to /products/marathon-elite covering fit, cushioning and sizing against common alternatives.",
    why: "A direct answer on the owned page gives channels something to cite. Citations are not guaranteed.",
    expectedOutcome: "FAQ renders on the page without layout shift.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "approved_apply",
    limitations: ["Hypothesis only", "Citation counts vary between runs"],
    verificationPlan: ["Re-crawl the page", "Check layout shift on mobile", "Re-run p-003 and p-004 as context only"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-03T09:00:00Z",
    decisionNote: "Task rolled back on 9 Nov after a mobile layout regression.",
    taskId: "task-008",
  }),
  rec({
    id: "rec-fnd-009-b",
    findingId: "fnd-009",
    title: "Add a static comparison section instead of an accordion",
    problem: "The first approach (accordion FAQ) caused layout shift and was rolled back.",
    evidenceIds: ["e4", "e5"],
    cause: { classification: "hypothesis", basis: "Same hypothesis as before; a different layout." },
    action: "Add a static, non-collapsing comparison section to /products/marathon-elite.",
    why: "Avoids the layout shift seen with the accordion. No effect on citations is claimed.",
    expectedOutcome: "Section renders without layout shift; copy states only supported facts.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "cms_staged",
    dependencies: ["Review of rolled-back task-008"],
    limitations: ["Hypothesis only"],
    verificationPlan: ["Check mobile layout shift before publishing", "Re-crawl the page"],
  }),
  rec({
    id: "rec-fnd-011-a",
    findingId: "fnd-011",
    title: "Re-measure the blog index in January",
    problem: "Lab LCP is 3.1 s on mobile; no field data is available.",
    evidenceIds: ["e1"],
    cause: { classification: "likely", basis: "Lab measurement only; real-user impact unknown." },
    action: "Re-run the lab measurement for /blogs/guides in January and add field data if available.",
    why: "A single lab number may not reflect real users.",
    expectedOutcome: "A fresh measurement to compare with 3.1 s.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    status: "rejected",
    decisionNote: "Accepted risk by the owner; review in January.",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-10-28T10:00:00Z",
  }),
];

// ---------------------------------------------------------------------------
// Task details
// ---------------------------------------------------------------------------

const GLIDE_BEFORE =
  "RunPro Glide 2. A lightweight everyday trainer from RunPro. Available in UK sizes 6 to 12. PKR 12,900. Free delivery across Pakistan on orders over PKR 10,000.";
const GLIDE_AFTER =
  "RunPro Glide 2 is a road-running shoe for daily training on pavement and treadmill. Cushioning: medium, with an EVA midsole. Weight: 265 g in UK size 9. Heel-to-toe drop: 8 mm. Not designed for trail use. Available in UK sizes 6 to 12. PKR 12,900. Free delivery across Pakistan on orders over PKR 10,000. Ideal for marathon distances. The most cushioned shoe under PKR 15,000.";
const GLIDE_ALT =
  "RunPro Glide 2 is a road-running shoe for daily training on pavement and treadmill. Cushioning: medium, with an EVA midsole. Weight: 265 g in UK size 9. Heel-to-toe drop: 8 mm. Not designed for trail use. Runs true to size. Available in UK sizes 6 to 12. PKR 12,900. Free delivery across Pakistan on orders over PKR 10,000.";

const LD_BEFORE = `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "RunPro Glide 2",
  "sku": "RP-GLD2",
  "brand": { "@type": "Brand", "name": "RunPro" },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "PKR",
    "price": "13500",
    "availability": "https://schema.org/InStock",
    "url": "${RP_URL}/products/glide-2"
  }
}`;
const LD_AFTER = LD_BEFORE.replace('"price": "13500"', '"price": "12900"');

const ORG_BEFORE = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "RunPro",
  "url": "${RP_URL}/",
  "logo": "${RP_URL}/cdn/logo.png"
}`;
const ORG_AFTER = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "RunPro",
  "url": "${RP_URL}/",
  "logo": "${RP_URL}/cdn/logo.png",
  "sameAs": [
    "https://www.instagram.com/runpro.pk",
    "https://www.facebook.com/runpro.pk"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "support@runpro.pk"
  }
}`;

const GUIDE_AFTER =
  "How to choose a running shoe\n\nStart with where you run: road, treadmill or trail. Then check cushioning, fit and weekly distance.\n\n1. Surface: road shoes, trail shoes and treadmill use differ in grip and cushioning.\n2. Fit: leave about a thumb's width in front of your longest toe.\n3. Cushioning: softer for easy mileage, firmer for faster sessions.\n4. Try shoes on in the afternoon, when feet are slightly larger.\n\nRelated: RunPro Glide 2 for road running.";

const FAQ_AFTER =
  "Marathon Elite: common questions\n\nWhat distance is it designed for? Long road runs; see the weight and cushioning figures in the specification.\nHow does sizing work? UK sizes 6 to 12; order half a size up if between sizes.\nIs it suitable for trail? No. It is a road shoe.\nHow does it compare with other road shoes? See the comparison table on this page.";

const SPEC_FACTS = (source: string) => [
  { label: "Surface", value: "Road and treadmill; not for trail", source },
  { label: "Cushioning", value: "Medium, EVA midsole", source },
  { label: "Weight", value: "265 g in UK size 9", source },
  { label: "Heel-to-toe drop", value: "8 mm", source },
];

const SHOPIFY = (scopes: string[]) => ({
  label: "Shopify",
  store: "runpro.pk",
  state: "connected" as const,
  scopesGranted: ["read_products", "write_products", "read_content", "write_content"],
  scopesRequired: scopes,
});

const PK_TASK_SUMMARY_EXTRAS: Record<string, { blockers: string[] }> = {
  "task-001": { blockers: [] },
  "task-002": { blockers: [] },
  "task-003": { blockers: ["Remote page changed since draft: /collections/sale"] },
  "task-004": { blockers: [] },
  "task-005": { blockers: [] },
  "task-006": { blockers: ["Waiting for client decision on crawler policy"] },
  "task-007": { blockers: [] },
  "task-008": { blockers: [] },
};

type TaskDetailSeed = Omit<TaskDetailData, "task">;

const EMPTY_ROLLBACK = { available: false, laterEdit: null, record: null };

const PK_TASK_DETAILS: Record<string, TaskDetailSeed> = {
  "task-001": {
    recommendationId: "rec-fnd-001-a",
    createdAt: "2026-10-22T09:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Page states surface suitability, cushioning level and weight", "Weight names the size it applies to", "Every added fact matches the spec sheet"],
    dependencies: [{ label: "Merchant spec sheet for Glide 2 (4 Nov)", met: true }, { label: "Editor review of the draft", met: false }],
    draft: {
      kind: "text",
      resource: "Product page · /products/glide-2",
      field: "Product description",
      before: GLIDE_BEFORE,
      after: GLIDE_AFTER,
      alternate: {
        after: GLIDE_ALT,
        unsupportedClaims: [{ text: "Runs true to size.", reason: "The spec sheet has no fit data." }],
      },
      sourceFacts: SPEC_FACTS("Spec sheet, merchant upload 4 Nov"),
      unsupportedClaims: [
        { text: "Ideal for marathon distances.", reason: "No source fact supports marathon suitability." },
        { text: "The most cushioned shoe under PKR 15,000.", reason: "Superlative with no comparison data." },
      ],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-17T10:12:00Z",
      version: 1,
    },
    approval: { state: "not_required", notRequiredReason: "AI draft only. Nothing is written to Shopify; a person applies the copy.", diffHash: demoDigest("task-001-copy"), writes: [] },
    execution: {
      connector: SHOPIFY(["read_products"]),
      cmsState: "draft",
      remote: {
        resource: "Product glide-2 · description",
        versionAtDraft: "rev 41",
        versionNow: "rev 41",
        hashAtDraft: demoDigest("glide-desc-41"),
        hashNow: demoDigest("glide-desc-41"),
        checkedAt: "2026-11-19T08:50:00Z",
        changed: false,
      },
      fields: [{ field: "Product description", before: GLIDE_BEFORE, after: GLIDE_AFTER, outcome: "pending", note: "Applied by a person after review" }],
      completedAt: "2026-11-18T14:20:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Page states surface suitability", expect: "Present" },
        { id: "c2", label: "Page states cushioning level", expect: "Present" },
        { id: "c3", label: "Page states weight and size", expect: "Present" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-20T05:34:00Z", actor: "Audit aud-002", kind: "created", title: "Finding fnd-001 detected" },
      { id: "h2", at: "2026-10-22T09:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-17T10:12:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated", detail: "2 unsupported claims flagged" },
      { id: "h4", at: "2026-11-18T14:20:00Z", actor: "Hira Malik", kind: "status", title: "Marked draft ready" },
    ],
  },

  "task-002": {
    recommendationId: "rec-fnd-002-a",
    createdAt: "2026-10-21T08:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["JSON-LD offers.price equals the visible price", "Structured data validates without price warnings"],
    dependencies: [{ label: "Owner or admin approval of the exact diff", met: false }, { label: "Shopify connection with write_products", met: true }],
    draft: {
      kind: "patch",
      resource: "Product glide-2 · metafield custom.structured_data",
      language: "json-ld",
      before: LD_BEFORE,
      after: LD_AFTER,
      sourceFacts: [
        { label: "Visible price", value: "PKR 12,900", source: "Crawl 19 Nov, /products/glide-2" },
        { label: "Variant price", value: "PKR 12,900", source: "Shopify read_products lookup, 19 Nov 08:56" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-17T10:40:00Z",
      version: 1,
    },
    approval: {
      state: "pending",
      diffHash: demoDigest("task-002-patch"),
      writes: ["Shopify product glide-2 · metafield custom.structured_data", "1 line changed: offers.price 13500 → 12900", "Live on the product page after save"],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-18T11:20:00Z",
    },
    execution: {
      connector: SHOPIFY(["read_products", "write_products"]),
      cmsState: "draft",
      remote: {
        resource: "Product glide-2 · metafield custom.structured_data",
        versionAtDraft: "rev 118",
        versionNow: "rev 118",
        hashAtDraft: demoDigest("glide-ld-118"),
        hashNow: demoDigest("glide-ld-118"),
        checkedAt: "2026-11-19T08:56:00Z",
        changed: false,
      },
      fields: [{ field: "offers.price", before: "13500", after: "12900", outcome: "pending" }],
      completedAt: "2026-11-18T11:15:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "JSON-LD price equals visible price", expect: "Equal" },
        { id: "c2", label: "Structured data validates", expect: "No price warnings" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-20T05:40:00Z", actor: "Audit aud-002", kind: "created", title: "Finding fnd-002 detected" },
      { id: "h2", at: "2026-11-17T10:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-17T10:40:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted", detail: "1 line changed" },
      { id: "h4", at: "2026-11-18T11:20:00Z", actor: "Omar Farooq", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
    ],
  },

  "task-003": {
    recommendationId: "rec-fnd-003-a",
    createdAt: "2026-10-23T08:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Both replaced links return HTTP 200", "No link to a discontinued product on the two pages"],
    dependencies: [{ label: "Staged-draft approval", met: true }, { label: "Remote pages unchanged since draft", met: false }],
    draft: {
      kind: "batch",
      resource: "Collection descriptions (batch of 3 resources)",
      items: [
        { id: "b1", pageUrl: `${RP_URL}/collections/road`, linkText: "Stride Trail 1", from: "/products/stride-trail-1", to: "/collections/trail", result: "ready" },
        { id: "b2", pageUrl: `${RP_URL}/collections/sale`, linkText: "Daily Trainer 1", from: "/products/daily-trainer-1", to: "/products/daily-trainer", result: "conflict", reason: "Page changed after the draft was made." },
        { id: "b3", pageUrl: `${RP_URL}/collections/road?page=2`, linkText: "Stride Trail 1", from: "/products/stride-trail-1", to: "/collections/trail", result: "excluded", reason: "Paginated copy of /collections/road; shares the same block." },
      ],
      sourceFacts: [
        { label: "Broken links", value: "2 internal links return 404", source: "Crawl 19 Nov" },
        { label: "Replacement targets", value: "Live collection and product URLs", source: "Shopify read_products lookup" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-16T09:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-003-batch"),
      writes: ["Shopify collection descriptions for 2 pages, staged as drafts", "2 links replaced, 1 resource excluded", "Not published until a second step"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-17T09:00:00Z",
      decidedBy: "Omar Farooq",
      decidedAt: "2026-11-18T08:30:00Z",
      note: "Staged draft only. Publishing needs a separate action.",
    },
    execution: {
      connector: SHOPIFY(["read_products", "write_products"]),
      cmsState: "draft",
      remote: {
        resource: "Collection sale · description",
        versionAtDraft: "rev 27",
        versionNow: "rev 28",
        hashAtDraft: demoDigest("sale-desc-27"),
        hashNow: demoDigest("sale-desc-28"),
        checkedAt: "2026-11-19T08:45:00Z",
        changed: true,
        changedBy: "Aisha Khan (store staff)",
        changedAt: "2026-11-18T14:20:00Z",
        note: "Description edited in Shopify admin after the draft was generated.",
      },
      fields: [
        { field: "/collections/road · description link", before: "/products/stride-trail-1", after: "/collections/trail", outcome: "pending" },
        { field: "/collections/sale · description link", before: "/products/daily-trainer-1", after: "/products/daily-trainer", outcome: "skipped", note: "Held: remote changed since draft" },
      ],
      completedAt: "2026-11-16T09:00:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been written." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Link on /collections/road returns 200", expect: "HTTP 200" },
        { id: "c2", label: "Link on /collections/sale returns 200", expect: "HTTP 200" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-20T05:28:00Z", actor: "Audit aud-002", kind: "created", title: "Finding fnd-003 detected" },
      { id: "h2", at: "2026-10-23T08:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-16T09:00:00Z", actor: "Drafting model", kind: "draft", title: "Batch drafted", detail: "3 resources, 1 excluded" },
      { id: "h4", at: "2026-11-18T08:30:00Z", actor: "Omar Farooq", kind: "approval", title: "Staged draft approved" },
      { id: "h5", at: "2026-11-18T08:31:00Z", actor: "System", kind: "status", title: "Queued for staging" },
      { id: "h6", at: "2026-11-19T08:45:00Z", actor: "System", kind: "execution", title: "Remote check: resource changed since draft", detail: "/collections/sale held" },
    ],
  },

  "task-004": {
    recommendationId: "rec-fnd-007-a",
    createdAt: "2026-10-24T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Guide returns 200 and is indexable", "Guide is linked from the guides index", "Guide is indexed in Search Console"],
    dependencies: [{ label: "Editor review of the draft", met: true }, { label: "Search Console property connected", met: true }],
    draft: {
      kind: "text",
      resource: "Blog article · /blogs/guides/how-to-choose-a-running-shoe",
      field: "Article body",
      before: "",
      after: GUIDE_AFTER,
      alternate: { after: GUIDE_AFTER, unsupportedClaims: [] },
      sourceFacts: [
        { label: "Topic", value: "How a beginner chooses a running shoe", source: "Prompt p-007" },
        { label: "Product link", value: "RunPro Glide 2 · road running", source: "Product catalogue" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-09T10:00:00Z",
      version: 2,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-004-guide"),
      writes: ["Shopify blog article created as a staged draft", "Published on approval of the publish step"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-12T08:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-13T09:10:00Z",
    },
    execution: {
      connector: SHOPIFY(["read_content", "write_content"]),
      cmsState: "published",
      remote: {
        resource: "Blog article · how-to-choose-a-running-shoe",
        versionAtDraft: "rev 1",
        versionNow: "rev 3",
        hashAtDraft: demoDigest("guide-1"),
        hashNow: demoDigest("guide-3"),
        checkedAt: "2026-11-19T08:40:00Z",
        changed: true,
        changedBy: "Hira Malik (Shopify admin)",
        changedAt: "2026-11-17T10:12:00Z",
        note: "Intro paragraph edited after publishing.",
      },
      fields: [
        { field: "Article body", before: "(page did not exist)", after: "Guide, 4 steps", outcome: "written", note: "Staged 14 Nov, published 15 Nov" },
        { field: "Guides index link", before: "(none)", after: "Link added", outcome: "written" },
      ],
      completedAt: "2026-11-13T09:00:00Z",
      stagedAt: "2026-11-14T08:00:00Z",
      appliedAt: "2026-11-14T08:05:00Z",
      publishedAt: "2026-11-15T08:30:00Z",
      rollback: {
        available: true,
        laterEdit: { by: "Hira Malik", at: "2026-11-17T10:12:00Z", note: "Intro paragraph edited in Shopify admin after publishing." },
        record: null,
      },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Guide returns 200", expect: "HTTP 200" },
        { id: "c2", label: "Guide is indexable", expect: "No noindex, self canonical" },
        { id: "c3", label: "Guide linked from the guides index", expect: "Link present" },
        { id: "c4", label: "Guide indexed in Search Console", expect: "Indexed" },
      ],
      outcome: null,
      simulated: {
        result: "partially_verified",
        ranAt: "2026-11-19T09:00:00Z",
        sourceLabel: "Verification audit (demo)",
        findingEffect: "Finding stays Awaiting verification until the page is indexed.",
        checks: [
          { id: "c1", label: "Guide returns 200", before: { status: "fail", detail: "Page did not exist" }, after: { status: "pass", detail: "HTTP 200" } },
          { id: "c2", label: "Guide is indexable", before: { status: "not_assessed", detail: "No page" }, after: { status: "pass", detail: "Self canonical, no noindex" } },
          { id: "c3", label: "Guide linked from the guides index", before: { status: "fail", detail: "No link" }, after: { status: "pass", detail: "1 link found" } },
          { id: "c4", label: "Guide indexed in Search Console", before: { status: "not_assessed", detail: "No page" }, after: { status: "inconclusive", detail: "Not indexed yet" } },
        ],
      },
      context: null,
    },
    history: [
      { id: "h1", at: "2026-08-12T06:30:00Z", actor: "Audit aud-001", kind: "created", title: "Finding fnd-007 detected" },
      { id: "h2", at: "2026-10-24T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-09T10:00:00Z", actor: "Drafting model", kind: "draft", title: "Draft v2 generated", detail: "Revised after editor feedback" },
      { id: "h4", at: "2026-11-13T09:10:00Z", actor: "Sana Iqbal", kind: "approval", title: "Staged draft approved" },
      { id: "h5", at: "2026-11-14T08:05:00Z", actor: "System", kind: "execution", title: "Staged in Shopify", detail: "Remote check passed" },
      { id: "h6", at: "2026-11-15T08:30:00Z", actor: "Hira Malik", kind: "execution", title: "Published" },
      { id: "h7", at: "2026-11-17T10:12:00Z", actor: "Hira Malik", kind: "execution", title: "Page edited in Shopify admin", detail: "Intro paragraph changed after publishing" },
    ],
  },

  "task-005": {
    recommendationId: "rec-fnd-008-a",
    createdAt: "2026-10-30T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Organization JSON-LD includes sameAs", "Organization JSON-LD includes contactPoint", "Markup validates"],
    dependencies: [{ label: "Official profile URLs confirmed", met: true }],
    draft: {
      kind: "patch",
      resource: "Theme snippet · Organization JSON-LD (home page)",
      language: "json-ld",
      before: ORG_BEFORE,
      after: ORG_AFTER,
      sourceFacts: [
        { label: "Profiles", value: "Instagram and Facebook, both official", source: "Store settings, brand profile" },
        { label: "Support email", value: "support@runpro.pk", source: "Contact page" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-01T10:00:00Z",
      version: 1,
    },
    approval: { state: "not_required", notRequiredReason: "AI draft only. The snippet was applied manually by Omar Farooq.", diffHash: demoDigest("task-005-org"), writes: [] },
    execution: {
      connector: null,
      cmsState: "applied",
      remote: null,
      fields: [
        { field: "sameAs", before: "(missing)", after: "2 profiles", outcome: "written", note: "Applied manually in the theme editor" },
        { field: "contactPoint", before: "(missing)", after: "1 contact point", outcome: "written", note: "Applied manually in the theme editor" },
      ],
      completedAt: "2026-11-03T10:00:00Z",
      stagedAt: null,
      appliedAt: "2026-11-04T09:30:00Z",
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Applied outside Rankvora Plus. Revert in the theme editor." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "sameAs present", expect: "Present" },
        { id: "c2", label: "contactPoint present", expect: "Present" },
        { id: "c3", label: "Markup validates", expect: "No errors" },
      ],
      outcome: {
        result: "verified_success",
        ranAt: "2026-11-12T07:25:00Z",
        sourceLabel: "Verification — Glide 2 product facts",
        sourceHref: "audits/aud-003",
        findingEffect: "Finding fnd-008 set to Verified resolved.",
        checks: [
          { id: "c1", label: "sameAs present", before: { status: "fail", detail: "Property missing (12 Aug)" }, after: { status: "pass", detail: "2 profiles" } },
          { id: "c2", label: "contactPoint present", before: { status: "fail", detail: "Property missing (12 Aug)" }, after: { status: "pass", detail: "1 contact point" } },
          { id: "c3", label: "Markup validates", before: { status: "pass", detail: "Valid" }, after: { status: "pass", detail: "Valid" } },
        ],
      },
      simulated: null,
      context: { label: "Brand mention rate in the verification audit (context only)", n: 5, d: 6, basis: "6 responses, 1 sample each. Directional." },
    },
    history: [
      { id: "h1", at: "2026-08-12T06:33:00Z", actor: "Audit aud-001", kind: "created", title: "Finding fnd-008 detected" },
      { id: "h2", at: "2026-10-30T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-01T10:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted" },
      { id: "h4", at: "2026-11-04T09:30:00Z", actor: "Omar Farooq", kind: "execution", title: "Marked applied", detail: "Snippet edited in the theme editor" },
      { id: "h5", at: "2026-11-12T07:25:00Z", actor: "Audit aud-003", kind: "verification", title: "Verified success", detail: "3 of 3 checks passed" },
    ],
  },

  "task-006": {
    recommendationId: "rec-fnd-006-a",
    createdAt: "2026-11-05T11:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The crawler policy is written down", "robots.txt matches the decision", "Each crawler is reported separately in the next audit"],
    dependencies: [{ label: "Client decision on crawler policy", met: false }],
    draft: {
      kind: "guidance",
      owner: "Omar Farooq",
      steps: [
        { title: "Confirm the policy", detail: "Ask the client whether OAI-SearchBot should be allowed. Record the answer." },
        { title: "Check other rules", detail: "GPTBot and ChatGPT-User follow the default rule. Decide each crawler on its own." },
        { title: "Edit robots.txt only if allowing", detail: "Remove the OAI-SearchBot Disallow line. Leave other rules as they are." },
        { title: "Re-run the website check", detail: "Confirm each crawler is reported separately." },
      ],
      sourceFacts: [{ label: "OAI-SearchBot", value: "Disallow /", source: "robots.txt, audit aud-002" }],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora Plus.", diffHash: null, writes: [] },
    execution: {
      connector: null,
      cmsState: "guidance",
      remote: null,
      fields: [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Guidance only." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "robots.txt rule for OAI-SearchBot", expect: "Matches the decision" },
        { id: "c2", label: "Each crawler reported separately", expect: "3 crawlers listed" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-20T05:22:00Z", actor: "Audit aud-002", kind: "created", title: "Finding fnd-006 detected" },
      { id: "h2", at: "2026-11-05T11:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-10T09:00:00Z", actor: "Omar Farooq", kind: "status", title: "Blocked", detail: "Waiting for client decision on crawler policy" },
    ],
  },

  "task-007": {
    recommendationId: "rec-fnd-004-a",
    createdAt: "2026-11-18T08:20:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Both samples reviewed against the previous run", "A short note records persistent change or normal variation"],
    dependencies: [{ label: "Assignee chosen", met: false }],
    draft: {
      kind: "guidance",
      owner: "Unassigned",
      steps: [
        { title: "Open both samples", detail: "Read the two Gemini answers for p-002 from the latest monitoring run." },
        { title: "Compare with the previous run", detail: "Note mention, position and cited sources for the same slots." },
        { title: "Check search use", detail: "Record whether grounded search ran in each sample." },
        { title: "Write a note", detail: "Persistent change or normal variation. Do not edit content on two samples." },
      ],
      sourceFacts: [{ label: "Samples", value: "2 Gemini samples, run-008", source: "Monitoring" }],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora Plus.", diffHash: null, writes: [] },
    execution: {
      connector: null,
      cmsState: "guidance",
      remote: null,
      fields: [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Guidance only." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Re-run p-002 on Gemini with 3 or more samples", expect: "Counts reported as n / d" },
        { id: "c2", label: "Failed requests reported separately", expect: "Not counted as absent" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-17T04:44:00Z", actor: "Monitoring run-008", kind: "created", title: "Finding fnd-004 detected" },
      { id: "h2", at: "2026-11-18T08:20:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-18T08:21:00Z", actor: "System", kind: "status", title: "Task suggested", detail: "No assignee yet" },
    ],
  },

  "task-008": {
    recommendationId: "rec-fnd-009-a",
    createdAt: "2026-11-03T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["FAQ renders on /products/marathon-elite", "No layout shift on mobile (lab CLS ≤ 0.1)"],
    dependencies: [{ label: "Approval of the exact diff", met: true }],
    draft: {
      kind: "text",
      resource: "Product page · /products/marathon-elite",
      field: "FAQ block",
      before: "",
      after: FAQ_AFTER,
      alternate: { after: FAQ_AFTER, unsupportedClaims: [] },
      sourceFacts: [
        { label: "Sizing", value: "UK 6 to 12", source: "Product catalogue" },
        { label: "Surface", value: "Road only", source: "Spec sheet" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-04T10:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-008-faq"),
      writes: ["Shopify product marathon-elite · FAQ section added", "Live on the product page after save"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-04T11:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-05T09:30:00Z",
    },
    execution: {
      connector: SHOPIFY(["read_products", "write_products"]),
      cmsState: "draft",
      remote: {
        resource: "Product marathon-elite · description",
        versionAtDraft: "rev 62",
        versionNow: "rev 65",
        hashAtDraft: demoDigest("marathon-62"),
        hashNow: demoDigest("marathon-65"),
        checkedAt: "2026-11-09T14:05:00Z",
        changed: true,
        changedBy: "Aisha Khan (store staff)",
        changedAt: "2026-11-07T12:40:00Z",
        note: "Price banner edited after the FAQ was applied.",
      },
      fields: [{ field: "FAQ block", before: "(none)", after: "4 questions", outcome: "reverted", note: "Reverted 9 Nov. The 7 Nov price banner edit was kept." }],
      completedAt: "2026-11-04T10:30:00Z",
      stagedAt: "2026-11-05T09:50:00Z",
      appliedAt: "2026-11-05T10:05:00Z",
      publishedAt: "2026-11-05T10:07:00Z",
      rollback: {
        available: false,
        unavailableReason: "Already rolled back.",
        laterEdit: { by: "Aisha Khan", at: "2026-11-07T12:40:00Z", note: "Price banner edited after the FAQ was applied." },
        record: {
          at: "2026-11-09T14:10:00Z",
          by: "Hira Malik",
          reason: "Accordion caused mobile layout shift (lab CLS 0.24).",
          restoredHash: demoDigest("marathon-62"),
          outcome: "restored_with_manual_merge",
          note: "Only the FAQ block was removed. The later price banner edit was reconciled by hand.",
          preservedEdits: ["Price banner (Aisha Khan, 7 Nov)"],
        },
      },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "FAQ renders on the page", expect: "Present" },
        { id: "c2", label: "Mobile layout shift", expect: "Lab CLS ≤ 0.1" },
      ],
      outcome: {
        result: "rolled_back",
        ranAt: "2026-11-09T13:30:00Z",
        sourceLabel: "Website check after publish",
        findingEffect: "Finding fnd-009 unchanged (New). Recommendation can be revised.",
        checks: [
          { id: "c1", label: "FAQ renders on the page", before: { status: "fail", detail: "No FAQ" }, after: { status: "pass", detail: "4 questions rendered" } },
          { id: "c2", label: "Mobile layout shift", before: { status: "pass", detail: "Lab CLS 0.04" }, after: { status: "fail", detail: "Lab CLS 0.24" } },
        ],
      },
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-03T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h2", at: "2026-11-04T10:00:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated" },
      { id: "h3", at: "2026-11-05T09:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Approved exact diff" },
      { id: "h4", at: "2026-11-05T10:05:00Z", actor: "System", kind: "execution", title: "Applied and published", detail: "Remote check passed" },
      { id: "h5", at: "2026-11-07T12:40:00Z", actor: "Aisha Khan", kind: "execution", title: "Price banner edited in Shopify admin" },
      { id: "h6", at: "2026-11-09T13:30:00Z", actor: "System", kind: "verification", title: "Website check: layout shift on mobile", detail: "Lab CLS 0.24" },
      { id: "h7", at: "2026-11-09T14:10:00Z", actor: "Hira Malik", kind: "rollback", title: "Rolled back", detail: "FAQ block removed; later edit reconciled manually" },
    ],
  },
};


// ===========================================================================
// runpro-ae (RunPro UAE · WooCommerce · runpro.ae)
// ===========================================================================

const AE_URL = "https://runpro.ae";

/** WooCommerce connector as recorded today: write access was rejected on 18 Nov (store integration: needs attention). */
const WOO = (required: string[], note?: string) => ({
  label: "WooCommerce",
  store: "runpro.ae",
  state: "needs_attention" as const,
  scopesGranted: ["read"],
  scopesRequired: required,
  note,
});

const AE_FINDING_EXTRAS: Record<string, FindingExtras> = {
  "fnd-ae-001": {
    severityRationale: "High: without Product and Offer data, price, currency and availability are not machine-readable on product pages. Nothing visible to shoppers is broken.",
    priorityRationale: "P1: affects all 3 sampled product pages and is shared by every product on the template. A small, reviewable change.",
    verificationCriteria: [
      "Product and Offer JSON-LD present on all 3 sampled product pages",
      "priceCurrency is AED and price equals the visible price",
      "Markup validates without errors",
      "Re-crawl shows no product page without Product markup",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${AE_URL}/product/daily-trainer`, note: "No Product or Offer JSON-LD; breadcrumb markup only", auditId: "aud-ae-001" },
      { id: "e2", kind: "page", url: `${AE_URL}/product/marathon-elite`, note: "No Product or Offer JSON-LD; breadcrumb markup only", auditId: "aud-ae-001" },
      { id: "e3", kind: "page", url: `${AE_URL}/product/glide-2`, note: "Stray Offer block only, no Product wrapper (see fnd-ae-002)", auditId: "aud-ae-001" },
      { id: "e4", kind: "prompt", promptId: "p-ae-002", note: "Purchase-intent prompt, where price and availability facts matter. Context only." },
      { id: "e5", kind: "prompt", promptId: "p-ae-005", note: "Purchase-intent prompt, where price and availability facts matter. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-09-16T05:28:00Z", source: "Initial audit", sourceHref: "audits/aud-ae-001", note: "3 of 3 sampled product pages lack Product markup" },
      { id: "o2", at: "2026-11-05T05:33:00Z", source: "Full audit — November", sourceHref: "audits/aud-ae-002", note: "Still missing on the same 3 pages" },
      { id: "o3", at: "2026-11-19T06:10:00Z", source: "Scheduled page re-check", note: "Live template unchanged; the staged template is not live" },
    ],
  },
  "fnd-ae-002": {
    severityRationale: "High: structured data reports USD while the page shows AED. A wrong currency can fail merchant-listing validation and mislead systems that read structured data.",
    priorityRationale: "P1: one page, but price data is customer-facing and the fix is two lines.",
    verificationCriteria: ["Offer priceCurrency is AED", "Offer price equals the visible price (AED 1,280)", "Structured data validates without price or currency warnings"],
    evidence: [{ id: "e1", kind: "page", url: `${AE_URL}/product/glide-2`, note: "Offer: priceCurrency USD, price 349. Visible price: AED 1,280", auditId: "aud-ae-001" }],
    observations: [
      { id: "o1", at: "2026-09-16T05:31:00Z", source: "Initial audit", sourceHref: "audits/aud-ae-001", note: "Mismatch confirmed" },
      { id: "o2", at: "2026-11-05T05:35:00Z", source: "Full audit — November", sourceHref: "audits/aud-ae-002", note: "Still USD" },
      { id: "o3", at: "2026-11-19T06:11:00Z", source: "Scheduled page re-check", note: "Live value unchanged: the apply on 18 Nov did not write" },
    ],
  },
  "fnd-ae-003": {
    severityRationale: "Medium: delivery area, time and returns window are facts shoppers and AI answers look for on a product page. Nothing is broken.",
    priorityRationale: "P2: affects 2 of 4 sampled product pages; confidence is medium because the sample is small.",
    verificationCriteria: ["Delivery area and time stated on the product page", "Returns window stated on the product page", "Every stated fact matches the shipping and returns policy pages"],
    evidence: [
      { id: "e1", kind: "page", url: `${AE_URL}/product/glide-2`, note: "Shipping mentioned in the footer only; returns on a separate page", auditId: "aud-ae-002" },
      { id: "e2", kind: "page", url: `${AE_URL}/product/daily-trainer`, note: "Shipping mentioned in the footer only; returns on a separate page", auditId: "aud-ae-002" },
      { id: "e3", kind: "prompt", promptId: "p-ae-002", note: "Purchase-intent prompt; delivery and returns are typical follow-up questions. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-11-05T05:33:00Z", source: "Full audit — November", sourceHref: "audits/aud-ae-002", note: "2 of 4 sampled product pages" },
      { id: "o2", at: "2026-11-19T06:12:00Z", source: "Scheduled page re-check", note: "Unchanged" },
    ],
  },
  "fnd-ae-004": {
    severityRationale: "Medium: a competitor domain is cited far more often than the owned domain on two local buying prompts. Citation-capable responses only.",
    priorityRationale: "P2: two local prompts; the cause is not established and confidence is medium.",
    verificationCriteria: [
      "Owned-domain citations counted on p-ae-002 and p-ae-005 with n / d",
      "Same channels, models and search modes as the baseline",
      "Failed requests excluded and reported separately",
    ],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-aud-ae-002-07", note: "OpenAI · p-ae-002 · sample 1 · cites gulfrun.example" },
      { id: "e2", kind: "response", responseId: "resp-aud-ae-002-10", note: "Gemini · p-ae-002 · sample 1 · cites gulfrun.example" },
      { id: "e3", kind: "response", responseId: "resp-aud-ae-002-25", note: "OpenAI · p-ae-005 · sample 1 · cites gulfrun.example" },
      { id: "e4", kind: "response", responseId: "resp-aud-ae-002-09", note: "OpenAI · p-ae-002 · sample 3 · the one response citing runpro.ae" },
      { id: "e5", kind: "prompt", promptId: "p-ae-002", note: "Local buying prompt, Dubai" },
      { id: "e6", kind: "prompt", promptId: "p-ae-005", note: "Local buying prompt, Abu Dhabi" },
    ],
    observations: [
      { id: "o1", at: "2026-11-05T05:38:00Z", source: "Full audit — November", sourceHref: "audits/aud-ae-002", note: "gulfrun.example 10 of 12, runpro.ae 1 of 12" },
      { id: "o2", at: "2026-11-14T06:12:00Z", source: "Focused audit — Dubai local prompts", sourceHref: "audits/aud-ae-003", note: "9 of 12 requests succeeded; gulfrun.example 6 of 9, runpro.ae 2 of 9. 3 failed requests excluded." },
      { id: "o3", at: "2026-11-18T05:30:00Z", source: "Weekly monitoring — 18 Nov", sourceHref: "monitoring/runs/run-ae-006", note: "gulfrun.example 9 of 12, runpro.ae 1 of 12" },
    ],
  },
  "fnd-ae-005": {
    severityRationale: "Low: redirecting URLs in a sitemap waste crawl budget. No visitor sees an error.",
    priorityRationale: "P3: 9 legacy URLs; low-risk change.",
    verificationCriteria: ["No sitemap URL redirects to runpro.pk", "Every sitemap URL returns HTTP 200 on runpro.ae", "Sitemap fetch returns valid XML"],
    evidence: [
      { id: "e1", kind: "page", url: `${AE_URL}/sitemap.xml`, note: "9 of 214 sitemap URLs return 301 to runpro.pk", auditId: "aud-ae-001" },
      { id: "e2", kind: "page", url: `${AE_URL}/sitemap.xml`, note: "0 of 205 sitemap URLs redirect", auditId: "aud-ae-002" },
    ],
    observations: [
      { id: "o1", at: "2026-09-16T05:26:00Z", source: "Initial audit", sourceHref: "audits/aud-ae-001", note: "9 redirecting URLs" },
      { id: "o2", at: "2026-11-05T05:30:00Z", source: "Verification — Full audit November", sourceHref: "audits/aud-ae-002", note: "0 redirecting URLs" },
    ],
  },
  "fnd-ae-006": {
    severityRationale: "Low: one prompt, 2 channels, brand absent. Low confidence that a site change would matter; answers vary between runs.",
    priorityRationale: "P3: single informational prompt. Accepted by the owner on 12 Nov; revisit in January.",
    verificationCriteria: ["Re-run p-ae-003 on the same channels with 3 samples each", "Report brand mentions with numerator and denominator", "Failed requests reported separately"],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-aud-ae-002-13", note: "OpenAI · sample 1 · brand absent; cites gulfrun.example" },
      { id: "e2", kind: "response", responseId: "resp-aud-ae-002-16", note: "Gemini · sample 1 · brand absent; cites gulfrun.example" },
      { id: "e3", kind: "prompt", promptId: "p-ae-003", note: "Hot-weather running prompt" },
    ],
    observations: [
      { id: "o1", at: "2026-11-05T05:39:00Z", source: "Full audit — November", sourceHref: "audits/aud-ae-002", note: "6 of 6 successful responses absent" },
      { id: "o2", at: "2026-11-18T05:30:00Z", source: "Weekly monitoring — 18 Nov", sourceHref: "monitoring/runs/run-ae-006", note: "6 of 6 successful responses absent" },
    ],
  },
};

const AE_RECOMMENDATIONS: Recommendation[] = [
  rec({
    id: "rec-fnd-ae-001-a",
    findingId: "fnd-ae-001",
    title: "Add Product and Offer JSON-LD to the WooCommerce product template",
    problem: "Product pages expose breadcrumb markup only. Price, currency and availability are not machine-readable.",
    evidenceIds: ["e1", "e2", "e3"],
    cause: { classification: "confirmed", basis: "Markup read directly from 3 product pages in the 16 Sep and 5 Nov audits." },
    action: "Add one Product block with a nested Offer (name, sku, price, priceCurrency AED, availability) to the single-product template, rendered from the WooCommerce product record.",
    why: "Structured data states price, currency and availability in a form crawlers can read. It does not guarantee rich results, rankings or AI citations.",
    expectedOutcome: "Every product page renders valid Product and Offer markup that matches the visible price in AED.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "cms_staged",
    dependencies: ["WooCommerce write access", "Legacy Offer block on Glide 2 replaced first (task-ae-002), to avoid a duplicate Offer"],
    limitations: ["The template change affects every product page once published", "Rendering is previewed on one page; the other sampled pages are re-checked after publish"],
    verificationPlan: ["Re-crawl the 3 sampled product pages", "Validate Product and Offer markup", "Confirm price and currency equal the visible values"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-06T09:00:00Z",
    taskId: "task-ae-001",
  }),
  rec({
    id: "rec-fnd-ae-002-a",
    findingId: "fnd-ae-002",
    title: "Set the Glide 2 Offer to AED 1,280",
    problem: "The Offer block says USD 349; the page shows AED 1,280.",
    evidenceIds: ["e1"],
    cause: { classification: "confirmed", basis: "The legacy snippet in the product meta data carries USD 349. The WooCommerce store currency and the visible price are AED 1,280." },
    action: "Change priceCurrency from USD to AED and price from 349 to 1280 in the legacy Offer block of /product/glide-2, in one write.",
    why: "A wrong currency in structured data can fail merchant-listing checks. Changing the currency alone would publish AED 349, so both values change together. No ranking effect is claimed.",
    expectedOutcome: "Offer currency and price equal the visible price.",
    effort: "small",
    risk: "high",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff", "WooCommerce write access"],
    limitations: ["Writes to a live product page", "Cached copies may show the old values for a short time"],
    verificationPlan: ["Re-crawl the page", "Compare Offer currency and price to the visible price", "Run structured-data validation"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T09:00:00Z",
    taskId: "task-ae-002",
  }),
  rec({
    id: "rec-fnd-ae-003-a",
    findingId: "fnd-ae-003",
    title: "Add a UAE delivery and returns section to product pages",
    problem: "Delivery and returns facts sit in the footer and on a separate page, not on the product page.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "likely", basis: "Both affected pages mention shipping in the footer only (2 of 4 sampled pages) and link to a separate returns page." },
    action: "Add a short Delivery and returns section below the description, using only facts from the shipping and returns policy pages.",
    why: "Shoppers and AI answers can quote delivery and returns only when the product page states them. This does not guarantee a mention.",
    expectedOutcome: "Each product page states the delivery area, time and returns window, matching the policy pages.",
    effort: "small",
    risk: "low",
    suggestedMode: "ai_draft",
    dependencies: ["Owner or admin confirms the policy wording"],
    limitations: ["Facts come from the policy pages crawled on 5 Nov", "A person adds the section in WooCommerce; no write by Rankvora Plus"],
    verificationPlan: ["Re-crawl the 2 affected product pages", "Check each stated fact against the policy pages"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-17T09:00:00Z",
    taskId: "task-ae-003",
  }),
  rec({
    id: "rec-fnd-ae-004-a",
    findingId: "fnd-ae-004",
    title: "Review Dubai local citations against GulfRun",
    problem: "gulfrun.example is cited in 10 of 12 responses to the two local prompts; runpro.ae in 1 of 12.",
    evidenceIds: ["e1", "e2", "e3", "e4"],
    cause: { classification: "hypothesis", basis: "Local pages or listings may be stronger on the competitor side. Not established; answers vary between runs." },
    action: "Read the cited GulfRun pages and the runpro.ae pages that could answer the same question, then write a note on whether the gap is content, listings or neither.",
    why: "A large gap on two local prompts deserves a look before any content is changed. Three audits are not a trend.",
    expectedOutcome: "A short note that names the gap or records normal variation.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["Citation counts vary between runs", "3 failed requests in the focused audit are excluded, not counted as absent"],
    verificationPlan: ["Re-run p-ae-002 and p-ae-005 with the same channels and 3 samples", "Report owned-domain citations as n / d"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-18T10:30:00Z",
    taskId: "task-ae-004",
  }),
  rec({
    id: "rec-fnd-ae-004-b",
    findingId: "fnd-ae-004",
    title: "Add a Dubai and Abu Dhabi delivery page",
    problem: "No page on runpro.ae answers where and how fast RunPro delivers in each emirate.",
    evidenceIds: ["e5", "e6"],
    cause: { classification: "hypothesis", basis: "Untested. No evidence that a dedicated page changes which sources are cited." },
    action: "Draft a delivery page for Dubai and Abu Dhabi that states delivery times and fees from the shipping policy, and link it from the footer.",
    why: "An owned page with local facts gives channels something to cite. Citations are not guaranteed.",
    expectedOutcome: "A live page whose facts match the shipping policy.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "cms_staged",
    dependencies: ["Review of the task-ae-003 wording first"],
    limitations: ["Hypothesis only", "Indexing time is outside our control"],
    verificationPlan: ["Check the page returns 200 and is indexable", "Re-run p-ae-002 and p-ae-005 as context only"],
  }),
  rec({
    id: "rec-fnd-ae-005-a",
    findingId: "fnd-ae-005",
    title: "Exclude 9 redirecting legacy URLs from the sitemap",
    problem: "9 sitemap URLs return 301 to runpro.pk.",
    evidenceIds: ["e1"],
    cause: { classification: "confirmed", basis: "Each URL returned 301 to runpro.pk in the initial audit sitemap check." },
    action: "Set the 9 legacy products to 'exclude from sitemap' in WooCommerce. No page content changes.",
    why: "A sitemap should list only URLs that return 200 on the same domain.",
    expectedOutcome: "The regenerated sitemap lists no redirecting URL.",
    effort: "small",
    risk: "low",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff"],
    limitations: ["Takes effect when the sitemap regenerates"],
    verificationPlan: ["Re-crawl the sitemap", "Count URLs that redirect or return an error"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-10-27T09:00:00Z",
    taskId: "task-ae-005",
  }),
  rec({
    id: "rec-fnd-ae-006-a",
    findingId: "fnd-ae-006",
    title: "Rewrite hot-weather guidance on the homepage",
    problem: "The brand is absent from every successful answer to the hot-weather prompt.",
    evidenceIds: ["e1", "e2", "e3"],
    cause: { classification: "hypothesis", basis: "The homepage may lack hot-weather guidance. One prompt, 2 channels; answers vary between runs." },
    action: "Review the homepage copy on climate and propose a short hot-weather note using only supported product facts.",
    why: "A page that states the guidance gives shoppers and channels an owned source. No mention is guaranteed.",
    expectedOutcome: "A short, factual hot-weather note on the homepage.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["Hypothesis only", "Based on one prompt"],
    verificationPlan: ["Re-run p-ae-003 on the same channels with 3 samples"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-06T09:00:00Z",
    decisionNote: "Task rejected on 12 Nov: accepted risk, revisit in January.",
    taskId: "task-ae-006",
  }),
];

// ---- Task details ----------------------------------------------------------

const AE_FACT_SHIPPING = "Shipping policy page, crawl 5 Nov";
const AE_FACT_RETURNS = "Returns policy page, crawl 5 Nov";

const TEMPLATE_BEFORE = `{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Shop", "item": "${AE_URL}/shop" },
        { "@type": "ListItem", "position": 2, "name": "RunPro Daily Trainer" }
      ]
    }
  ]
}`;
const TEMPLATE_AFTER = `{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Shop", "item": "${AE_URL}/shop" },
        { "@type": "ListItem", "position": 2, "name": "RunPro Daily Trainer" }
      ]
    },
    {
      "@type": "Product",
      "name": "RunPro Daily Trainer",
      "sku": "RP-DTR",
      "brand": { "@type": "Brand", "name": "RunPro" },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "AED",
        "price": "429.00",
        "availability": "https://schema.org/InStock",
        "url": "${AE_URL}/product/daily-trainer"
      }
    }
  ]
}`;

const OFFER_BEFORE = `{
  "@context": "https://schema.org",
  "@type": "Offer",
  "url": "${AE_URL}/product/glide-2",
  "priceCurrency": "USD",
  "price": "349",
  "availability": "https://schema.org/InStock"
}`;
const OFFER_AFTER = OFFER_BEFORE.replace('"priceCurrency": "USD"', '"priceCurrency": "AED"').replace('"price": "349"', '"price": "1280"');

const DELIVERY_AFTER =
  "Delivery and returns (UAE)\n\nDelivery: standard delivery takes 2 to 4 working days across the UAE. Orders over AED 250 ship free; below that, delivery costs AED 20. Same-day delivery is available in Dubai.\nReturns: unworn shoes in the original box can be returned within 14 days of delivery. Start a return from your account or contact support.\nFull policies: runpro.ae/shipping and runpro.ae/returns.";
const DELIVERY_ALT =
  "Delivery and returns (UAE)\n\nDelivery: standard delivery takes 2 to 4 working days across the UAE. Orders over AED 250 ship free; below that, delivery costs AED 20.\nReturns: unworn shoes in the original box can be returned within 14 days of delivery. Start a return from your account or contact support.\nFull policies: runpro.ae/shipping and runpro.ae/returns.";

const SITEMAP_SLUGS = ["glide-1", "daily-trainer-1", "marathon-pro-2024", "kids-runner-2", "trail-grip-3", "road-lite-1", "sprint-spike-1", "recovery-slide-1", "stride-trail-1"];

const AE_TASK_SUMMARY_EXTRAS: Record<string, { blockers: string[] }> = {
  "task-ae-001": { blockers: ["Publish needs approval and WooCommerce write access", "Waiting for task-ae-002 (legacy Offer on Glide 2)"] },
  "task-ae-002": { blockers: ["WooCommerce write access was rejected. Reconnect before retrying."] },
  "task-ae-003": { blockers: [] },
  "task-ae-004": { blockers: [] },
  "task-ae-005": { blockers: [] },
  "task-ae-006": { blockers: [] },
};

const AE_TASK_DETAILS: Record<string, TaskDetailSeed> = {
  // Staged on WooCommerce, not published, awaiting publish approval.
  "task-ae-001": {
    recommendationId: "rec-fnd-ae-001-a",
    createdAt: "2026-11-06T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Product and Offer JSON-LD present on all 3 sampled product pages", "priceCurrency is AED and price equals the visible price", "Markup validates without errors"],
    dependencies: [
      { label: "Staging approved (12 Nov)", met: true },
      { label: "Publish approval of the staged template", met: false },
      { label: "WooCommerce write access", met: false },
      { label: "task-ae-002: legacy Offer on Glide 2 replaced, to avoid a duplicate Offer", met: false },
    ],
    draft: {
      kind: "patch",
      resource: "Product daily-trainer · rendered JSON-LD (template preview)",
      language: "json-ld",
      before: TEMPLATE_BEFORE,
      after: TEMPLATE_AFTER,
      sourceFacts: [
        { label: "Name and SKU", value: "RunPro Daily Trainer · RP-DTR", source: "WooCommerce product record, read 10 Nov" },
        { label: "Price and currency", value: "AED 429.00", source: "WooCommerce product record and visible price, crawl 5 Nov" },
        { label: "Availability", value: "In stock", source: "WooCommerce stock status, read 10 Nov" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-10T10:00:00Z",
      version: 1,
    },
    approval: {
      state: "pending",
      diffHash: demoDigest("task-ae-001-template"),
      writes: [
        "WooCommerce single-product JSON-LD template: the staged copy becomes live",
        "Applies to every product page once published",
        "Staging was approved on 12 Nov. This request covers publishing the staged template.",
      ],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-18T09:40:00Z",
    },
    execution: {
      connector: WOO(["read", "write"], "Staged on 12 Nov, before write access was rejected on 18 Nov. Publishing needs write access."),
      cmsState: "staged",
      remote: {
        resource: "Template · single-product JSON-LD (staged copy)",
        versionAtDraft: "staged v1",
        versionNow: "staged v1",
        hashAtDraft: demoDigest("ae-template-staged-1"),
        hashNow: demoDigest("ae-template-staged-1"),
        checkedAt: "2026-11-19T08:30:00Z",
        changed: false,
        note: "Read-only check. The staged copy is unchanged since 12 Nov and is not live.",
      },
      fields: [
        { field: "Single-product JSON-LD template", before: "Breadcrumb only", after: "Breadcrumb, Product and Offer", outcome: "pending", note: "Staged 12 Nov. Not live until published." },
        { field: "Glide 2 · legacy Offer block", before: "Stray Offer, USD 349", after: "Replaced by the template", outcome: "skipped", note: "Held until task-ae-002 corrects it, so the page never shows two Offers." },
      ],
      completedAt: "2026-11-10T10:30:00Z",
      stagedAt: "2026-11-12T10:20:00Z",
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing is live. Discard the staged copy instead." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Product and Offer markup on daily-trainer", expect: "Present" },
        { id: "c2", label: "Product and Offer markup on marathon-elite", expect: "Present" },
        { id: "c3", label: "priceCurrency AED and price equals visible price", expect: "Equal" },
        { id: "c4", label: "Markup validates", expect: "No errors" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-09-16T05:28:00Z", actor: "Audit aud-ae-001", kind: "created", title: "Finding fnd-ae-001 detected" },
      { id: "h2", at: "2026-11-06T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-10T10:00:00Z", actor: "Drafting model", kind: "draft", title: "Template patch drafted", detail: "Preview rendered on daily-trainer" },
      { id: "h4", at: "2026-11-11T09:00:00Z", actor: "Hira Malik", kind: "approval", title: "Staging approval requested" },
      { id: "h5", at: "2026-11-12T09:30:00Z", actor: "Omar Farooq", kind: "approval", title: "Staging approved", detail: "Staged draft only. Publishing needs a separate approval." },
      { id: "h6", at: "2026-11-12T10:20:00Z", actor: "System", kind: "execution", title: "Staged in WooCommerce", detail: "Remote check passed. Not live." },
      { id: "h7", at: "2026-11-18T09:40:00Z", actor: "Hira Malik", kind: "approval", title: "Publish approval requested", detail: "Owner or admin must approve publishing the staged template" },
      { id: "h8", at: "2026-11-19T08:30:00Z", actor: "System", kind: "execution", title: "Remote check: staged copy unchanged", detail: "Write access is still rejected, so publishing is blocked" },
    ],
  },

  // Apply attempt failed because the WooCommerce connection needs attention. Nothing changed on the live site.
  "task-ae-002": {
    recommendationId: "rec-fnd-ae-002-a",
    createdAt: "2026-11-10T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Offer priceCurrency is AED", "Offer price equals the visible price (AED 1,280)", "Structured data validates without price or currency warnings"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "WooCommerce write access", met: false },
      { label: "Live value unchanged since draft", met: true },
    ],
    draft: {
      kind: "patch",
      resource: "Product glide-2 · meta_data _legacy_offer_jsonld",
      language: "json-ld",
      before: OFFER_BEFORE,
      after: OFFER_AFTER,
      sourceFacts: [
        { label: "Visible price", value: "AED 1,280", source: "Crawl 19 Nov, /product/glide-2" },
        { label: "Store currency", value: "AED", source: "WooCommerce settings, read 10 Nov" },
        { label: "Product price", value: "AED 1,280", source: "WooCommerce product record, read 10 Nov" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-10T09:40:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-ae-002-patch"),
      writes: [
        "WooCommerce product glide-2 · meta_data _legacy_offer_jsonld",
        "2 lines changed: priceCurrency USD → AED, price 349 → 1280, in one write",
        "Live on the product page after save",
      ],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-11T10:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-12T09:15:00Z",
    },
    execution: {
      connector: WOO(["read", "write"], "Write access was rejected on 18 Nov. Reconnect in store settings to restore it."),
      cmsState: "draft",
      remote: {
        resource: "Product glide-2 · meta_data _legacy_offer_jsonld",
        versionAtDraft: "rev 31",
        versionNow: "rev 31",
        hashAtDraft: demoDigest("ae-glide-offer-31"),
        hashNow: demoDigest("ae-glide-offer-31"),
        checkedAt: "2026-11-19T08:32:00Z",
        changed: false,
        note: "Re-read after the failed attempt. The live value is unchanged.",
      },
      fields: [
        { field: "priceCurrency", before: "USD", after: "AED", outcome: "failed", note: "Not written: HTTP 401 woocommerce_rest_cannot_edit" },
        { field: "price", before: "349", after: "1280", outcome: "failed", note: "Not written. Changed together with priceCurrency so the page never shows AED 349." },
      ],
      completedAt: "2026-11-10T09:50:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      failure: {
        at: "2026-11-18T05:25:40Z",
        stage: "apply",
        code: "woocommerce_rest_cannot_edit",
        message: "HTTP 401: Sorry, you cannot edit this resource. The API key now has read-only permission.",
        attempts: [
          { at: "2026-11-18T05:25:10Z", result: "HTTP 401 woocommerce_rest_cannot_edit" },
          { at: "2026-11-18T05:25:25Z", result: "HTTP 401 woocommerce_rest_cannot_edit" },
          { at: "2026-11-18T05:25:40Z", result: "HTTP 401 woocommerce_rest_cannot_edit. Retries stopped: the error is not temporary." },
        ],
        retryable: true,
        retryBlockedBy: "The WooCommerce connection needs attention. Write access must be restored first.",
        nothingWritten: true,
        nextStep: "Reconnect WooCommerce with a read and write API key, then retry. The approved diff and the unchanged remote copy are reused.",
      },
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing was written, so there is nothing to roll back." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Offer priceCurrency equals AED", expect: "AED" },
        { id: "c2", label: "Offer price equals the visible price", expect: "AED 1,280" },
        { id: "c3", label: "Structured data validates", expect: "No price or currency warnings" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-09-16T05:31:00Z", actor: "Audit aud-ae-001", kind: "created", title: "Finding fnd-ae-002 detected" },
      { id: "h2", at: "2026-11-10T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-10T09:40:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted", detail: "2 lines changed" },
      { id: "h4", at: "2026-11-11T10:00:00Z", actor: "Omar Farooq", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
      { id: "h5", at: "2026-11-12T09:15:00Z", actor: "Sana Iqbal", kind: "approval", title: "Approved exact diff" },
      { id: "h6", at: "2026-11-17T16:00:00Z", actor: "Omar Farooq", kind: "status", title: "Apply scheduled", detail: "Maintenance window 18 Nov 09:25 Dubai time" },
      { id: "h7", at: "2026-11-18T05:25:05Z", actor: "System", kind: "execution", title: "Remote check passed", detail: "rev 31, unchanged since draft" },
      { id: "h8", at: "2026-11-18T05:25:40Z", actor: "System", kind: "execution", title: "Apply failed", detail: "HTTP 401 woocommerce_rest_cannot_edit, 3 attempts. Nothing was written." },
      { id: "h9", at: "2026-11-18T05:30:00Z", actor: "System", kind: "status", title: "Task marked failed; connection needs attention", detail: "WooCommerce write access rejected" },
      { id: "h10", at: "2026-11-19T08:32:00Z", actor: "System", kind: "execution", title: "Re-read after failure", detail: "Live value unchanged (rev 31)" },
    ],
  },

  // AI draft of a UAE delivery and returns section, waiting for approval of the wording.
  "task-ae-003": {
    recommendationId: "rec-fnd-ae-003-a",
    createdAt: "2026-11-17T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Delivery area and time are stated on the product page", "The returns window is stated on the product page", "Every stated fact matches the shipping and returns policy pages"],
    dependencies: [
      { label: "Shipping and returns policy pages crawled (5 Nov)", met: true },
      { label: "Owner or admin confirms the wording", met: false },
    ],
    draft: {
      kind: "text",
      resource: "Product pages · Delivery and returns section (Glide 2 shown)",
      field: "Delivery and returns section",
      before: "",
      after: DELIVERY_AFTER,
      alternate: { after: DELIVERY_ALT, unsupportedClaims: [] },
      sourceFacts: [
        { label: "Delivery time", value: "2 to 4 working days across the UAE", source: AE_FACT_SHIPPING },
        { label: "Free delivery", value: "Orders over AED 250", source: AE_FACT_SHIPPING },
        { label: "Delivery fee", value: "AED 20 below the free-delivery threshold", source: AE_FACT_SHIPPING },
        { label: "Returns window", value: "14 days from delivery, unworn, original box", source: AE_FACT_RETURNS },
      ],
      unsupportedClaims: [{ text: "Same-day delivery is available in Dubai.", reason: "The shipping policy lists 2 to 4 working days only." }],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-18T08:00:00Z",
      version: 1,
    },
    approval: {
      state: "pending",
      diffHash: demoDigest("task-ae-003-copy"),
      writes: [
        "No write by Rankvora Plus",
        "Approval confirms the delivery and returns wording and its source facts",
        "Hira Malik then adds the section in WooCommerce and marks the task applied",
      ],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-18T08:30:00Z",
    },
    execution: {
      connector: WOO(["read"], "Only read access is needed to compare the page. An AI draft makes no write."),
      cmsState: "draft",
      remote: {
        resource: "Product glide-2 · description",
        versionAtDraft: "rev 31",
        versionNow: "rev 31",
        hashAtDraft: demoDigest("ae-glide-desc-31"),
        hashNow: demoDigest("ae-glide-desc-31"),
        checkedAt: "2026-11-19T08:34:00Z",
        changed: false,
      },
      fields: [{ field: "Delivery and returns section", before: "(none)", after: "4 lines", outcome: "pending", note: "Applied by a person after approval" }],
      completedAt: "2026-11-18T08:20:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Delivery area and time on the product page", expect: "Present" },
        { id: "c2", label: "Returns window on the product page", expect: "Present" },
        { id: "c3", label: "Stated facts match the policy pages", expect: "No mismatch" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-05T05:33:00Z", actor: "Audit aud-ae-002", kind: "created", title: "Finding fnd-ae-003 detected" },
      { id: "h2", at: "2026-11-17T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-18T08:00:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated", detail: "1 unsupported claim flagged" },
      { id: "h4", at: "2026-11-18T08:30:00Z", actor: "Hira Malik", kind: "approval", title: "Approval requested", detail: "Owner or admin must confirm the policy wording" },
    ],
  },

  // Guidance only, unassigned.
  "task-ae-004": {
    recommendationId: "rec-fnd-ae-004-a",
    createdAt: "2026-11-18T10:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The cited GulfRun and runpro.ae pages are compared", "A short note records whether the gap is content, listings or neither"],
    dependencies: [{ label: "Assignee chosen", met: false }],
    draft: {
      kind: "guidance",
      owner: "Unassigned",
      steps: [
        { title: "Open the cited responses", detail: "Read samples resp-aud-ae-002-07, -10 and -25 for p-ae-002 and p-ae-005, and the one sample that cites runpro.ae (-09)." },
        { title: "List the cited GulfRun pages", detail: "Note which GulfRun page each answer cites and which question it answers." },
        { title: "Compare with runpro.ae", detail: "Find the runpro.ae page that could answer the same question and check what it states: store location, delivery and returns." },
        { title: "Check local listings", detail: "Look at how RunPro appears for Dubai and Abu Dhabi in map and directory listings." },
        { title: "Write a note", detail: "Content gap, listing gap or neither. Do not change pages on the evidence of one audit." },
      ],
      sourceFacts: [
        { label: "November audit", value: "gulfrun.example cited in 10 of 12 · runpro.ae in 1 of 12", source: "Audit aud-ae-002, prompts p-ae-002 and p-ae-005" },
        { label: "Focused re-check", value: "gulfrun.example 6 of 9 · runpro.ae 2 of 9 (3 failed requests excluded)", source: "Audit aud-ae-003" },
        { label: "Weekly run", value: "gulfrun.example 9 of 12 · runpro.ae 1 of 12", source: "Monitoring run-ae-006" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora Plus.", diffHash: null, writes: [] },
    execution: {
      connector: null,
      cmsState: "guidance",
      remote: null,
      fields: [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Guidance only." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Re-run p-ae-002 and p-ae-005 with the same channels and 3 samples", expect: "Counts reported as n / d" },
        { id: "c2", label: "Failed requests reported separately", expect: "Not counted as absent" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-05T05:38:00Z", actor: "Audit aud-ae-002", kind: "created", title: "Finding fnd-ae-004 detected" },
      { id: "h2", at: "2026-11-18T10:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-11-18T10:31:00Z", actor: "System", kind: "status", title: "Task suggested", detail: "No assignee yet" },
    ],
  },

  // Sitemap redirects removed and verified by the next audit.
  "task-ae-005": {
    recommendationId: "rec-fnd-ae-005-a",
    createdAt: "2026-10-27T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["No sitemap URL redirects to runpro.pk", "Every sitemap URL returns HTTP 200 on runpro.ae"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "WooCommerce write access (at the time)", met: true },
    ],
    draft: {
      kind: "batch",
      resource: "Sitemap entries (9 legacy product URLs)",
      items: SITEMAP_SLUGS.map((slug, i) => ({
        id: `b${i + 1}`,
        pageUrl: `${AE_URL}/product/${slug}`,
        linkText: "Sitemap entry",
        from: "In sitemap.xml (301 to runpro.pk)",
        to: "Excluded from sitemap",
        result: "applied" as const,
      })),
      sourceFacts: [
        { label: "Redirecting URLs", value: "9 of 214 sitemap URLs return 301 to runpro.pk", source: "Audit aud-ae-001, sitemap check, 16 Sep" },
        { label: "Rule", value: "The sitemap lists only URLs that return 200 on runpro.ae", source: "Website readiness criteria 1.4" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-10-27T10:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-ae-005-sitemap"),
      writes: ["WooCommerce · 9 legacy products set to 'exclude from sitemap'", "No page content changes", "Takes effect when the sitemap regenerates"],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-10-28T08:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-10-28T09:20:00Z",
    },
    execution: {
      connector: WOO(["read", "write"], "This task wrote on 29 Oct, before write access was rejected on 18 Nov."),
      cmsState: "published",
      remote: {
        resource: "Sitemap exclusions · 9 products",
        versionAtDraft: "rev 12",
        versionNow: "rev 12",
        hashAtDraft: demoDigest("ae-sitemap-12"),
        hashNow: demoDigest("ae-sitemap-12"),
        checkedAt: "2026-10-29T07:39:00Z",
        changed: false,
        note: "Checked just before the write.",
      },
      fields: SITEMAP_SLUGS.map((slug) => ({ field: `${slug} · exclude from sitemap`, before: "Included", after: "Excluded", outcome: "written" as const })),
      completedAt: "2026-10-27T10:30:00Z",
      stagedAt: null,
      appliedAt: "2026-10-29T07:40:00Z",
      publishedAt: "2026-10-29T07:41:00Z",
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Verified on 5 Nov. Reverting the exclusions would be a new task." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Sitemap URLs that redirect", expect: "0" },
        { id: "c2", label: "Sitemap fetch", expect: "HTTP 200, valid XML" },
        { id: "c3", label: "Audit crawl coverage", expect: "Comparable with the baseline audit" },
      ],
      outcome: {
        result: "verified_success",
        ranAt: "2026-11-05T05:30:00Z",
        sourceLabel: "Full audit — November",
        sourceHref: "audits/aud-ae-002",
        findingEffect: "Finding fnd-ae-005 set to Verified resolved.",
        checks: [
          { id: "c1", label: "Sitemap URLs that redirect", before: { status: "fail", detail: "9 of 214 URLs return 301 to runpro.pk (16 Sep)" }, after: { status: "pass", detail: "0 of 205 URLs redirect" } },
          { id: "c2", label: "Sitemap fetch", before: { status: "pass", detail: "HTTP 200, valid XML" }, after: { status: "pass", detail: "HTTP 200, valid XML" } },
          { id: "c3", label: "Audit crawl coverage", before: { status: "warning", detail: "41 of 60 sampled pages reached (aud-ae-001)" }, after: { status: "pass", detail: "58 of 60 sampled pages reached (aud-ae-002)" } },
        ],
      },
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-09-16T05:26:00Z", actor: "Audit aud-ae-001", kind: "created", title: "Finding fnd-ae-005 detected" },
      { id: "h2", at: "2026-10-27T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h3", at: "2026-10-27T10:00:00Z", actor: "Drafting model", kind: "draft", title: "Batch drafted", detail: "9 resources" },
      { id: "h4", at: "2026-10-28T09:20:00Z", actor: "Sana Iqbal", kind: "approval", title: "Approved exact diff" },
      { id: "h5", at: "2026-10-29T07:40:00Z", actor: "System", kind: "execution", title: "Applied", detail: "Remote check passed; 9 of 9 written" },
      { id: "h6", at: "2026-10-29T07:41:00Z", actor: "System", kind: "execution", title: "Published", detail: "Sitemap regenerated" },
      { id: "h7", at: "2026-11-05T05:30:00Z", actor: "Audit aud-ae-002", kind: "verification", title: "Verified success", detail: "3 of 3 checks passed" },
    ],
  },

  // Rejected, reason recorded.
  "task-ae-006": {
    recommendationId: "rec-fnd-ae-006-a",
    createdAt: "2026-11-06T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The homepage states hot-weather suitability using supported facts only", "p-ae-003 re-run on the same channels with 3 samples"],
    dependencies: [{ label: "Assignee chosen", met: true }],
    rejection: {
      by: "Sana Iqbal",
      at: "2026-11-12T10:00:00Z",
      reason: "Not pursued now. One prompt, low confidence, and answers vary between runs. Accepted as a risk; revisit in January if the brand is still absent.",
    },
    draft: {
      kind: "guidance",
      owner: "Hira Malik",
      steps: [
        { title: "Review the homepage climate copy", detail: "Note whether the homepage says anything about running in heat." },
        { title: "List supported product facts", detail: "Use only facts from the spec sheet, such as upper material and cushioning." },
        { title: "Propose a short note", detail: "Two sentences at most. Do not claim a result in answers." },
      ],
      sourceFacts: [
        { label: "Prompt p-ae-003", value: "Brand absent in 6 of 6 successful responses (2 channels x 3 samples)", source: "Audit aud-ae-002 and monitoring run-ae-006" },
        { label: "Cited source", value: "gccfitness.example hot-weather running shoes", source: "Responses resp-aud-ae-002-13 to -18" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora Plus.", diffHash: null, writes: [] },
    execution: {
      connector: null,
      cmsState: "guidance",
      remote: null,
      fields: [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Guidance only." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Homepage states hot-weather suitability", expect: "Present" },
        { id: "c2", label: "p-ae-003 re-run with 3 samples per channel", expect: "Counts reported as n / d" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-05T05:39:00Z", actor: "Audit aud-ae-002", kind: "created", title: "Finding fnd-ae-006 detected" },
      { id: "h2", at: "2026-11-06T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-12T10:00:00Z", actor: "Sana Iqbal", kind: "status", title: "Task rejected", detail: "Accepted risk; revisit in January. Finding set to Accepted risk." },
    ],
  },
};

// ---------------------------------------------------------------------------
// Merged exports (all stores). Ids never collide between stores.
// ---------------------------------------------------------------------------

export const FINDING_EXTRAS: Record<string, FindingExtras> = { ...PK_FINDING_EXTRAS, ...AE_FINDING_EXTRAS };
export const RECOMMENDATIONS: Recommendation[] = [...PK_RECOMMENDATIONS, ...AE_RECOMMENDATIONS];
export const TASK_SUMMARY_EXTRAS: Record<string, { blockers: string[] }> = { ...PK_TASK_SUMMARY_EXTRAS, ...AE_TASK_SUMMARY_EXTRAS };
export const TASK_DETAILS: Record<string, TaskDetailSeed> = { ...PK_TASK_DETAILS, ...AE_TASK_DETAILS };
