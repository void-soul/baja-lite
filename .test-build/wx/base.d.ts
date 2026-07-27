export declare abstract class BaseWx {
    protected authErrorCodes: number[];
    protected name: string;
    protected tokenUrl: string;
    private tokenData;
    protected mock: boolean;
    protected getToken(force?: boolean): Promise<string>;
    protected fetch(uri: (token: string) => string, method: 'get' | 'post', data: {
        [key: string]: any;
    }, needToken?: boolean, buffer?: boolean): Promise<any>;
}
