export interface INotificationData {
    id: string;
    type: 'message' | 'mention' | 'workspace_invite' | 'system';
    title: string;
    content: string;
    timestamp: number;
    read: boolean;
    workspaceId?: string;
    workspaceSection?: string;
    workspaceContext?: string;
    userId?: string;
    homeSection?: string;
    homeContext?: string;
}

export interface INotificationCounts {
    home: number;
    homeSections: Record<string, number>;
    homeContexts: Record<string, Record<string, number>>;
    workspaces: Record<string, number>;
    workspaceSections: Record<string, Record<string, number>>;
    workspaceContexts: Record<string, Record<string, Record<string, number>>>;
}
