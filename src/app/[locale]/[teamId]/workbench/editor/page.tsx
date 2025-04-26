"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useSelector } from 'react-redux';
import { RootState } from "@/store/store";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Box,
    Heading,
    Icon,
    Text,
    Flex,
    Button,
    HStack,
    Select,
    Portal,
    createListCollection,
} from "@chakra-ui/react";
import { FaCode, FaSave, FaPlay } from "react-icons/fa";
import { useColorModeValue } from "@/components/ui/color-mode";
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
    ssr: false,
    loading: () => (
        <Box
            width="100%"
            height="500px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            bg="gray.100"
            color="gray.600"
            borderRadius="md"
        >
            <Text>Loading Editor...</Text>
        </Box>
    )
});

const MotionBox = motion(Box);

export default function EditorPage() {
    const { data: session } = useSession();
    const t = useTranslations("Workbench");
    const router = useRouter();
    const { currentUser, isAuthenticated, isLoading } = useSelector(
        (state: RootState) => state.user
    );

    // State for editor
    const [language, setLanguage] = useState("javascript");
    const [code, setCode] = useState("// Start coding here\n\nconsole.log('Hello, world!');\n");
    const [editorTheme, setEditorTheme] = useState("vs-dark");

    // Color mode values
    const textColorHeading = useColorModeValue("gray.800", "gray.100");
    const textColor = useColorModeValue("gray.600", "gray.400");
    const bgColor = useColorModeValue("white", "gray.800");
    const borderColor = useColorModeValue("gray.200", "gray.700");
    const toolbarBg = useColorModeValue("gray.50", "gray.700");

    // Language options
    const languageCollection = createListCollection({
        items: [
            { value: "javascript", label: "JavaScript" },
            { value: "typescript", label: "TypeScript" },
            { value: "python", label: "Python" },
            { value: "html", label: "HTML" },
            { value: "css", label: "CSS" },
            { value: "json", label: "JSON" },
        ],
    });

    // Theme options
    const themeCollection = createListCollection({
        items: [
            { value: "vs", label: "Light" },
            { value: "vs-dark", label: "Dark" },
            { value: "hc-black", label: "High Contrast" },
        ],
    });

    // Handle code change
    const handleCodeChange = (value: string | undefined) => {
        setCode(value || "");
    };

    // Handle language change
    const handleLanguageChange = (value: string) => {
        setLanguage(value);
    };

    // Handle theme change
    const handleThemeChange = (value: string) => {
        setEditorTheme(value);
    };

    // Handle save
    const handleSave = () => {
        // In a real app, you would save to a backend

    };

    // Handle run
    const handleRun = () => {
        if (language === "javascript") {
            try {
                // eslint-disable-next-line no-new-func
                const result = new Function(code)();

            } catch (error) {

            }
        } else {

        }
    };

    return (
        <Box width="100%" height="100%" overflow="hidden" display="flex" flexDirection="column">
            <Heading size="md" mb={4} color={textColorHeading}>
                <Flex align="center">
                    <Icon as={FaCode} mr={3} color="blue.500" />
                    {t("code_editor") || "Code Editor"}
                </Flex>
            </Heading>

            <Box
                flex="1"
                bg={bgColor}
                borderRadius="md"
                borderWidth="1px"
                borderColor={borderColor}
                overflow="hidden"
                display="flex"
                flexDirection="column"
            >
                {/* Toolbar */}
                <Flex
                    p={2}
                    bg={toolbarBg}
                    borderBottomWidth="1px"
                    borderBottomColor={borderColor}
                    alignItems="center"
                    flexWrap="wrap"
                    gap={2}
                >
                    <HStack gap={2} mr={4}>
                        <Text fontSize="sm" fontWeight="medium" color={textColor}>Language:</Text>
                        <Select.Root
                            size="sm"
                            value={[language]}
                            onValueChange={(data) => handleLanguageChange(data.value[0])}
                            collection={languageCollection}
                        >
                            <Select.HiddenSelect />
                            <Select.Control>
                                <Select.Trigger>
                                    <Select.ValueText />
                                </Select.Trigger>
                                <Select.IndicatorGroup>
                                    <Select.Indicator />
                                </Select.IndicatorGroup>
                            </Select.Control>
                            <Portal>
                                <Select.Positioner>
                                    <Select.Content>
                                        {languageCollection.items.map((option) => (
                                            <Select.Item item={option} key={option.value}>
                                                {option.label}
                                                <Select.ItemIndicator />
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Positioner>
                            </Portal>
                        </Select.Root>
                    </HStack>

                    <HStack gap={2} mr={4}>
                        <Text fontSize="sm" fontWeight="medium" color={textColor}>Theme:</Text>
                        <Select.Root
                            size="sm"
                            value={[editorTheme]}
                            onValueChange={(data) => handleThemeChange(data.value[0])}
                            collection={themeCollection}
                        >
                            <Select.HiddenSelect />
                            <Select.Control>
                                <Select.Trigger>
                                    <Select.ValueText />
                                </Select.Trigger>
                                <Select.IndicatorGroup>
                                    <Select.Indicator />
                                </Select.IndicatorGroup>
                            </Select.Control>
                            <Portal>
                                <Select.Positioner>
                                    <Select.Content>
                                        {themeCollection.items.map((option) => (
                                            <Select.Item item={option} key={option.value}>
                                                {option.label}
                                                <Select.ItemIndicator />
                                            </Select.Item>
                                        ))}
                                    </Select.Content>
                                </Select.Positioner>
                            </Portal>
                        </Select.Root>
                    </HStack>

                    <HStack gap={2} ml="auto">
                        <Button
                            size="sm"
                            // leftIcon={<FaSave />}
                            colorScheme="blue"
                            onClick={handleSave}
                        >
                            Save
                        </Button>
                        <Button
                            size="sm"
                            // leftIcon={<FaPlay />}
                            colorScheme="green"
                            onClick={handleRun}
                        >
                            Run
                        </Button>
                    </HStack>
                </Flex>

                {/* Editor */}
                <Box flex="1" height="calc(100% - 50px)">
                    <MonacoEditor
                        height="100%"
                        language={language}
                        value={code}
                        theme={editorTheme}
                        onChange={handleCodeChange}
                        options={{
                            minimap: { enabled: true },
                            scrollBeyondLastLine: false,
                            fontSize: 14,
                            automaticLayout: true,
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
}
