import { BaseWx } from './base.js';
import { WxDepartment, WxOrganConfig, WxOrganFile, WxOrganImage, WxOrganMarkDown, WxOrganMini, WxOrganMpNews, WxOrganNews, WxOrganTaskCard, WxOrganText, WxOrganTextCard, WxOrganUser, WxOrganUserSimply, WxOrganVideo, WxOrganVoice } from './types.js';
export declare class WxOrgan extends BaseWx {
    protected name: string;
    private config;
    private miniMessCache;
    private messCache;
    constructor(config: WxOrganConfig);
    createDepartment(param: WxDepartment): Promise<number>;
    updateDepartment(param: WxDepartment): Promise<void>;
    deleteDepartment(id: number): Promise<void>;
    getDepartmentList(id?: number): Promise<WxDepartment[]>;
    createUser(param: WxOrganUser): Promise<string | number>;
    getUser(userid: number | string): Promise<WxOrganUser>;
    updateUser(param: WxOrganUser): Promise<void>;
    deleteUser(userid: number | string): Promise<void>;
    batchDeleteUser(useridlist: Array<number | string>): Promise<void>;
    getDeptUserSimply(department_id: number, fetch_child: boolean): Promise<WxOrganUserSimply[]>;
    getDeptUser(department_id: number, fetch_child: boolean): Promise<WxOrganUser[]>;
    userid2openid(userid: number | string): Promise<string>;
    openid2userid(openid: string): Promise<number | string>;
    authsucc(userid: string): Promise<void>;
    inviteUsers({ user, party, tag }: {
        user?: Array<number | string>;
        party?: number[];
        tag?: number[];
    }): Promise<{
        invaliduser?: Array<number | string>;
        invalidparty?: number[];
        invalidtag?: number[];
    }>;
    createTag(tagname: string, tagid: number): Promise<number>;
    updateTag(tagname: string, tagid: number): Promise<void>;
    deleteTag(tagid: number): Promise<void>;
    createTagUser(tagid: number, userlist: Array<string | number>): Promise<void>;
    deleteTagUser(tagid: number, userlist: Array<string | number>): Promise<void>;
    getTagUser(tagid: number): Promise<{
        tagname: string;
        userlist: Array<{
            userid: string | number;
            name: string;
        }>;
        partylist: number[];
    }>;
    getTag(): Promise<Array<{
        tagid: number;
        tagname: string;
    }>>;
    updateTaskCard(userids: Array<string | number>, task_id: string, clicked_key: string): Promise<void>;
    sendMiniMs({ touser, toparty, totag, name, scene, ms }: {
        touser?: Array<number | string>;
        toparty?: number[];
        totag?: number[];
        name: string;
        scene?: string;
        ms: WxOrganMini;
    }): Promise<void>;
    sendMs({ touser, toparty, totag, name, ms }: {
        touser?: Array<number | string>;
        toparty?: number[];
        totag?: number[];
        name: string;
        ms: WxOrganText | WxOrganImage | WxOrganVoice | WxOrganVideo | WxOrganFile | WxOrganTextCard | WxOrganNews | WxOrganMpNews | WxOrganMarkDown | WxOrganTaskCard;
    }): Promise<void>;
}
