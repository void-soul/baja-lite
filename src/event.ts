type EventParams = readonly unknown[];
type EventHandler<T extends EventParams> = (...args: T) => void;
export class EventBus<T extends Record<string, EventParams>> {
    private readonly all: Map<keyof T, EventHandler<T[keyof T]>[]> = new Map();
    on<K extends keyof T>(type: K, handler: EventHandler<T[K]>) {
        let list = this.all.get(type);
        if (!list) this.all.set(type, (list = []));
        list.push(handler as EventHandler<EventParams>);
        return this;
    }
    once<K extends keyof T>(type: K, handler: EventHandler<T[K]>) {
        const wrapper: EventHandler<T[K]> = (...args) => {
            handler(...args);
            this.off(type, wrapper);
        };
        return this.on(type, wrapper);
    }
    off<K extends keyof T>(type: K, handler?: EventHandler<T[K]>) {
        const list = this.all.get(type);
        if (!list) return this;
        if (handler) {
            const idx = list.indexOf(handler as EventHandler<EventParams>);
            if (idx !== -1) list.splice(idx, 1);
        } else {
            this.all.delete(type);
        }
        return this;
    }
    emit<K extends keyof T>(type: K, ...args: T[K]) {
        const list = this.all.get(type);
        list?.slice().forEach(fn => fn(...args));
        return this;
    }
}