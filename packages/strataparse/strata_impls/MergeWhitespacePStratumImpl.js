const decoder = new TextDecoder();

export class MergeWhitespacePStratumImpl {
    static meta = {
        inputs: 'node',
        outputs: 'node',
    }
    constructor (tabWidth) {
        this.tabWidth = tabWidth ?? 1;
        this.line = 0;
        this.col = 0;
    }
    countChar (c) {
        if ( c === '\n' ) {
            this.line++;
            this.col = 0;
            return;
        }
        if ( c === '\t' ) {
            this.col += this.tabWidth;
            return;
        }
        if ( c === '\r' ) return;
        this.col++;
    }
    next (api) {
        const lexer = api.delegate;

        for ( ;; ) {
            const { value, done } = lexer.next();
            if ( done ) return { value, done };
            
            if ( value.$ === 'whitespace' ) {
                for ( const c of value.text ) {
                    this.countChar(c);
                }
                continue;
            }

            value.$cst = {
                ...(value.$cst ?? {}),
                line: this.line,
                col: this.col,
            };
            
            if ( value.hasOwnProperty('$source') ) {
                let source = value.$source;
                if ( source instanceof Uint8Array ) {
                    source = decoder.decode(source);
                }
                for ( let c of source ) {
                    this.countChar(c);
                }
            } else {
                console.warn('source missing; can\'t count position');
            }

            return { value, done: false };
        }
    }
}
