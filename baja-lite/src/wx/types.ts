/**
 * 企业微信员工
 */
export interface WxOrganUser {
    userid: number;
    name: string;
    alias?: string;
    mobile: string;
    department: number[];
    order?: number[];
    is_leader_in_dept?: Array<0 | 1>;
    position?: string;
    gender?: 1 | 0;
    email?: string;
    telephone?: string;
    avatar_mediaid?: string;
    enable?: 1 | 0;
    extattr?: { [key: string]: string | number };
    to_invite?: boolean;
    external_profile?: { [key: string]: string | number };
    external_position?: string;
    address?: string;
}
export interface WxOrganUserRead extends WxOrganUser {
    status?: 1 | 2 | 4;
    avatar?: string;
    thumb_avatar?: string;
    qr_code?: string;
}
export interface WxOrganUserSimply {
    userid: number;
    name: string;
    department: number[];
}
/**
 *
 * 企业微信部门
 * @interface WxDepartment
 */
export interface WxDepartment {
    name: string;
    parentid: number;
    order?: number;
    id: number;
}
export interface WxLiveReplay {
    expire_time: string;
    create_time: string;
    media_url: string;
}
export interface WxConfig {
    corpid: string;
    appSecret: string;
}
export type WxPayType = 'JSAPI' | 'NATIVE' | 'APP' | 'MWEB';
export interface WxPayOption {
    /** 小程序id、公众号id、企业微信id */
    appid: string;
    /** 商户号 */
    mch_id: string;
    /** 商户平台密钥 */
    appSecret: string;
    /** 证书名称(文件名+后缀)，需要放在 app/cert 目录中  */
    cert: string;
    /** 支付方式：微信内网页环境使用JSAPI,微信外网页环境使用MWEB;用户扫码使用NATIVE  */
    trade_type: WxPayType;
}
export interface WxCreatedorder {
    device_info?: string;
    body: string;
    detail?: string;
    out_trade_no: string;
    total_fee: number;
    spbill_create_ip: string;
    time_start?: string;
    time_expire?: string;
    goods_tag?: string;
    product_id?: string;
    limit_pay?: string;
    openid: string;
    receipt?: string;
    scene_info?: {
        store_info: {
            id: string;
            name: string;
            area_code: string;
            address: string;
        };
    };
}

export interface WxPayToUserResponse {
    payment_no: string;
    partner_trade_no: string;
    payment_time: string;
}
export interface WxPayToUser {
    partner_trade_no: string;
    openid: string;
    check_name: 'NO_CHECK' | 'FORCE_CHECK';
    re_user_name?: string;
    amount: number;
    desc?: string;
    spbill_create_ip?: string;
}
export interface WxCreateOrderJSAPI {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
}
export interface WxCreateOrderAPP {
    appid: string;
    partnerid: string;
    prepayid: string;
    package: string;
    noncestr: string;
    timestamp: string;
    sign: string;
}
/** 微信支付预创建订单返回结果 */
export interface WxCreateOrderResult {
    /** jsapi支付方式 */
    jsapi?: WxCreateOrderJSAPI;
    /** app支付方式 */
    app?: WxCreateOrderAPP;
    prepay_id: string;
    code_url?: string;
    mweb_url?: string;
    dataCacheId?: string;
    devCacheId?: string;
}/** 微信退款返回结果 */
export interface WxRefResult {
    dataCacheId?: string;
    devCacheId?: string;
}
export interface WxOrderQuery {
    transaction_id?: string;
    out_trade_no?: string;
}
export interface WxOrder {
    device_info?: string;
    openid: string;
    is_subscribe: 'Y' | 'N';
    trade_type: WxPayType;
    trade_state: 'SUCCESS' | 'REFUND' | 'NOTPAY' | 'CLOSED' | 'REVOKED' | 'USERPAYING' | 'PAYERROR';
    bank_type: string;
    total_fee: number;
    settlement_total_fee?: number;
    fee_type?: string;
    cash_fee: number;
    cash_fee_type?: string;
    coupon_fee?: number;
    coupon_count?: number;
    transaction_id: string;
    out_trade_no: string;
    attach?: string;
    time_end: string;
    trade_state_desc: string;
    children?: Array<{
        coupon_type: string;
        coupon_id: string;
        coupon_fee: number;
    }>;
}
export interface WxCreateRefundOrder {
    transaction_id?: string;
    out_trade_no?: string;
    out_refund_no: string;
    total_fee: number;
    refund_fee: number;
    refund_desc: string;
    refund_account?: 'REFUND_SOURCE_UNSETTLED_FUNDS' | 'REFUND_SOURCE_RECHARGE_FUNDS';
}
export interface WxRefundOrderQuery {
    transaction_id?: string;
    out_trade_no?: string;
    out_refund_no?: string;
    refund_id?: string;
    offset?: number;
}
export interface WxRefundOrder {
    total_refund_count?: number;
    transaction_id: string;
    out_trade_no: string;
    total_fee: number;
    settlement_total_fee?: number;
    fee_type?: string;
    cash_fee: number;
    refund_count: number;
    children?: Array<{
        out_refund_no: string;
        refund_id: string;
        refund_channel?: 'ORIGINAL' | 'BALANCE' | 'OTHER_BALANCE' | 'OTHER_BANKCARD';
        refund_fee: number;
        settlement_refund_fee?: number;
        coupon_refund_fee?: number;
        coupon_refund_count?: number;
        refund_status: 'SUCCESS' | 'REFUNDCLOSE' | 'PROCESSING' | 'CHANGE';
        refund_account?: 'REFUND_SOURCE_RECHARGE_FUNDS' | 'REFUND_SOURCE_UNSETTLED_FUNDS';
        refund_recv_accout: string;
        refund_success_time?: string;
        children?: Array<{
            coupon_type: string;
            coupon_refund_id: string;
            coupon_refund_fee: number;
        }>;
    }>;
}
export interface WxPayHook {
    device_info?: string;
    openid: string;
    is_subscribe: 'Y' | 'N';
    bank_type: string;
    total_fee: number;
    settlement_total_fee?: number;
    fee_type?: string;
    cash_fee: number;
    cash_fee_type?: string;
    coupon_fee?: string;
    coupon_count?: number;
    children?: Array<{
        coupon_type: string;
        coupon_id: string;
        coupon_fee: number;
    }>;
    transaction_id: string;
    out_trade_no: string;
    attach?: string;
    time_end: string;
}
export interface WxRefHook {
    transaction_id: string;
    out_trade_no: string;
    refund_id: string;
    out_refund_no: string;
    total_fee: number;
    settlement_total_fee?: number;
    refund_fee: number;
    settlement_refund_fee: string;
    refund_status: 'SUCCESS' | 'CHANGE' | 'REFUNDCLOSE';
    success_time?: string;
    refund_recv_accout: string;
    refund_account: 'REFUND_SOURCE_RECHARGE_FUNDS' | 'REFUND_SOURCE_UNSETTLED_FUNDS';
    refund_request_source: 'API' | 'VENDOR_PLATFORM';
}
export interface WxPay {
    /**
   * 企业付款到零钱
   * https://pay.weixin.qq.com/wiki/doc/api/tools/mch_pay.php?chapter=14_2
   *
   * option中的amount单位是元
   * 处理失败时返回异常
   * @memberof WxPay
   */
    transfers(option: WxPayToUser): Promise<WxPayToUserResponse>;
    /**
     * 统一下单接口参数定义
     * https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_1
     * 其中未定义到此处的参数，说明框架会给出默认值
     *
     * 会将dataCache存放到redis中
     * 在支付回调中将dataCache取出传回业务方法
     *
     * 每一个支付应用都有自己的：支付成功、支付失败、退款成功、退款失败回调
     * 所以如果有不同的业务，最好将这些业务都分层不同的支付应用
     * 每个应用实现独立的同步消息通知（sub-async）
     *
     * devid 是当前支付发起的用户token
     * 在支付回调时，由于请求是由微信服务器发起的,因此上下文中不存在 用户对象
     * 通过这个参数可以将 当前支付发起时用户 追加到回调的上下文中
     * @memberof WxPay
     */
    unifiedorder(wxOrderOption: WxCreatedorder, dataCache?: { [key: string]: any }, devid?: string): Promise<WxCreateOrderResult>;
    /**
     *
     * https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_2
     * @param {WxOrderQuery} option
     * @returns {Promise<WxOrder>}
     * @memberof WxPay
     */
    orderquery(option: WxOrderQuery): Promise<WxOrder>;
    /**
     *
     * https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_3
     * @param {string} out_trade_no
     * @returns {Promise<void>}
     * @memberof WxPay
     */
    closeorder(out_trade_no: string): Promise<void>;
    /**
     * 取消订单
     * 用于用户取消支付导致的取消订单场景
     * 此方法会清除调起支付时缓存的dataCache
     * 同时会向微信提交关闭订单的申请
     * @param {string} out_trade_no
     * @returns {Promise<void>}
     * @memberof WxPay
     */
    cancelorder(out_trade_no: string): Promise<void>;
    /**
     *
     * https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_4
     *
     * 会将dataCache存放到redis中
     * 在回调中将dataCache取出传回业务方法
     *
     * devid 是当前退款发起的用户token
     * 在退款回调时，由于请求是由微信服务器发起的,因此上下文中不存在 用户对象
     * 通过这个参数可以将 当前退款发起时用户 追加到回调的上下文中
     *
     * @param {WxCreateRefundOrder} option
     * @returns {Promise<void>}
     * @memberof WxPay
     */
    refund(option: WxCreateRefundOrder, dataCache?: { [key: string]: any }, devid?: string): Promise<WxRefResult>;
    /**
     *
     * https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=9_5
     * @param {WxRefundOrderQuery} option
     * @returns {Promise<void>}
     * @memberof WxPay
     */
    refundquery(option: WxRefundOrderQuery): Promise<WxRefundOrder>;
    /**
     * 修改支付、退款时缓存的业务对象
     * @param dataCache
     * @param dataCacheId
     */
    resetDataCache(dataCache: {
        [key: string]: any;
    }, dataCacheId: string): Promise<void>;

    /**
     * 修改支付、退款时缓存的会话id
     * @param devid
     * @param devCacheId
     */
    resetDevIdCache(devid: string, devCacheId: string): Promise<void>;
}
export interface WxMiniConfig {
    appId: string;
    appSecret: string;
    /** 小程序二维码设置 */
    qrcode?: {
        /** 线条颜色 */
        lineColor?: { r: number; g: number; b: number };
        /** 宽度 */
        width?: number;
    };
    /**
     *
     * 微信订阅消息场景
     * 当传递此参数后,会自动创建路由
     *
     * keys 表示场景,在前端申请订阅场景权限时使用,同一个key将一次性申请订阅权限
     *      每一个模板可以在不同的场景中被申请
     * model=页面所在分包名
     * page=页面名称
     * name=模板消息标识符,调用this.app.wxSendMs时使用,同一个name将同时发出
     * tmplId=模板id
     *
     * /wx-mini-ms-id.json 得到所有模板消息id数组
     * 返回 {key: [模板id数组]}
     */
    messages?: Array<{
        keys: string[];
        name: string;
        tmplId: string;
        model: string;
        page: string;
    }>;
}
export interface WxOrganConfig {
    /**
     *
     * 应用自定义编码
     * 用于消息回调的url拼接
     * @type {string}
     * @memberof WxOrganConfig
     */
    appCode?: string;
    /**
     *
     * 企业编号 或者 suiteid
     * @type {string}
     * @memberof WxOrganConfig
     */
    corpid: string;
    /**
     *
     * 应用密钥
     * @type {string}
     * @memberof WxOrganConfig
     */
    corpsecret: string;
    /**
     *
     * 当应用是小程序应用,并需要发送小程序消息时,需要指定appid
     * @type {string}
     * @memberof WxOrganConfig
     */
    appid?: string;
    /**
     *
     * 当应用是自建应用,且需要发送应用消息时,需要指定应用id
     * @type {string}
     * @memberof WxOrganConfig
     */
    agentid?: number;
    /**
     *
     * 是否开启消息回调?
     * 当开启时，必须指定token\encodingAesKey
     * 访问地址: /wx-organ/appCode.json
     * @type {boolean}
     * @memberof WxOrganConfig
     */
    msHook?: boolean;
    /**
     *
     * 消息回调解密token
     * @type {string}
     * @memberof WxOrganConfig
     */
    token?: string;
    /**
     *
     * 消息回调解密 key
     * @type {string}
     * @memberof WxOrganConfig
     */
    encodingAESKey?: string;
    /**
     *
     * 小程序消息模板
     * 发送时只要指定name即可
     * 一个name可以有多个消息
     * @memberof WxOrganConfig
     */
    miniMessages?: Array<{
        name: string;
        model: string;
        page: string;
    }>;
    /**
     *
     * 非小程序消息模板
     * 发送时只要指定name即可
     * 一个name可以有多个消息
     * https://work.weixin.qq.com/api/doc#90000/90135/90236
     * @memberof WxOrganConfig
     */
    messages?: Array<{
        name: string;
        msgtype: 'text' | 'image' | 'voice' | 'video' | 'file' | 'textcard' | 'news' | 'mpnews' | 'markdown' | 'taskcard';
        safe?: 0 | 1;
    }>;

    /**
     *
     * 接口模拟调用?
     * 默认false
     * @type {boolean}
     * @memberof WxOrganConfig
     */
    mock?: boolean;
}
export interface WxOrganMini {
    title: string;
    description?: string;
    content_item?: { [key: string]: string };
    emphasis_first_item?: boolean;
}
export interface WxOrganText {
    content: string;
}
export interface WxOrganImage {
    media_id: string;
}
export interface WxOrganVoice {
    media_id: string;
}
export interface WxOrganVideo {
    media_id: string;
    title?: string;
    description?: string;
}
export interface WxOrganFile {
    media_id: string;
}
export interface WxOrganTextCard {
    url: string;
    title: string;
    description: string;
    btntxt?: string;
}
export interface WxOrganNews {
    articles: Array<{
        title: string;
        description?: string;
        url: string;
        picurl?: string;
    }>;
}
export interface WxOrganMpNews {
    articles: Array<{
        title: string;
        thumb_media_id: string;
        author?: string;
        content_source_url?: string;
        content: string;
        digest?: string;
    }>;
}
export interface WxOrganMarkDown {
    content: string;
}
export interface WxOrganTaskCard {
    title: string;
    description: string;
    url?: string;
    task_id: string;
    btn: Array<{
        key: string;
        name: string;
        replace_name?: string;
        color?: 'red' | 'blue';
        is_bold?: boolean;
    }>;
}
export interface WxLiveInfo {
    name: string;
    roomid: number;
    cover_img: string;
    live_satus: number;
    start_time: number;
    end_time: number;
    anchor_name: string;
    anchor_img: string;
    goods: Array<{
        cover_img: string;
        url: string;
        price: number;
        name: string;
    }>;
}
