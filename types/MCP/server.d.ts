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

export interface ITavilyConfig {
    apiKey: string;
}

export interface ITavilyState {
    tavilyEnabled: boolean;
    tavilyConfig: ITavilyConfig;
}

export interface IWeatherConfig {
    apiKey: string;
    endpoint: string;
    units: string;
}

export interface IWeatherState {
    weatherEnabled: boolean;
    weatherConfig: IWeatherConfig;
}

export interface ILocationConfig {
    path: string;
}

export interface ILocationState {
    locationEnabled: boolean;
    locationConfig: ILocationConfig;
}

export interface IWeatherForecastConfig {
    apiKey: string;
    path: string;
}

export interface IWeatherForecastState {
    weatherForecastEnabled: boolean;
    weatherForecastConfig: IWeatherForecastConfig;
}

export interface INearbySearchConfig {
    apiKey: string;
    endpoint: string;
    defaultRadius: number;
}

export interface INearbySearchState {
    nearbySearchEnabled: boolean;
    nearbySearchConfig: INearbySearchConfig;
}

export interface IWeb3ResearchConfig {
    apiKey: string;
    endpoint: string;
}

export interface IWeb3ResearchState {
    web3ResearchEnabled: boolean;
    web3ResearchConfig: IWeb3ResearchConfig;
}

export interface IDoorDashConfig {
    apiKey: string;
    endpoint: string;
    region: string;
}

export interface IDoorDashState {
    doorDashEnabled: boolean;
    doorDashConfig: IDoorDashConfig;
}

export interface IWhatsAppConfig {
    path: string;
}

export interface IWhatsAppState {
    whatsAppEnabled: boolean;
    whatsAppConfig: IWhatsAppConfig;
}

export interface IGitHubConfig {
    accessToken: string;
}

export interface IGitHubState {
    gitHubEnabled: boolean;
    gitHubConfig: IGitHubConfig;
}

export interface IIPLocationConfig {
    apiKey: string;
}

export interface IIPLocationState {
    ipLocationEnabled: boolean;
    ipLocationConfig: IIPLocationConfig;
}

export interface IAirbnbConfig {
    // No required config for Airbnb
}

export interface IAirbnbState {
    airbnbEnabled: boolean;
    airbnbConfig: IAirbnbConfig;
}

export interface ILinkedInConfig {
    email: string;
    password: string;
}

export interface ILinkedInState {
    linkedInEnabled: boolean;
    linkedInConfig: ILinkedInConfig;
}
