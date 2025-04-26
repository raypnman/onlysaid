"use client";

import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { setLastOpenedTeam, updateOwner } from "@/store/features/userSlice";
import { useDispatch } from "react-redux";

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dispatch = useDispatch();
  const params = useParams();
  const teamId = params.teamId as string;
  const { currentUser, isAuthenticated, isLoading, isOwner } = useSelector((state: RootState) => state.user);
  const teams = currentUser?.teams;
  const isMember = teams?.some((team) => team === teamId);
  const [accessChecked, setAccessChecked] = useState(false);
  const [teamLoading, setTeamLoading] = useState(true);

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

  // Fetch team data and update Redux store
  useEffect(() => {
    if (teamId && accessChecked) {
      const fetchTeamData = async () => {
        try {
          setTeamLoading(true);
          const response = await fetch(`/api/team/get_team?team_id=${teamId}`);

          if (!response.ok) {
            throw new Error('Failed to fetch team data');
          }

          const data = await response.json();

          // Update Redux store with team data
          dispatch(setLastOpenedTeam(teamId));
          dispatch(updateOwner({ team: data.team }));

        } catch (error) {
          console.error('Error fetching team data:', error);
        } finally {
          setTeamLoading(false);
        }
      };

      fetchTeamData();
    }
  }, [teamId, accessChecked, dispatch]);

  // Show nothing while checking access or loading team data
  if (isLoading || !accessChecked || teamLoading) {
    return null; // Or return a loading spinner
  }

  return <>{children}</>;
}
