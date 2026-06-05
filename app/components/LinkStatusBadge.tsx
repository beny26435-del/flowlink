import type { LinkStatus } from "../../src/flowlink-v4/types";

export function LinkStatusBadge({ status }: { status?: LinkStatus }) {
  if (!status) return <span className="badge">Loading</span>;
  if (!status?.exists) return <span className="badge danger">Invalid</span>;
  if (status.paid) return <span className="badge good pulse">{status.mode === 3 ? "Funded" : "Paid"}</span>;
  if (status.cancelled) return <span className="badge danger">Cancelled</span>;
  if (status.expired) return <span className="badge warn">Expired</span>;
  if (status.active) return <span className="badge good pulse">{status.mode === 3 ? "Funding" : "Payable"}</span>;
  return <span className="badge">Inactive</span>;
}
