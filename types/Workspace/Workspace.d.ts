import { IUser } from "../User/User";

export interface IWorkspace {
    id: string;
    created_at: string;
    updated_at: string;
    image: string;
    name: string;
    invite_code: string;
    settings: Record<string, any>;
}

export interface IWorkspaceUser {
    workspace_id: string;
    user_id: string;
    role: 'super_admin' | 'admin' | 'member';
    created_at: string;
    username?: string;
    avatar?: string;
    last_login?: string;
    email?: string;
    settings?: Record<string, any>;
}

export interface ICreateWorkspaceArgs {
    request: IWorkspace;
    token: string;
    users?: IWorkspaceUser[];
}

export interface IGetWorkspaceArgs {
    token: string;
    workspaceId: string;
    userId: string;
}

export interface IUpdateWorkspaceArgs {
    request: IWorkspace;
    token: string;
}

export interface IWorkspaceUserArgs {
    token: string;
    workspaceId: string;
    userId: string;
    role?: string;
}

export interface IGetWorkspaceUsersArgs {
    token: string;
    workspaceId: string;
    role?: string;
}

export interface IAddUserToWorkspaceRequest {
    user_id: string;
    role: 'super_admin' | 'admin' | 'member';
}

export interface IAddUsersToWorkspaceArgs {
    token: string;
    workspaceId: string;
    request: IAddUserToWorkspaceRequest[];
}

export interface IRemoveUserFromWorkspaceRequest {
    userId: string;
    workspaceId: string;
}

export interface IRemoveUsersFromWorkspaceArgs {
    token: string;
    workspaceId: string;
    request: IRemoveUserFromWorkspaceRequest[];
}

export interface IWorkspaceWithRole extends IWorkspace {
    role?: 'super_admin' | 'admin' | 'member';
}

export interface IGetUsersFromWorkspaceArgs {
    token: string;
    workspaceId: string;
}