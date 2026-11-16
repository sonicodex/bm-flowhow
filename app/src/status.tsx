import type { ReviewState, ReviewStatus } from "./tour.ts";

// A flow's review status: icon plus label, never colour alone (§7). The
// viewer gives it an id, and public/js/viewer.js draws the same line again
// there when the status changes.
const STATUS_ICONS: Record<ReviewState, string> = { pending: "pending", in_progress: "in_progress", reviewed: "done" };

export function StatusLine({ status, id }: { status: ReviewStatus; id?: string }) {
  return (
    <p class="review-status" id={id} data-state={status.state}>
      <img class="icon" src={`/icons/${STATUS_ICONS[status.state]}.svg`} alt="" width="18" height="18" />
      <strong>{status.label}</strong>
      {status.detail && <span class="muted">{status.detail}</span>}
    </p>
  );
}
