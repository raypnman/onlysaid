import {
    Box,
    Flex,
    Text,
    VStack,
    Select,
    Portal,
    createListCollection,
    Stack,
    Progress,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { IChatRoom } from "@/types/chat";
import { Log, PlanLog, PlanStatus } from "@/types/plan";
import PlanLogSection from "@/components/plans/plan_log_section";
import { getStatusColorScheme } from "@/components/ui/StatusBadge";
import PlanLogModal from "@/components/plans/plan_log_modal";

interface PlanSectionProps {
    currentRoom: IChatRoom | undefined;
    colors: any;
    t: any;
}

const PlanSection = ({
    currentRoom,
    colors,
    t
}: PlanSectionProps) => {
    const [plans, setPlans] = useState<Array<{
        id: string,
        name: string,
        progress?: number,
        logs?: Log[],
        plan_overview?: string,
        status: string
    }>>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
    const [logsByPlan, setLogsByPlan] = useState<Record<string, Log[]>>({});
    const [selectedLog, setSelectedLog] = useState<Log | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [taskDetails, setTaskDetails] = useState<any>(null);
    const [isLoadingTask, setIsLoadingTask] = useState(false);
    const [skillsCache, setSkillsCache] = useState<Record<string, any>>({});
    const [isLoadingSkills, setIsLoadingSkills] = useState(false);
    const currentUser = useSelector((state: RootState) => state.user.currentUser);

    // Create collection for plans
    const plansCollection = useMemo(() => {
        return createListCollection({
            items: plans.map(plan => ({
                label: plan.name,
                value: plan.id
            }))
        });
    }, [plans]);

    // Fetch plans when room changes
    useEffect(() => {
        const fetchPlans = async () => {
            if (!currentRoom) {
                setPlans([]);
                setSelectedPlans([]);
                setLogsByPlan({});
                return;
            }

            setIsLoadingPlans(true);
            try {
                const response = await axios.get(`/api/plan/get_plans?roomId=${currentRoom.id}`);
                console.log("Fetched plans raw data:", response.data);

                const processedPlans = response.data.map((plan: any) => {
                    console.log(`Plan ${plan.id} status:`, plan.status);
                    return {
                        id: plan.id,
                        name: plan.plan_name || `Plan ${plan.id}`,
                        progress: plan.progress,
                        logs: plan.logs || [],
                        plan_overview: plan.plan_overview,
                        status: plan.status
                    };
                });

                console.log("Processed plans:", processedPlans);
                setPlans(processedPlans);
            } catch (error) {
                console.error("Error fetching plans:", error);
            } finally {
                setIsLoadingPlans(false);
            }
        };

        fetchPlans();
    }, [currentRoom]);

    // Fetch logs for selected plans
    useEffect(() => {
        const fetchLogs = async () => {
            if (!plans.length) return;

            // If no plans are selected, show logs from all plans
            const plansToFetch = selectedPlans.length ?
                plans.filter(p => selectedPlans.includes(p.id)) :
                plans;

            const logsObj: Record<string, Log[]> = {};

            for (const plan of plansToFetch) {
                try {
                    // Fetch logs directly by plan ID instead of using log IDs
                    const response = await fetch(`/api/plan/get_plan_log?planId=${plan.id}`);

                    if (response.ok) {
                        const logData = await response.json();
                        // Add plan information to each log
                        const formattedLogs = Array.isArray(logData)
                            ? logData.map((log: any) => ({
                                ...log,
                                planName: plan.name,
                                planShortId: plan.id ? plan.id.split('-')[0] : '',
                                planNavId: plan.id,
                                planOverview: plan.plan_overview
                            }))
                            : [];

                        logsObj[plan.id] = formattedLogs;
                    }
                } catch (error) {
                    console.error(`Error fetching logs for plan ${plan.id}:`, error);
                }
            }

            setLogsByPlan(logsObj);
        };

        fetchLogs();
    }, [selectedPlans, plans]);

    // Helper to get first chunk of uuid
    const getShortId = (uuid?: string) => uuid ? uuid.split('-')[0] : '';

    // Combine all logs from selected plans into a single array, with plan info
    const allLogs = useMemo(() => {
        let logs: Array<Log & { planName?: string; planShortId?: string; planNavId?: string }> = [];

        // If no plans are selected, use logs from all plans
        if (selectedPlans.length === 0) {
            Object.values(logsByPlan).forEach(planLogs => {
                if (Array.isArray(planLogs)) {
                    logs = logs.concat(planLogs);
                }
            });
        } else {
            // Otherwise use logs from selected plans
            selectedPlans.forEach(planId => {
                const planLogs = logsByPlan[planId] || [];
                if (Array.isArray(planLogs)) {
                    logs = logs.concat(planLogs);
                }
            });
        }

        // Sort by created_at descending
        return logs.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    }, [selectedPlans, logsByPlan, plans]);

    // Map status to color scheme
    const getColorForPlan = (plan: any) => {
        // Default to 'running' if no status is provided
        const status = plan.status || 'running';
        return getStatusColorScheme(status);
    };

    // Fetch skill details by ID
    const fetchSkill = async (skillId: string) => {
        if (skillsCache[skillId]) {
            return skillsCache[skillId];
        }

        try {
            const response = await axios.get(`/api/skill/get_skill?id=${skillId}`);
            const skill = response.data.skill;

            // Update cache
            setSkillsCache(prev => ({
                ...prev,
                [skillId]: skill
            }));

            return skill;
        } catch (error) {
            console.error(`Error fetching skill ${skillId}:`, error);
            return null;
        }
    };

    // Helper function to get formatted content for logs
    const getFormattedContent = async (log: Log) => {
        // Type-safe check for tasks property
        const logAny = log as any;

        // If the log has tasks with skills, prioritize showing skills
        if (logAny.tasks && Array.isArray(logAny.tasks) && logAny.tasks.length > 0) {
            // Look for skills in tasks
            const allSkills: string[] = [];
            setIsLoadingSkills(true);

            try {
                // Add debug logging
                console.log("Processing tasks for log:", log.id);
                console.log("Tasks:", logAny.tasks);

                // Process each task to fetch its skills
                for (const task of logAny.tasks) {
                    // Check for skills array (as seen in the task details)
                    if (task.skills && Array.isArray(task.skills) && task.skills.length > 0) {
                        console.log("Found skills in task:", task.skills);
                        for (const skillId of task.skills) {
                            console.log("Fetching skill:", skillId);
                            const skill = await fetchSkill(skillId);
                            console.log("Fetched skill:", skill);
                            if (skill && skill.name) {
                                allSkills.push(skill.name);
                            }
                        }
                    }
                    // Also check for skill_ids (original implementation)
                    else if (task.skill_ids && Array.isArray(task.skill_ids) && task.skill_ids.length > 0) {
                        console.log("Found skill_ids in task:", task.skill_ids);
                        for (const skillId of task.skill_ids) {
                            console.log("Fetching skill:", skillId);
                            const skill = await fetchSkill(skillId);
                            console.log("Fetched skill:", skill);
                            if (skill && skill.name) {
                                allSkills.push(skill.name);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error processing skills:", error);
            } finally {
                setIsLoadingSkills(false);
            }

            // If we found skills, show them
            if (allSkills.length > 0) {
                console.log("Found skills:", allSkills);
                return `${t("skills")}: ${allSkills.join(", ")}`;
            }

            // Otherwise fall back to task names
            return `${t("tasks")}: ${logAny.tasks.map((task: any) => task.task_name || "Unnamed task").join(", ")}`;
        }

        // If the log itself has a task_id, try to fetch that task's skills
        if (log.task_id) {
            try {
                const response = await fetch(`/api/plan/get_task?taskId=${log.task_id}`);
                if (response.ok) {
                    const taskData = await response.json();

                    if (taskData.skills && Array.isArray(taskData.skills) && taskData.skills.length > 0) {
                        const allSkills: string[] = [];

                        for (const skillId of taskData.skills) {
                            const skill = await fetchSkill(skillId);
                            if (skill && skill.name) {
                                allSkills.push(skill.name);
                            }
                        }

                        if (allSkills.length > 0) {
                            return `${t("skills")}: ${allSkills.join(", ")}`;
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching task for log:", error);
            }
        }

        // If no tasks but has skill_ids directly on the log
        if (logAny.skill_ids && Array.isArray(logAny.skill_ids) && logAny.skill_ids.length > 0) {
            const allSkills: string[] = [];
            setIsLoadingSkills(true);

            try {
                for (const skillId of logAny.skill_ids) {
                    const skill = await fetchSkill(skillId);
                    if (skill && skill.name) {
                        allSkills.push(skill.name);
                    }
                }
            } catch (error) {
                console.error("Error processing skills:", error);
            } finally {
                setIsLoadingSkills(false);
            }

            if (allSkills.length > 0) {
                return `${t("skills")}: ${allSkills.join(", ")}`;
            }
        }

        // For approval logs, try to extract a meaningful message
        if (log.type === "ask_for_plan_approval") {
            return t("plan_requires_approval");
        }

        // For plan creation logs, show a simple message
        if (log.type === "plan_created") {
            return t("plan_was_created");
        }

        // For other logs with content, truncate if needed
        if (log.content) {
            const content = typeof log.content === 'string' ? log.content : JSON.stringify(log.content);
            return content.length > 100 ? content.substring(0, 100) + "..." : content;
        }

        // Default empty message
        return "";
    };

    // State to store formatted content for each log
    const [formattedContents, setFormattedContents] = useState<Record<string, string>>({});

    // Effect to load formatted content for all logs
    useEffect(() => {
        const loadFormattedContents = async () => {
            console.log("Loading formatted contents for logs:", allLogs.length);
            const contents: Record<string, string> = {};

            for (const log of allLogs) {
                if (log.id) {
                    contents[log.id] = await getFormattedContent(log);
                }
            }

            console.log("Finished loading formatted contents");
            setFormattedContents(contents);
        };

        loadFormattedContents();
    }, [allLogs]);

    // Modified log click handler to use pre-loaded content
    const handleLogClick = async (log: Log) => {
        console.log("Log clicked in PlanSection:", log);

        setSelectedLog(log);
        setIsModalOpen(true);

        // Reset task details
        setTaskDetails(null);

        // If the log has a task_id, fetch the task details
        if (log.task_id) {
            setIsLoadingTask(true);
            try {
                const response = await fetch(`/api/plan/get_task?taskId=${log.task_id}`);
                if (response.ok) {
                    const taskData = await response.json();
                    setTaskDetails(taskData);
                } else {
                    console.error("Error fetching task details:", response.statusText);
                }
            } catch (error) {
                console.error("Error fetching task details:", error);
            } finally {
                setIsLoadingTask(false);
            }
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    // Determine if logs should be grouped by plan
    const shouldGroupLogs = selectedPlans.length === 0;

    // Create a synchronous wrapper function that uses the pre-loaded content
    const getFormattedContentSync = useCallback((log: Log): string => {
        return log.id && formattedContents[log.id] ? formattedContents[log.id] : "";
    }, [formattedContents]);

    const handleApprove = async (log: PlanLog) => {
        // First update the log type to approved
        const logUpdateResponse = await fetch('/api/plan/update_plan_log', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                logId: log.id,
                type: 'approved'
            }),
        });

        if (!logUpdateResponse.ok) {
            const errorData = await logUpdateResponse.json();
            console.error('Failed to update log status:', errorData);
            // Continue with plan approval anyway
        }

        // Update plan status to running
        const updateResponse = await fetch('/api/plan/update_plan', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plan_id: log.plan_id,
                status: 'running'
            }),
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('Failed to approve plan:', errorData);
            return;
        }

        await fetch('/api/mcp/perform', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ log_id: log.id }),
        });

        console.log('Plan approved successfully');
    };

    const handleDeny = async (log: PlanLog) => {
        try {
            // First update the log type to denied
            const logUpdateResponse = await fetch('/api/plan/update_plan_log', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logId: log.id,
                    type: 'denied'
                }),
            });

            if (!logUpdateResponse.ok) {
                const errorData = await logUpdateResponse.json();
                console.error('Failed to update log status:', errorData);
                // Continue with plan termination anyway
            }

            // Update the plan status to terminated
            const updateResponse = await fetch('/api/plan/update_plan', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    plan_id: log.plan_id,
                    status: 'terminated'
                }),
            });

            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                console.error('Failed to terminate plan:', errorData);
                return;
            }

            console.log('Plan terminated successfully');

            // Then create a log entry for the termination with string content
            const logResponse = await fetch('/api/plan/create_plan_log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'plan_terminated',
                    plan_id: log.plan_id,
                    content: `Plan was manually terminated by ${currentUser?.username}. Original log ID: ${log.id || 'unknown'}`
                }),
            });

            if (!logResponse.ok) {
                console.error('Failed to create termination log:', await logResponse.json());
            } else {
                console.log('Termination log created successfully');
            }

            // Reload the plans after termination
            const fetchPlans = async () => {
                if (!currentRoom) return;

                setIsLoadingPlans(true);
                try {
                    const response = await axios.get(`/api/plan/get_plans?roomId=${currentRoom.id}`);
                    setPlans(response.data.map((plan: any) => ({
                        id: plan.id,
                        name: plan.plan_name || `Plan ${plan.id}`,
                        progress: plan.progress,
                        logs: plan.logs || [],
                        plan_overview: plan.plan_overview,
                        status: plan.status
                    })));
                } catch (error) {
                    console.error("Error fetching plans:", error);
                } finally {
                    setIsLoadingPlans(false);
                }
            };

            fetchPlans();
        } catch (error) {
            console.error('Error terminating plan:', error);
        }
    };

    return (
        <Box
            bg={colors.cardBg}
            height="100%"
            width="100%"
            overflow="auto"
            borderRadius="md"
            display="flex"
            flexDirection="column"
            borderWidth="1px"
            borderColor={colors.planSectionBorder}
            zIndex={1}
            _hover={{ boxShadow: colors.planSectionHoverShadow }}
        >
            <Box
                p={4}
                borderBottomWidth="1px"
                borderColor={colors.planSectionBorder}
                bg={colors.planSectionHeaderBg}
            >
                <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color={colors.planSectionHeaderText}
                >
                    {t("plan_section")}
                </Text>
            </Box>

            <VStack gap={4} p={4} align="stretch" overflowY="auto">
                {currentRoom ? (
                    <>
                        <Box>
                            <Text
                                fontSize="sm"
                                fontWeight="bold"
                                color={colors.planLabelText}
                                mb={2}
                            >
                                {t("select_plans")}
                            </Text>
                            {isLoadingPlans ? (
                                <Box
                                    p={3}
                                    borderWidth="1px"
                                    borderRadius="md"
                                    borderColor={colors.planItemBorder}
                                    bg={colors.planItemBg}
                                    textAlign="center"
                                >
                                    <Text fontSize="sm" color={colors.textColor}>
                                        {t("loading_plans")}...
                                    </Text>
                                </Box>
                            ) : plans.length > 0 ? (
                                <>
                                    <Select.Root
                                        multiple
                                        collection={plansCollection}
                                        size="sm"
                                        width="100%"
                                        onValueChange={(details) => {
                                            const selectedValues = details?.value || [];
                                            setSelectedPlans(Array.isArray(selectedValues) ? selectedValues : []);
                                        }}
                                        value={selectedPlans}
                                    >
                                        <Select.HiddenSelect />
                                        <Select.Control>
                                            <Select.Trigger>
                                                <Select.ValueText
                                                    placeholder={t("select_plans")}
                                                    color={colors.textColor}
                                                />
                                            </Select.Trigger>
                                            <Select.IndicatorGroup>
                                                <Select.Indicator />
                                            </Select.IndicatorGroup>
                                        </Select.Control>
                                        <Portal>
                                            <Select.Positioner>
                                                <Select.Content bg={colors.dropdownBg}>
                                                    {plansCollection.items.map((plan) => {
                                                        // Find the full plan object for progress/id
                                                        const fullPlan = plans.find(p => p.id === plan.value);
                                                        return (
                                                            <Select.Item
                                                                item={plan}
                                                                key={plan.value}
                                                                color={colors.dropdownText}
                                                                _hover={{ bg: colors.dropdownHoverBg }}
                                                                px={2}
                                                                py={1}
                                                            >
                                                                <Flex align="center" justify="space-between" width="100%">
                                                                    <Box>
                                                                        <Text as="span" fontWeight="medium">
                                                                            {plan.label}
                                                                        </Text>
                                                                        <Text as="span" color="gray.400" fontSize="xs" ml={2}>
                                                                            [{getShortId(fullPlan?.id)}]
                                                                        </Text>
                                                                    </Box>
                                                                    <Flex minW="80px" textAlign="right" align="center" justify="flex-end">
                                                                        {fullPlan?.status && (
                                                                            <Text
                                                                                as="span"
                                                                                fontSize="xs"
                                                                                px={1}
                                                                                py={0.5}
                                                                                borderRadius="sm"
                                                                                bg={getStatusColor(fullPlan.status as PlanStatus)}
                                                                                color="white"
                                                                                mr={2}
                                                                            >
                                                                                {fullPlan.status}
                                                                            </Text>
                                                                        )}
                                                                        {typeof fullPlan?.progress === "number" && (
                                                                            <Text as="span" color="gray.400" fontSize="xs">
                                                                                {fullPlan.progress}%
                                                                            </Text>
                                                                        )}
                                                                    </Flex>
                                                                </Flex>
                                                                <Select.ItemIndicator />
                                                            </Select.Item>
                                                        );
                                                    })}
                                                </Select.Content>
                                            </Select.Positioner>
                                        </Portal>
                                    </Select.Root>
                                    <Box mt={2}>
                                        <Stack gap={1}>
                                            {plans
                                                .filter(plan => selectedPlans.includes(plan.id))
                                                .map((plan) => {
                                                    console.log(`Rendering selected plan: ${plan.name}, status:`, plan.status);
                                                    const colorScheme = getColorForPlan(plan);
                                                    return (
                                                        <Flex
                                                            key={plan.id}
                                                            align="center"
                                                            justify="space-between"
                                                            width="100%"
                                                            py={1}
                                                        >
                                                            {/* Plan name with ID */}
                                                            <Text
                                                                width="45%"
                                                                color={colors.textColor}
                                                                fontSize="sm"
                                                                lineClamp={1}
                                                            >
                                                                {plan.name}
                                                                <Text as="span" color="gray.500" fontSize="xs" ml={1}>
                                                                    [{getShortId(plan.id)}]
                                                                </Text>
                                                            </Text>

                                                            {/* Progress bar or TERMINATED label */}
                                                            {plan.status === 'terminated' ? (
                                                                <Text
                                                                    width="40%"
                                                                    fontSize="xs"
                                                                    fontWeight="bold"
                                                                    color="orange.500"
                                                                    textAlign="center"
                                                                >
                                                                    TERMINATED
                                                                </Text>
                                                            ) : (
                                                                <Progress.Root
                                                                    width="40%"
                                                                    defaultValue={plan.progress ?? 0}
                                                                    colorScheme={colorScheme}
                                                                    variant="outline"
                                                                    size="sm"
                                                                >
                                                                    <Progress.Track>
                                                                        <Progress.Range />
                                                                    </Progress.Track>
                                                                </Progress.Root>
                                                            )}

                                                            {/* Percentage */}
                                                            <Text
                                                                width="15%"
                                                                fontSize="xs"
                                                                color={colors.textColor}
                                                                textAlign="right"
                                                            >
                                                                {plan.status === 'terminated' ?
                                                                    "" :
                                                                    (typeof plan.progress === "number" ? `${plan.progress}%` : "0%")}
                                                            </Text>
                                                        </Flex>
                                                    );
                                                })}
                                        </Stack>
                                    </Box>
                                    {/* Render PlanLogSection with the logs */}
                                    {currentRoom && (
                                        <Box mt={4}>
                                            <PlanLogSection
                                                logs={allLogs}
                                                colors={colors}
                                                t={t}
                                                onLogClick={handleLogClick}
                                                groupByPlan={shouldGroupLogs}
                                                getFormattedContent={getFormattedContentSync}
                                            />
                                        </Box>
                                    )}
                                </>
                            ) : (
                                <Box
                                    p={3}
                                    borderWidth="1px"
                                    borderRadius="md"
                                    borderColor={colors.planItemBorder}
                                    bg={colors.planItemBg}
                                >
                                    <Text fontSize="sm" color={colors.textColor}>
                                        {t("no_plans_found")}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    </>
                ) : (
                    <Box
                        p={4}
                        borderWidth="1px"
                        borderRadius="md"
                        borderColor={colors.planItemBorder}
                        bg={colors.planItemBg}
                        textAlign="center"
                    >
                        <Text fontSize="sm" color={colors.textColor}>
                            {t("select_room_to_see_plans")}
                        </Text>
                    </Box>
                )}
            </VStack>

            {/* Render the modal with task details */}
            <PlanLogModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                log={selectedLog}
                taskDetails={taskDetails}
                isLoadingTask={isLoadingTask}
                colors={colors}
                onApprove={handleApprove}
                onDeny={handleDeny}
                formattedContent={selectedLog && selectedLog.id ? formattedContents[selectedLog.id] || "" : ""}
            />
        </Box>
    );
};

// Helper function to get color based on status
const getStatusColor = (status: PlanStatus): string => {
    switch (status) {
        case 'pending': return 'gray.500';
        case 'running': return 'blue.500';
        case 'success': return 'green.500';
        case 'failure': return 'red.500';
        case 'terminated': return 'orange.500';
        default: return 'gray.500';
    }
};

export default PlanSection;
