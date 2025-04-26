"use client";

import React from "react";
import { Box, Heading, Flex, Icon, Container } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { IconType } from "react-icons";
import { FaUsers } from "react-icons/fa";
import { useTranslations } from "next-intl";
import { useSelector } from 'react-redux';
import { RootState } from "@/store/store";
import { useRouter } from "next/navigation";
import Loading from "@/components/loading";
import { useColorModeValue } from "@/components/ui/color-mode";

// Create motion components
const MotionBox = motion.create(Box);
const MotionFlex = motion.create(Flex);
const MotionVStack = motion.create(Box);

interface TabItem {
    icon: IconType;
    label: string;
    id: number;
    href: string;
}

export default function AdminPanelLayout({
    children
}: {
    children: React.ReactNode
}) {
    const t = useTranslations("AdminPanel");
    const router = useRouter();
    const { currentUser, isAuthenticated, isLoading, isOwner } = useSelector(
        (state: RootState) => state.user
    );

    // Define custom colors using useColorModeValue for dark mode support
    const textColorHeading = useColorModeValue("gray.800", "gray.100");
    const textColor = useColorModeValue("gray.800", "gray.100");
    const hoverBg = useColorModeValue("gray.50", "gray.700");

    // Determine active tab based on current path
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const activeTabId = pathname.includes('/chatroom') ? 1 : 0;

    // Define the tab items
    const tabItems: TabItem[] = [
        { icon: FaUsers, label: t("users"), id: 0, href: "/admin/panel" },
        { icon: FaUsers, label: t("chatroom"), id: 1, href: "/admin/panel/chatroom" },
        // More tabs can be added here in the future
    ];

    // Handle tab navigation
    const handleTabClick = (href: string) => {
        router.push(href);
    };

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                duration: 0.4,
                when: "beforeChildren",
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    };

    const tabVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    };

    // Check authentication and permissions
    React.useEffect(() => {
        if (!isAuthenticated && !isLoading) {
            router.push('/signin');
        } else if (currentUser && !isOwner && !isLoading) {
            router.push('/redirect/no_access?reason=Access denied');
        }
    }, [currentUser, isOwner, router, isAuthenticated, isLoading]);

    // Show loading state while checking authentication
    if (isLoading) {
        return <Loading />;
    }

    // Only render content if authenticated and is owner
    if (!isAuthenticated || (currentUser && !isOwner)) {
        return null;
    }

    return (
        <Container
            maxW="1400px"
            px={{ base: 4, md: 6, lg: 8 }}
            py={4}
            height="100%"
            position="relative"
            overflow="hidden"
        >
            <MotionBox
                width="100%"
                height="100%"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                display="flex"
                flexDirection="column"
                overflow="hidden"
                position="relative"
            >
                <MotionBox variants={itemVariants}>
                    <Heading size="lg" mb={6} display="flex" alignItems="center" color={textColorHeading}>
                        <Icon as={FaUsers} mr={3} color="blue.500" />
                        {t("admin_panel")}
                    </Heading>
                </MotionBox>

                <MotionFlex
                    direction={{ base: "column", md: "row" }}
                    gap={6}
                    variants={itemVariants}
                    height="calc(100% - 60px)"
                    overflow="hidden"
                >
                    {/* Left sidebar */}
                    <MotionVStack
                        width={{ base: "100%", md: "250px" }}
                        display="flex"
                        flexDirection="column"
                        height="fit-content"
                        variants={itemVariants}
                    >
                        {tabItems.map((item) => (
                            <motion.div key={item.id} variants={tabVariants}>
                                <Box
                                    as="button"
                                    py={3}
                                    px={4}
                                    borderRadius="md"
                                    bg={activeTabId === item.id ? hoverBg : "transparent"}
                                    color={textColor}
                                    fontWeight="medium"
                                    fontSize="sm"
                                    width="100%"
                                    textAlign="left"
                                    _hover={{ bg: hoverBg }}
                                    _active={{ bg: activeTabId === item.id ? hoverBg : "gray.100" }}
                                    onClick={() => handleTabClick(item.href)}
                                >
                                    <Flex align="center">
                                        <Icon as={item.icon} color={textColor} mr={2} />
                                        {item.label}
                                    </Flex>
                                </Box>
                            </motion.div>
                        ))}
                    </MotionVStack>

                    {/* Main content */}
                    <MotionBox flex={1} variants={itemVariants} overflow="hidden" height="100%">
                        {children}
                    </MotionBox>
                </MotionFlex>
            </MotionBox>
        </Container>
    );
}