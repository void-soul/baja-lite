export interface XML {
    type: 'tag' | 'text';
    name: string;
    id?: string;
    voidElement: boolean;
    attrs: Record<string, string>;
    children: XML[];
    content: string;
}
export declare const convert: (childrens: XML[], param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) => string;
