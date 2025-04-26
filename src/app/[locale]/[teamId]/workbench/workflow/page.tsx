"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useSelector } from 'react-redux';
import { RootState } from "@/store/store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Box,
    Heading,
    Icon,
    Text,
    VStack,
    Flex,
    Center,
    Button,
    HStack,
    Badge,
} from "@chakra-ui/react";
import { FaDiagramProject, FaPlay, FaPlus, FaCode, FaNetworkWired } from "react-icons/fa6";
import { FiActivity, FiSettings } from "react-icons/fi";
import { useColorModeValue } from "@/components/ui/color-mode";

const MotionBox = motion(Box);

export default function WorkflowPage() {
    const { data: session } = useSession();
    const t = useTranslations("Workbench");
    const router = useRouter();
    const { currentUser, isAuthenticated, isLoading, isOwner } = useSelector(
        (state: RootState) => state.user
    );

    // Color mode values
    const textColorHeading = useColorModeValue("gray.800", "gray.100");
    const bgColor = useColorModeValue("white", "gray.800");
    const borderColor = useColorModeValue("gray.200", "gray.700");
    const textColor = useColorModeValue("gray.600", "gray.400");

    // Use useEffect for navigation instead of doing it during render
    useEffect(() => {
        // Removing the access restriction that redirects non-owner users
    }, [currentUser, isOwner, router]);

    // Determine the iframe URL based on NODE_ENV
    const iframeUrl = process.env.NODE_ENV === 'development'
        ? 'http://n8n.onlysaid-dev.com'
        : 'https://n8n.onlysaid.com';

    const handleOpenWorkflow = () => {
        // Open in a new tab instead of an iframe
        window.open(iframeUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <Box width="100%" height="100%" overflow="hidden" display="flex" flexDirection="column">
            <Heading size="md" mb={6} color={textColorHeading}>
                <Flex align="center">
                    <Icon as={FaDiagramProject} mr={3} color="blue.500" />
                    {t("workflow")}
                </Flex>
            </Heading>

            <Box
                flex="1"
                bg={bgColor}
                borderRadius="md"
                borderWidth="1px"
                borderColor={borderColor}
                height="calc(100% - 50px)"
                p={6}
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
            >
                <Icon as={FaNetworkWired} fontSize="6xl" color="blue.500" mb={4} />
                <Heading size="lg" mb={3} textAlign="center" color={textColorHeading}>
                    {t("workflow_management")}
                </Heading>
                <Text mb={6} textAlign="center" color={textColor}>
                    {t("workflow_description") || "Create and manage automated workflows for your data processing needs."}
                </Text>
                <Text mb={6} fontSize="sm" textAlign="center" color={textColor}>
                    {t("workflow_iframe_error") || "Due to security restrictions, the workflow tool cannot be embedded directly in this page."}
                </Text>
                <Button
                    colorScheme="blue"
                    // leftIcon={<FaPlay />}
                    onClick={handleOpenWorkflow}
                    size="lg"
                >
                    {t("open_workflow_tool") || "Open Workflow Tool"}
                </Button>
            </Box>
        </Box>
    );
}
