import { buildExplorerAddressUrl, buildExplorerTxUrl } from "../../src/flowlink/utils";

export function ExplorerLink({
  kind,
  value,
  label,
}: {
  kind: "address" | "tx";
  value: string;
  label?: string;
}) {
  const href = kind === "address" ? buildExplorerAddressUrl(value) : buildExplorerTxUrl(value);

  return (
    <a className="secondary-button" href={href} target="_blank" rel="noreferrer">
      {label ?? "Open Arcscan"} ↗
    </a>
  );
}
