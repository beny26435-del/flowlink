"use client";

import { useParams } from "next/navigation";
import { PublicProfileView } from "../../components/PublicProfileView";
import { normalizeUsername } from "../../../src/flowlink-v4/utils";

export default function UsernameProfilePage() {
  const params = useParams<{ username: string }>();
  return <PublicProfileView username={normalizeUsername(decodeURIComponent(params.username ?? ""))} />;
}
