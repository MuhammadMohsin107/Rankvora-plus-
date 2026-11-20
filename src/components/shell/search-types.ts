/**
 * Serialisable index the server layout hands to the command palette. Field names match the records
 * modules overlay in demo-state, so locally created or edited rows merge in with the same keys.
 * Rows created locally may carry `storeId` or `websiteId`; the palette also resolves it from events.
 */
export type SearchPrompt = { id: string; storeId: string; text: string; status: string };
export type SearchFinding = { id: string; storeId: string; title: string; status: string };
export type SearchTask = { id: string; storeId: string; title: string; status: string };
export type SearchRun = { id: string; storeId: string; scheduledFor: string; status: string };
export type SearchReport = { id: string; storeId: string; title: string; type: string };

export type SearchIndex = {
  prompts: SearchPrompt[];
  findings: SearchFinding[];
  tasks: SearchTask[];
  runs: SearchRun[];
  reports: SearchReport[];
};
