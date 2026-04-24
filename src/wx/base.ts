/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios from 'axios';
import pino from 'pino';
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
      const config: import('axios').AxiosRequestConfig = {
        method,
        url,
        responseType: buffer ? 'arraybuffer' : 'json',
      };
      if (method === 'get') {
        config.params = data;
      } else {
        config.data = data;
      }

      let response = await axios(config);
      let result = buffer ? response.data : response.data;
      if (this.authErrorCodes.includes(result.errcode)) {
        token = await this.getToken(true);
        url = uri(token);
        config.url = url;
        response = await axios(config);
        result = buffer ? response.data : response.data;
        Throw.if(result.errcode && result.errcode - 0 !== 0, `${url}-${result.errcode}-${result.errmsg}`);
      }
      Throw.if(result.errcode && result.errcode - 0 !== 0, `${url}-${result.errcode}-${result.errmsg}`);
      logger.info(`fetch data ${+new Date() - start} ms`);
      return result;
    }
  }
}
