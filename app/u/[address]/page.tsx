"use client";

import { useParams } from "next/navigation";
import { PublicProfileView } from "../../components/PublicProfileView";

export default function AddressProfilePage() {
  const params = useParams<{ address: string }>();
  return <PublicProfileView address={params.address} />;
}
