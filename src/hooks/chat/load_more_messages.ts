import { useState } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { setMessages } from '@/store/features/chatSlice';
import { User } from '@/types/user';

interface UseLoadMoreMessagesProps {
    selectedRoomId: string | null;
    currentMessages: any[];
    hasMoreMessages: boolean;
    setHasMoreMessages: (value: boolean) => void;
    MESSAGE_LIMIT: number;
    t: (key: string) => string;
    toaster: {
        create: (options: { title: string; description: string; type: string }) => void;
    };
}

export const useLoadMoreMessages = ({
    selectedRoomId,
    currentMessages,
    hasMoreMessages,
    setHasMoreMessages,
    MESSAGE_LIMIT,
    t,
    toaster
}: UseLoadMoreMessagesProps) => {
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const dispatch = useDispatch();

    const loadMoreMessages = async () => {
        if (!selectedRoomId || isLoadingMore || !hasMoreMessages) return;

        try {
            setIsLoadingMore(true);

            // Get the oldest message ID in the current messages
            const oldestMessage = currentMessages[0];
            const oldestMessageId = oldestMessage?.id;

            // Fetch older messages
            const response = await axios.get(`/api/chat/get_messages`, {
                params: {
                    roomId: selectedRoomId,
                    before: oldestMessageId,
                    limit: MESSAGE_LIMIT
                }
            });

            const serverMessages = response.data;

            // If we got fewer messages than the limit, there are no more to load
            setHasMoreMessages(serverMessages.length >= MESSAGE_LIMIT);

            // Only proceed if we have messages to process
            if (serverMessages.length > 0) {
                // Use a more efficient approach to process messages
                const userIds = [...new Set(serverMessages.map((msg: any) =>
                    typeof msg.sender === 'string' ? msg.sender : msg.sender?.id
                ))].filter(Boolean);

                // Fetch all user data in a single request
                const usersResponse = await axios.post('/api/user/get_users', {
                    ids: userIds
                });

                // Create a map for faster lookups
                const userMap = new Map();
                if (usersResponse.data && usersResponse.data.users) {
                    usersResponse.data.users.forEach((user: User) => {
                        userMap.set(user.id, user);
                    });
                }

                // Transform messages efficiently
                const transformedMessages = serverMessages.map((msg: any) => {
                    if (typeof msg.sender === 'string') {
                        const user = userMap.get(msg.sender);
                        return {
                            ...msg,
                            sender: user || {
                                id: msg.sender,
                                username: 'Unknown User',
                                email: '',
                                role: 'user',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                active_rooms: [],
                                archived_rooms: []
                            }
                        };
                    }
                    return msg;
                });

                // Add the older messages to the Redux store
                dispatch(setMessages({
                    roomId: selectedRoomId,
                    messages: [...transformedMessages, ...currentMessages]
                }));
            }
        } catch (error) {
            console.error("Error loading more messages:", error);
            toaster.create({
                title: t("error"),
                description: t("error_loading_more_messages"),
                type: "error"
            });
        } finally {
            setIsLoadingMore(false);
        }
    };

    return {
        isLoadingMore,
        loadMoreMessages
    };
};
