"use client";

import { useParams } from "next/navigation";
import { PayLinkView } from "../../components/PayLinkView";
import { normalizeSlugInput, validateSlug } from "../../../src/flowlink-v4/utils";

export default function PublicPayPage() {
  const params = useParams<{ slug: string }>();
  const slug = normalizeSlugInput(decodeURIComponent(params.slug ?? ""));

  return <PayLinkView slug={validateSlug(slug) ? slug : undefined} routeKey={`/p/${slug}`} />;
}
