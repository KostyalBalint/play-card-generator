import { prisma } from "@/lib/prisma";

/**
 * Image generation and PDF export both run in-process inside (or right after)
 * the request that started them, so a restart kills the work with nobody left
 * to write the terminal state: the row stays PENDING/RUNNING and the UI spins
 * on it forever, with no way to start over.
 *
 * Nothing can legitimately be in flight while the server is booting, so every
 * unfinished row found here is orphaned by definition and is failed with an
 * explanation. Assumes a single app instance, which is how this deploys (see
 * docker-compose.yml) — a second replica booting would fail the first one's
 * live jobs.
 */
export async function failOrphanedJobs(): Promise<void> {
  const [images, exports] = await Promise.all([
    prisma.generatedImage.updateMany({
      where: { status: "PENDING" },
      data: {
        status: "FAILED",
        error: "Generation stopped — the server restarted. Try again.",
      },
    }),
    prisma.exportJob.updateMany({
      where: { status: { in: ["PENDING", "RUNNING"] } },
      data: {
        status: "FAILED",
        error: "Export stopped — the server restarted mid-export. Try again.",
      },
    }),
  ]);
  if (images.count || exports.count) {
    console.log(
      `Startup cleanup: failed ${images.count} orphaned image(s), ${exports.count} orphaned export job(s)`,
    );
  }
}
