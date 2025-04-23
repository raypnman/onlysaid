"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Loading from "@/components/loading";
import { useSelector } from 'react-redux';
import { ColorModeButton } from "@/components/ui/color-mode"
import { RootState } from "@/store/store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Box, Heading, Icon, Container, Center, Text, VStack, SimpleGrid, Button, Flex, HStack } from "@chakra-ui/react";
import { FaHome, FaTools, FaFolder, FaCode, FaRocket, FaBookOpen } from "react-icons/fa";
import { FaNetworkWired } from "react-icons/fa6";
import { useColorModeValue } from "@/components/ui/color-mode";
import { useSettingsColors } from "@/utils/colors";

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

// Feature card component
const FeatureCard = ({ icon, title, description, onClick }: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick?: () => void;
}) => {
  const colors = useSettingsColors();

  return (
    <MotionBox
      p={4}
      borderWidth="1px"
      borderColor={colors.borderColor}
      borderRadius="md"
      bg={colors.cardBg}
      boxShadow="sm"
      whileHover={{ y: -3, boxShadow: "0 8px 20px -8px rgba(0,0,0,0.2)" }}
      transition={{ duration: 0.2 }}
      cursor={onClick ? "pointer" : "default"}
      onClick={onClick}
      height="100%"
      display="flex"
      flexDirection="column"
    >
      <Flex align="center" mb={2}>
        <Icon as={icon} fontSize="xl" color={colors.accentColor} mr={2} />
        <Heading size="sm" color={colors.textColorHeading}>{title}</Heading>
      </Flex>
      <Text fontSize="xs" color={colors.textColorMuted}>{description}</Text>
    </MotionBox>
  );
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const t = useTranslations("Workbench");
  const router = useRouter();
  const { currentUser, isAuthenticated, isLoading, isOwner } = useSelector(
    (state: RootState) => state.user
  );

  // Use the colors utility
  const colors = useSettingsColors();

  // Gradient background
  const gradientBg = useColorModeValue(
    "linear-gradient(135deg, #f5f7fa 0%, #e4e7eb 100%)",
    "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)"
  );

  // If user data is available, log it
  useEffect(() => {
    if (currentUser) {
      console.log("User data from Redux:", currentUser);
    }
  }, [currentUser]);

  // Use useEffect for navigation instead of doing it during render
  useEffect(() => {
    // Removing the access restriction that redirects non-owner users
    // Previously had:
    // if (currentUser && !isOwner) {
    //   router.push('/redirect/no_access?reason=Not available for UAT');
    // }
  }, [currentUser, isOwner, router]);

  // Navigation handlers
  const navigateToFileExplorer = () => router.push('/workbench/file_explorer');
  const navigateToLearn = () => router.push('/workbench/learn');
  const navigateToWorkflow = () => router.push('/workbench/workflow');

  // Removed workflow navigation since it's not available yet

  // Show loading state while checking authentication
  if (isLoading || !session) {
    return <Loading />;
  }

  // Redirect if not authenticated
  if (!isAuthenticated && !session) {
    return <Loading />; // Show loading instead of direct navigation
  }

  return (
    <Container
      maxW="1400px"
      px={{ base: 3, md: 4, lg: 6 }}
      py={3}
      height="100%"
      position="relative"
      overflow="hidden"
    >
      <MotionBox
        width="100%"
        height="100%"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        display="flex"
        flexDirection="column"
        overflow="hidden"
        position="relative"
      >
        <Heading size="lg" mb={4} display="flex" alignItems="center" color={colors.textColorHeading}>
          <Icon as={FaTools} mr={3} color={colors.accentColor} />
          {t("workbench")}
        </Heading>

        <Box
          p={4}
          bg={colors.bgColor}
          borderRadius="lg"
          boxShadow="sm"
          height="calc(100vh - 160px)"
          borderWidth="1px"
          borderColor={colors.borderColor}
          overflow="auto"
          position="relative"
        >
          {/* Hero section - made more compact */}
          <MotionBox
            mb={4}
            p={4}
            borderRadius="lg"
            bg={gradientBg}
            boxShadow="md"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Flex direction={{ base: "column", md: "row" }} align="center">
              <Box flex="1" pr={{ base: 0, md: 4 }} mb={{ base: 4, md: 0 }}>
                <Heading size="md" mb={2} lineHeight="1.2" color={colors.textColorHeading}>
                  {t("welcome_to_workbench")}
                </Heading>
                <Text fontSize="sm" mb={3} color={colors.textColorMuted}>
                  {t("workbench_description")}
                </Text>
                <Flex gap={2} flexWrap="wrap">
                  <Button
                    colorScheme="blue"
                    size="sm"
                    onClick={navigateToFileExplorer}
                  >
                    {t("explore_files")}
                  </Button>
                  <Button
                    colorScheme="teal"
                    size="sm"
                    onClick={navigateToWorkflow}
                  >
                    {t("workflow")}
                  </Button>
                </Flex>
              </Box>
              <Center flex="1">
                <Icon as={FaRocket} fontSize="6xl" color={colors.accentColor} />
              </Center>
            </Flex>
          </MotionBox>

          {/* Features section */}
          <Heading size="sm" mb={3} color={colors.textColorHeading}>
            {t("available_tools")}
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={3} mb={4}>
            <MotionFlex
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              height="100%"
            >
              <FeatureCard
                icon={FaFolder}
                title={t("file_explorer")}
                description={t("file_explorer_description")}
                onClick={navigateToFileExplorer}
              />
            </MotionFlex>

            <MotionFlex
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              height="100%"
            >
              <FeatureCard
                icon={FaBookOpen}
                title={t("learn")}
                description={t("learn_description")}
                onClick={navigateToLearn}
              />
            </MotionFlex>

            <MotionFlex
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              height="100%"
            >
              <FeatureCard
                icon={FaNetworkWired}
                title={t("workflow")}
                description={t("workflow_description") || "Create and manage automated workflows for your data processing needs."}
                onClick={navigateToWorkflow}
              />
            </MotionFlex>
          </SimpleGrid>

          {/* Development note - made more compact */}
          <MotionBox
            p={3}
            borderRadius="md"
            borderWidth="1px"
            borderColor={colors.borderColor}
            bg={colors.subtleSelectedItemBg}
            color={colors.accentColor}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            mb={3}
          >
            <Flex align="center">
              <Icon as={FaTools} mr={2} fontSize="sm" />
              <Text fontSize="xs" fontWeight="medium">
                {t("under_development")}: {t("currently_only_file_browsing")}
              </Text>
            </Flex>
          </MotionBox>

          {/* Color mode toggle */}
          <Center mt={3}>
            <ColorModeButton />
          </Center>
        </Box>
      </MotionBox>
    </Container>
  );
}
