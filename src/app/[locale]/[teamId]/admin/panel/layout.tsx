"use client";

import React from "react";
import { Box, Heading, Flex, Icon, Container } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { IconType } from "react-icons";
import { FaUsers } from "react-icons/fa";
import { FiBookOpen, FiServer } from "react-icons/fi";
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
    const lastOpenedTeam = currentUser?.lastOpenedTeam;

    // Define custom colors using useColorModeValue for dark mode support
    const textColorHeading = useColorModeValue("gray.800", "gray.100");
    const textColor = useColorModeValue("gray.800", "gray.100");
    const hoverBg = useColorModeValue("gray.50", "gray.700");
    const borderColor = useColorModeValue("gray.200", "gray.700");
    const activeHighlight = useColorModeValue("blue.200", "blue.700");
    const activeBorderColor = "blue.500";
    const accentColor = "blue.500";

    // Determine active tab based on current path
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const activeTabId = pathname.includes('/chatroom') ? 1 : 0;

    // Define the tab items
    const tabItems: TabItem[] = [
        { icon: FaUsers, label: t("users"), id: 0, href: `/${lastOpenedTeam}/admin/panel` },
        { icon: FaUsers, label: t("chatroom"), id: 1, href: `/${lastOpenedTeam}/admin/panel/chatroom` },
        // More tabs can be added here in the future
    ];

    // Navigation items with categories
    const navItems = [
        {
            category: "users",
            items: [
                {
                    icon: FaUsers,
                    label: t("users"),
                    path: `/${lastOpenedTeam}/admin/panel`,
                    visible: true,
                    color: undefined
                }
            ]
        },
        {
            category: "chat",
            items: [
                {
                    icon: FaUsers,
                    label: t("chatroom"),
                    path: `/${lastOpenedTeam}/admin/panel/chatroom`,
                    visible: true,
                    color: undefined
                }
            ]
        },
        {
            category: "workbench",
            items: [
                {
                    icon: FiBookOpen,
                    label: t("knowledge_base"),
                    path: `/${lastOpenedTeam}/admin/panel/workbench/knowledge_base`,
                    visible: true,
                    color: undefined
                },
                {
                    icon: FiServer,
                    label: t("mcp"),
                    path: `/${lastOpenedTeam}/admin/panel/workbench/mcp`,
                    visible: true,
                    color: undefined
                }
            ]
        }
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
                        gap={4}
                    >
                        {navItems.map((category, idx) => (
                            <Box key={category.category}>
                                {/* Category title */}
                                <Box
                                    px={4}
                                    mb={2}
                                    fontWeight="bold"
                                    fontSize="xs"
                                    textTransform="uppercase"
                                    color={useColorModeValue("gray.500", "gray.400")}
                                >
                                    {t(category.category)}
                                </Box>

                                {/* Category items */}
                                <Box display="flex" flexDirection="column" gap={1}>
                                    {category.items.filter(item => item.visible).map((item) => (
                                        <motion.div key={item.path} variants={tabVariants}>
                                            <Box
                                                as="button"
                                                py={3}
                                                px={4}
                                                borderRadius="md"
                                                bg={pathname === item.path ? activeHighlight : "transparent"}
                                                color={item.color || (pathname === item.path ? accentColor : textColor)}
                                                fontWeight={pathname === item.path ? "semibold" : "medium"}
                                                fontSize="sm"
                                                width="100%"
                                                textAlign="left"
                                                _hover={{ bg: hoverBg }}
                                                display="block"
                                                borderLeft={pathname === item.path ? "3px solid" : "none"}
                                                borderLeftColor={activeBorderColor}
                                                onClick={() => handleTabClick(item.path)}
                                            >
                                                <Flex align="center">
                                                    <Icon
                                                        as={item.icon}
                                                        color={item.color || (pathname === item.path ? accentColor : textColor)}
                                                        mr={2}
                                                    />
                                                    {item.label}
                                                </Flex>
                                            </Box>
                                        </motion.div>
                                    ))}
                                </Box>

                                {/* Add separator if not the last category */}
                                {idx < navItems.length - 1 && (
                                    <Box
                                        height="1px"
                                        bg={borderColor}
                                        my={3}
                                        width="90%"
                                        mx="auto"
                                    />
                                )}
                            </Box>
                        ))}
                    </MotionVStack>

                    {/* Main content */}
                    <MotionBox
                        flex={1}
                        variants={itemVariants}
                        overflow="auto"
                        height="100%"
                        bg={useColorModeValue("white", "gray.800")}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={borderColor}
                        p={6}
                        boxShadow="sm"
                    >
                        {children}
                    </MotionBox>
                </MotionFlex>
            </MotionBox>
        </Container>
    );
}