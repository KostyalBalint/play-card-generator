/**
 * Runs once per server start, before any request is served.
 */
export async function register() {
  // Edge runtime has no database client; the cleanup is Node-only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { failOrphanedJobs } = await import("@/lib/startup");
  try {
    await failOrphanedJobs();
  } catch (err) {
    // A boot must never be blocked by the cleanup — stuck rows are recoverable,
    // a server that will not start is not.
    console.error("Startup cleanup failed:", err);
  }
}
