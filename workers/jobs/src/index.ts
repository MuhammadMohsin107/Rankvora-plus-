/**
 * Jobs Worker placeholder. No background work exists yet
 * (docs/backend/backend-plan.md, roadmap task 1.8).
 */
const jobs = {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
};

export default jobs;
