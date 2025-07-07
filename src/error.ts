export const Throw = {
    if(test: boolean, message: string | Error | any) {
        if (test === true) this.now(message);
    },
    ifNot(test: boolean, message: string | Error | any) {
        if (test !== true) this.now(message);
    },
    now(message: string | Error | any) {
        throw typeof message === 'string' ? new Error(message) : message;
    }
};