// Import Field type from MCPDialog
import { Field } from "@/components/Dialog/MCPDialog";
import { ReactNode } from "react";

export interface IBaseServerConfig {
    enabled: boolean;
    configured: boolean;
    config: any;
}

export interface IServerModule<TConfig = any> {
    // Configuration
    defaultConfig: TConfig;

    // Validation
    isConfigured: (config: TConfig) => boolean;

    // Client initialization
    createClientConfig: (config: TConfig, homedir: string) => {
        enabled: boolean;
        command: string;
        args: string[];
        env?: Record<string, string>;
        clientName: string;
        clientVersion: string;
    };

    // Store actions
    setEnabled: (enabled: boolean) => Promise<void>;
    setConfig: (config: Partial<TConfig>) => void;
    setAutoApproved: (autoApproved: boolean) => void;

    // State getters
    getEnabled: () => boolean;
    getConfig: () => TConfig;
    getConfigured: () => boolean;
    getAutoApproved: () => boolean;
}

// Enhanced server metadata interface
export interface IServerMetadata {
    id: string;
    title: string;
    description: string;
    version: string;
    icon?: string; // Icon name or component
    sourceUrl?: string;
    platforms?: ('windows' | 'macos' | 'linux')[];
    category?: 'communication' | 'weather' | 'location' | 'research' | 'productivity' | 'delivery' | 'development' | 'accommodation' | 'other';
}

// Enhanced server module interface
export interface IEnhancedServerModule<TConfig = any> extends IServerModule<TConfig> {
    metadata: IServerMetadata;

    // UI Configuration - make getDialogFields optional since we might use DialogComponent
    getDialogFields?: () => Field[];
    validateConfig?: (config: TConfig) => { isValid: boolean; errors?: Record<string, string> };

    // Optional custom components
    customServerCard?: React.ComponentType<ICustomServerCardProps>;
    customDialog?: React.ComponentType<ICustomDialogProps>;

    // New: Embedded dialog component
    DialogComponent?: React.ComponentType<ICustomDialogProps>;
}

// Registry for server modules
export interface IServerRegistry {
    [serverKey: string]: IEnhancedServerModule;
}

// UI Component Props Interfaces
export interface IServerCardProps {
    title: string;
    description: string;
    version: string;
    isEnabled: boolean;
    isConfigured: boolean;
    isAutoApproved: boolean;
    onToggle: (enabled: boolean) => void;
    onAutoApprovalToggle: (autoApproved: boolean) => void;
    onConfigure: () => void;
    onReset?: () => void;
    icon?: ReactNode;
    sourceUrl?: string;
}

export interface ICustomServerCardProps {
    serverModule: IEnhancedServerModule;
    isEnabled: boolean;
    isConfigured: boolean;
    isAutoApproved: boolean;
    onToggle: (enabled: boolean) => void;
    onAutoApprovalToggle: (autoApproved: boolean) => void;
    onConfigure: () => void;
    onReset?: () => void;
}

export interface ICustomDialogProps {
    open: boolean;
    initialData?: Record<string, any>;
    onClose: () => void;
    onSave: (data: Record<string, any>) => void;
}

export interface IServiceItem {
    serverKey: string;
    type: string;
    enabledFlag: boolean;
    config: any;
    humanName: string;
    category: string;
    isRegistered: boolean;
    metadata?: any;
}

export interface IServersProps {
    services: IServiceItem[];
    configureHandlers: Record<string, () => void>;
}

export interface IGenericServerProps {
    serverKey: string;
    onReset?: () => void;
    isAutoApproved?: boolean;
    onAutoApprovalToggle?: (autoApproved: boolean) => void;
}

export interface IConfigurableComponentProps {
    onConfigure?: () => void;
    serverKey?: string;
}

export interface IEnhancedComponentProps extends IConfigurableComponentProps {
    onReset?: () => void;
    isAutoApproved?: boolean;
    onAutoApprovalToggle?: (autoApproved: boolean) => void;
}

// Server Configuration Interfaces
export interface ITavilyConfig {
    apiKey: string;
}

export interface IWeatherConfig {
    apiKey: string;
    endpoint: string;
    units: string;
}

export interface ILocationConfig {
    path: string;
}

export interface IWeatherForecastConfig {
    apiKey: string;
    path: string;
}

export interface INearbySearchConfig {
    apiKey: string;
    endpoint: string;
    defaultRadius: number;
}

export interface IWeb3ResearchConfig {
    apiKey: string;
    endpoint: string;
}

export interface IDoorDashConfig {
    apiKey: string;
    endpoint: string;
    region: string;
}

export interface IWhatsAppConfig {
    path: string;
}

export interface IGitHubConfig {
    accessToken: string;
}

export interface IIPLocationConfig {
    apiKey: string;
}

export interface IAirbnbConfig {
    // No required config for Airbnb
}

export interface ILinkedInConfig {
    email: string;
    password: string;
}

// Server State Interfaces (for backward compatibility)
export interface ITavilyState {
    tavilyEnabled: boolean;
    tavilyConfig: ITavilyConfig;
}

export interface IWeatherState {
    weatherEnabled: boolean;
    weatherConfig: IWeatherConfig;
}

export interface ILocationState {
    locationEnabled: boolean;
    locationConfig: ILocationConfig;
}

export interface IWeatherForecastState {
    weatherForecastEnabled: boolean;
    weatherForecastConfig: IWeatherForecastConfig;
}

export interface INearbySearchState {
    nearbySearchEnabled: boolean;
    nearbySearchConfig: INearbySearchConfig;
}

export interface IWeb3ResearchState {
    web3ResearchEnabled: boolean;
    web3ResearchConfig: IWeb3ResearchConfig;
}

export interface IDoorDashState {
    doorDashEnabled: boolean;
    doorDashConfig: IDoorDashConfig;
}

export interface IWhatsAppState {
    whatsAppEnabled: boolean;
    whatsAppConfig: IWhatsAppConfig;
}

export interface IGitHubState {
    gitHubEnabled: boolean;
    gitHubConfig: IGitHubConfig;
}

export interface IIPLocationState {
    ipLocationEnabled: boolean;
    ipLocationConfig: IIPLocationConfig;
}

export interface IAirbnbState {
    airbnbEnabled: boolean;
    airbnbConfig: IAirbnbState;
}

export interface ILinkedInState {
    linkedInEnabled: boolean;
    linkedInConfig: ILinkedInConfig;
}
