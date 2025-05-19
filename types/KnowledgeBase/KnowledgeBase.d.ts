export interface IKnowledgeBase {
    id: string;
    name: string;
    description: string;
    source: string;
    url: string;
    create_at: string;
    update_at: string;
    enabled: boolean;
    configured: boolean;
    embedding_engine: string;
    workspace_id: string;
    type: "public" | "private";

    size?: number;
    documents?: number;
}

export interface IKnowledgeBaseRegisterArgs {
    id: string;
    name: string;
    description: string;
    source: string;
    url: string;
    workspace_id: string
    type: string;
    embedding_engine: string;
}
