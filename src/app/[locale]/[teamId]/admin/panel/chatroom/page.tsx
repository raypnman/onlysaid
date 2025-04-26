"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useColorModeValue } from "@/components/ui/color-mode";
import ChatroomTab from "@/components/admin/panel/tabs/ChatroomTab";

export default function AdminChatroomPage() {
    const t = useTranslations("AdminPanel");

    // Define custom colors using useColorModeValue for dark mode support
    const textColor = useColorModeValue("gray.800", "gray.100");
    const textColorHeading = useColorModeValue("gray.800", "gray.100");
    const textColorStrong = useColorModeValue("gray.800", "gray.100");
    const textColorMuted = useColorModeValue("gray.600", "gray.400");
    const cardBg = useColorModeValue("white", "gray.800");
    const borderColor = useColorModeValue("gray.200", "gray.700");
    const bgSubtle = useColorModeValue("gray.50", "gray.800");

    return (
        <ChatroomTab
            colors={{
                textColor,
                textColorHeading,
                textColorStrong,
                textColorMuted,
                cardBg,
                borderColor,
                bgSubtle,
                inputBgColor: bgSubtle,
                inputBorderHoverColor: borderColor,
                tableHeaderBg: bgSubtle,
                errorBg: "red.50",
                errorText: "red.500",
                emptyBg: bgSubtle,
                hoverBg: "gray.50",
                refreshButtonHoverBg: "gray.100"
            }}
            t={t}
        />
    );
}