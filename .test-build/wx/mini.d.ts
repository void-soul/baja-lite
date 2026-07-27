import { BaseWx } from './base.js';
import { WxLiveInfo, WxLiveReplay, WxMiniConfig } from './types.js';
export declare class WxMini extends BaseWx {
    protected name: string;
    private config;
    private templNameCache;
    private templKeyCache;
    constructor(config: WxMiniConfig);
    getUnlimited({ scene, model, page, fullpath, png, width, lineColor }: {
        scene: string;
        model?: string;
        page?: string;
        fullpath?: string;
        png?: '0' | '1' | 0 | 1 | true | false | 'true' | 'false';
        width?: number;
        lineColor?: {
            r: number;
            g: number;
            b: number;
        };
    }): Promise<any>;
    sendMs({ openids, name, data, scene }: {
        openids: string[];
        name: string;
        data: {
            [key: string]: string | number;
        };
        scene: string;
    }): Promise<void>;
    code2session(code: string): Promise<{
        openid: string;
        session_key: string;
        unionid?: string;
    }>;
    getTemplIds(): {
        [key: string]: string[];
    };
    decrypt<T>({ sessionKey, encryptedData, iv }: {
        iv: string;
        sessionKey: string;
        encryptedData: string;
    }): T | undefined;
    getLiveInfo(start: number, limit: number): Promise<WxLiveInfo[]>;
    getLiveReplay(room_id: number, start: number, limit: number): Promise<WxLiveReplay[]>;
    getPhone(code: string, openid: string): Promise<{
        phoneNumber: any;
        purePhoneNumber: any;
        countryCode: any;
        timestamp: any;
        appid: any;
    }>;
}
