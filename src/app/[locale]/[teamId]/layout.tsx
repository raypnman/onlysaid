"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const teamId = params.teamId;
  const { currentUser, isAuthenticated, isLoading, isOwner } = useSelector((state: RootState) => state.user);
  const teams = currentUser?.teams;
  const isMember = teams?.some((team) => team === teamId);
  const [accessChecked, setAccessChecked] = useState(false);

  // Handle authentication check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, isLoading, router]);

  // Handle team membership check
  useEffect(() => {
    if (!isLoading && isAuthenticated && teams) {
      if (!isMember) {
        router.push('/redirect/no_access?reason=Not a member of this team');
      } else {
        setAccessChecked(true);
      }
    }
  }, [isMember, isAuthenticated, isLoading, teams, router]);

  // Show nothing while checking access
  if (isLoading || !accessChecked) {
    return null; // Or return a loading spinner
  }

  return <>{children}</>;
}
