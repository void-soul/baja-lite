/* eslint-disable @typescript-eslint/no-unsafe-argument */
import pino from 'pino';
import * as rp from 'request-promise';
import { Throw } from '../error.js';
const logger =
  process.env['NODE_ENV'] !== 'production' ? pino({
    name: 'wx',
    transport: {
      target: 'pino-pretty'
    }
  }) : pino({ name: 'wx' });
export abstract class BaseWx {
  protected authErrorCodes = [40001, 40014, 41001, 42001];
  protected name: string = '';
  protected tokenUrl: string = '';
  private tokenData = '';
  protected mock = false;
  protected async getToken(force?: boolean): Promise<string> {
    let token = '';
    const now = +new Date();
    let need = force === true;
    if (this.tokenData) {
      const datas = this.tokenData.split('^_^');
      token = datas[0]!;
      const lastTime = datas[1]!;
      const spliceTime = datas[2]!;
      if (now - parseInt(lastTime, 10) - parseInt(spliceTime, 10) > 0) {
        need = true;
      }
    } else {
      need = true;
    }
    if (need === true) {
      const data = await this.fetch(() => this.tokenUrl, 'get', {}, false);
      token = data.access_token;
      this.tokenData = `${token}^_^${now}^_^${data.expires_in * 1000}`;
    }
    return token;
  }
  protected async fetch(uri: (token: string) => string, method: 'get' | 'post', data: { [key: string]: any }, needToken = true, buffer = false) {
    if (this.mock === true) {
      return {};
    }
    let token = needToken ? await this.getToken() : '';
    if (!needToken || token) {
      const start = +new Date();
      let url = uri(token);
      const param = method === 'get' ? {
        method,
        json: buffer ? false : true,
        qs: data,
        encoding: buffer ? null : undefined
      } : {
        json: data,
        method,
        encoding: buffer ? null : undefined
      };

      let response = await rp.default({
        uri: url,
        ...param
      });
      if (this.authErrorCodes.includes(response.errcode)) {
        token = await this.getToken(true);
        url = uri(token);
        response = await rp.default({
          uri: url,
          ...param
        });
        Throw.if(response.errcode && response.errcode - 0 !== 0, `${url}-${response.errcode}-${response.errmsg}`);
      }
      Throw.if(response.errcode && response.errcode - 0 !== 0, `${url}-${response.errcode}-${response.errmsg}`);
      logger.info(`fetch data ${+new Date() - start} ms`);
      return response;
    }
  }
}
