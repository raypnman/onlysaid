export interface IGeneralSettings {
  theme: string;
  language?: string;
}

// Define the structure for a single Knowledge Base item
export interface IKnowledgeBaseItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  sourceType?: string;
  // Add any other relevant properties for a KB item here
  url?: string;
}

export interface IKnowledgeBaseSettings {
  source?: string;
  enableKnowledgeBase?: boolean;
  apiKey?: string;
  apiUrl?: string;
  knowledgeBases?: IKnowledgeBaseItem[];
  relevanceThreshold?: number;
  maxResults?: number;
}

export interface IMCPSettings {
  defaultModel?: string;
  temperature?: number;
  enableStreaming?: boolean;
  responseStyle?: string;
  apiKey?: string;
  apiUrl?: string;
}

export interface IUserSettings {
  general?: IGeneralSettings;
  knowledgeBase?: IKnowledgeBaseSettings;
  mcp?: IMCPSettings;
  // Add an index signature to allow string indexing
  [key: string]: any;
}

export interface IUser {
  id?: string;
  username: string;
  email: string;
  avatar?: string | null;
  settings: IUserSettings;
  lastOpenedTeam?: string;
  token?: string;
  level?: number;
  xp?: number;
  is_human?: boolean;
  agent_id?: string | null;
}

export interface IUserGet {
  token: string;
  args: {
    ids: string[];
  }
}

export interface IUserUpdateArgs {
  token: string;
  user: IUser;
}
