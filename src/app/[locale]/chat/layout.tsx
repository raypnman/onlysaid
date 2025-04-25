"use client";

import {
    Box,
    Container,
    Flex,
    Heading,
    Icon,

} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaComments } from "react-icons/fa";
import { useTranslations } from "next-intl";
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChatPageColors } from "@/utils/colors";
import { Global, css } from '@emotion/react';
import axios from "axios";
import { toaster } from "@/components/ui/toaster";
import {
    setRooms,
    setSelectedRoom,
    setLoadingRooms,
    setUnreadCount,
    joinRoom,
    setPlanSectionWidth,
    setSidebarWidth
} from '@/store/features/chatSlice';
import { ChatRoomList } from "@/components/chat/room_list";
import Loading from "@/components/loading";
import { useSession } from "next-auth/react";
import { CreateRoomModal } from "@/components/chat/create_room_modal";
import PlanSection from "@/components/chat/plan_section";

const MotionBox = motion(Box);

const colorPalettes = [
    "blue", "green", "yellow", "orange", "red", "purple", "teal", "gray"
];

export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = useTranslations("Chat");
    const { isAuthenticated } = useSelector((state: RootState) => state.user);
    const router = useRouter();
    const colors = useChatPageColors();
    const dispatch = useDispatch();
    const { data: session } = useSession();

    // Get chat state from Redux
    const {
        rooms,
        selectedRoomId,
        unreadCounts,
        isLoadingRooms,
        isSocketConnected,
        planSectionWidth,
        sidebarWidth
    } = useSelector((state: RootState) => state.chat);

    // Remove container resizing state and functionality
    const containerRef = useRef<HTMLDivElement>(null);

    // State for creating new room
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [isCreatingRoomLoading, setIsCreatingRoomLoading] = useState(false);

    // Add state for sidebar resizing
    const [sidebarResizing, setSidebarResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const MIN_SIDEBAR_WIDTH = 200;
    const MAX_SIDEBAR_WIDTH = 320;

    // Add state for plan section resizing
    const [planSectionResizing, setPlanSectionResizing] = useState(false);
    const planSectionRef = useRef<HTMLDivElement>(null);
    const MIN_PLAN_SECTION_WIDTH = 200;
    const MAX_PLAN_SECTION_WIDTH = 400;
    const [resizeStartPosition, setResizeStartPosition] = useState(0);

    // Authentication check
    useEffect(() => {
        if (!isAuthenticated) {
            router.push("/signin");
        }
    }, [isAuthenticated, router]);

    // Fetch rooms
    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const response = await axios.get("/api/chat/get_rooms");
                // Make sure rooms have their active_users properly populated
                const roomsWithUsers = response.data.map((room: any) => {
                    // If active_users is null or undefined, initialize as empty array
                    if (!room.active_users) {
                        room.active_users = [];
                    }
                    return room;
                });

                dispatch(setRooms(roomsWithUsers));
            } catch (error) {
                toaster.create({
                    title: t("error"),
                    description: t("error_fetching_rooms"),
                    type: "error"
                });
            } finally {
                dispatch(setLoadingRooms(false));
            }
        };

        if (session) {
            fetchRooms();
        }
    }, [session, dispatch, t]);

    // Join rooms when socket connects
    useEffect(() => {
        // When socket connects, join all rooms the user is part of
        if (isSocketConnected && rooms.length > 0) {
            console.log("Socket connected, joining all rooms:", rooms.map(r => r.id));
            rooms.forEach(room => {
                dispatch({ type: 'chat/joinRoom', payload: room.id });
            });
        }
    }, [isSocketConnected, rooms, dispatch]);

    // Handle room selection
    const handleRoomSelect = useCallback((roomId: string) => {
        console.log("Selecting room:", roomId);

        // First join the room via socket
        dispatch(joinRoom(roomId));

        // Then set it as selected in Redux
        dispatch(setSelectedRoom(roomId));

        // Reset unread count for this room
        dispatch(setUnreadCount({ roomId, count: 0 }));
    }, [dispatch]);

    // Handle sidebar resize start
    const handleSidebarResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setSidebarResizing(true);

        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(
                MIN_SIDEBAR_WIDTH,
                Math.min(MAX_SIDEBAR_WIDTH, startWidth + (e.clientX - startX))
            );
            // Update Redux instead of local state
            dispatch(setSidebarWidth(newWidth));
        };

        const handleMouseUp = () => {
            setSidebarResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Get the current room
    const currentRoom = useMemo(() => {
        return rooms.find(room => room.id === selectedRoomId);
    }, [rooms, selectedRoomId]);

    // Handle plan section resize start
    const handlePlanSectionResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setPlanSectionResizing(true);
        setResizeStartPosition(e.clientX);
    };

    // Effect for plan section resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (planSectionResizing && planSectionRef.current) {
                const deltaX = e.clientX - resizeStartPosition;
                const newWidth = Math.max(
                    MIN_PLAN_SECTION_WIDTH,
                    Math.min(MAX_PLAN_SECTION_WIDTH, planSectionWidth - deltaX)
                );

                // Update Redux state
                dispatch(setPlanSectionWidth(newWidth));

                // Update DOM directly for smooth resizing
                planSectionRef.current.style.width = `${newWidth}px`;

                setResizeStartPosition(e.clientX);
            }
        };

        const handleMouseUp = () => {
            setPlanSectionResizing(false);
        };

        if (planSectionResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [planSectionResizing, resizeStartPosition, planSectionWidth, dispatch]);

    if (!isAuthenticated) {
        return null;
    }

    if (isLoadingRooms || !session) {
        return <Loading />;
    }

    return (
        <>
            {/* Global styles to override parent constraints */}
            <Global
                styles={css`
                    body > div, 
                    #__next, 
                    #__next > div, 
                    main, 
                    main > div, 
                    main > div > div {
                        overflow: visible !important;
                        max-width: none !important;
                    }
                    
                    .chakra-container {
                        max-width: none !important;
                        overflow: visible !important;
                    }
                `}
            />

            <Box
                width="100%"
                height="100%"
                overflow="visible"
                position="relative"
                display="flex"
                justifyContent="center"
                maxWidth="none !important"
                css={{
                    '& > *': {
                        maxWidth: 'none !important',
                        overflow: 'visible !important'
                    }
                }}
            >
                <Container
                    ref={containerRef}
                    maxW="none"
                    width="98%"
                    px={{ base: 1, md: 2, lg: 4 }}
                    py={3}
                    height="calc(100% - 10px)"
                    position="relative"
                    overflow="hidden"
                    css={{
                        maxWidth: "98% !important",
                        overflow: 'visible !important'
                    }}
                >
                    <MotionBox
                        width="100%"
                        height="100%"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        display="flex"
                        flexDirection="column"
                        overflow="hidden"
                        position="relative"
                    >
                        <Heading
                            size="lg"
                            mb={6}
                            display="flex"
                            alignItems="center"
                            color={colors.textColorHeading}
                        >
                            <Icon as={FaComments} mr={3} color="blue.500" />
                            {t("chat")}
                        </Heading>

                        <Flex
                            width="100%"
                            height="calc(100% - 60px)"
                            position="relative"
                            overflow="hidden"
                            gap={4}
                        >
                            {/* Room List Component with resize handle */}
                            <Box
                                ref={sidebarRef}
                                width={`${sidebarWidth}px`}
                                flexShrink={0}
                                position="relative"
                                transition={sidebarResizing ? 'none' : 'width 0.2s'}
                            >
                                <ChatRoomList
                                    rooms={rooms}
                                    selectedRoomId={selectedRoomId}
                                    unreadCounts={unreadCounts}
                                    onSelectRoom={handleRoomSelect}
                                    onCreateRoomClick={() => setIsCreatingRoom(true)}
                                    isCreatingRoomLoading={isCreatingRoomLoading}
                                    width={sidebarWidth}
                                />

                                {/* Resize handle for sidebar */}
                                <Box
                                    position="absolute"
                                    top="0"
                                    right="-4px"
                                    width="8px"
                                    height="100%"
                                    cursor="col-resize"
                                    onMouseDown={handleSidebarResizeStart}
                                    _hover={{
                                        bg: colors.cardBg,
                                        opacity: 0.5
                                    }}
                                    zIndex={2}
                                />
                            </Box>

                            {/* Main content area - will render children */}
                            <Box flex="1" minWidth="0">
                                {children}
                            </Box>

                            {/* Plan Section Component with resize handle */}
                            <Box
                                ref={planSectionRef}
                                width={`${planSectionWidth}px`}
                                flexShrink={0}
                                position="relative"
                                transition={planSectionResizing ? 'none' : 'width 0.2s'}
                            >
                                <PlanSection
                                    currentRoom={currentRoom}
                                    colors={colors}
                                    t={t}
                                />

                                {/* Resize handle for plan section */}
                                <Box
                                    position="absolute"
                                    top="0"
                                    left="-4px"
                                    width="8px"
                                    height="100%"
                                    cursor="col-resize"
                                    onMouseDown={handlePlanSectionResizeStart}
                                    _hover={{
                                        bg: colors.borderColor || "blue.500",
                                        opacity: 0.5
                                    }}
                                    zIndex={2}
                                />
                            </Box>
                        </Flex>
                    </MotionBox>
                </Container>
            </Box>

            {/* Add the CreateRoomModal component */}
            <CreateRoomModal
                isOpen={isCreatingRoom}
                onClose={() => setIsCreatingRoom(false)}
            />
        </>
    );
}
