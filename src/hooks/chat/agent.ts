import axios from "axios";
import { useTranslations } from "next-intl";
import { User } from "@/types/user";
import { toaster } from "@/components/ui/toaster";
import { useDispatch } from "react-redux";
import { joinRoom } from "@/store/features/chatSlice";
import { updateActiveRooms } from "@/store/features/userSlice";
import { useCallback } from "react";

// Create a proper hook (name starts with "use")
export const useAgentAPI = () => {
    const dispatch = useDispatch();
    const t = useTranslations();

    // Move the function inside the hook and use useCallback
    const triggerAgentAPI = useCallback(async (
        message: string,
        roomId: string,
        users: User[],
        currentUser: User | null,
    ) => {
        try {
            // Extract the mentioned agent username
            let assigneeId = null;
            const mentionMatch = message.match(/@([a-zA-Z0-9_]+)/);

            if (mentionMatch && mentionMatch[1]) {
                const mentionedUsername = mentionMatch[1];

                // Look for the mentioned user in all users
                const mentionedUser = users.find(user =>
                    user.username === mentionedUsername ||
                    (mentionedUsername === "agent" && user.role === "agent")
                );

                if (mentionedUser) {
                    assigneeId = mentionedUser.id;
                }
            }

            const payload = {
                summoner: currentUser?.email,
                query: message,
                room_id: roomId,
                assigner: currentUser?.id,
                created_at: new Date().toISOString(),
                assignee: assigneeId,
            };

            const response = await axios.post(`/api/mcp/create_plan`, payload);

            dispatch(joinRoom(roomId));

            await axios.post("/api/user/update_user", {
                roomId: roomId,
                action: "add"
            });

            dispatch(updateActiveRooms({ roomId, action: "add" }));
        }
        catch (error) {
            console.error("Error calling agent API:", error);

            if (axios.isAxiosError(error) && error.response) {
                console.error("Response status:", error.response.status);
                console.error("Response data:", error.response.data);
            }

            toaster.create({
                title: t("error"),
                description: t("error_calling_agent_api"),
                type: "error"
            });
        }
    }, [dispatch, t]);

    return { triggerAgentAPI };
};