function hexToDec(hexStr: string): string | null {
    if (hexStr.substring(0, 2) === "0x") hexStr = hexStr.substring(2);
    hexStr = hexStr.toLowerCase();
    return convertBase(hexStr, 16, 10);
}

function add(x: number[], y: number[], base: number): number[] {
    let z: number[] = [];
    let n = Math.max(x.length, y.length);
    let carry = 0;
    let i = 0;
    while (i < n || carry) {
        let xi = i < x.length ? x[i] : 0;
        let yi = i < y.length ? y[i] : 0;
        let zi = carry + xi! + yi!;
        z.push(zi % base);
        carry = Math.floor(zi / base);
        i++;
    }
    return z;
}

function multiplyByNumber(num: number, x: number[], base: number): number[] | null {
    if (num < 0) return null;
    if (num == 0) return [];

    let result: number[] = [];
    let power = x;
    while (true) {
        if (num & 1) {
            result = add(result, power, base);
        }
        num = num >> 1;
        if (num === 0) break;
        power = add(power, power, base);
    }

    return result;
}

function parseToDigitsArray(str: string, base: number): number[] | null {
    let digits = str.split("");
    let ary: number[] = [];
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i]!, base);
        if (isNaN(n)) return null;
        ary.push(n);
    }
    return ary;
}

function convertBase(str: string, fromBase: number, toBase: number): string | null {
    let digits = parseToDigitsArray(str, fromBase);
    if (digits === null) return null;

    let outArray: number[] = [];
    let power = [1];
    for (let i = 0; i < digits.length; i++) {
        if (digits[i]) {
            outArray = add(outArray, multiplyByNumber(digits[i]!, power, toBase)!, toBase);
        }
        power = multiplyByNumber(fromBase, power, toBase)!;
    }

    let out = "";
    for (let i = outArray.length - 1; i >= 0; i--) {
        out += outArray[i]!.toString(toBase);
    }
    return out;
}

export class Snowflake {
    private seq: number;
    private mid: number;
    private offset: number;
    private lastTime: number;

    constructor(options?: { mid?: number; offset?: number }) {
        options = options || {};
        this.seq = 0;
        this.mid = (options.mid || 1) % 1023;
        this.offset = options.offset || 0;
        this.lastTime = 0;
    }

    generate(): string | null {
        let time = Date.now(),
            bTime = (time - this.offset).toString(2);

        if (this.lastTime == time) {
            this.seq++;

            if (this.seq > 4095) {
                this.seq = 0;

                while (Date.now() <= time) { }
            }
        } else {
            this.seq = 0;
        }

        this.lastTime = time;

        let bSeq = this.seq.toString(2),
            bMid = this.mid.toString(2);

        while (bSeq.length < 12) {
            bSeq = "0" + bSeq;
        }
        while (bMid.length < 10) {
            bMid = "0" + bMid;
        }
        let bid = bTime + bMid + bSeq;
        let id = "";

        for (let i = bid.length; i > 0; i -= 4) {
            id = parseInt(bid.substring(i - 4, i), 2).toString(16) + id;
        }

        return hexToDec(id);
    }
}

export const snowflake = new Snowflake({
    mid: 66,
    offset: (2024 - 1970) * 31536000 * 1000,
});