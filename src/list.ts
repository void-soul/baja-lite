
export class ArrayList<T> extends Array<T> {
    constructor(array?: Array<T> | T | undefined) {
        super();
        if (array instanceof Array) {
            super.push(...array);
        } else if (typeof array !== 'undefined') {
            super.push(array);
        }
    }
    add(...items: T[]) {
        this.push(...items);
    }
    size() {
        return this.length;
    }
    isEmpty() {
        return this.length === 0;
    }
    get(index: number) {
        return this[index];
    }
    clear() {
        this.length = 0;
    }
    set(index: number, item: T) {
        this[index] = item;
    }
    remove(index: number) {
        this.splice(index, 1);
    }
}

// export class ArrayMap<T> extends Array<T> {
//     private _map: Map<string, T> = new Map();
//     private key: keyof T;
//     constructor(key: keyof T, array?: Array<T> | T | undefined) {
//         super();
//         this.key = key;
//         if (array instanceof Array) {
//             super.push(...array);
//         } else if (typeof array !== 'undefined') {
//             super.push(array);
//         }
//     }
//     override push(...items: T[]): number {
//         for (const item of items) {
//             const key = item[this.key] as string;
//             if (!this._map.has(key)) {
//                 super.push(item);
//                 this._map.set(key, item);
//             }
//         }
//         return this.length;
//     }
//     override
// }
