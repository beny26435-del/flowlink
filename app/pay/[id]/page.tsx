"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { PayLinkView } from "../../components/PayLinkView";

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const linkId = useMemo(() => parseLinkId(params.id), [params.id]);

  return <PayLinkView linkId={linkId} routeKey={`/pay/${params.id}`} />;
}

function parseLinkId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return undefined;
  return BigInt(raw);
}
