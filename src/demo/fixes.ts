/**
 * DEMONSTRATION DATA — not real.
 * Fixes module detail around the shared findings and registry tasks of each store:
 * runpro-pk (fnd-001…011, task-001…008), runpro-ae (fnd-ae-001…006, task-ae-001…006),
 * nutrition (fnd-nu-001…008, task-nu-001…008) and threadly (fnd-th-001…008, task-th-001…008).
 * Fixed timestamps only. Read through src/services/fixes.ts.
 *
 * Wording rules honoured here: no causal claims, "Applied" is never "verified",
 * causes are classified confirmed / likely / hypothesis.
 */
import type {
  ExecutionMode,
  FindingExtras,
  Recommendation,
  RiskLevel,
  TaskDetailData,
  TaskStatus,
} from "@/types/fixes";
import type { Priority } from "@/types/shared-records";

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
    priorityRationale: "P1: Glide 2 is the flagship product page and the target of the November verification audit, so it is worked before lower-traffic pages even though nothing is broken.",
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
    priorityRationale: "P2: the severity is high, but it rests on 2 samples on one channel. Confirm it with a larger re-run before it takes priority over the price and crawler issues.",
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
    priorityRationale: "P2: the severity is low, but the wrong spelling is in the footer of every page and the fix is a quick text change, so it ships with the next content release.",
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
    problem: "Structured data says PKR 13,500; the visible price and the catalogue price are PKR 12,900.",
    evidenceIds: ["e1"],
    cause: { classification: "confirmed", basis: "Crawl and a read-only catalogue lookup agree on 12,900; the stale 13,500 comes from the structured-data field." },
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

/** Optional demo connector. Platform names are never shown in the Fixes UI. */
const CONNECTOR = (scopes: string[]) => ({
  label: "Website connector",
  site: "runpro.pk",
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

type TaskDetailSeed = Omit<TaskDetailData, "task" | "findingStatus">;

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
    approval: { state: "not_required", notRequiredReason: "AI draft only. Nothing is written to the site; a person applies the copy.", diffHash: demoDigest("task-001-copy"), writes: [] },
    execution: {
      connector: CONNECTOR(["read_products"]),
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
    dependencies: [{ label: "Owner or admin approval of the exact diff", met: false }, { label: "Connector with write access to products", met: true }],
    draft: {
      kind: "patch",
      resource: "Product glide-2 · metafield custom.structured_data",
      language: "json-ld",
      before: LD_BEFORE,
      after: LD_AFTER,
      sourceFacts: [
        { label: "Visible price", value: "PKR 12,900", source: "Crawl 19 Nov, /products/glide-2" },
        { label: "Variant price", value: "PKR 12,900", source: "Catalogue lookup (read only), 19 Nov 08:56" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-17T10:40:00Z",
      version: 1,
    },
    approval: {
      state: "pending",
      diffHash: demoDigest("task-002-patch"),
      writes: ["Product glide-2 · structured-data field", "1 line changed: offers.price 13500 → 12900", "Live on the product page after save"],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-18T11:20:00Z",
    },
    execution: {
      connector: CONNECTOR(["read_products", "write_products"]),
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
        { label: "Replacement targets", value: "Live collection and product URLs", source: "Catalogue lookup (read only)" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-16T09:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-003-batch"),
      writes: ["Collection descriptions for 2 pages, staged as drafts", "2 links replaced, 1 resource excluded", "Not published until a second step"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-17T09:00:00Z",
      decidedBy: "Omar Farooq",
      decidedAt: "2026-11-18T08:30:00Z",
      note: "Staged draft only. Publishing needs a separate action.",
    },
    execution: {
      connector: CONNECTOR(["read_products", "write_products"]),
      cmsState: "draft",
      remote: {
        resource: "Collection sale · description",
        versionAtDraft: "rev 27",
        versionNow: "rev 28",
        hashAtDraft: demoDigest("sale-desc-27"),
        hashNow: demoDigest("sale-desc-28"),
        checkedAt: "2026-11-19T08:45:00Z",
        changed: true,
        changedBy: "Aisha Khan (site team)",
        changedAt: "2026-11-18T14:20:00Z",
        note: "Description edited in the site admin after the draft was generated.",
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
      writes: ["Blog article created as a staged draft", "Published on approval of the publish step"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-12T08:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-13T09:10:00Z",
    },
    execution: {
      connector: CONNECTOR(["read_content", "write_content"]),
      cmsState: "published",
      remote: {
        resource: "Blog article · how-to-choose-a-running-shoe",
        versionAtDraft: "rev 1",
        versionNow: "rev 3",
        hashAtDraft: demoDigest("guide-1"),
        hashNow: demoDigest("guide-3"),
        checkedAt: "2026-11-19T08:40:00Z",
        changed: true,
        changedBy: "Hira Malik (site admin)",
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
        laterEdit: { by: "Hira Malik", at: "2026-11-17T10:12:00Z", note: "Intro paragraph edited in the site admin after publishing." },
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
      { id: "h5", at: "2026-11-14T08:05:00Z", actor: "System", kind: "execution", title: "Staged as a draft", detail: "Remote check passed" },
      { id: "h6", at: "2026-11-15T08:30:00Z", actor: "Hira Malik", kind: "execution", title: "Published" },
      { id: "h7", at: "2026-11-17T10:12:00Z", actor: "Hira Malik", kind: "execution", title: "Page edited in the site admin", detail: "Intro paragraph changed after publishing" },
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
        { label: "Profiles", value: "Instagram and Facebook, both official", source: "Website settings, brand profile" },
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
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Applied outside Rankvora AI. Revert in the theme editor." },
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
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
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
    dependencies: [],
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
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
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
      writes: ["Product marathon-elite · FAQ section added", "Live on the product page after save"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-04T11:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-05T09:30:00Z",
    },
    execution: {
      connector: CONNECTOR(["read_products", "write_products"]),
      cmsState: "draft",
      remote: {
        resource: "Product marathon-elite · description",
        versionAtDraft: "rev 62",
        versionNow: "rev 65",
        hashAtDraft: demoDigest("marathon-62"),
        hashNow: demoDigest("marathon-65"),
        checkedAt: "2026-11-09T14:05:00Z",
        changed: true,
        changedBy: "Aisha Khan (site team)",
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
      { id: "h5", at: "2026-11-07T12:40:00Z", actor: "Aisha Khan", kind: "execution", title: "Price banner edited in the site admin" },
      { id: "h6", at: "2026-11-09T13:30:00Z", actor: "System", kind: "verification", title: "Website check: layout shift on mobile", detail: "Lab CLS 0.24" },
      { id: "h7", at: "2026-11-09T14:10:00Z", actor: "Hira Malik", kind: "rollback", title: "Rolled back", detail: "FAQ block removed; later edit reconciled manually" },
    ],
  },
};


// ===========================================================================
// runpro-ae (RunPro UAE · runpro.ae)
// ===========================================================================

const AE_URL = "https://runpro.ae";

/** Optional demo connector as recorded today: write access was rejected on 18 Nov (connector needs attention). */
const WOO = (required: string[], note?: string) => ({
  label: "Website connector",
  site: "runpro.ae",
  state: "needs_attention" as const,
  scopesGranted: ["read_content"],
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
    severityRationale: "Critical: structured data reports USD while the page shows AED. A wrong currency can fail merchant-listing validation and mislead systems that read structured data.",
    priorityRationale: "P0: price data is customer-facing, the fix is two lines, and it must not wait behind other work. The apply attempt failed because the connector needs attention.",
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
    severityRationale: "Informational: one prompt, 2 channels, brand absent. Low confidence that a site change would matter; answers vary between runs, so this is recorded for awareness.",
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
    title: "Add Product and Offer JSON-LD to the product template",
    problem: "Product pages expose breadcrumb markup only. Price, currency and availability are not machine-readable.",
    evidenceIds: ["e1", "e2", "e3"],
    cause: { classification: "confirmed", basis: "Markup read directly from 3 product pages in the 16 Sep and 5 Nov audits." },
    action: "Add one Product block with a nested Offer (name, sku, price, priceCurrency AED, availability) to the single-product template, rendered from the product record.",
    why: "Structured data states price, currency and availability in a form crawlers can read. It does not guarantee rich results, rankings or AI citations.",
    expectedOutcome: "Every product page renders valid Product and Offer markup that matches the visible price in AED.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "cms_staged",
    dependencies: ["Connector write access", "Legacy Offer block on Glide 2 replaced first (task-ae-002), to avoid a duplicate Offer"],
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
    cause: { classification: "confirmed", basis: "The legacy snippet in the product meta data carries USD 349. The catalogue currency and the visible price are AED 1,280." },
    action: "Change priceCurrency from USD to AED and price from 349 to 1280 in the legacy Offer block of /product/glide-2, in one write.",
    why: "A wrong currency in structured data can fail merchant-listing checks. Changing the currency alone would publish AED 349, so both values change together. No ranking effect is claimed.",
    expectedOutcome: "Offer currency and price equal the visible price.",
    effort: "small",
    risk: "high",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff", "Connector write access"],
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
    limitations: ["Facts come from the policy pages crawled on 5 Nov", "A person adds the section on the site; no write by Rankvora AI"],
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
    action: "Set the 9 legacy products to 'exclude from sitemap' on the site. No page content changes.",
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
  "task-ae-001": { blockers: ["Publish needs approval and connector write access", "Waiting for task-ae-002 (legacy Offer on Glide 2)"] },
  "task-ae-002": { blockers: ["Connector write access was rejected. Reconnect before retrying."] },
  "task-ae-003": { blockers: [] },
  "task-ae-004": { blockers: [] },
  "task-ae-005": { blockers: [] },
  "task-ae-006": { blockers: [] },
};

const AE_TASK_DETAILS: Record<string, TaskDetailSeed> = {
  // Staged as a draft, not published, awaiting publish approval.
  "task-ae-001": {
    recommendationId: "rec-fnd-ae-001-a",
    createdAt: "2026-11-06T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Product and Offer JSON-LD present on all 3 sampled product pages", "priceCurrency is AED and price equals the visible price", "Markup validates without errors"],
    dependencies: [
      { label: "Staging approved (12 Nov)", met: true },
      { label: "Publish approval of the staged template", met: false },
      { label: "Connector write access", met: false },
      { label: "task-ae-002: legacy Offer on Glide 2 replaced, to avoid a duplicate Offer", met: false },
    ],
    draft: {
      kind: "patch",
      resource: "Product daily-trainer · rendered JSON-LD (template preview)",
      language: "json-ld",
      before: TEMPLATE_BEFORE,
      after: TEMPLATE_AFTER,
      sourceFacts: [
        { label: "Name and SKU", value: "RunPro Daily Trainer · RP-DTR", source: "Product record, read 10 Nov" },
        { label: "Price and currency", value: "AED 429.00", source: "Product record and visible price, crawl 5 Nov" },
        { label: "Availability", value: "In stock", source: "Stock status, read 10 Nov" },
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
        "Single-product JSON-LD template: the staged copy becomes live",
        "Applies to every product page once published",
        "Staging was approved on 12 Nov. This request covers publishing the staged template.",
      ],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-18T09:40:00Z",
    },
    execution: {
      connector: WOO(["read_content", "write_content"], "Staged on 12 Nov, before write access was rejected on 18 Nov. Publishing needs write access."),
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
      { id: "h6", at: "2026-11-12T10:20:00Z", actor: "System", kind: "execution", title: "Staged as a draft", detail: "Remote check passed. Not live." },
      { id: "h7", at: "2026-11-18T09:40:00Z", actor: "Hira Malik", kind: "approval", title: "Publish approval requested", detail: "Owner or admin must approve publishing the staged template" },
      { id: "h8", at: "2026-11-19T08:30:00Z", actor: "System", kind: "execution", title: "Remote check: staged copy unchanged", detail: "Write access is still rejected, so publishing is blocked" },
    ],
  },

  // Apply attempt failed because the connector needs attention. Nothing changed on the live site.
  "task-ae-002": {
    recommendationId: "rec-fnd-ae-002-a",
    createdAt: "2026-11-10T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Offer priceCurrency is AED", "Offer price equals the visible price (AED 1,280)", "Structured data validates without price or currency warnings"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "Connector write access", met: false },
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
        { label: "Catalogue currency", value: "AED", source: "Site settings, read 10 Nov" },
        { label: "Product price", value: "AED 1,280", source: "Product record, read 10 Nov" },
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
        "Product glide-2 · legacy Offer metadata",
        "2 lines changed: priceCurrency USD → AED, price 349 → 1280, in one write",
        "Live on the product page after save",
      ],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-11T10:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-12T09:15:00Z",
    },
    execution: {
      connector: WOO(["read_content", "write_content"], "Write access was rejected on 18 Nov. Reconnect in website settings to restore it."),
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
        retryBlockedBy: "The connector needs attention. Write access must be restored first.",
        nothingWritten: true,
        nextStep: "Reconnect the connector with read and write access, then retry. The approved diff and the unchanged remote copy are reused.",
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
      { id: "h9", at: "2026-11-18T05:30:00Z", actor: "System", kind: "status", title: "Task marked failed; connection needs attention", detail: "Connector write access rejected" },
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
        "No write by Rankvora AI",
        "Approval confirms the delivery and returns wording and its source facts",
        "Hira Malik then adds the section on the site and marks the task applied",
      ],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-18T08:30:00Z",
    },
    execution: {
      connector: WOO(["read_content"], "Only read access is needed to compare the page. An AI draft makes no write."),
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
    dependencies: [],
    draft: {
      kind: "guidance",
      owner: "Unassigned",
      steps: [
        { title: "Open the cited responses", detail: "Read samples resp-aud-ae-002-07, -10 and -25 for p-ae-002 and p-ae-005, and the one sample that cites runpro.ae (-09)." },
        { title: "List the cited GulfRun pages", detail: "Note which GulfRun page each answer cites and which question it answers." },
        { title: "Compare with runpro.ae", detail: "Find the runpro.ae page that could answer the same question and check what it states: shop location, delivery and returns." },
        { title: "Check local listings", detail: "Look at how RunPro appears for Dubai and Abu Dhabi in map and directory listings." },
        { title: "Write a note", detail: "Content gap, listing gap or neither. Do not change pages on the evidence of one audit." },
      ],
      sourceFacts: [
        { label: "November audit", value: "gulfrun.example cited in 10 of 12 · runpro.ae in 1 of 12", source: "Audit aud-ae-002, prompts p-ae-002 and p-ae-005" },
        { label: "Focused re-check", value: "gulfrun.example 6 of 9 · runpro.ae 2 of 9 (3 failed requests excluded)", source: "Audit aud-ae-003" },
        { label: "Weekly run", value: "gulfrun.example 9 of 12 · runpro.ae 1 of 12", source: "Monitoring run-ae-006" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
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
      { label: "Connector write access (at the time)", met: true },
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
      writes: ["9 legacy products set to 'exclude from sitemap'", "No page content changes", "Takes effect when the sitemap regenerates"],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-10-28T08:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-10-28T09:20:00Z",
    },
    execution: {
      connector: WOO(["read_content", "write_content"], "This task wrote on 29 Oct, before write access was rejected on 18 Nov."),
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
    dependencies: [],
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
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
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

// ===========================================================================
// nutrition (Nutrition · nutrition.example) — fictional informational website
// fnd-nu-001…008 and task-nu-001…008. Task statuses agree with REGISTRY_NU_TASKS.
// The connector is an optional WordPress example; no shop platform is involved.
// ===========================================================================

const NU_URL = "https://nutrition.example";

/** Optional demo connector (WordPress example). Neutral scope names; connected. */
const NU_CONNECTOR = (required: string[], note?: string) => ({
  label: "Website connector (WordPress example)",
  site: "nutrition.example",
  state: "connected" as const,
  scopesGranted: ["read_content", "write_content"],
  scopesRequired: required,
  note,
});

const NU_FINDING_EXTRAS: Record<string, FindingExtras> = {
  "fnd-nu-001": {
    severityRationale: "Medium: the guide shows six questions and answers that machines cannot read as FAQ data. Nothing visible to readers is broken.",
    priorityRationale: "P2: one guide, a small and reviewable markup change; it is the page behind the tracked meal-planning prompt.",
    verificationCriteria: [
      "FAQPage JSON-LD present on /guides/meal-planning",
      "The 6 marked-up questions and answers equal the visible text",
      "Markup validates without errors",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${NU_URL}/guides/meal-planning`, note: "6 visible questions and answers; Article markup only, no FAQPage", auditId: "aud-nu-001" },
      { id: "e2", kind: "page", url: `${NU_URL}/guides/meal-planning`, note: "Still no FAQPage markup", auditId: "aud-nu-003" },
      { id: "e3", kind: "prompt", promptId: "p-nu-002", note: "Meal-planning prompt this guide answers. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T02:30:00Z", source: "Initial audit", sourceHref: "audits/aud-nu-001", note: "FAQPage markup missing" },
      { id: "o2", at: "2026-11-09T02:38:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "Unchanged" },
    ],
  },
  "fnd-nu-002": {
    severityRationale: "High: health guidance without a named reviewer or credentials is a weak trust signal for readers and for systems that judge source quality. The page text itself is not wrong.",
    priorityRationale: "P1: three of the most-read health articles are affected and the fix is editorial, so it needs an owner or admin to approve the exact wording.",
    verificationCriteria: [
      "Each of the 3 articles names its author with credentials",
      "Each article names a qualified reviewer and a review date",
      "Every stated credential matches the editorial roster",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${NU_URL}/guides/protein-intake`, note: "Author named without credentials; no reviewer", auditId: "aud-nu-001" },
      { id: "e2", kind: "page", url: `${NU_URL}/guides/macros`, note: "No reviewer shown", auditId: "aud-nu-001" },
      { id: "e3", kind: "page", url: `${NU_URL}/blog/hydration`, note: "Author named without credentials; no reviewer", auditId: "aud-nu-001" },
      { id: "e4", kind: "prompt", promptId: "p-nu-001", note: "Trusted-sources prompt. Context only." },
      { id: "e5", kind: "prompt", promptId: "p-nu-007", note: "Daily-protein prompt. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T02:31:00Z", source: "Initial audit", sourceHref: "audits/aud-nu-001", note: "3 of 8 sampled health articles lack a reviewer" },
      { id: "o2", at: "2026-11-09T02:39:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "Unchanged on the same 3 articles" },
    ],
  },
  "fnd-nu-003": {
    severityRationale: "Critical: a noindex directive keeps the page out of search indexes, so the free course page cannot be found through search.",
    priorityRationale: "P0: raised on 9 Nov when the third audit still found the tag. One setting, easy to reverse, and the page promotes the free course.",
    verificationCriteria: [
      "No noindex directive in the meta robots tag or the X-Robots-Tag header",
      "Canonical points to the page itself",
      "Verification audit re-assesses the page and finds it indexable",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${NU_URL}/courses/nutrition-basics`, note: "meta robots: noindex, follow", auditId: "aud-nu-001" },
      { id: "e2", kind: "page", url: `${NU_URL}/courses/nutrition-basics`, note: "meta robots: noindex, follow (third audit in a row)", auditId: "aud-nu-003" },
      { id: "e3", kind: "page", url: `${NU_URL}/courses/nutrition-basics`, note: "meta robots: index, follow; self canonical", auditId: "aud-nu-004" },
      { id: "e4", kind: "prompt", promptId: "p-nu-006", note: "Free-course prompt. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T02:29:00Z", source: "Initial audit", sourceHref: "audits/aud-nu-001", note: "noindex found" },
      { id: "o2", at: "2026-10-22T01:33:00Z", source: "Scheduled audit — October", sourceHref: "audits/aud-nu-002", note: "Still present" },
      { id: "o3", at: "2026-11-09T02:36:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "Still present" },
      { id: "o4", at: "2026-11-16T03:10:00Z", source: "Verification — course page indexing", sourceHref: "audits/aud-nu-004", note: "No noindex directive" },
    ],
  },
  "fnd-nu-004": {
    severityRationale: "Low: duplicated titles and descriptions make recipe pages harder to tell apart in listings. Nothing is broken on the pages.",
    priorityRationale: "P2: six pages, a content-only change in a staged draft; two pages still need a second look.",
    verificationCriteria: ["Each of the 6 recipe pages has a unique title", "Each page has a unique meta description", "No recipe page repeats the category page title"],
    evidence: [
      { id: "e1", kind: "page", url: `${NU_URL}/recipes/meal-prep`, note: "Title “Recipes | Nutrition” shared with 5 other pages", auditId: "aud-nu-001" },
      { id: "e2", kind: "page", url: `${NU_URL}/recipes/high-protein-breakfast`, note: "Same title and meta description as /recipes/meal-prep", auditId: "aud-nu-003" },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T02:33:00Z", source: "Initial audit", sourceHref: "audits/aud-nu-001", note: "6 pages share one title" },
      { id: "o2", at: "2026-11-09T02:37:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "Unchanged" },
      { id: "o3", at: "2026-11-16T03:10:00Z", source: "Targeted re-check of 6 recipe pages", note: "4 of 6 unique; 2 still repeat the category title" },
    ],
  },
  "fnd-nu-005": {
    severityRationale: "Low: the Organization markup is valid but does not link the brand to its official profiles. No visible impact.",
    priorityRationale: "P3: one markup block on the home page; the change was made and awaits verification.",
    verificationCriteria: ["Organization JSON-LD lists the official profiles in sameAs", "Every sameAs URL is an official profile", "Markup validates"],
    evidence: [
      { id: "e1", kind: "page", url: `${NU_URL}/`, note: "Organization markup: name and logo; sameAs is empty", auditId: "aud-nu-002" },
      { id: "e2", kind: "page", url: `${NU_URL}/`, note: "Unchanged: sameAs still empty", auditId: "aud-nu-003" },
    ],
    observations: [
      { id: "o1", at: "2026-10-22T01:30:00Z", source: "Scheduled audit — October", sourceHref: "audits/aud-nu-002", note: "sameAs empty" },
      { id: "o2", at: "2026-11-09T02:40:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "Unchanged" },
      { id: "o3", at: "2026-11-17T02:30:00Z", source: "Publish check", note: "3 profiles in the live markup; not yet re-assessed by an audit" },
    ],
  },
  "fnd-nu-006": {
    severityRationale: "Medium: a competitor domain is cited more often than the owned domain on two beginner prompts. Citation-capable responses only; the cause is not established.",
    priorityRationale: "P2: two beginner prompts, the same split in the November audit and the 16 Nov weekly run. Confidence is medium.",
    verificationCriteria: [
      "Owned-domain citations counted on p-nu-003 and p-nu-004 with n / d",
      "Same channels, models and search modes as the baseline",
      "Failed requests excluded and reported separately",
    ],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-aud-nu-003-19", note: "OpenAI · p-nu-004 · sample 1 · cites nourishwell.example" },
      { id: "e2", kind: "response", responseId: "resp-aud-nu-003-21", note: "Gemini · p-nu-004 · sample 1 · cites nourishwell.example" },
      { id: "e3", kind: "response", responseId: "resp-aud-nu-003-23", note: "Perplexity · p-nu-004 · sample 1 · cites nourishwell.example" },
      { id: "e4", kind: "response", responseId: "resp-aud-nu-003-13", note: "OpenAI · p-nu-003 · sample 1 · one of the 3 responses citing nutrition.example (all on p-nu-003)" },
      { id: "e5", kind: "prompt", promptId: "p-nu-003", note: "Head-to-head prompt for beginners (version 2)" },
      { id: "e6", kind: "prompt", promptId: "p-nu-004", note: "Macros prompt for beginners" },
    ],
    observations: [
      { id: "o1", at: "2026-11-09T02:30:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "nourishwell.example 4 of 10, nutrition.example 3 of 10 (responses that returned citations); all 4 NourishWell citations are on p-nu-004" },
      { id: "o2", at: "2026-11-16T01:44:00Z", source: "Weekly monitoring — 16 Nov", sourceHref: "monitoring/runs/run-nu-006", note: "nourishwell.example 4 of 10, nutrition.example 3 of 10" },
    ],
  },
  "fnd-nu-007": {
    severityRationale: "Medium: lab LCP is 3.4 s on mobile against a 2.5 s target. There is no field data, so real-reader impact is unknown.",
    priorityRationale: "P2: one tool page that many guides link to; the fix is applied but not yet published, so it cannot be verified.",
    verificationCriteria: ["Lab LCP on mobile is 2.5 s or lower", "Hero image is served under 200 KB", "Lab CLS stays at or below 0.1"],
    evidence: [
      { id: "e1", kind: "page", url: `${NU_URL}/tools/calorie-calculator`, note: "Lab LCP 3.4 s on mobile; hero image 1.9 MB, loaded late", auditId: "aud-nu-003" },
      { id: "e2", kind: "page", url: `${NU_URL}/tools/calorie-calculator`, note: "Lab LCP 3.4 s on mobile, re-measured before the change", auditId: "aud-nu-004" },
    ],
    observations: [
      { id: "o1", at: "2026-11-09T02:35:00Z", source: "Full audit — November", sourceHref: "audits/aud-nu-003", note: "Lab LCP 3.4 s" },
      { id: "o2", at: "2026-11-16T03:09:00Z", source: "Verification — course page indexing", sourceHref: "audits/aud-nu-004", note: "Lab LCP 3.4 s, before the change" },
    ],
  },
  "fnd-nu-008": {
    severityRationale: "Informational: one neutral prompt, brand absent from all 4 successful samples. Answers vary between runs, so this is recorded for awareness.",
    priorityRationale: "P3: single informational prompt with low confidence. Accepted by the owner on 18 Nov; revisit in January.",
    verificationCriteria: ["Re-run p-nu-007 on the same channels with 3 samples each", "Report brand mentions with numerator and denominator", "Failed requests reported separately"],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-aud-nu-005-08", note: "OpenAI · sample 2 · brand absent; cites nourishwell.example" },
      { id: "e2", kind: "response", responseId: "resp-aud-nu-005-09", note: "Gemini · sample 1 · brand absent; cites nourishwell.example" },
      { id: "e3", kind: "response", responseId: "resp-aud-nu-005-12", note: "Perplexity · sample 2 · brand absent; cites nourishwell.example" },
      { id: "e4", kind: "response", responseId: "resp-aud-nu-005-07", note: "OpenAI · sample 1 · request failed. Excluded, not counted as absent." },
      { id: "e5", kind: "prompt", promptId: "p-nu-007", note: "Neutral daily-protein prompt" },
    ],
    observations: [{ id: "o1", at: "2026-11-18T05:08:00Z", source: "Triggered audit — new competitor suggested", sourceHref: "audits/aud-nu-005", note: "Absent in 4 of 4 successful responses; 2 failed requests excluded" }],
  },
};

const NU_RECOMMENDATIONS: Recommendation[] = [
  rec({
    id: "rec-fnd-nu-001-a",
    findingId: "fnd-nu-001",
    title: "Add FAQPage markup for the six questions on the meal-planning guide",
    problem: "The guide shows six questions and answers, but its markup describes the article only.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Markup read directly from the page in the 8 Oct and 9 Nov audits: Article only, no FAQPage." },
    action: "Add one FAQPage block with the six visible questions and answers, word for word, to the JSON-LD of /guides/meal-planning.",
    why: "Marked-up questions let systems read the answers as a list. This does not guarantee rich results, rankings or AI citations.",
    expectedOutcome: "The page carries valid FAQPage markup that equals the visible text.",
    effort: "small",
    risk: "medium",
    suggestedMode: "ai_draft",
    dependencies: ["Editor review of the draft"],
    limitations: ["Markup must equal the visible text; any later edit to the Q&A needs the markup updated", "A person adds the markup on the site; no write by Rankvora AI"],
    verificationPlan: ["Re-crawl /guides/meal-planning", "Compare the marked-up text with the visible text", "Validate the markup"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T09:00:00Z",
    taskId: "task-nu-001",
  }),
  rec({
    id: "rec-fnd-nu-002-a",
    findingId: "fnd-nu-002",
    title: "Add reviewer, credentials and review date to three health articles",
    problem: "Three articles show no named reviewer, and two show the author without credentials.",
    evidenceIds: ["e1", "e2", "e3"],
    cause: { classification: "confirmed", basis: "Bylines read from the three pages in the 8 Oct and 9 Nov audits." },
    action: "Add a reviewer block under the byline of /guides/protein-intake, /guides/macros and /blog/hydration: author credentials, reviewer name and credential, review date, and a general-information note.",
    why: "Named, qualified review is a trust signal for readers and for systems that judge source quality. It does not guarantee a mention or a ranking.",
    expectedOutcome: "Each article states who wrote it, who reviewed it, their credentials and the review date.",
    effort: "medium",
    risk: "high",
    suggestedMode: "approved_apply",
    dependencies: ["Reviewer roster confirmed", "Owner or admin approval of the exact wording"],
    limitations: ["Health content: only credentials on the editorial roster may be stated", "Writes to three live articles", "Reviewers must have actually reviewed each article"],
    verificationPlan: ["Re-crawl the three articles", "Check each stated credential against the roster", "Confirm the review date is shown"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T09:10:00Z",
    taskId: "task-nu-002",
  }),
  rec({
    id: "rec-fnd-nu-003-a",
    findingId: "fnd-nu-003",
    title: "Remove the noindex tag from the Nutrition Basics course page",
    problem: "The course page carries meta robots “noindex, follow”, so it is kept out of search indexes.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "The tag is present in the page head on every audit from 8 Oct to 9 Nov; the page setting “hide from search engines” is on." },
    action: "Set the meta robots value of /courses/nutrition-basics to “index, follow” (turn the hide-from-search setting off). No content changes.",
    why: "A page with noindex cannot appear in search results. Removing it makes the page eligible; it does not guarantee indexing speed, rankings or AI citations.",
    expectedOutcome: "The page is indexable, with a self-referencing canonical.",
    effort: "small",
    risk: "medium",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff", "Connector with write access to pages"],
    limitations: ["Writes to a live page", "Search engines index at their own pace"],
    verificationPlan: ["Re-crawl the course page in a verification audit", "Check meta robots and the X-Robots-Tag header", "Check the canonical"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-09T07:30:00Z",
    taskId: "task-nu-003",
  }),
  rec({
    id: "rec-fnd-nu-004-a",
    findingId: "fnd-nu-004",
    title: "Give six recipe pages unique titles and meta descriptions",
    problem: "Six recipe pages share the title “Recipes | Nutrition” and one meta description.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "likely", basis: "The recipe template falls back to the category title when the page title field is empty." },
    action: "Write one distinct title and meta description per recipe page and stage them as drafts, then apply and publish in a separate step.",
    why: "Distinct titles help readers and crawlers tell the pages apart in listings. No ranking effect is claimed.",
    expectedOutcome: "Six unique titles and descriptions, none equal to the category page title.",
    effort: "small",
    risk: "low",
    suggestedMode: "cms_staged",
    dependencies: ["Staged-draft approval"],
    limitations: ["Pages that use the category template may ignore the custom title field", "Cached copies may show the old title for a short time"],
    verificationPlan: ["Re-check all 6 pages", "Confirm each title and description is unique", "Confirm none equals the category title"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-09T07:40:00Z",
    taskId: "task-nu-004",
  }),
  rec({
    id: "rec-fnd-nu-005-a",
    findingId: "fnd-nu-005",
    title: "List the three official profiles in Organization sameAs",
    problem: "Organization markup has a name and logo but an empty sameAs list.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Markup read directly from the home page in the 22 Oct and 9 Nov audits." },
    action: "Add the three official profile URLs to sameAs in the Organization JSON-LD of the home page.",
    why: "Explicit identity links help systems tell which profiles belong to the brand. No mention or ranking is guaranteed.",
    expectedOutcome: "sameAs lists three official profiles and the markup validates.",
    effort: "small",
    risk: "low",
    suggestedMode: "ai_draft",
    dependencies: ["Official profile URLs confirmed"],
    limitations: ["Only profiles confirmed as official by the owner are listed", "A person edits the markup in the site editor"],
    verificationPlan: ["Re-crawl the home page", "Validate the markup"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T09:20:00Z",
    taskId: "task-nu-005",
  }),
  rec({
    id: "rec-fnd-nu-006-a",
    findingId: "fnd-nu-006",
    title: "Review the beginner-prompt citations against NourishWell",
    problem: "nourishwell.example is cited in 4 of 10 responses that returned citations; nutrition.example in 3 of 10. All 4 NourishWell citations are on the macros prompt p-nu-004, where nutrition.example is cited in 0 of 5.",
    evidenceIds: ["e1", "e2", "e3", "e4"],
    cause: { classification: "hypothesis", basis: "NourishWell may have a clearer beginner page for the same question. Not established; answers vary between runs." },
    action: "Read the cited NourishWell pages and the nutrition.example pages that could answer the same questions, then write a note on whether the gap is content, structure or neither.",
    why: "A consistent split on two prompts deserves a look before any content is changed. Two audits are not a trend.",
    expectedOutcome: "A short note that names the gap or records normal variation.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["p-nu-003 changed wording on 27 Oct; compare only slots of the same prompt version", "2 of 12 responses returned no citations and are not counted"],
    verificationPlan: ["Re-run p-nu-003 and p-nu-004 on the same channels with 3 samples", "Report owned-domain citations as n / d"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-17T08:30:00Z",
    taskId: "task-nu-006",
  }),
  rec({
    id: "rec-fnd-nu-006-b",
    findingId: "fnd-nu-006",
    title: "Add a plain-language beginner section to the macros guide",
    problem: "No page on nutrition.example opens with a short beginner explanation of macros.",
    evidenceIds: ["e5", "e6"],
    cause: { classification: "hypothesis", basis: "Untested. No evidence that a beginner section changes which sources are cited." },
    action: "Draft a short beginner section for /guides/macros that defines protein, carbohydrate and fat in one sentence each, with a link to the free basics course.",
    why: "An owned page that answers the beginner question gives channels something to cite. Citations are not guaranteed.",
    expectedOutcome: "A section whose statements are supported by the guide itself.",
    effort: "medium",
    risk: "low",
    suggestedMode: "ai_draft",
    dependencies: ["Review of the task-nu-006 note first"],
    limitations: ["Hypothesis only", "Indexing time is outside our control"],
    verificationPlan: ["Check the section renders", "Re-run p-nu-004 as context only"],
  }),
  rec({
    id: "rec-fnd-nu-007-a",
    findingId: "fnd-nu-007",
    title: "Shrink and preload the calculator hero image; defer the calculator script",
    problem: "The page loads a 1.9 MB hero image late and a blocking script before it. Lab LCP is 3.4 s on mobile.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "likely", basis: "The lab trace shows the hero image as the LCP element, loaded after the blocking script." },
    action: "Serve a 140 KB WebP hero with high fetch priority and load the calculator script with defer on /tools/calorie-calculator.",
    why: "Faster loading of the largest element improves the lab LCP. Real-reader impact is unknown without field data.",
    expectedOutcome: "Lab LCP of 2.5 s or lower on mobile, with no new layout shift.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff", "Connector with write access to pages"],
    limitations: ["Lab measurement only", "Writes to a live page when published"],
    verificationPlan: ["Re-measure lab LCP on mobile", "Check image size and CLS", "Run after the change is published"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T09:30:00Z",
    taskId: "task-nu-007",
  }),
  rec({
    id: "rec-fnd-nu-008-a",
    findingId: "fnd-nu-008",
    title: "Add a short protein-intake answer block to the homepage",
    problem: "The brand is absent from all 4 successful answers to the daily-protein prompt.",
    evidenceIds: ["e1", "e2", "e3", "e5"],
    cause: { classification: "hypothesis", basis: "The homepage may not state a protein answer. One neutral prompt; 2 of 6 requests failed; answers vary between runs." },
    action: "Propose a two-sentence general answer on the homepage that links to /guides/protein-intake, using only facts from that guide.",
    why: "A page that states the answer gives readers and channels an owned source. No mention is guaranteed.",
    expectedOutcome: "A short, factual answer block linking to the guide.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["Hypothesis only", "Based on one prompt and 4 successful samples"],
    verificationPlan: ["Re-run p-nu-007 on the same channels with 3 samples"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-18T06:30:00Z",
    decisionNote: "Task cancelled on 18 Nov: accepted risk, revisit in January.",
    taskId: "task-nu-008",
  }),
];

// ---- Task details ----------------------------------------------------------

const NU_QA: [string, string][] = [
  ["How many meals should a weekly plan include?", "Most plans cover three main meals and one or two snacks a day. Adjust the number to your routine."],
  ["How do I balance a plate?", "Aim for about half vegetables and fruit, a quarter protein foods and a quarter whole grains."],
  ["Can I prepare meals ahead?", "Yes. Cooked grains, roasted vegetables and soups keep for three to four days in the fridge."],
  ["How do I plan a vegetarian week?", "Rotate beans, lentils, tofu, eggs or dairy as protein sources and repeat the ones you like."],
  ["How can I reduce food waste?", "Plan meals with overlapping ingredients and freeze leftovers in single portions."],
  ["Is this plan medical advice?", "No. This guide is general information. Speak to a qualified professional about personal needs."],
];

const NU_ARTICLE = {
  "@type": "Article",
  headline: "How to build a balanced weekly meal plan",
  author: { "@type": "Person", name: "Priya Nair" },
  url: `${NU_URL}/guides/meal-planning`,
};
const NU_FAQ_BEFORE = JSON.stringify({ "@context": "https://schema.org", ...NU_ARTICLE }, null, 2);
const NU_FAQ_AFTER = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@graph": [
      NU_ARTICLE,
      {
        "@type": "FAQPage",
        mainEntity: NU_QA.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  },
  null,
  2,
);

const NU_BYLINE_BEFORE = "By Priya Nair\nUpdated 3 Sep 2026";
const NU_BYLINE_AFTER =
  "By Priya Nair, BSc Nutrition (writer)\nReviewed by Jordan Ellery, RD (dietitian reviewer) · Reviewed 14 Nov 2026\nThis article is general information, not medical advice.\nJordan Ellery is registered with the national dietetics board. All guidance follows current national guidelines.";
const NU_BYLINE_ALT =
  "By Priya Nair, BSc Nutrition (writer)\nReviewed by Jordan Ellery, RD (dietitian reviewer) · Reviewed 14 Nov 2026\nThis article is general information, not medical advice.";

const NU_ROBOTS_BEFORE = `<head>
  <title>Nutrition Basics: a free beginner course | Nutrition</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${NU_URL}/courses/nutrition-basics">
</head>`;
const NU_ROBOTS_AFTER = NU_ROBOTS_BEFORE.replace("noindex, follow", "index, follow");

const NU_RECIPES: { slug: string; title: string; ok: boolean; reason?: string }[] = [
  { slug: "meal-prep", title: "Meal-prep recipes for the week | Nutrition", ok: false, reason: "Live title still “Recipes | Nutrition” at the re-check. This page uses the category template, which ignores the custom title field." },
  { slug: "high-protein-breakfast", title: "High-protein breakfast ideas | Nutrition", ok: false, reason: "Live title unchanged at the re-check. A cached copy is the likely cause; re-check after the cache clears." },
  { slug: "lentil-soup", title: "Easy lentil soup in 30 minutes | Nutrition", ok: true },
  { slug: "overnight-oats", title: "Overnight oats: four base recipes | Nutrition", ok: true },
  { slug: "chickpea-salad", title: "Chickpea salad with lemon dressing | Nutrition", ok: true },
  { slug: "veggie-stir-fry", title: "Veggie stir-fry for beginners | Nutrition", ok: true },
];
const NU_CATEGORY_TITLE = "Recipes | Nutrition";

const NU_ORG_BEFORE = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Nutrition",
  "url": "${NU_URL}/",
  "logo": "${NU_URL}/assets/logo.png",
  "sameAs": []
}`;
const NU_ORG_AFTER = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Nutrition",
  "url": "${NU_URL}/",
  "logo": "${NU_URL}/assets/logo.png",
  "sameAs": [
    "https://www.linkedin.example/company/nutrition",
    "https://www.instagram.example/nutrition",
    "https://www.youtube.example/@nutrition"
  ]
}`;

const NU_PERF_BEFORE = `hero_image: calculator-hero.png   # 1.9 MB
hero_fetch_priority: auto
hero_preload: off
calculator_script: blocking      # loaded in the head`;
const NU_PERF_AFTER = `hero_image: calculator-hero.webp  # 140 KB
hero_fetch_priority: high
hero_preload: on
calculator_script: defer         # loaded after the page`;

const NU_TASK_SUMMARY_EXTRAS: Record<string, { blockers: string[] }> = {
  "task-nu-001": { blockers: [] },
  "task-nu-002": { blockers: [] },
  "task-nu-003": { blockers: [] },
  "task-nu-004": { blockers: [] },
  "task-nu-005": { blockers: [] },
  "task-nu-006": { blockers: [] },
  "task-nu-007": { blockers: ["Applied on 17 Nov but not published yet. Verification cannot start until it is live."] },
  "task-nu-008": { blockers: [] },
};

const NU_TASK_DETAILS: Record<string, TaskDetailSeed> = {
  // AI draft of FAQPage markup, ready for an editor. Nothing applied.
  "task-nu-001": {
    recommendationId: "rec-fnd-nu-001-a",
    createdAt: "2026-11-10T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["FAQPage JSON-LD present on /guides/meal-planning", "The 6 marked-up questions and answers equal the visible text", "Markup validates without errors"],
    dependencies: [
      { label: "Visible questions and answers captured (crawl 9 Nov)", met: true },
      { label: "Editor review of the draft", met: false },
    ],
    draft: {
      kind: "patch",
      resource: "Guide page · /guides/meal-planning · JSON-LD",
      language: "json-ld",
      before: NU_FAQ_BEFORE,
      after: NU_FAQ_AFTER,
      sourceFacts: [
        { label: "Questions and answers", value: "6 visible, copied word for word", source: "Crawl 9 Nov, /guides/meal-planning" },
        { label: "Article", value: "Headline, author and URL already in the markup", source: "Audit aud-nu-003" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-17T04:30:00Z",
      version: 1,
    },
    approval: { state: "not_required", notRequiredReason: "AI draft only. Nothing is written to the site; a person adds the markup.", diffHash: demoDigest("task-nu-001-faq"), writes: [] },
    execution: {
      connector: NU_CONNECTOR(["read_content"], "Only read access is needed to compare the page. An AI draft makes no write."),
      cmsState: "draft",
      remote: {
        resource: "Page guides/meal-planning · JSON-LD",
        versionAtDraft: "rev 18",
        versionNow: "rev 18",
        hashAtDraft: demoDigest("nu-mealplan-jsonld-18"),
        hashNow: demoDigest("nu-mealplan-jsonld-18"),
        checkedAt: "2026-11-19T08:48:00Z",
        changed: false,
      },
      fields: [{ field: "FAQPage markup", before: "(none)", after: "6 questions", outcome: "pending", note: "Added by a person after review" }],
      completedAt: "2026-11-18T07:20:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "FAQPage markup present", expect: "Present" },
        { id: "c2", label: "Marked-up text equals visible text", expect: "6 of 6 equal" },
        { id: "c3", label: "Markup validates", expect: "No errors" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-08T02:30:00Z", actor: "Audit aud-nu-001", kind: "created", title: "Finding fnd-nu-001 detected" },
      { id: "h2", at: "2026-11-10T09:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-17T04:30:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated", detail: "6 questions marked up, 0 unsupported claims" },
      { id: "h4", at: "2026-11-18T07:20:00Z", actor: "Hira Malik", kind: "status", title: "Marked draft ready" },
    ],
  },

  // High-risk write to three health articles, waiting for owner or admin approval of the exact diff.
  "task-nu-002": {
    recommendationId: "rec-fnd-nu-002-a",
    createdAt: "2026-11-10T09:10:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Each of the 3 articles names its author with credentials", "Each article names a qualified reviewer and a review date", "Every stated credential matches the editorial roster"],
    dependencies: [
      { label: "Reviewer roster confirmed (12 Nov)", met: true },
      { label: "Owner or admin approval of the exact diff", met: false },
      { label: "Connector with write access to pages", met: true },
    ],
    draft: {
      kind: "text",
      resource: "Health articles · reviewer block (/guides/protein-intake shown)",
      field: "Byline and reviewer block",
      before: NU_BYLINE_BEFORE,
      after: NU_BYLINE_AFTER,
      alternate: { after: NU_BYLINE_ALT, unsupportedClaims: [] },
      sourceFacts: [
        { label: "Author", value: "Priya Nair, BSc Nutrition", source: "Editorial roster (demo), 12 Nov" },
        { label: "Reviewer", value: "Jordan Ellery, RD (fictional reviewer)", source: "Editorial roster (demo), 12 Nov" },
        { label: "Review date", value: "14 Nov 2026", source: "Reviewer sign-off note, 14 Nov" },
        { label: "Articles", value: "3: protein-intake, macros, hydration", source: "Audit aud-nu-001" },
      ],
      unsupportedClaims: [
        { text: "Jordan Ellery is registered with the national dietetics board.", reason: "The roster states the credential RD only, not a registration body." },
        { text: "All guidance follows current national guidelines.", reason: "No source fact names a guideline or checks the articles against one." },
      ],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-14T05:00:00Z",
      version: 1,
    },
    approval: {
      state: "pending",
      diffHash: demoDigest("task-nu-002-byline"),
      writes: [
        "3 articles: reviewer block added under the byline",
        "Author credentials, reviewer name and credential, review date",
        "Live on each article after save",
      ],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-18T09:15:00Z",
    },
    execution: {
      connector: NU_CONNECTOR(["read_content", "write_content"]),
      cmsState: "draft",
      remote: {
        resource: "Page guides/protein-intake · byline block",
        versionAtDraft: "rev 44",
        versionNow: "rev 44",
        hashAtDraft: demoDigest("nu-protein-byline-44"),
        hashNow: demoDigest("nu-protein-byline-44"),
        checkedAt: "2026-11-19T08:52:00Z",
        changed: false,
      },
      fields: [
        { field: "/guides/protein-intake · reviewer block", before: NU_BYLINE_BEFORE.replace("\n", " · "), after: "Author credentials and reviewer added", outcome: "pending" },
        { field: "/guides/macros · reviewer block", before: "By Priya Nair · no reviewer", after: "Author credentials and reviewer added", outcome: "pending" },
        { field: "/blog/hydration · reviewer block", before: "By Priya Nair · no reviewer", after: "Author credentials and reviewer added", outcome: "pending" },
      ],
      completedAt: "2026-11-14T05:30:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Author credentials shown on all 3 articles", expect: "3 of 3" },
        { id: "c2", label: "Reviewer and review date shown on all 3 articles", expect: "3 of 3" },
        { id: "c3", label: "Stated credentials match the roster", expect: "No mismatch" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-08T02:31:00Z", actor: "Audit aud-nu-001", kind: "created", title: "Finding fnd-nu-002 detected" },
      { id: "h2", at: "2026-11-10T09:10:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Omar Farooq" },
      { id: "h3", at: "2026-11-14T05:00:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated", detail: "2 unsupported claims flagged" },
      { id: "h4", at: "2026-11-18T09:15:00Z", actor: "Omar Farooq", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
    ],
  },

  // Applied, published and verified by the verification audit.
  "task-nu-003": {
    recommendationId: "rec-fnd-nu-003-a",
    createdAt: "2026-11-09T07:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["No noindex directive in the meta robots tag or the X-Robots-Tag header", "Canonical points to the page itself", "Verification audit finds the page indexable"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "Connector with write access to pages (at the time)", met: true },
      { label: "Live value unchanged since draft", met: true },
    ],
    draft: {
      kind: "patch",
      resource: "Page · /courses/nutrition-basics · robots meta",
      language: "html",
      before: NU_ROBOTS_BEFORE,
      after: NU_ROBOTS_AFTER,
      sourceFacts: [
        { label: "Current value", value: "robots: noindex, follow", source: "Crawl 9 Nov, audit aud-nu-003" },
        { label: "Page setting", value: "“Hide from search engines” is on", source: "Page settings, read 9 Nov" },
        { label: "Canonical", value: "Self-referencing; unchanged", source: "Crawl 9 Nov" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-09T08:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-nu-003-robots"),
      writes: ["Page /courses/nutrition-basics · robots meta", "1 line changed: noindex, follow → index, follow", "No content change; live after the publish step"],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-10T02:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-10T06:45:00Z",
    },
    execution: {
      connector: NU_CONNECTOR(["read_content", "write_content"]),
      cmsState: "published",
      remote: {
        resource: "Page courses/nutrition-basics · robots meta",
        versionAtDraft: "rev 9",
        versionNow: "rev 9",
        hashAtDraft: demoDigest("nu-course-robots-9"),
        hashNow: demoDigest("nu-course-robots-9"),
        checkedAt: "2026-11-11T02:09:00Z",
        changed: false,
        note: "Checked just before the write.",
      },
      fields: [{ field: "robots meta", before: "noindex, follow", after: "index, follow", outcome: "written", note: "Applied 11 Nov, published 12 Nov" }],
      completedAt: "2026-11-09T08:30:00Z",
      stagedAt: null,
      appliedAt: "2026-11-11T02:10:00Z",
      publishedAt: "2026-11-12T01:30:00Z",
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Verified on 16 Nov. Reverting the setting would be a new task." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "No noindex in the meta robots tag", expect: "Absent" },
        { id: "c2", label: "No noindex in the X-Robots-Tag header", expect: "Absent" },
        { id: "c3", label: "Canonical points to the page itself", expect: "Self" },
        { id: "c4", label: "Page reached by the verification audit", expect: "Assessed" },
      ],
      outcome: {
        result: "verified_success",
        ranAt: "2026-11-16T03:10:00Z",
        sourceLabel: "Verification — course page indexing",
        sourceHref: "audits/aud-nu-004",
        findingEffect: "Finding fnd-nu-003 set to Verified resolved.",
        checks: [
          { id: "c1", label: "No noindex in the meta robots tag", before: { status: "fail", detail: "noindex, follow (9 Nov)" }, after: { status: "pass", detail: "index, follow" } },
          { id: "c2", label: "No noindex in the X-Robots-Tag header", before: { status: "pass", detail: "Header absent" }, after: { status: "pass", detail: "Header absent" } },
          { id: "c3", label: "Canonical points to the page itself", before: { status: "pass", detail: "Self canonical" }, after: { status: "pass", detail: "Self canonical" } },
          { id: "c4", label: "Page reached by the verification audit", before: { status: "pass", detail: "Assessed in aud-nu-003" }, after: { status: "pass", detail: "Assessed: 5 of 5 pages (aud-nu-004)" } },
        ],
      },
      simulated: null,
      context: { label: "Brand mention rate on the free-course prompt p-nu-006 (context only)", n: 1, d: 3, basis: "3 responses, 1 sample each, verification audit. Directional." },
    },
    history: [
      { id: "h1", at: "2026-10-08T02:29:00Z", actor: "Audit aud-nu-001", kind: "created", title: "Finding fnd-nu-003 detected" },
      { id: "h2", at: "2026-11-09T02:36:00Z", actor: "Audit aud-nu-003", kind: "status", title: "Finding observed again", detail: "Third audit with the tag present; priority raised to P0" },
      { id: "h3", at: "2026-11-09T07:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Omar Farooq" },
      { id: "h4", at: "2026-11-09T08:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted", detail: "1 line changed" },
      { id: "h5", at: "2026-11-10T02:00:00Z", actor: "Omar Farooq", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
      { id: "h6", at: "2026-11-10T06:45:00Z", actor: "Sana Iqbal", kind: "approval", title: "Approved exact diff" },
      { id: "h7", at: "2026-11-11T02:10:00Z", actor: "System", kind: "execution", title: "Applied", detail: "Remote check passed; 1 of 1 written. Not live yet." },
      { id: "h8", at: "2026-11-12T01:30:00Z", actor: "Omar Farooq", kind: "execution", title: "Published", detail: "Page revision live; cache cleared" },
      { id: "h9", at: "2026-11-16T03:10:00Z", actor: "Audit aud-nu-004", kind: "verification", title: "Verified success", detail: "4 of 4 checks passed" },
    ],
  },

  // Staged, applied and published; 4 of 6 pages verified.
  "task-nu-004": {
    recommendationId: "rec-fnd-nu-004-a",
    createdAt: "2026-11-09T07:40:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Each of the 6 recipe pages has a unique title", "Each page has a unique meta description", "No recipe page repeats the category page title"],
    dependencies: [
      { label: "Staged-draft approval", met: true },
      { label: "Connector with write access to pages (at the time)", met: true },
      { label: "Re-check of the 2 pages that still repeat the title", met: false },
    ],
    draft: {
      kind: "batch",
      resource: "Recipe pages · title and meta description (6 resources)",
      items: NU_RECIPES.map((r, i) => ({
        id: `b${i + 1}`,
        pageUrl: `${NU_URL}/recipes/${r.slug}`,
        linkText: "Title and meta description",
        from: NU_CATEGORY_TITLE,
        to: r.title,
        result: "applied" as const,
        reason: r.ok ? undefined : r.reason,
      })),
      sourceFacts: [
        { label: "Duplicated title", value: `“${NU_CATEGORY_TITLE}” on 6 recipe pages`, source: "Audit aud-nu-001, crawl 8 Oct" },
        { label: "Duplicated description", value: "One meta description on 6 recipe pages", source: "Audit aud-nu-003, crawl 9 Nov" },
        { label: "Rule", value: "Every indexable page has a unique title and description", source: "Website readiness criteria 2.3" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-10T04:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-nu-004-recipes"),
      writes: ["6 recipe pages: title and meta description set as staged drafts", "Category page not changed", "Not live until the apply and publish steps"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-11T08:00:00Z",
      decidedBy: "Omar Farooq",
      decidedAt: "2026-11-11T09:20:00Z",
      note: "Staged draft only. Publishing needs a separate action.",
    },
    execution: {
      connector: NU_CONNECTOR(["read_content", "write_content"]),
      cmsState: "published",
      remote: {
        resource: "Recipe pages · 6 titles and descriptions",
        versionAtDraft: "rev 31",
        versionNow: "rev 31",
        hashAtDraft: demoDigest("nu-recipes-31"),
        hashNow: demoDigest("nu-recipes-31"),
        checkedAt: "2026-11-12T02:19:00Z",
        changed: false,
        note: "Checked just before staging.",
      },
      fields: NU_RECIPES.map((r) => ({
        field: `/recipes/${r.slug} · title and description`,
        before: NU_CATEGORY_TITLE,
        after: r.title,
        outcome: "written" as const,
        note: r.ok ? undefined : "Written; live title unchanged at the 16 Nov re-check",
      })),
      completedAt: "2026-11-10T04:30:00Z",
      stagedAt: "2026-11-12T02:20:00Z",
      appliedAt: "2026-11-13T02:05:00Z",
      publishedAt: "2026-11-13T02:10:00Z",
      rollback: { ...EMPTY_ROLLBACK, available: true },
    },
    verification: {
      plannedChecks: NU_RECIPES.map((r, i) => ({ id: `c${i + 1}`, label: `Unique title and description on /recipes/${r.slug}`, expect: "Unique, not the category title" })),
      outcome: {
        result: "partially_verified",
        ranAt: "2026-11-16T03:10:00Z",
        sourceLabel: "Targeted re-check of 6 recipe pages",
        findingEffect: "Finding fnd-nu-004 stays In remediation: 4 of 6 pages fixed, 2 still repeat the category title.",
        checks: NU_RECIPES.map((r, i) => ({
          id: `c${i + 1}`,
          label: `Unique title and description on /recipes/${r.slug}`,
          before: { status: "fail" as const, detail: `Title “${NU_CATEGORY_TITLE}” shared with the other recipe pages (9 Nov)` },
          after: r.ok
            ? { status: "pass" as const, detail: `Title “${r.title}”; description unique` }
            : { status: "fail" as const, detail: r.reason ?? "Title unchanged" },
        })),
      },
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-08T02:33:00Z", actor: "Audit aud-nu-001", kind: "created", title: "Finding fnd-nu-004 detected" },
      { id: "h2", at: "2026-11-09T07:40:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-10T04:00:00Z", actor: "Drafting model", kind: "draft", title: "Batch drafted", detail: "6 resources" },
      { id: "h4", at: "2026-11-11T08:00:00Z", actor: "Hira Malik", kind: "approval", title: "Staging approval requested" },
      { id: "h5", at: "2026-11-11T09:20:00Z", actor: "Omar Farooq", kind: "approval", title: "Staged draft approved", detail: "Staged draft only. Publishing needs a separate action." },
      { id: "h6", at: "2026-11-12T02:20:00Z", actor: "System", kind: "execution", title: "Staged as a draft", detail: "Remote check passed; 6 of 6 staged. Not live." },
      { id: "h7", at: "2026-11-13T02:05:00Z", actor: "Hira Malik", kind: "execution", title: "Applied", detail: "6 of 6 written as page revisions" },
      { id: "h8", at: "2026-11-13T02:10:00Z", actor: "Hira Malik", kind: "execution", title: "Published", detail: "Cache cleared" },
      { id: "h9", at: "2026-11-16T03:10:00Z", actor: "System", kind: "verification", title: "Partially verified", detail: "4 of 6 pages fixed; 2 still repeat the category title" },
    ],
  },

  // Applied by hand and published; waiting for verification.
  "task-nu-005": {
    recommendationId: "rec-fnd-nu-005-a",
    createdAt: "2026-11-10T09:20:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Organization JSON-LD lists the official profiles in sameAs", "Every sameAs URL is an official profile", "Markup validates"],
    dependencies: [{ label: "Official profile URLs confirmed by the owner", met: true }],
    draft: {
      kind: "patch",
      resource: "Home page · Organization JSON-LD",
      language: "json-ld",
      before: NU_ORG_BEFORE,
      after: NU_ORG_AFTER,
      sourceFacts: [
        { label: "Official profiles", value: "LinkedIn, Instagram and YouTube", source: "Website settings, brand profile" },
        { label: "Current markup", value: "Name and logo present; sameAs empty", source: "Audit aud-nu-003" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-12T03:00:00Z",
      version: 1,
    },
    approval: { state: "not_required", notRequiredReason: "AI draft only. The snippet was applied by hand by Omar Farooq.", diffHash: demoDigest("task-nu-005-org"), writes: [] },
    execution: {
      connector: null,
      cmsState: "published",
      remote: null,
      fields: [{ field: "sameAs", before: "(empty)", after: "3 profiles", outcome: "written", note: "Applied by hand in the site editor; page cache cleared" }],
      completedAt: "2026-11-12T08:00:00Z",
      stagedAt: null,
      appliedAt: "2026-11-17T02:20:00Z",
      publishedAt: "2026-11-17T02:25:00Z",
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Applied outside Rankvora AI. Revert in the site editor." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "sameAs lists 3 official profiles", expect: "3 profiles" },
        { id: "c2", label: "Every sameAs URL is an official profile", expect: "No unknown URL" },
        { id: "c3", label: "Markup validates", expect: "No errors" },
      ],
      outcome: null,
      simulated: {
        result: "verified_success",
        ranAt: "2026-11-19T09:00:00Z",
        sourceLabel: "Verification audit (demo)",
        findingEffect: "Finding fnd-nu-005 set to Verified resolved.",
        checks: [
          { id: "c1", label: "sameAs lists 3 official profiles", before: { status: "fail", detail: "sameAs empty (9 Nov)" }, after: { status: "pass", detail: "3 profiles" } },
          { id: "c2", label: "Every sameAs URL is an official profile", before: { status: "not_applicable", detail: "No URLs" }, after: { status: "pass", detail: "3 of 3 match the brand profile" } },
          { id: "c3", label: "Markup validates", before: { status: "pass", detail: "Valid" }, after: { status: "pass", detail: "Valid" } },
        ],
      },
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-22T01:30:00Z", actor: "Audit aud-nu-002", kind: "created", title: "Finding fnd-nu-005 detected" },
      { id: "h2", at: "2026-11-10T09:20:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Omar Farooq" },
      { id: "h3", at: "2026-11-12T03:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted" },
      { id: "h4", at: "2026-11-12T08:00:00Z", actor: "Omar Farooq", kind: "status", title: "Marked draft ready" },
      { id: "h5", at: "2026-11-17T02:20:00Z", actor: "Omar Farooq", kind: "execution", title: "Marked applied", detail: "Snippet edited in the site editor" },
      { id: "h6", at: "2026-11-17T02:25:00Z", actor: "Omar Farooq", kind: "execution", title: "Marked published", detail: "Page cache cleared; 3 profiles in the live markup" },
      { id: "h7", at: "2026-11-17T02:26:00Z", actor: "System", kind: "status", title: "Awaiting verification", detail: "Not yet re-assessed by an audit" },
    ],
  },

  // Guidance only, unassigned.
  "task-nu-006": {
    recommendationId: "rec-fnd-nu-006-a",
    createdAt: "2026-11-17T08:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The cited NourishWell and nutrition.example pages are compared", "A short note records whether the gap is content, structure or neither"],
    dependencies: [],
    draft: {
      kind: "guidance",
      owner: "Unassigned",
      steps: [
        { title: "Open the cited responses", detail: "Read samples resp-aud-nu-003-19, -21, -23 and -24, which cite nourishwell.example, and -13, -16 and -18, which cite nutrition.example." },
        { title: "List the cited NourishWell pages", detail: "Note which page each answer cites and which beginner question it answers." },
        { title: "Compare with nutrition.example", detail: "Find the page that could answer the same question, such as /guides/macros, and note what it opens with." },
        { title: "Respect the prompt versions", detail: "p-nu-003 changed wording on 27 Oct. Compare only slots of the same prompt version." },
        { title: "Write a note", detail: "Content gap, structure gap or neither. Do not change pages on the evidence of two audits." },
      ],
      sourceFacts: [
        { label: "November audit", value: "nourishwell.example cited in 4 of 10 · nutrition.example in 3 of 10 (responses that returned citations)", source: "Audit aud-nu-003, prompts p-nu-003 and p-nu-004" },
        { label: "Per prompt", value: "p-nu-004: nourishwell.example 4 of 5, nutrition.example 0 of 5 · p-nu-003: nutrition.example 3 of 5, nourishwell.example 0 of 5", source: "Audit aud-nu-003" },
        { label: "Weekly run", value: "nourishwell.example 4 of 10 · nutrition.example 3 of 10", source: "Monitoring run-nu-006" },
        { label: "Failed requests", value: "0 of 12 failed; 2 responses returned no citations and are not counted", source: "Audit aud-nu-003" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
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
        { id: "c1", label: "Re-run p-nu-003 and p-nu-004 with the same channels and 3 samples", expect: "Counts reported as n / d" },
        { id: "c2", label: "Failed requests reported separately", expect: "Not counted as absent" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-09T02:30:00Z", actor: "Audit aud-nu-003", kind: "created", title: "Finding fnd-nu-006 detected" },
      { id: "h2", at: "2026-11-16T01:44:00Z", actor: "Monitoring run-nu-006", kind: "status", title: "Finding observed again", detail: "Same split: 4 of 10 vs 3 of 10" },
      { id: "h3", at: "2026-11-17T08:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h4", at: "2026-11-17T08:31:00Z", actor: "System", kind: "status", title: "Task suggested", detail: "No assignee yet" },
    ],
  },

  // Applied as a saved revision; not published and not verified.
  "task-nu-007": {
    recommendationId: "rec-fnd-nu-007-a",
    createdAt: "2026-11-10T09:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Lab LCP on mobile is 2.5 s or lower", "Hero image is served under 200 KB", "Lab CLS stays at or below 0.1"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "Connector with write access to pages", met: true },
      { label: "Mobile layout check before publishing", met: false },
    ],
    draft: {
      kind: "patch",
      resource: "Tool page · /tools/calorie-calculator · performance settings",
      language: "yaml",
      before: NU_PERF_BEFORE,
      after: NU_PERF_AFTER,
      sourceFacts: [
        { label: "Lab LCP", value: "3.4 s on mobile; LCP element is the hero image", source: "Audit aud-nu-004, lab trace 16 Nov" },
        { label: "Hero image", value: "1.9 MB PNG, loaded after a blocking script", source: "Audit aud-nu-003, crawl 9 Nov" },
        { label: "Replacement", value: "140 KB WebP, same dimensions", source: "Media library, upload 12 Nov" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-12T06:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-nu-007-perf"),
      writes: ["Tool page · 3 performance settings", "Saved as a page revision on apply", "Live only after the separate publish step"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-14T08:00:00Z",
      decidedBy: "Omar Farooq",
      decidedAt: "2026-11-14T10:30:00Z",
    },
    execution: {
      connector: NU_CONNECTOR(["read_content", "write_content"]),
      cmsState: "applied",
      remote: {
        resource: "Page tools/calorie-calculator · performance settings",
        versionAtDraft: "rev 57",
        versionNow: "rev 57",
        hashAtDraft: demoDigest("nu-calc-perf-57"),
        hashNow: demoDigest("nu-calc-perf-57"),
        checkedAt: "2026-11-19T08:45:00Z",
        changed: false,
        note: "The live copy is still rev 57 with the old settings. The applied revision 58 is saved but not published.",
      },
      fields: [
        { field: "Hero image", before: "calculator-hero.png (1.9 MB)", after: "calculator-hero.webp (140 KB)", outcome: "written", note: "Saved as a revision. Not live until published." },
        { field: "Hero fetch priority and preload", before: "auto, preload off", after: "high, preload on", outcome: "written", note: "Saved as a revision. Not live until published." },
        { field: "Calculator script", before: "Blocking, in the head", after: "defer", outcome: "written", note: "Saved as a revision. Not live until published." },
      ],
      completedAt: "2026-11-12T06:30:00Z",
      stagedAt: null,
      appliedAt: "2026-11-17T03:15:00Z",
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, available: true },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Lab LCP on mobile", expect: "2.5 s or lower" },
        { id: "c2", label: "Hero image transfer size", expect: "Under 200 KB" },
        { id: "c3", label: "Lab CLS on mobile", expect: "0.1 or lower" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-09T02:35:00Z", actor: "Audit aud-nu-003", kind: "created", title: "Finding fnd-nu-007 detected" },
      { id: "h2", at: "2026-11-10T09:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-12T06:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted", detail: "3 settings changed" },
      { id: "h4", at: "2026-11-14T08:00:00Z", actor: "Hira Malik", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
      { id: "h5", at: "2026-11-14T10:30:00Z", actor: "Omar Farooq", kind: "approval", title: "Approved exact diff" },
      { id: "h6", at: "2026-11-14T11:00:00Z", actor: "Hira Malik", kind: "status", title: "Apply scheduled", detail: "Maintenance window 17 Nov 11:00 Singapore time" },
      { id: "h7", at: "2026-11-16T03:09:00Z", actor: "Audit aud-nu-004", kind: "status", title: "Baseline re-measured", detail: "Lab LCP 3.4 s on mobile, before the change" },
      { id: "h8", at: "2026-11-17T03:14:00Z", actor: "System", kind: "execution", title: "Remote check passed", detail: "rev 57, unchanged since draft" },
      { id: "h9", at: "2026-11-17T03:15:00Z", actor: "System", kind: "execution", title: "Applied", detail: "3 of 3 settings written as revision 58. Not published." },
      { id: "h10", at: "2026-11-19T08:45:00Z", actor: "System", kind: "execution", title: "Remote check: revision unchanged", detail: "Not live. Publish to start verification." },
    ],
  },

  // Cancelled before any work: finding accepted as a risk.
  "task-nu-008": {
    recommendationId: "rec-fnd-nu-008-a",
    createdAt: "2026-11-18T06:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The homepage states a short protein answer using supported facts only", "p-nu-007 re-run on the same channels with 3 samples"],
    dependencies: [],
    cancellation: {
      by: "Sana Iqbal",
      at: "2026-11-18T11:00:00Z",
      reason: "Not pursued now. One neutral prompt, 2 of 6 requests failed and only 4 samples are usable. Accepted as a risk; revisit in January if the brand is still absent.",
    },
    draft: {
      kind: "guidance",
      owner: "Hira Malik",
      steps: [
        { title: "Review the homepage", detail: "Note whether the homepage answers a basic protein question." },
        { title: "List supported facts", detail: "Use only facts from /guides/protein-intake." },
        { title: "Propose a short answer block", detail: "Two sentences at most, linking to the guide. Do not claim a result in answers." },
      ],
      sourceFacts: [
        { label: "Prompt p-nu-007", value: "Brand absent in 4 of 4 successful responses; 2 of 6 requests failed", source: "Audit aud-nu-005" },
        { label: "Cited source", value: "nourishwell.example in 4 of 4 successful responses", source: "Responses resp-aud-nu-005-08, -09, -10 and -12" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
    execution: {
      connector: null,
      cmsState: "guidance",
      remote: null,
      fields: [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Cancelled before any change." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Homepage states a short protein answer", expect: "Present" },
        { id: "c2", label: "p-nu-007 re-run with 3 samples per channel", expect: "Counts reported as n / d" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-18T05:08:00Z", actor: "Audit aud-nu-005", kind: "created", title: "Finding fnd-nu-008 detected" },
      { id: "h2", at: "2026-11-18T06:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-18T11:00:00Z", actor: "Sana Iqbal", kind: "status", title: "Task cancelled", detail: "Accepted risk; revisit in January. Finding set to Accepted risk." },
    ],
  },
};

// ===========================================================================
// threadly (Threadly · threadly.example) — fictional Shopify fashion store, United Kingdom
// fnd-th-001…008 and task-th-001…008. Task statuses agree with REGISTRY_TH_TASKS.
// The connector is the Shopify connector (theme and product access). Times follow London (UTC in November).
// ===========================================================================

const TH_URL = "https://threadly.example";

/** Demo connector (Shopify). Shopify scope names; connected. */
const TH_CONNECTOR = (required: string[], note?: string) => ({
  label: "Shopify connector",
  site: "threadly.example",
  state: "connected" as const,
  scopesGranted: ["read_content", "write_content", "read_products", "write_products", "read_themes", "write_themes"],
  scopesRequired: required,
  note,
});

const TH_FINDING_EXTRAS: Record<string, FindingExtras> = {
  "fnd-th-001": {
    severityRationale: "Medium: the guide shows six questions and answers that machines cannot read as FAQ data. Nothing visible to shoppers is broken.",
    priorityRationale: "P2: one guide, a small and reviewable markup change; it is the page that answers the sizing questions behind the tracked linen prompt.",
    verificationCriteria: [
      "FAQPage JSON-LD present on /pages/size-and-fit-guide",
      "The 6 marked-up questions and answers equal the visible text",
      "Markup validates without errors",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${TH_URL}/pages/size-and-fit-guide`, note: "6 visible questions and answers; Article markup only, no FAQPage", auditId: "aud-th-001" },
      { id: "e2", kind: "page", url: `${TH_URL}/pages/size-and-fit-guide`, note: "Still no FAQPage markup", auditId: "aud-th-003" },
      { id: "e3", kind: "prompt", promptId: "p-th-002", note: "Linen shirt prompt this guide supports. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T09:30:00Z", source: "Initial audit", sourceHref: "audits/aud-th-001", note: "FAQPage markup missing" },
      { id: "o2", at: "2026-11-09T10:38:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "Unchanged" },
    ],
  },
  "fnd-th-002": {
    severityRationale: "High: a wrong price or stock status in structured data can mislead shopping systems and shoppers, and can make the product ineligible for shopping listings. The visible page itself is correct.",
    priorityRationale: "P1: three of the best-selling linen shirt pages are affected and the fix changes live price data, so an owner or admin needs to approve the exact change.",
    verificationCriteria: [
      "Schema price equals the visible price on each of the 3 pages",
      "Schema availability equals the stock status shown on each page",
      "Price and availability are output from live product data, not typed into the theme",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${TH_URL}/products/everyday-linen-shirt`, note: "Schema price £65.00; visible price £49.00", auditId: "aud-th-001" },
      { id: "e2", kind: "page", url: `${TH_URL}/products/relaxed-linen-shirt`, note: "Schema price £65.00; visible price £49.00", auditId: "aud-th-001" },
      { id: "e3", kind: "page", url: `${TH_URL}/products/short-sleeve-linen-shirt`, note: "Schema availability InStock; every size shown as sold out", auditId: "aud-th-001" },
      { id: "e4", kind: "prompt", promptId: "p-th-001", note: "Sustainable-brands prompt. Context only." },
      { id: "e5", kind: "prompt", promptId: "p-th-007", note: "Shirt-sizing prompt. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T09:31:00Z", source: "Initial audit", sourceHref: "audits/aud-th-001", note: "3 of 8 sampled linen shirt pages have a schema price or availability that differs from the page" },
      { id: "o2", at: "2026-11-09T10:39:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "Unchanged on the same 3 pages" },
    ],
  },
  "fnd-th-003": {
    severityRationale: "Critical: a noindex directive keeps the page out of search indexes, so the Summer Linen collection cannot be found through search.",
    priorityRationale: "P0: raised on 9 Nov when the third audit still found the tag. One rule in the theme, easy to reverse, and the collection is the main landing page for linen shirts.",
    verificationCriteria: [
      "No noindex directive in the meta robots tag or the X-Robots-Tag header",
      "Canonical points to the page itself",
      "Verification audit re-assesses the page and finds it indexable",
    ],
    evidence: [
      { id: "e1", kind: "page", url: `${TH_URL}/collections/summer-linen`, note: "meta robots: noindex, follow", auditId: "aud-th-001" },
      { id: "e2", kind: "page", url: `${TH_URL}/collections/summer-linen`, note: "meta robots: noindex, follow (third audit in a row)", auditId: "aud-th-003" },
      { id: "e3", kind: "page", url: `${TH_URL}/collections/summer-linen`, note: "meta robots: index, follow; self canonical", auditId: "aud-th-004" },
      { id: "e4", kind: "prompt", promptId: "p-th-006", note: "Merino knitwear prompt tracked for the same store. Context only." },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T09:29:00Z", source: "Initial audit", sourceHref: "audits/aud-th-001", note: "noindex found" },
      { id: "o2", at: "2026-10-22T08:33:00Z", source: "Scheduled audit — October", sourceHref: "audits/aud-th-002", note: "Still present" },
      { id: "o3", at: "2026-11-09T10:36:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "Still present" },
      { id: "o4", at: "2026-11-16T11:10:00Z", source: "Verification — Summer Linen collection indexing", sourceHref: "audits/aud-th-004", note: "No noindex directive" },
    ],
  },
  "fnd-th-004": {
    severityRationale: "Low: duplicated titles and descriptions make collection pages harder to tell apart in listings. Nothing is broken on the pages.",
    priorityRationale: "P2: six pages, a content-only change staged in the connector; two pages still need a second look.",
    verificationCriteria: ["Each of the 6 collection pages has a unique title", "Each page has a unique meta description", "No collection page repeats the store-wide collection title"],
    evidence: [
      { id: "e1", kind: "page", url: `${TH_URL}/collections/new-in`, note: "Title “Collections | Threadly” shared with 5 other pages", auditId: "aud-th-001" },
      { id: "e2", kind: "page", url: `${TH_URL}/collections/linen-shirts`, note: "Same title and meta description as /collections/new-in", auditId: "aud-th-003" },
    ],
    observations: [
      { id: "o1", at: "2026-10-08T09:33:00Z", source: "Initial audit", sourceHref: "audits/aud-th-001", note: "6 pages share one title" },
      { id: "o2", at: "2026-11-09T10:37:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "Unchanged" },
      { id: "o3", at: "2026-11-16T11:10:00Z", source: "Targeted re-check of 6 collection pages", note: "4 of 6 unique; 2 still repeat the store-wide title" },
    ],
  },
  "fnd-th-005": {
    severityRationale: "Low: the Organization markup is valid but does not link the brand to its official profiles. No visible impact.",
    priorityRationale: "P3: one markup block in the theme; the change was made and awaits verification.",
    verificationCriteria: ["Organization JSON-LD lists the official profiles in sameAs", "Every sameAs URL is an official profile", "Markup validates"],
    evidence: [
      { id: "e1", kind: "page", url: `${TH_URL}/`, note: "Organization markup: name and logo; sameAs is empty", auditId: "aud-th-002" },
      { id: "e2", kind: "page", url: `${TH_URL}/`, note: "Unchanged: sameAs still empty", auditId: "aud-th-003" },
    ],
    observations: [
      { id: "o1", at: "2026-10-22T08:30:00Z", source: "Scheduled audit — October", sourceHref: "audits/aud-th-002", note: "sameAs empty" },
      { id: "o2", at: "2026-11-09T10:40:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "Unchanged" },
      { id: "o3", at: "2026-11-17T10:30:00Z", source: "Publish check", note: "3 profiles in the live markup; not yet re-assessed by an audit" },
    ],
  },
  "fnd-th-006": {
    severityRationale: "Medium: a competitor domain is cited more often than the owned domain on two linen and denim prompts. Citation-capable responses only; the cause is not established.",
    priorityRationale: "P2: two prompts, the same split in the November audit and the 16 Nov weekly run. Confidence is medium.",
    verificationCriteria: [
      "Owned-domain citations counted on p-th-003 and p-th-004 with n / d",
      "Same channels, models and search modes as the baseline",
      "Failed requests excluded and reported separately",
    ],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-aud-th-003-19", note: "OpenAI · p-th-004 · sample 1 · cites maisonalder.example" },
      { id: "e2", kind: "response", responseId: "resp-aud-th-003-21", note: "Gemini · p-th-004 · sample 1 · cites maisonalder.example" },
      { id: "e3", kind: "response", responseId: "resp-aud-th-003-23", note: "Perplexity · p-th-004 · sample 1 · cites maisonalder.example" },
      { id: "e4", kind: "response", responseId: "resp-aud-th-003-13", note: "OpenAI · p-th-003 · sample 1 · one of the 3 responses citing threadly.example (all on p-th-003)" },
      { id: "e5", kind: "prompt", promptId: "p-th-003", note: "Head-to-head prompt for linen shirts in warm weather (version 2)" },
      { id: "e6", kind: "prompt", promptId: "p-th-004", note: "Organic cotton denim prompt" },
    ],
    observations: [
      { id: "o1", at: "2026-11-09T10:30:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "maisonalder.example 4 of 10, threadly.example 3 of 10 (responses that returned citations); all 4 Maison Alder citations are on p-th-004" },
      { id: "o2", at: "2026-11-16T09:44:00Z", source: "Weekly monitoring — 16 Nov", sourceHref: "monitoring/runs/run-th-006", note: "maisonalder.example 4 of 10, threadly.example 3 of 10" },
    ],
  },
  "fnd-th-007": {
    severityRationale: "Medium: lab LCP is 3.4 s on mobile against a 2.5 s target. There is no field data, so real-shopper impact is unknown.",
    priorityRationale: "P2: one product template that several collections link to; the fix is applied but not yet published, so it cannot be verified.",
    verificationCriteria: ["Lab LCP on mobile is 2.5 s or lower", "Hero image is served under 200 KB", "Lab CLS stays at or below 0.1"],
    evidence: [
      { id: "e1", kind: "page", url: `${TH_URL}/products/waxed-cotton-trench`, note: "Lab LCP 3.4 s on mobile; hero image 1.9 MB, loaded late", auditId: "aud-th-003" },
      { id: "e2", kind: "page", url: `${TH_URL}/products/waxed-cotton-trench`, note: "Lab LCP 3.4 s on mobile, re-measured before the change", auditId: "aud-th-004" },
    ],
    observations: [
      { id: "o1", at: "2026-11-09T10:35:00Z", source: "Full audit — November", sourceHref: "audits/aud-th-003", note: "Lab LCP 3.4 s" },
      { id: "o2", at: "2026-11-16T11:09:00Z", source: "Verification — Summer Linen collection indexing", sourceHref: "audits/aud-th-004", note: "Lab LCP 3.4 s, before the change" },
    ],
  },
  "fnd-th-008": {
    severityRationale: "Informational: one neutral prompt, brand absent from all 4 successful samples. Answers vary between runs, so this is recorded for awareness.",
    priorityRationale: "P3: single informational prompt with low confidence. Accepted by the owner on 18 Nov; revisit in January.",
    verificationCriteria: ["Re-run p-th-007 on the same channels with 3 samples each", "Report brand mentions with numerator and denominator", "Failed requests reported separately"],
    evidence: [
      { id: "e1", kind: "response", responseId: "resp-aud-th-005-08", note: "OpenAI · sample 2 · brand absent; cites maisonalder.example" },
      { id: "e2", kind: "response", responseId: "resp-aud-th-005-09", note: "Gemini · sample 1 · brand absent; cites maisonalder.example" },
      { id: "e3", kind: "response", responseId: "resp-aud-th-005-12", note: "Perplexity · sample 2 · brand absent; cites maisonalder.example" },
      { id: "e4", kind: "response", responseId: "resp-aud-th-005-07", note: "OpenAI · sample 1 · request failed. Excluded, not counted as absent." },
      { id: "e5", kind: "prompt", promptId: "p-th-007", note: "Neutral shirt-sizing prompt" },
    ],
    observations: [{ id: "o1", at: "2026-11-18T13:08:00Z", source: "Triggered audit — new competitor suggested", sourceHref: "audits/aud-th-005", note: "Absent in 4 of 4 successful responses; 2 failed requests excluded" }],
  },
};

const TH_RECOMMENDATIONS: Recommendation[] = [
  rec({
    id: "rec-fnd-th-001-a",
    findingId: "fnd-th-001",
    title: "Add FAQPage markup for the six questions on the size and fit guide",
    problem: "The guide shows six questions and answers, but its markup describes the article only.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Markup read directly from the page in the 8 Oct and 9 Nov audits: Article only, no FAQPage." },
    action: "Add one FAQPage block with the six visible questions and answers, word for word, to the JSON-LD of /pages/size-and-fit-guide.",
    why: "Marked-up questions let systems read the answers as a list. This does not guarantee rich results, rankings or AI citations.",
    expectedOutcome: "The page carries valid FAQPage markup that equals the visible text.",
    effort: "small",
    risk: "medium",
    suggestedMode: "ai_draft",
    dependencies: ["Editor review of the draft"],
    limitations: ["Markup must equal the visible text; any later edit to the Q&A needs the markup updated", "A person adds the markup in the theme; no write by Rankvora AI"],
    verificationPlan: ["Re-crawl /pages/size-and-fit-guide", "Compare the marked-up text with the visible text", "Validate the markup"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T17:00:00Z",
    taskId: "task-th-001",
  }),
  rec({
    id: "rec-fnd-th-002-a",
    findingId: "fnd-th-002",
    title: "Output live price and availability in the Product schema of three linen shirt pages",
    problem: "Two pages declare £65.00 in the Product schema while the page shows £49.00, and one declares InStock while every size is sold out.",
    evidenceIds: ["e1", "e2", "e3"],
    cause: { classification: "confirmed", basis: "Schema read from the three pages in the 8 Oct and 9 Nov audits; the product schema snippet in the theme has the price and availability typed in." },
    action: "Replace the typed-in offer values in the product schema snippet with Liquid output of the live price and stock status for /products/everyday-linen-shirt, /products/relaxed-linen-shirt and /products/short-sleeve-linen-shirt.",
    why: "Structured data that matches the page is a trust signal for shopping systems and shoppers. It does not guarantee shopping listings, rankings or AI citations.",
    expectedOutcome: "Each page declares the same price, currency and availability as the visible page, and keeps them in step when the price changes.",
    effort: "medium",
    risk: "high",
    suggestedMode: "approved_apply",
    dependencies: ["Live price and stock data confirmed", "Owner or admin approval of the exact wording"],
    limitations: ["Only values from the live product data may be output", "Writes to the live theme, affecting three product pages", "Sale prices change; the schema must follow the live price"],
    verificationPlan: ["Re-crawl the three product pages", "Compare schema price and availability with the visible page", "Validate the markup"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T17:10:00Z",
    taskId: "task-th-002",
  }),
  rec({
    id: "rec-fnd-th-003-a",
    findingId: "fnd-th-003",
    title: "Remove the noindex tag from the Summer Linen collection page",
    problem: "The collection page carries meta robots “noindex, follow”, so it is kept out of search indexes.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "The tag is present in the page head on every audit from 8 Oct to 9 Nov; the theme still renders it for this collection handle, a rule left over from the launch preview." },
    action: "Remove the robots rule for the summer-linen handle from the theme so the page renders “index, follow”. No content changes.",
    why: "A page with noindex cannot appear in search results. Removing it makes the page eligible; it does not guarantee indexing speed, rankings or AI citations.",
    expectedOutcome: "The page is indexable, with a self-referencing canonical.",
    effort: "small",
    risk: "medium",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff", "Connector with write access to the theme"],
    limitations: ["Writes to the live theme", "Search engines index at their own pace"],
    verificationPlan: ["Re-crawl the collection page in a verification audit", "Check meta robots and the X-Robots-Tag header", "Check the canonical"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-09T15:30:00Z",
    taskId: "task-th-003",
  }),
  rec({
    id: "rec-fnd-th-004-a",
    findingId: "fnd-th-004",
    title: "Give six collection pages unique titles and meta descriptions",
    problem: "Six collection pages share the title “Collections | Threadly” and one meta description.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "likely", basis: "The collection template falls back to one store-wide title when a collection's search listing title is empty." },
    action: "Write one distinct title and meta description per collection page and stage them through the connector, then apply and publish in a separate step.",
    why: "Distinct titles help shoppers and crawlers tell the pages apart in listings. No ranking effect is claimed.",
    expectedOutcome: "Six unique titles and descriptions, none equal to the store-wide collection title.",
    effort: "small",
    risk: "low",
    suggestedMode: "cms_staged",
    dependencies: ["Staged-change approval"],
    limitations: ["Collections that use a custom template may ignore the search listing title field", "Cached copies may show the old title for a short time"],
    verificationPlan: ["Re-check all 6 pages", "Confirm each title and description is unique", "Confirm none equals the store-wide collection title"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-09T15:40:00Z",
    taskId: "task-th-004",
  }),
  rec({
    id: "rec-fnd-th-005-a",
    findingId: "fnd-th-005",
    title: "List the three official profiles in Organization sameAs",
    problem: "Organization markup has a name and logo but an empty sameAs list.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "confirmed", basis: "Markup read directly from the home page in the 22 Oct and 9 Nov audits." },
    action: "Add the three official profile URLs to sameAs in the Organization JSON-LD of the home page.",
    why: "Explicit identity links help systems tell which profiles belong to the brand. No mention or ranking is guaranteed.",
    expectedOutcome: "sameAs lists three official profiles and the markup validates.",
    effort: "small",
    risk: "low",
    suggestedMode: "ai_draft",
    dependencies: ["Official profile URLs confirmed"],
    limitations: ["Only profiles confirmed as official by the owner are listed", "A person edits the markup in the theme code editor"],
    verificationPlan: ["Re-crawl the home page", "Validate the markup"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T17:20:00Z",
    taskId: "task-th-005",
  }),
  rec({
    id: "rec-fnd-th-006-a",
    findingId: "fnd-th-006",
    title: "Review the linen and denim prompt citations against Maison Alder",
    problem: "maisonalder.example is cited in 4 of 10 responses that returned citations; threadly.example in 3 of 10. All 4 Maison Alder citations are on the denim prompt p-th-004, where threadly.example is cited in 0 of 5.",
    evidenceIds: ["e1", "e2", "e3", "e4"],
    cause: { classification: "hypothesis", basis: "Maison Alder may have a clearer denim page for the same question. Not established; answers vary between runs." },
    action: "Read the cited Maison Alder pages and the threadly.example pages that could answer the same questions, then write a note on whether the gap is content, structure or neither.",
    why: "A consistent split on two prompts deserves a look before any content is changed. Two audits are not a trend.",
    expectedOutcome: "A short note that names the gap or records normal variation.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["p-th-003 changed wording on 27 Oct; compare only slots of the same prompt version", "2 of 12 responses returned no citations and are not counted"],
    verificationPlan: ["Re-run p-th-003 and p-th-004 on the same channels with 3 samples", "Report owned-domain citations as n / d"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-17T16:30:00Z",
    taskId: "task-th-006",
  }),
  rec({
    id: "rec-fnd-th-006-b",
    findingId: "fnd-th-006",
    title: "Add a plain-language denim fit and care section to the organic denim collection",
    problem: "No page on threadly.example opens with a short plain-language explanation of organic cotton denim.",
    evidenceIds: ["e5", "e6"],
    cause: { classification: "hypothesis", basis: "Untested. No evidence that a denim section changes which sources are cited." },
    action: "Draft a short section for /collections/organic-denim that explains organic cotton, rigid and stretch denim and how to care for it in one sentence each, with a link to the size and fit guide.",
    why: "An owned page that answers the denim question gives channels something to cite. Citations are not guaranteed.",
    expectedOutcome: "A section whose statements are supported by the product details themselves.",
    effort: "medium",
    risk: "low",
    suggestedMode: "ai_draft",
    dependencies: ["Review of the task-th-006 note first"],
    limitations: ["Hypothesis only", "Indexing time is outside our control"],
    verificationPlan: ["Check the section renders", "Re-run p-th-004 as context only"],
  }),
  rec({
    id: "rec-fnd-th-007-a",
    findingId: "fnd-th-007",
    title: "Shrink and preload the product hero image; defer the gallery script",
    problem: "The page loads a 1.9 MB hero image late and a blocking script before it. Lab LCP is 3.4 s on mobile.",
    evidenceIds: ["e1", "e2"],
    cause: { classification: "likely", basis: "The lab trace shows the hero image as the LCP element, loaded after the blocking script." },
    action: "Serve a 140 KB WebP hero with high fetch priority and load the gallery script with defer on the product template used by /products/waxed-cotton-trench.",
    why: "Faster loading of the largest element improves the lab LCP. Real-shopper impact is unknown without field data.",
    expectedOutcome: "Lab LCP of 2.5 s or lower on mobile, with no new layout shift.",
    effort: "medium",
    risk: "medium",
    suggestedMode: "approved_apply",
    dependencies: ["Owner or admin approval of the exact diff", "Connector with write access to the theme"],
    limitations: ["Lab measurement only", "Writes to the live theme when published"],
    verificationPlan: ["Re-measure lab LCP on mobile", "Check image size and CLS", "Run after the change is published"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-10T17:30:00Z",
    taskId: "task-th-007",
  }),
  rec({
    id: "rec-fnd-th-008-a",
    findingId: "fnd-th-008",
    title: "Add a short sizing answer block to the homepage",
    problem: "The brand is absent from all 4 successful answers to the shirt-sizing prompt.",
    evidenceIds: ["e1", "e2", "e3", "e5"],
    cause: { classification: "hypothesis", basis: "The homepage may not state a sizing answer. One neutral prompt; 2 of 6 requests failed; answers vary between runs." },
    action: "Propose a two-sentence general answer on the homepage that links to /pages/size-and-fit-guide, using only facts from that guide.",
    why: "A page that states the answer gives shoppers and channels an owned source. No mention is guaranteed.",
    expectedOutcome: "A short, factual answer block linking to the guide.",
    effort: "small",
    risk: "low",
    suggestedMode: "guidance",
    limitations: ["Hypothesis only", "Based on one prompt and 4 successful samples"],
    verificationPlan: ["Re-run p-th-007 on the same channels with 3 samples"],
    status: "approved",
    decidedBy: "Sana Iqbal",
    decidedAt: "2026-11-18T14:30:00Z",
    decisionNote: "Task cancelled on 18 Nov: accepted risk, revisit in January.",
    taskId: "task-th-008",
  }),
];

// ---- Task details ----------------------------------------------------------

const TH_QA: [string, string][] = [
  ["How should a linen shirt fit?", "Linen is cut slightly relaxed. Choose your usual size for a relaxed fit, or one size down for a closer fit."],
  ["How do I measure my chest?", "Wrap a soft tape around the fullest part of your chest, under the arms, keeping it level and snug but not tight."],
  ["Will linen shrink in the wash?", "Our linen is pre-washed. Wash at 30°C and dry flat to keep the fit; expect little further shrinkage."],
  ["What if I am between sizes?", "Size up for a relaxed fit or down for a closer one. If the fit is not right, you can return it within 30 days."],
  ["Do your sizes follow UK sizing?", "Yes. Sizes are given in UK sizes, with a chest measurement in centimetres for each size."],
  ["Can I exchange for a different size?", "Yes. Exchanges are free within 30 days of delivery; the returns page explains how to start one."],
];

const TH_ARTICLE = {
  "@type": "Article",
  headline: "Size and fit guide",
  author: { "@type": "Person", name: "Imogen Hart" },
  url: `${TH_URL}/pages/size-and-fit-guide`,
};
const TH_FAQ_BEFORE = JSON.stringify({ "@context": "https://schema.org", ...TH_ARTICLE }, null, 2);
const TH_FAQ_AFTER = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@graph": [
      TH_ARTICLE,
      {
        "@type": "FAQPage",
        mainEntity: TH_QA.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  },
  null,
  2,
);

const TH_OFFER_BEFORE = `"offers": {
  "@type": "Offer",
  "price": "65.00",
  "priceCurrency": "GBP",
  "availability": "https://schema.org/InStock"
}`;
const TH_OFFER_AFTER = `"offers": {
  "@type": "Offer",
  "price": "49.00",
  "priceCurrency": "GBP",
  "availability": "https://schema.org/InStock",
  "priceValidUntil": "2026-12-31",
  "hasMerchantReturnPolicy": "Free 30-day returns on all UK orders"
}`;
const TH_OFFER_ALT = `"offers": {
  "@type": "Offer",
  "price": "49.00",
  "priceCurrency": "GBP",
  "availability": "https://schema.org/InStock"
}`;

const TH_ROBOTS_BEFORE = `<head>
  <title>Summer Linen: shirts, trousers and dresses | Threadly</title>
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${TH_URL}/collections/summer-linen">
</head>`;
const TH_ROBOTS_AFTER = TH_ROBOTS_BEFORE.replace("noindex, follow", "index, follow");

const TH_COLLECTIONS: { slug: string; title: string; ok: boolean; reason?: string }[] = [
  { slug: "new-in", title: "New in: this season's arrivals | Threadly", ok: false, reason: "Live title still “Collections | Threadly” at the re-check. This collection uses a custom template that ignores the search listing title field." },
  { slug: "linen-shirts", title: "Linen shirts for warm weather | Threadly", ok: false, reason: "Live title unchanged at the re-check. A cached copy is the likely cause; re-check after the cache clears." },
  { slug: "organic-denim", title: "Organic cotton denim, made to last | Threadly", ok: true },
  { slug: "merino-knitwear", title: "Ethically made merino knitwear | Threadly", ok: true },
  { slug: "waxed-outerwear", title: "Waxed cotton jackets and trench coats | Threadly", ok: true },
  { slug: "smart-casual-shirts", title: "Smart casual shirts for every day | Threadly", ok: true },
];
const TH_CATEGORY_TITLE = "Collections | Threadly";

const TH_ORG_BEFORE = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Threadly",
  "url": "${TH_URL}/",
  "logo": "${TH_URL}/cdn/shop/files/threadly-logo.png",
  "sameAs": []
}`;
const TH_ORG_AFTER = `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Threadly",
  "url": "${TH_URL}/",
  "logo": "${TH_URL}/cdn/shop/files/threadly-logo.png",
  "sameAs": [
    "https://www.instagram.example/threadly",
    "https://www.pinterest.example/threadly",
    "https://www.tiktok.example/@threadly"
  ]
}`;

const TH_PERF_BEFORE = `hero_image: trench-hero.png      # 1.9 MB
hero_fetch_priority: auto
hero_preload: off
gallery_script: blocking        # loaded in the head`;
const TH_PERF_AFTER = `hero_image: trench-hero.webp     # 140 KB
hero_fetch_priority: high
hero_preload: on
gallery_script: defer           # loaded after the page`;

const TH_TASK_SUMMARY_EXTRAS: Record<string, { blockers: string[] }> = {
  "task-th-001": { blockers: [] },
  "task-th-002": { blockers: [] },
  "task-th-003": { blockers: [] },
  "task-th-004": { blockers: [] },
  "task-th-005": { blockers: [] },
  "task-th-006": { blockers: [] },
  "task-th-007": { blockers: ["Applied on 17 Nov but not published yet. Verification cannot start until it is live."] },
  "task-th-008": { blockers: [] },
};

const TH_TASK_DETAILS: Record<string, TaskDetailSeed> = {
  // AI draft of FAQPage markup, ready for an editor. Nothing applied.
  "task-th-001": {
    recommendationId: "rec-fnd-th-001-a",
    createdAt: "2026-11-10T17:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["FAQPage JSON-LD present on /pages/size-and-fit-guide", "The 6 marked-up questions and answers equal the visible text", "Markup validates without errors"],
    dependencies: [
      { label: "Visible questions and answers captured (crawl 9 Nov)", met: true },
      { label: "Editor review of the draft", met: false },
    ],
    draft: {
      kind: "patch",
      resource: "Guide page · /pages/size-and-fit-guide · JSON-LD",
      language: "json-ld",
      before: TH_FAQ_BEFORE,
      after: TH_FAQ_AFTER,
      sourceFacts: [
        { label: "Questions and answers", value: "6 visible, copied word for word", source: "Crawl 9 Nov, /pages/size-and-fit-guide" },
        { label: "Article", value: "Headline, author and URL already in the markup", source: "Audit aud-th-003" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-17T12:30:00Z",
      version: 1,
    },
    approval: { state: "not_required", notRequiredReason: "AI draft only. Nothing is written to the store; a person adds the markup.", diffHash: demoDigest("task-th-001-faq"), writes: [] },
    execution: {
      connector: TH_CONNECTOR(["read_content"], "Only read access is needed to compare the page. An AI draft makes no write."),
      cmsState: "draft",
      remote: {
        resource: "Page pages/size-and-fit-guide · JSON-LD",
        versionAtDraft: "rev 18",
        versionNow: "rev 18",
        hashAtDraft: demoDigest("th-sizeguide-jsonld-18"),
        hashNow: demoDigest("th-sizeguide-jsonld-18"),
        checkedAt: "2026-11-19T08:48:00Z",
        changed: false,
      },
      fields: [{ field: "FAQPage markup", before: "(none)", after: "6 questions", outcome: "pending", note: "Added by a person after review" }],
      completedAt: "2026-11-18T15:20:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "FAQPage markup present", expect: "Present" },
        { id: "c2", label: "Marked-up text equals visible text", expect: "6 of 6 equal" },
        { id: "c3", label: "Markup validates", expect: "No errors" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-08T09:30:00Z", actor: "Audit aud-th-001", kind: "created", title: "Finding fnd-th-001 detected" },
      { id: "h2", at: "2026-11-10T17:00:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-17T12:30:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated", detail: "6 questions marked up, 0 unsupported claims" },
      { id: "h4", at: "2026-11-18T15:20:00Z", actor: "Hira Malik", kind: "status", title: "Marked draft ready" },
    ],
  },

  // High-risk write to three linen shirt pages, waiting for owner or admin approval of the exact diff.
  "task-th-002": {
    recommendationId: "rec-fnd-th-002-a",
    createdAt: "2026-11-10T17:10:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Schema price on each of the 3 pages equals the visible price", "Schema availability on each page equals the stock status shown", "Markup validates without errors"],
    dependencies: [
      { label: "Live price and stock data confirmed (12 Nov)", met: true },
      { label: "Owner or admin approval of the exact diff", met: false },
      { label: "Connector with write access to the theme", met: true },
    ],
    draft: {
      kind: "text",
      resource: "Linen shirt pages · Product schema offer (/products/everyday-linen-shirt shown)",
      field: "Offer price and availability",
      before: TH_OFFER_BEFORE,
      after: TH_OFFER_AFTER,
      alternate: { after: TH_OFFER_ALT, unsupportedClaims: [] },
      sourceFacts: [
        { label: "Visible price", value: "£49.00 sale price on 2 pages", source: "Shopify product data, read 12 Nov" },
        { label: "Stock status", value: "short-sleeve-linen-shirt: every size sold out", source: "Shopify inventory, read 12 Nov" },
        { label: "Schema source", value: "Price and availability typed into the product schema snippet", source: "Theme code read, 14 Nov" },
        { label: "Pages", value: "3: everyday-linen-shirt, relaxed-linen-shirt, short-sleeve-linen-shirt", source: "Audit aud-th-001" },
      ],
      unsupportedClaims: [
        { text: "\"priceValidUntil\": \"2026-12-31\"", reason: "No source fact gives an end date for the sale price." },
        { text: "Free 30-day returns on all UK orders", reason: "No source fact states the returns terms for these pages." },
      ],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-14T13:00:00Z",
      version: 1,
    },
    approval: {
      state: "pending",
      diffHash: demoDigest("task-th-002-offer"),
      writes: [
        "3 product pages: Product schema price and availability output from live product data",
        "Offer price, currency and availability only; visible page content not changed",
        "Live on each product page after the theme publish",
      ],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-18T17:15:00Z",
    },
    execution: {
      connector: TH_CONNECTOR(["read_products", "read_themes", "write_themes"]),
      cmsState: "draft",
      remote: {
        resource: "Theme snippets/product-schema.liquid · offer block",
        versionAtDraft: "rev 44",
        versionNow: "rev 44",
        hashAtDraft: demoDigest("th-product-schema-44"),
        hashNow: demoDigest("th-product-schema-44"),
        checkedAt: "2026-11-19T08:52:00Z",
        changed: false,
      },
      fields: [
        { field: "/products/everyday-linen-shirt · offer price", before: "£65.00 in schema · £49.00 on page", after: "Price output from live product data", outcome: "pending" },
        { field: "/products/relaxed-linen-shirt · offer price", before: "£65.00 in schema · £49.00 on page", after: "Price output from live product data", outcome: "pending" },
        { field: "/products/short-sleeve-linen-shirt · availability", before: "InStock in schema · sold out on page", after: "Availability output from live stock status", outcome: "pending" },
      ],
      completedAt: "2026-11-14T13:30:00Z",
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Nothing has been applied." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Schema price equals visible price on all 3 pages", expect: "3 of 3" },
        { id: "c2", label: "Schema availability equals stock status on all 3 pages", expect: "3 of 3" },
        { id: "c3", label: "Markup validates", expect: "No errors" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-08T09:31:00Z", actor: "Audit aud-th-001", kind: "created", title: "Finding fnd-th-002 detected" },
      { id: "h2", at: "2026-11-10T17:10:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Omar Farooq" },
      { id: "h3", at: "2026-11-14T13:00:00Z", actor: "Drafting model", kind: "draft", title: "Draft v1 generated", detail: "2 unsupported claims flagged" },
      { id: "h4", at: "2026-11-18T17:15:00Z", actor: "Omar Farooq", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
    ],
  },

  // Applied, published and verified by the verification audit.
  "task-th-003": {
    recommendationId: "rec-fnd-th-003-a",
    createdAt: "2026-11-09T15:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["No noindex directive in the meta robots tag or the X-Robots-Tag header", "Canonical points to the page itself", "Verification audit finds the page indexable"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "Connector with write access to the theme (at the time)", met: true },
      { label: "Live value unchanged since draft", met: true },
    ],
    draft: {
      kind: "patch",
      resource: "Collection · /collections/summer-linen · robots meta",
      language: "html",
      before: TH_ROBOTS_BEFORE,
      after: TH_ROBOTS_AFTER,
      sourceFacts: [
        { label: "Current value", value: "robots: noindex, follow", source: "Crawl 9 Nov, audit aud-th-003" },
        { label: "Theme rule", value: "layout/theme.liquid renders noindex for the summer-linen handle, left from the launch preview", source: "Theme code read, 9 Nov" },
        { label: "Canonical", value: "Self-referencing; unchanged", source: "Crawl 9 Nov" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-09T16:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-th-003-robots"),
      writes: ["Collection /collections/summer-linen · robots meta rule in the theme", "1 line changed: noindex, follow → index, follow", "No content change; live after the theme publish step"],
      requestedBy: "Omar Farooq",
      requestedAt: "2026-11-10T10:00:00Z",
      decidedBy: "Sana Iqbal",
      decidedAt: "2026-11-10T14:45:00Z",
    },
    execution: {
      connector: TH_CONNECTOR(["read_themes", "write_themes"]),
      cmsState: "published",
      remote: {
        resource: "Theme layout/theme.liquid · robots meta",
        versionAtDraft: "rev 9",
        versionNow: "rev 9",
        hashAtDraft: demoDigest("th-summer-robots-9"),
        hashNow: demoDigest("th-summer-robots-9"),
        checkedAt: "2026-11-11T10:09:00Z",
        changed: false,
        note: "Checked just before the write.",
      },
      fields: [{ field: "robots meta", before: "noindex, follow", after: "index, follow", outcome: "written", note: "Applied to the draft theme 11 Nov, theme published 12 Nov" }],
      completedAt: "2026-11-09T16:30:00Z",
      stagedAt: null,
      appliedAt: "2026-11-11T10:10:00Z",
      publishedAt: "2026-11-12T09:30:00Z",
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Verified on 16 Nov. Reverting the rule would be a new task." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "No noindex in the meta robots tag", expect: "Absent" },
        { id: "c2", label: "No noindex in the X-Robots-Tag header", expect: "Absent" },
        { id: "c3", label: "Canonical points to the page itself", expect: "Self" },
        { id: "c4", label: "Page reached by the verification audit", expect: "Assessed" },
      ],
      outcome: {
        result: "verified_success",
        ranAt: "2026-11-16T11:10:00Z",
        sourceLabel: "Verification — Summer Linen collection indexing",
        sourceHref: "audits/aud-th-004",
        findingEffect: "Finding fnd-th-003 set to Verified resolved.",
        checks: [
          { id: "c1", label: "No noindex in the meta robots tag", before: { status: "fail", detail: "noindex, follow (9 Nov)" }, after: { status: "pass", detail: "index, follow" } },
          { id: "c2", label: "No noindex in the X-Robots-Tag header", before: { status: "pass", detail: "Header absent" }, after: { status: "pass", detail: "Header absent" } },
          { id: "c3", label: "Canonical points to the page itself", before: { status: "pass", detail: "Self canonical" }, after: { status: "pass", detail: "Self canonical" } },
          { id: "c4", label: "Page reached by the verification audit", before: { status: "pass", detail: "Assessed in aud-th-003" }, after: { status: "pass", detail: "Assessed: 5 of 5 pages (aud-th-004)" } },
        ],
      },
      simulated: null,
      context: { label: "Brand mention rate on the knitwear prompt p-th-006 (context only)", n: 1, d: 3, basis: "3 responses, 1 sample each, verification audit. Directional." },
    },
    history: [
      { id: "h1", at: "2026-10-08T09:29:00Z", actor: "Audit aud-th-001", kind: "created", title: "Finding fnd-th-003 detected" },
      { id: "h2", at: "2026-11-09T10:36:00Z", actor: "Audit aud-th-003", kind: "status", title: "Finding observed again", detail: "Third audit with the tag present; priority raised to P0" },
      { id: "h3", at: "2026-11-09T15:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Omar Farooq" },
      { id: "h4", at: "2026-11-09T16:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted", detail: "1 line changed" },
      { id: "h5", at: "2026-11-10T10:00:00Z", actor: "Omar Farooq", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
      { id: "h6", at: "2026-11-10T14:45:00Z", actor: "Sana Iqbal", kind: "approval", title: "Approved exact diff" },
      { id: "h7", at: "2026-11-11T10:10:00Z", actor: "System", kind: "execution", title: "Applied", detail: "Remote check passed; 1 of 1 written to the draft theme. Not live yet." },
      { id: "h8", at: "2026-11-12T09:30:00Z", actor: "Omar Farooq", kind: "execution", title: "Published", detail: "Theme published; storefront refreshed" },
      { id: "h9", at: "2026-11-16T11:10:00Z", actor: "Audit aud-th-004", kind: "verification", title: "Verified success", detail: "4 of 4 checks passed" },
    ],
  },

  // Staged, applied and published; 4 of 6 pages verified.
  "task-th-004": {
    recommendationId: "rec-fnd-th-004-a",
    createdAt: "2026-11-09T15:40:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Each of the 6 collection pages has a unique title", "Each page has a unique meta description", "No collection page repeats the store-wide collection title"],
    dependencies: [
      { label: "Staged-change approval", met: true },
      { label: "Connector with write access to collections (at the time)", met: true },
      { label: "Re-check of the 2 pages that still repeat the title", met: false },
    ],
    draft: {
      kind: "batch",
      resource: "Collection pages · title and meta description (6 resources)",
      items: TH_COLLECTIONS.map((r, i) => ({
        id: `b${i + 1}`,
        pageUrl: `${TH_URL}/collections/${r.slug}`,
        linkText: "Title and meta description",
        from: TH_CATEGORY_TITLE,
        to: r.title,
        result: "applied" as const,
        reason: r.ok ? undefined : r.reason,
      })),
      sourceFacts: [
        { label: "Duplicated title", value: `“${TH_CATEGORY_TITLE}” on 6 collection pages`, source: "Audit aud-th-001, crawl 8 Oct" },
        { label: "Duplicated description", value: "One meta description on 6 collection pages", source: "Audit aud-th-003, crawl 9 Nov" },
        { label: "Rule", value: "Every indexable page has a unique title and description", source: "Website readiness criteria 2.3" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-10T12:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-th-004-collections"),
      writes: ["6 collection pages: title and meta description staged through the Shopify connector", "Collection products and layout not changed", "Not live until the apply and publish steps"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-11T16:00:00Z",
      decidedBy: "Omar Farooq",
      decidedAt: "2026-11-11T17:20:00Z",
      note: "Staged change only. Publishing needs a separate action.",
    },
    execution: {
      connector: TH_CONNECTOR(["read_products", "write_products"]),
      cmsState: "published",
      remote: {
        resource: "Collection pages · 6 titles and descriptions",
        versionAtDraft: "rev 31",
        versionNow: "rev 31",
        hashAtDraft: demoDigest("th-collections-31"),
        hashNow: demoDigest("th-collections-31"),
        checkedAt: "2026-11-12T10:19:00Z",
        changed: false,
        note: "Checked just before staging.",
      },
      fields: TH_COLLECTIONS.map((r) => ({
        field: `/collections/${r.slug} · title and description`,
        before: TH_CATEGORY_TITLE,
        after: r.title,
        outcome: "written" as const,
        note: r.ok ? undefined : "Written; live title unchanged at the 16 Nov re-check",
      })),
      completedAt: "2026-11-10T12:30:00Z",
      stagedAt: "2026-11-12T10:20:00Z",
      appliedAt: "2026-11-13T10:05:00Z",
      publishedAt: "2026-11-13T10:10:00Z",
      rollback: { ...EMPTY_ROLLBACK, available: true },
    },
    verification: {
      plannedChecks: TH_COLLECTIONS.map((r, i) => ({ id: `c${i + 1}`, label: `Unique title and description on /collections/${r.slug}`, expect: "Unique, not the store-wide title" })),
      outcome: {
        result: "partially_verified",
        ranAt: "2026-11-16T11:10:00Z",
        sourceLabel: "Targeted re-check of 6 collection pages",
        findingEffect: "Finding fnd-th-004 stays In remediation: 4 of 6 pages fixed, 2 still repeat the store-wide title.",
        checks: TH_COLLECTIONS.map((r, i) => ({
          id: `c${i + 1}`,
          label: `Unique title and description on /collections/${r.slug}`,
          before: { status: "fail" as const, detail: `Title “${TH_CATEGORY_TITLE}” shared with the other collection pages (9 Nov)` },
          after: r.ok
            ? { status: "pass" as const, detail: `Title “${r.title}”; description unique` }
            : { status: "fail" as const, detail: r.reason ?? "Title unchanged" },
        })),
      },
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-08T09:33:00Z", actor: "Audit aud-th-001", kind: "created", title: "Finding fnd-th-004 detected" },
      { id: "h2", at: "2026-11-09T15:40:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-10T12:00:00Z", actor: "Drafting model", kind: "draft", title: "Batch drafted", detail: "6 resources" },
      { id: "h4", at: "2026-11-11T16:00:00Z", actor: "Hira Malik", kind: "approval", title: "Staging approval requested" },
      { id: "h5", at: "2026-11-11T17:20:00Z", actor: "Omar Farooq", kind: "approval", title: "Staged change approved", detail: "Staged change only. Publishing needs a separate action." },
      { id: "h6", at: "2026-11-12T10:20:00Z", actor: "System", kind: "execution", title: "Staged through the Shopify connector", detail: "Remote check passed; 6 of 6 staged. Not live." },
      { id: "h7", at: "2026-11-13T10:05:00Z", actor: "Hira Malik", kind: "execution", title: "Applied", detail: "6 of 6 written as collection updates" },
      { id: "h8", at: "2026-11-13T10:10:00Z", actor: "Hira Malik", kind: "execution", title: "Published", detail: "Storefront refreshed" },
      { id: "h9", at: "2026-11-16T11:10:00Z", actor: "System", kind: "verification", title: "Partially verified", detail: "4 of 6 pages fixed; 2 still repeat the store-wide title" },
    ],
  },

  // Applied by hand and published; waiting for verification.
  "task-th-005": {
    recommendationId: "rec-fnd-th-005-a",
    createdAt: "2026-11-10T17:20:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Organization JSON-LD lists the official profiles in sameAs", "Every sameAs URL is an official profile", "Markup validates"],
    dependencies: [{ label: "Official profile URLs confirmed by the owner", met: true }],
    draft: {
      kind: "patch",
      resource: "Home page · Organization JSON-LD",
      language: "json-ld",
      before: TH_ORG_BEFORE,
      after: TH_ORG_AFTER,
      sourceFacts: [
        { label: "Official profiles", value: "Instagram, Pinterest and TikTok", source: "Store settings, brand profile" },
        { label: "Current markup", value: "Name and logo present; sameAs empty", source: "Audit aud-th-003" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-12T11:00:00Z",
      version: 1,
    },
    approval: { state: "not_required", notRequiredReason: "AI draft only. The snippet was applied by hand by Omar Farooq.", diffHash: demoDigest("task-th-005-org"), writes: [] },
    execution: {
      connector: null,
      cmsState: "published",
      remote: null,
      fields: [{ field: "sameAs", before: "(empty)", after: "3 profiles", outcome: "written", note: "Applied by hand in the theme code editor; theme published" }],
      completedAt: "2026-11-12T16:00:00Z",
      stagedAt: null,
      appliedAt: "2026-11-17T10:20:00Z",
      publishedAt: "2026-11-17T10:25:00Z",
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Applied outside Rankvora AI. Revert in the theme code editor." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "sameAs lists 3 official profiles", expect: "3 profiles" },
        { id: "c2", label: "Every sameAs URL is an official profile", expect: "No unknown URL" },
        { id: "c3", label: "Markup validates", expect: "No errors" },
      ],
      outcome: null,
      simulated: {
        result: "verified_success",
        ranAt: "2026-11-19T09:00:00Z",
        sourceLabel: "Verification audit (demo)",
        findingEffect: "Finding fnd-th-005 set to Verified resolved.",
        checks: [
          { id: "c1", label: "sameAs lists 3 official profiles", before: { status: "fail", detail: "sameAs empty (9 Nov)" }, after: { status: "pass", detail: "3 profiles" } },
          { id: "c2", label: "Every sameAs URL is an official profile", before: { status: "not_applicable", detail: "No URLs" }, after: { status: "pass", detail: "3 of 3 match the brand profile" } },
          { id: "c3", label: "Markup validates", before: { status: "pass", detail: "Valid" }, after: { status: "pass", detail: "Valid" } },
        ],
      },
      context: null,
    },
    history: [
      { id: "h1", at: "2026-10-22T08:30:00Z", actor: "Audit aud-th-002", kind: "created", title: "Finding fnd-th-005 detected" },
      { id: "h2", at: "2026-11-10T17:20:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Omar Farooq" },
      { id: "h3", at: "2026-11-12T11:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted" },
      { id: "h4", at: "2026-11-12T16:00:00Z", actor: "Omar Farooq", kind: "status", title: "Marked draft ready" },
      { id: "h5", at: "2026-11-17T10:20:00Z", actor: "Omar Farooq", kind: "execution", title: "Marked applied", detail: "Snippet edited in the theme code editor" },
      { id: "h6", at: "2026-11-17T10:25:00Z", actor: "Omar Farooq", kind: "execution", title: "Marked published", detail: "Theme published; 3 profiles in the live markup" },
      { id: "h7", at: "2026-11-17T10:26:00Z", actor: "System", kind: "status", title: "Awaiting verification", detail: "Not yet re-assessed by an audit" },
    ],
  },

  // Guidance only, unassigned.
  "task-th-006": {
    recommendationId: "rec-fnd-th-006-a",
    createdAt: "2026-11-17T16:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The cited Maison Alder and threadly.example pages are compared", "A short note records whether the gap is content, structure or neither"],
    dependencies: [],
    draft: {
      kind: "guidance",
      owner: "Unassigned",
      steps: [
        { title: "Open the cited responses", detail: "Read samples resp-aud-th-003-19, -21, -23 and -24, which cite maisonalder.example, and -13, -16 and -18, which cite threadly.example." },
        { title: "List the cited Maison Alder pages", detail: "Note which page each answer cites and which linen or denim question it answers." },
        { title: "Compare with threadly.example", detail: "Find the page that could answer the same question, such as /collections/organic-denim, and note what it opens with." },
        { title: "Respect the prompt versions", detail: "p-th-003 changed wording on 27 Oct. Compare only slots of the same prompt version." },
        { title: "Write a note", detail: "Content gap, structure gap or neither. Do not change pages on the evidence of two audits." },
      ],
      sourceFacts: [
        { label: "November audit", value: "maisonalder.example cited in 4 of 10 · threadly.example in 3 of 10 (responses that returned citations)", source: "Audit aud-th-003, prompts p-th-003 and p-th-004" },
        { label: "Per prompt", value: "p-th-004: maisonalder.example 4 of 5, threadly.example 0 of 5 · p-th-003: threadly.example 3 of 5, maisonalder.example 0 of 5", source: "Audit aud-th-003" },
        { label: "Weekly run", value: "maisonalder.example 4 of 10 · threadly.example 3 of 10", source: "Monitoring run-th-006" },
        { label: "Failed requests", value: "0 of 12 failed; 2 responses returned no citations and are not counted", source: "Audit aud-th-003" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
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
        { id: "c1", label: "Re-run p-th-003 and p-th-004 with the same channels and 3 samples", expect: "Counts reported as n / d" },
        { id: "c2", label: "Failed requests reported separately", expect: "Not counted as absent" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-09T10:30:00Z", actor: "Audit aud-th-003", kind: "created", title: "Finding fnd-th-006 detected" },
      { id: "h2", at: "2026-11-16T09:44:00Z", actor: "Monitoring run-th-006", kind: "status", title: "Finding observed again", detail: "Same split: 4 of 10 vs 3 of 10" },
      { id: "h3", at: "2026-11-17T16:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved" },
      { id: "h4", at: "2026-11-17T16:31:00Z", actor: "System", kind: "status", title: "Task suggested", detail: "No assignee yet" },
    ],
  },

  // Applied as a saved theme revision; not published and not verified.
  "task-th-007": {
    recommendationId: "rec-fnd-th-007-a",
    createdAt: "2026-11-10T17:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["Lab LCP on mobile is 2.5 s or lower", "Hero image is served under 200 KB", "Lab CLS stays at or below 0.1"],
    dependencies: [
      { label: "Owner or admin approval of the exact diff", met: true },
      { label: "Connector with write access to the theme", met: true },
      { label: "Mobile layout check before publishing", met: false },
    ],
    draft: {
      kind: "patch",
      resource: "Product template · /products/waxed-cotton-trench · performance settings",
      language: "yaml",
      before: TH_PERF_BEFORE,
      after: TH_PERF_AFTER,
      sourceFacts: [
        { label: "Lab LCP", value: "3.4 s on mobile; LCP element is the hero image", source: "Audit aud-th-004, lab trace 16 Nov" },
        { label: "Hero image", value: "1.9 MB PNG, loaded after a blocking script", source: "Audit aud-th-003, crawl 9 Nov" },
        { label: "Replacement", value: "140 KB WebP, same dimensions", source: "Shopify Files, upload 12 Nov" },
      ],
      unsupportedClaims: [],
      modelLabel: "Drafting model demo-model-a",
      generatedAt: "2026-11-12T14:00:00Z",
      version: 1,
    },
    approval: {
      state: "approved",
      diffHash: demoDigest("task-th-007-perf"),
      writes: ["Product template · 3 performance settings", "Saved as a theme revision on apply", "Live only after the separate theme publish step"],
      requestedBy: "Hira Malik",
      requestedAt: "2026-11-14T16:00:00Z",
      decidedBy: "Omar Farooq",
      decidedAt: "2026-11-14T18:30:00Z",
    },
    execution: {
      connector: TH_CONNECTOR(["read_themes", "write_themes"]),
      cmsState: "applied",
      remote: {
        resource: "Theme templates/product.json · performance settings",
        versionAtDraft: "rev 57",
        versionNow: "rev 57",
        hashAtDraft: demoDigest("th-product-perf-57"),
        hashNow: demoDigest("th-product-perf-57"),
        checkedAt: "2026-11-19T08:45:00Z",
        changed: false,
        note: "The live theme is still rev 57 with the old settings. The applied revision 58 is saved to the draft theme but not published.",
      },
      fields: [
        { field: "Hero image", before: "trench-hero.png (1.9 MB)", after: "trench-hero.webp (140 KB)", outcome: "written", note: "Saved as a revision. Not live until published." },
        { field: "Hero fetch priority and preload", before: "auto, preload off", after: "high, preload on", outcome: "written", note: "Saved as a revision. Not live until published." },
        { field: "Gallery script", before: "Blocking, in the head", after: "defer", outcome: "written", note: "Saved as a revision. Not live until published." },
      ],
      completedAt: "2026-11-12T14:30:00Z",
      stagedAt: null,
      appliedAt: "2026-11-17T11:15:00Z",
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, available: true },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Lab LCP on mobile", expect: "2.5 s or lower" },
        { id: "c2", label: "Hero image transfer size", expect: "Under 200 KB" },
        { id: "c3", label: "Lab CLS on mobile", expect: "0.1 or lower" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-09T10:35:00Z", actor: "Audit aud-th-003", kind: "created", title: "Finding fnd-th-007 detected" },
      { id: "h2", at: "2026-11-10T17:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-12T14:00:00Z", actor: "Drafting model", kind: "draft", title: "Patch drafted", detail: "3 settings changed" },
      { id: "h4", at: "2026-11-14T16:00:00Z", actor: "Hira Malik", kind: "approval", title: "Approval requested", detail: "Owner or admin must approve the exact diff" },
      { id: "h5", at: "2026-11-14T18:30:00Z", actor: "Omar Farooq", kind: "approval", title: "Approved exact diff" },
      { id: "h6", at: "2026-11-14T19:00:00Z", actor: "Hira Malik", kind: "status", title: "Apply scheduled", detail: "Quiet-hours window 17 Nov 11:00 UK time" },
      { id: "h7", at: "2026-11-16T11:09:00Z", actor: "Audit aud-th-004", kind: "status", title: "Baseline re-measured", detail: "Lab LCP 3.4 s on mobile, before the change" },
      { id: "h8", at: "2026-11-17T11:14:00Z", actor: "System", kind: "execution", title: "Remote check passed", detail: "rev 57, unchanged since draft" },
      { id: "h9", at: "2026-11-17T11:15:00Z", actor: "System", kind: "execution", title: "Applied", detail: "3 of 3 settings written as revision 58. Not published." },
      { id: "h10", at: "2026-11-19T08:45:00Z", actor: "System", kind: "execution", title: "Remote check: revision unchanged", detail: "Not live. Publish to start verification." },
    ],
  },

  // Cancelled before any work: finding accepted as a risk.
  "task-th-008": {
    recommendationId: "rec-fnd-th-008-a",
    createdAt: "2026-11-18T14:30:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The homepage states a short sizing answer using supported facts only", "p-th-007 re-run on the same channels with 3 samples"],
    dependencies: [],
    cancellation: {
      by: "Sana Iqbal",
      at: "2026-11-18T19:00:00Z",
      reason: "Not pursued now. One neutral prompt, 2 of 6 requests failed and only 4 samples are usable. Accepted as a risk; revisit in January if the brand is still absent.",
    },
    draft: {
      kind: "guidance",
      owner: "Hira Malik",
      steps: [
        { title: "Review the homepage", detail: "Note whether the homepage answers a basic sizing question." },
        { title: "List supported facts", detail: "Use only facts from /pages/size-and-fit-guide." },
        { title: "Propose a short answer block", detail: "Two sentences at most, linking to the guide. Do not claim a result in answers." },
      ],
      sourceFacts: [
        { label: "Prompt p-th-007", value: "Brand absent in 4 of 4 successful responses; 2 of 6 requests failed", source: "Audit aud-th-005" },
        { label: "Cited source", value: "maisonalder.example in 4 of 4 successful responses", source: "Responses resp-aud-th-005-08, -09, -10 and -12" },
      ],
    },
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
    execution: {
      connector: null,
      cmsState: "guidance",
      remote: null,
      fields: [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { ...EMPTY_ROLLBACK, unavailableReason: "Cancelled before any change." },
    },
    verification: {
      plannedChecks: [
        { id: "c1", label: "Homepage states a short sizing answer", expect: "Present" },
        { id: "c2", label: "p-th-007 re-run with 3 samples per channel", expect: "Counts reported as n / d" },
      ],
      outcome: null,
      simulated: null,
      context: null,
    },
    history: [
      { id: "h1", at: "2026-11-18T13:08:00Z", actor: "Audit aud-th-005", kind: "created", title: "Finding fnd-th-008 detected" },
      { id: "h2", at: "2026-11-18T14:30:00Z", actor: "Sana Iqbal", kind: "approval", title: "Recommendation approved", detail: "Task created and assigned to Hira Malik" },
      { id: "h3", at: "2026-11-18T19:00:00Z", actor: "Sana Iqbal", kind: "status", title: "Task cancelled", detail: "Accepted risk; revisit in January. Finding set to Accepted risk." },
    ],
  },
};

// ---------------------------------------------------------------------------
// Merged exports (all stores). Ids never collide between stores.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Closed tasks that make Cancelled and Superseded visible in the seeded data.
// They are not in the shared registry, so open-task counts elsewhere are unchanged (both are closed states).
// ---------------------------------------------------------------------------

export type ExtraTask = {
  storeId: string;
  id: string;
  title: string;
  findingId: string;
  status: TaskStatus;
  assignee: string | null;
  dueAt: string | null;
  mode: ExecutionMode;
  risk: RiskLevel;
  priority: Priority;
  cancelReason?: string;
  supersededBy?: string;
};

export const EXTRA_TASKS: ExtraTask[] = [
  {
    storeId: "runpro-pk",
    id: "task-009",
    title: "Standardise the brand spelling in the About page and footer",
    findingId: "fnd-005",
    status: "cancelled",
    assignee: "Hira Malik",
    dueAt: null,
    mode: "guidance",
    risk: "low",
    priority: "P2",
    cancelReason: "Waiting for the brand guidelines. Reopen once the spelling is decided.",
  },
  {
    storeId: "runpro-pk",
    id: "task-010",
    title: "Publish a separate comparison FAQ page",
    findingId: "fnd-009",
    status: "superseded",
    assignee: "Hira Malik",
    dueAt: null,
    mode: "ai_draft",
    risk: "medium",
    priority: "P2",
    supersededBy: "task-008",
  },
];

const closedGuidance = (owner: string, summary: string): TaskDetailSeed["draft"] => ({
  kind: "guidance",
  owner,
  steps: [{ title: "Review the finding", detail: summary }],
  sourceFacts: [],
});

const EXTRA_RESULT = { available: false, laterEdit: null, record: null };

const EXTRA_EXECUTION = (reason: string): TaskDetailSeed["execution"] => ({
  connector: null,
  cmsState: "guidance",
  remote: null,
  fields: [],
  completedAt: null,
  stagedAt: null,
  appliedAt: null,
  publishedAt: null,
  rollback: { ...EXTRA_RESULT, unavailableReason: reason },
});

const EXTRA_TASK_DETAILS: Record<string, TaskDetailSeed> = {
  "task-009": {
    recommendationId: "rec-fnd-005-a",
    createdAt: "2026-11-02T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["The brand is spelled one way on the About page and in the footer"],
    dependencies: [{ label: "Brand guidelines confirm the spelling", met: false }],
    draft: closedGuidance("Hira Malik", "The About page and footer write the brand as two words."),
    approval: { state: "not_required", notRequiredReason: "Guidance only. No write is made by Rankvora AI.", diffHash: null, writes: [] },
    execution: EXTRA_EXECUTION("Cancelled before any change."),
    verification: { plannedChecks: [{ id: "c1", label: "Brand spelling on the About page and footer", expect: "One spelling" }], outcome: null, simulated: null, context: null },
    cancellation: { by: "Sana Iqbal", at: "2026-11-12T10:00:00Z", reason: "Waiting for the brand guidelines. Reopen once the spelling is decided." },
    history: [
      { id: "h1", at: "2026-11-02T09:00:00Z", actor: "Sana Iqbal", kind: "created", title: "Task created from finding fnd-005" },
      { id: "h2", at: "2026-11-12T10:00:00Z", actor: "Sana Iqbal", kind: "status", title: "Cancelled", detail: "Waiting for the brand guidelines" },
    ],
  },
  "task-010": {
    recommendationId: null,
    createdAt: "2026-10-28T09:00:00Z",
    createdBy: "Sana Iqbal",
    successCriteria: ["A comparison answer exists on the site for the two prompts"],
    dependencies: [{ label: "Editor review of the draft", met: false }],
    draft: closedGuidance("Hira Malik", "A separate FAQ page was proposed for the comparison prompts."),
    approval: { state: "not_required", notRequiredReason: "AI draft only. Nothing is written to the site.", diffHash: null, writes: [] },
    execution: EXTRA_EXECUTION("Replaced by task-008."),
    verification: { plannedChecks: [{ id: "c1", label: "Comparison answer on the site", expect: "Present" }], outcome: null, simulated: null, context: null },
    supersession: { by: "Sana Iqbal", at: "2026-11-03T09:00:00Z", successorId: "task-008", reason: "The FAQ block on the product page replaces a separate page." },
    history: [
      { id: "h1", at: "2026-10-28T09:00:00Z", actor: "Sana Iqbal", kind: "created", title: "Task created from finding fnd-009" },
      { id: "h2", at: "2026-11-03T09:00:00Z", actor: "Sana Iqbal", kind: "status", title: "Superseded by task-008", detail: "The FAQ block on the product page replaces a separate page" },
    ],
  },
};

export const FINDING_EXTRAS: Record<string, FindingExtras> = { ...PK_FINDING_EXTRAS, ...AE_FINDING_EXTRAS, ...NU_FINDING_EXTRAS, ...TH_FINDING_EXTRAS };
export const RECOMMENDATIONS: Recommendation[] = [...PK_RECOMMENDATIONS, ...AE_RECOMMENDATIONS, ...NU_RECOMMENDATIONS, ...TH_RECOMMENDATIONS];
export const TASK_SUMMARY_EXTRAS: Record<string, { blockers: string[] }> = { ...PK_TASK_SUMMARY_EXTRAS, ...AE_TASK_SUMMARY_EXTRAS, ...NU_TASK_SUMMARY_EXTRAS, ...TH_TASK_SUMMARY_EXTRAS, "task-009": { blockers: [] }, "task-010": { blockers: [] } };
export const TASK_DETAILS: Record<string, TaskDetailSeed> = { ...PK_TASK_DETAILS, ...AE_TASK_DETAILS, ...NU_TASK_DETAILS, ...TH_TASK_DETAILS, ...EXTRA_TASK_DETAILS };

/** Wording-only title fixes for registry tasks that name a platform (the registry itself is owned by Reports and records). */
export const TASK_TITLE_OVERRIDES: Record<string, string> = {
  "task-ae-001": "Add Product and Offer schema to the product template",
};
