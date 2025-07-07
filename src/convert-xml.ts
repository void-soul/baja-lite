import LGet from 'lodash.get';
export interface XML {
    type: 'tag' | 'text';
    name: string;
    id?: string;
    voidElement: boolean;
    attrs: Record<string, string>;
    children: XML[];
    content: string;
}
export const convert = function (childrens: XML[], param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    let statement = '';
    for (let i = 0, children: XML; children = childrens[i]!; i++) {
        // Convert SQL statement recursively
        statement += convertChildren(children, param, parentIds, myBatisMapper);
    }
    // Check not converted Parameters
    const regexList = ['\\#{\\S*}', '\\${\\S*}'];
    for (let i = 0, regexString: string; regexString = regexList[i]!; i++) {
        var checkParam = statement.match(regexString);
        if (checkParam != null && checkParam.length > 0) {
            throw new Error("Parameter " + checkParam.join(",") + " is not converted.");
        }
    }
    return statement;
}
const convertChildren = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    param ??= {};
    if (!isDict(param)) {
        throw new Error('Parameter argument should be Key-Value type or Null.');
    }
    if (children.type == 'text') {
        // Convert Parameters
        return convertParameters(children, param);

    } else if (children.type == 'tag') {
        switch (children.name.toLowerCase()) {
            case 'if':
                return convertIf(children, param, parentIds, myBatisMapper);
            case 'choose':
                return convertChoose(children, param, parentIds, myBatisMapper);
            case 'trim':
            case 'where':
                return convertTrimWhere(children, param, parentIds, myBatisMapper);
            case 'set':
                return convertSet(children, param, parentIds, myBatisMapper);
            case 'foreach':
                return convertForeach(children, param, parentIds, myBatisMapper);
            case 'bind':
                param = convertBind(children, param);
                return '';
            case 'include':
                return convertInclude(children, param, parentIds, myBatisMapper);
            default:
                throw new Error('XML is not well-formed character or markup. Consider using CDATA section.');
        }
    } else {
        return '';
    }
}

const convertParameters = function (children: XML, param: Record<string, any>) {
    let convertString = children.content;

    try {
        convertString = convertParametersInner('#', convertString, param);
        convertString = convertParametersInner('$', convertString, param);
    } catch (err) {
        throw new Error('Error occurred during convert parameters.');
    }

    try {
        // convert CDATA string
        convertString = convertString.replace(/(\&amp\;)/g, '&');
        convertString = convertString.replace(/(\&lt\;)/g, '<');
        convertString = convertString.replace(/(\&gt\;)/g, '>');
        convertString = convertString.replace(/(\&quot\;)/g, '"');
    } catch (err) {
        throw new Error('Error occurred during convert CDATA section.');
    }

    return convertString;
}

const isObject = function (variable: any) {
    return typeof variable === 'object' && variable !== null;
}

const isArray = function (variable: any) {
    return isObject(variable) && variable.hasOwnProperty('length');
}

const convertParametersInner = function (change: string, convertString: string, param: Record<string, any>) {
    const stringReg = new RegExp('(\\' + change + '\\{[a-zA-Z0-9._\\$]+\\})', 'g');
    let stringTarget = convertString.match(stringReg);

    if (stringTarget != null && stringTarget.length > 0) {
        const _stringTarget = uniqueArray(stringTarget);

        let target: string | undefined;
        for (let i = 0; i < _stringTarget.length; i++) {
            target = _stringTarget[i];
            const t = target!.replace(change + '{', '').replace('}', '');
            let tempParamKey = LGet(param, t);
            if (tempParamKey !== undefined) {
                const reg = new RegExp('\\' + change + '{' + t + '}', 'g');

                if (tempParamKey === null) {
                    tempParamKey = 'NULL';
                    convertString = convertString.replace(reg, tempParamKey);
                } else {
                    if (change == '#') {
                        // processing JSON fields structures
                        if (isObject(tempParamKey) || isArray(tempParamKey)) {
                            tempParamKey = JSON.stringify(tempParamKey);
                        } else {
                            tempParamKey = tempParamKey.toString().replace(/"/g, '\\\"');
                            tempParamKey = mysqlRealEscapeParam(tempParamKey);
                        }

                        tempParamKey = tempParamKey.replace(/'/g, "''");
                        const replaceWith = "'" + tempParamKey + "'"
                        convertString = convertString.replace(reg, () => replaceWith);
                    } else if (change == '$') {
                        convertString = convertString.replace(reg, tempParamKey);
                    }
                }
            }
        }
    }
    return convertString;
}

const convertIf = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    let evalString = children.attrs['test']!;
    try {
        // Create Evaluate string
        evalString = replaceEvalString(evalString, param);

        evalString = evalString.replace(/ and /gi, ' && ');
        evalString = evalString.replace(/ or /gi, ' || ');

        // replace == to === for strict evaluate
        // TODO: fix != null & != ''
        // evalString = evalString.replace(/==/g, '===');
        // evalString = evalString.replace(/!=/g, '!==');

        evalString = evalString.replace(/^'(.*?)'\.equalsIgnoreCase\( ([a-zA-Z]+\.[a-zA-Z]+) \)/i, `($2 && $2.toUpperCase() === '$1'.toUpperCase())`);
        evalString = evalString.replace(/\('(.*?)'\.equalsIgnoreCase\( ([a-zA-Z]+\.[a-zA-Z]+) \)/i, `(($2 && $2.toUpperCase() === '$1'.toUpperCase())`);

    } catch (err) {
        throw new Error('Error occurred during convert <if> element.');
    }

    // Execute Evaluate string
    try {
        if (eval(evalString)) {
            let convertString = '';
            for (let i = 0, nextChildren: XML; nextChildren = children['children'][i]!; i++) {
                convertString += convertChildren(nextChildren, param, parentIds, myBatisMapper);
            }
            return convertString;

        } else {
            return '';
        }
    } catch (e) {
        return '';
    }
}

const convertForeach = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    try {
        const collection = eval('param.' + children.attrs['collection']);
        const item = children.attrs['item']!;
        const open = (children.attrs['open'] == null) ? '' : children.attrs['open'];
        const close = (children.attrs['close'] == null) ? '' : children.attrs['close'];
        const separator = (children.attrs['separator'] == null) ? '' : children.attrs['separator'];

        const foreachTexts: string[] = [];
        let coll = null;
        for (let j = 0; j < collection.length; j++) {
            coll = collection[j];
            const foreachParam = param;
            foreachParam[item] = coll;

            let foreachText = '';
            for (let k = 0, nextChildren: XML; nextChildren = children.children[k]!; k++) {
                let fText = convertChildren(nextChildren, foreachParam, parentIds, myBatisMapper);
                fText = fText.replace(/^\s*$/g, '');
                if (fText != null && fText.length > 0) {
                    foreachText += fText;
                }
            }

            if (foreachText != null && foreachText.length > 0) {
                foreachTexts.push(foreachText);
            }
        }

        return (open + foreachTexts.join(separator) + close);
    } catch (err) {
        throw new Error('Error occurred during convert <foreach> element.');
    }
}

const convertChoose = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    try {
        for (let i = 0, whenChildren; whenChildren = children.children[i]; i++) {
            if (whenChildren.type == 'tag' && whenChildren.name.toLowerCase() == 'when') {
                let evalString = whenChildren.attrs.test;

                // Create Evaluate string
                evalString = replaceEvalString(evalString, param);

                evalString = evalString.replace(/ and /gi, ' && ');
                evalString = evalString.replace(/ or /gi, ' || ');

                // Execute Evaluate string
                try {
                    if (eval(evalString)) {
                        // If <when> condition is true, do it.
                        let convertString = '';
                        for (let k = 0, nextChildren: XML; nextChildren = whenChildren.children[k]; k++) {
                            convertString += convertChildren(nextChildren, param, parentIds, myBatisMapper);
                        }
                        return convertString;
                    } else {
                        continue;
                    }
                } catch (e) {
                    continue;
                }
            } else if (whenChildren.type == 'tag' && whenChildren.name.toLowerCase() == 'otherwise') {
                // If reached <otherwise> tag, do it.
                let convertString = '';
                for (let k = 0, nextChildren: XML; nextChildren = whenChildren.children[k]; k++) {
                    convertString += convertChildren(nextChildren, param, parentIds, myBatisMapper);
                }
                return convertString;
            }
        }

        // If there is no suitable when and otherwise, just return null.
        return '';

    } catch (err) {
        throw new Error('Error occurred during convert <choose> element.');
    }
}

const convertTrimWhere = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    let convertString = '';
    let prefix: string | undefined;
    let prefixOverrides: string | undefined;
    let suffix: string | undefined;
    let suffixOverrides: string | undefined;
    let globalSet: string | undefined;

    try {
        switch (children.name.toLowerCase()) {
            case 'trim':
                prefix = children.attrs["prefix"];
                prefixOverrides = children.attrs["prefixOverrides"];
                suffix = children.attrs["suffix"];
                suffixOverrides = children.attrs["suffixOverrides"];
                globalSet = 'g';
                break;
            case 'where':
                prefix = 'WHERE';
                prefixOverrides = 'and|or';
                globalSet = 'gi';
                break;
            default:
                throw new Error('Error occurred during convert <trim/where> element.');
        }

        // Convert children first.
        for (let j = 0, nextChildren: XML; nextChildren = children.children[j]!; j++) {
            convertString += convertChildren(nextChildren, param, parentIds, myBatisMapper);
        }

        // Remove prefixOverrides
        let trimRegex = new RegExp('(^)([\\s]*?)(' + prefixOverrides + ')', globalSet);
        convertString = convertString.replace(trimRegex, '');
        // Remove suffixOverrides
        trimRegex = new RegExp('(' + suffixOverrides + ')([\\s]*?)($)', globalSet);
        convertString = convertString.replace(trimRegex, '');

        if (children.name.toLowerCase() != 'trim') {
            trimRegex = new RegExp('(' + prefixOverrides + ')([\\s]*?)($)', globalSet);
            convertString = convertString.replace(trimRegex, '');
        }

        // Add Prefix if String is not empty.
        trimRegex = new RegExp('([a-zA-Z])', 'g');
        const w = convertString.match(trimRegex);

        if (w != null && w.length > 0) {
            convertString = prefix + ' ' + convertString;
            if (suffix) {
                convertString = convertString + ' ' + suffix
            }
        }

        // Remove comma(,) before WHERE
        if (children.name.toLowerCase() != 'where') {
            const regex = new RegExp('(,)([\\s]*?)(where)', 'gi');
            convertString = convertString.replace(regex, ' WHERE ');
        }

        return convertString;
    } catch (err) {
        throw new Error('Error occurred during convert <' + children.name.toLowerCase() + '> element.');
    }
}

const convertSet = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    let convertString = '';

    try {
        // Convert children first.
        for (let j = 0, nextChildren: XML; nextChildren = children.children[j]!; j++) {
            convertString += convertChildren(nextChildren, param, parentIds, myBatisMapper);
        }

        // Remove comma repeated more than 2.
        let regex = new RegExp('(,)(,|\\s){2,}', 'g');
        convertString = convertString.replace(regex, ',\n');

        // Remove first comma if exists.
        regex = new RegExp('(^)([\\s]*?)(,)', 'g');
        convertString = convertString.replace(regex, '');

        // Remove last comma if exists.
        regex = new RegExp('(,)([\\s]*?)($)', 'g');
        convertString = convertString.replace(regex, '');

        convertString = ' SET ' + convertString;
        return convertString;
    } catch (err) {
        throw new Error('Error occurred during convert <set> element.');
    }
}

const convertBind = function (children: XML, param: Record<string, any>) {
    let evalString = children.attrs["value"]!;

    // Create Evaluate string
    evalString = replaceEvalString(evalString, param);

    param[children.attrs["name"]!] = eval(evalString);

    return param;
}

const convertInclude = function (children: XML, param: Record<string, any>, parentIds: string[], myBatisMapper: Record<string, XML[]>) {
    try {
        // Add Properties to param
        for (let j = 0, nextChildren: XML; nextChildren = children.children[j]!; j++) {
            if (nextChildren.type == 'tag' && nextChildren.name == 'property') {
                param[nextChildren.attrs['name']!] = nextChildren.attrs['value'];
            }
        }
    } catch (err) {
        throw new Error('Error occurred during read <property> element in <include> element.');
    }

    try {
        let refid = convertParametersInner('#', children.attrs['refid']!, param);
        refid = convertParametersInner('$', refid, param);
        let mapper: XML[] | undefined;
        for (const psqlid of parentIds) {
            mapper = myBatisMapper[`${psqlid}.${refid}`];
            if (mapper) {
                break;
            }
        }
        let statement = '';
        for (let i = 0, children: XML; children = mapper![i]!; i++) {
            statement += convertChildren(children, param, parentIds, myBatisMapper);
        }
        return statement;
    } catch (err) {
        throw new Error('Error occurred during convert refid attribute in <include> element.');
    }

}

const isDict = function (v: any) {
    return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
}

const replaceEvalString = function (evalString: string, param: Record<string, any>) {
    const keys = Object.keys(param);

    for (let i = 0; i < keys.length; i++) {
        let replacePrefix = '';
        let replacePostfix = '';
        let paramRegex: RegExp | undefined;

        if (isDict(param[keys[i]!])) {
            replacePrefix = ' param.';
            replacePostfix = '';

            paramRegex = new RegExp('(^|[^a-zA-Z0-9_])(' + keys[i] + '\\.)([a-zA-Z0-9_]+)', 'g');
        } else {
            replacePrefix = ' param.';
            replacePostfix = ' ';
            paramRegex = new RegExp('(^|[^a-zA-Z0-9_])(' + keys[i] + ')($|[^a-zA-Z0-9_])', 'g');
        }
        evalString = evalString.replace(paramRegex, ('$1' + replacePrefix + '$2' + replacePostfix + '$3'));
    }
    return evalString;
}

const uniqueArray = function (a: RegExpMatchArray) {
    const seen = {};
    const out: string[] = [];
    const len = a.length;
    let j = 0;
    for (let i = 0; i < len; i++) {
        const item = a[i]!;
        if (seen[item] !== 1) {
            seen[item] = 1;
            out[j++] = item;
        }
    }
    return out;
}

const mysqlRealEscapeParam = function (param) {
    if (typeof param != 'string')
        return param;

    return param.replace(/[\0\x08\x09\x1a\n\r''\\\%]/g, function (char) {
        switch (char) {
            case '\0':
                return '\\0';
            case '\x08':
                return '\\b';
            case '\x09':
                return '\\t';
            case '\x1a':
                return '\\z';
            case '\n':
                return '\\n';
            case '\r':
                return '\\r';
            case '\'':
            case `'`:
            case '\\':
            case '%':
                return '\\' + char;
            default:
                return char;
        }
    });
}

