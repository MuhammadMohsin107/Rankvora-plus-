/** Endpoints for the prompt library: /websites/:websiteId/prompts, /prompt-groups and /prompts/:promptId. */
import { MAX_IMPORT_BODY_BYTES } from "../config/limits";
import { apiHandler } from "../http/handler";
import {
  createAssignment,
  createAssignmentSchema,
  findAssignment,
  listAssignments,
  permissionFor,
  removeAssignment,
  removeAssignmentSchema,
  updateAssignment,
  updateAssignmentSchema,
} from "../modules/prompts/assignments";
import { bulkPrompts, bulkSchema } from "../modules/prompts/bulk";
import { createGroup, createGroupSchema, listGroups, removeGroup, removeGroupSchema, renameGroup, renameGroupSchema } from "../modules/prompts/groups";
import { importPrompts, importSchema } from "../modules/prompts/import";
import {
  changePromptStatus,
  createPrompt,
  createPromptSchema,
  deletePrompt,
  deletePromptSchema,
  getPrompt,
  listPrompts,
  listPromptsSchema,
  promptHistory,
  promptStatusSchema,
  updatePrompt,
  updatePromptSchema,
} from "../modules/prompts/service";
import { approveVersion, createVersion, listVersions, newVersionSchema } from "../modules/prompts/versions";
import { assertPermission, requirePrompt, requireWebsite } from "../tenancy/guard";

export const promptsList = apiHandler({ name: "prompts.list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.read");
  return { data: await listPrompts(context, scope, context.query(listPromptsSchema)) };
});

export const promptsCreate = apiHandler({ name: "prompts.create", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.write");
  return { status: 201, data: await createPrompt(context, scope, context.body(createPromptSchema)) };
});

export const promptsBulk = apiHandler({ name: "prompts.bulk" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.write");
  return { data: await bulkPrompts(context, scope, context.body(bulkSchema)) };
});

export const promptsImport = apiHandler({ name: "prompts.import", idempotent: true, maxBodyBytes: MAX_IMPORT_BODY_BYTES }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.write");
  return { data: await importPrompts(context, scope, context.body(importSchema)) };
});

export const groupsList = apiHandler({ name: "prompt_groups.list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.read");
  return { data: await listGroups(context, scope) };
});

export const groupsCreate = apiHandler({ name: "prompt_groups.create", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.write");
  return { status: 201, data: await createGroup(context, scope, context.body(createGroupSchema)) };
});

export const groupRename = apiHandler({ name: "prompt_groups.rename" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.write");
  return { data: await renameGroup(context, scope, context.params.groupId, context.body(renameGroupSchema)) };
});

export const groupRemove = apiHandler({ name: "prompt_groups.remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "prompt.write");
  return { data: await removeGroup(context, scope, context.params.groupId, context.body(removeGroupSchema)) };
});

export const promptGet = apiHandler({ name: "prompts.get" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.read");
  return { data: await getPrompt(context, scope) };
});

export const promptUpdate = apiHandler({ name: "prompts.update" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.write");
  return { data: await updatePrompt(context, scope, context.body(updatePromptSchema)) };
});

export const promptDelete = apiHandler({ name: "prompts.delete" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.delete");
  return { data: await deletePrompt(context, scope, context.body(deletePromptSchema)) };
});

export const promptStatus = apiHandler({ name: "prompts.status" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.write");
  return { data: await changePromptStatus(context, scope, context.body(promptStatusSchema)) };
});

export const versionsList = apiHandler({ name: "prompts.versions" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.read");
  return { data: await listVersions(context, scope) };
});

export const versionsCreate = apiHandler({ name: "prompts.version_create", idempotent: true }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.write");
  return { status: 201, data: await createVersion(context, scope, context.body(newVersionSchema)) };
});

export const versionApprove = apiHandler({ name: "prompts.version_approve" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.approve");
  return { data: await approveVersion(context, scope, context.params.versionId) };
});

export const assignmentsList = apiHandler({ name: "prompts.assignments" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.read");
  return { data: await listAssignments(context, scope) };
});

// An assignment decides what runs, so it also needs the permission of what it runs.
export const assignmentsCreate = apiHandler({ name: "prompts.assignment_create", idempotent: true }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.read");
  const input = context.body(createAssignmentSchema);
  await assertPermission(context, scope, permissionFor(input.purpose));
  return { status: 201, data: await createAssignment(context, scope, input) };
});

export const assignmentUpdate = apiHandler({ name: "prompts.assignment_update" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.read");
  const current = await findAssignment(context, scope, context.params.assignmentId);
  await assertPermission(context, scope, permissionFor(current.purpose));
  return { data: await updateAssignment(context, scope, current.id, context.body(updateAssignmentSchema)) };
});

export const assignmentRemove = apiHandler({ name: "prompts.assignment_remove" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "prompt.read");
  const current = await findAssignment(context, scope, context.params.assignmentId);
  await assertPermission(context, scope, permissionFor(current.purpose));
  return { data: await removeAssignment(context, scope, current.id, context.body(removeAssignmentSchema)) };
});

export const promptActivityList = apiHandler({ name: "prompts.activity" }, async (context) => {
  const scope = await requirePrompt(context, context.params.promptId, "activity.read");
  return { data: await promptHistory(context, scope) };
});
