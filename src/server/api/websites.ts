/** Endpoints under /api/v1/websites. */
import { apiHandler } from "../http/handler";
import { listActivity } from "../modules/history/service";
import { addDomain, addDomainSchema, changeMainDomain, changeMainDomainSchema, listDomains, retireDomain, retireDomainSchema } from "../modules/websites/domains";
import {
  changeWebsiteStatus,
  createWebsite,
  createWebsiteSchema,
  getWebsite,
  listWebsites,
  listWebsitesSchema,
  removeWebsite,
  removeWebsiteSchema,
  updateWebsite,
  updateWebsiteSchema,
  websiteStatusSchema,
} from "../modules/websites/service";
import { checkDomain, listDomainChecks } from "../modules/websites/inspect";
import { checkVerification, startVerification } from "../modules/websites/verification";
import { requireOrganization, requireWebsite } from "../tenancy/guard";
import { pageQuery } from "../validation";

export const websitesList = apiHandler({ name: "websites.list" }, async (context) => {
  const query = context.query(listWebsitesSchema);
  const scope = await requireOrganization(context, query.organizationId, "website.read");
  return { data: await listWebsites(context, scope, query.status) };
});

export const websitesCreate = apiHandler({ name: "websites.create", idempotent: true }, async (context) => {
  const input = context.body(createWebsiteSchema);
  // The organization id in the body is only a request: membership is checked here.
  const scope = await requireOrganization(context, input.organizationId, "website.create");
  return { status: 201, data: await createWebsite(context, scope, input) };
});

export const websiteGet = apiHandler({ name: "websites.get" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await getWebsite(context, scope) };
});

export const websiteUpdate = apiHandler({ name: "websites.update" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await updateWebsite(context, scope, context.body(updateWebsiteSchema)) };
});

export const websiteRemove = apiHandler({ name: "websites.remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.remove");
  return { data: await removeWebsite(context, scope, context.body(removeWebsiteSchema)) };
});

export const websiteStatus = apiHandler({ name: "websites.status" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.lifecycle");
  return { data: await changeWebsiteStatus(context, scope, context.body(websiteStatusSchema)) };
});

export const websiteActivityList = apiHandler({ name: "websites.activity" }, async (context) => {
  // History names who did what, so it needs the same permission as the organization's history.
  const scope = await requireWebsite(context, context.params.websiteId, "activity.read");
  return { data: await listActivity(context, scope, context.query(pageQuery), scope.websiteId) };
});

export const domainsList = apiHandler({ name: "domains.list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await listDomains(context, scope) };
});

export const domainsAdd = apiHandler({ name: "domains.add", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.domain.manage");
  return { status: 201, data: await addDomain(context, scope, context.body(addDomainSchema)) };
});

export const domainRetire = apiHandler({ name: "domains.retire" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.domain.manage");
  return { data: await retireDomain(context, scope, context.params.domainId, context.body(retireDomainSchema)) };
});

export const mainDomainChange = apiHandler({ name: "domains.change_main" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.domain.manage");
  return { data: await changeMainDomain(context, scope, context.body(changeMainDomainSchema)) };
});

export const domainChecksList = apiHandler({ name: "domains.checks" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await listDomainChecks(context, scope, context.params.domainId) };
});

export const domainCheck = apiHandler({ name: "domains.check" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.domain.manage");
  return { status: 201, data: await checkDomain(context, scope, context.params.domainId) };
});

export const verificationStart = apiHandler({ name: "domains.verification_start" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.verify");
  return { data: await startVerification(context, scope, context.params.domainId) };
});

export const verificationCheck = apiHandler({ name: "domains.verification_check" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.verify");
  return { data: await checkVerification(context, scope, context.params.domainId) };
});
