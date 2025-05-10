export interface IWorkspace {
    id: string;
    created_at: string;
    updated_at: string;
    image: string;
    name: string;
    super_admins: string[];
    admins: string[];
    members: string[];
    invite_code: string;
    settings: any;
}

export interface ICreateWorkspaceArgs {
    request: IWorkspace;
    token: string;
}

export interface IGetWorkspaceArgs {
    token: string;
    userId: string;
    type: string;
}

export interface IUpdateWorkspaceArgs {
    request: IWorkspace;
    token: string;
}




