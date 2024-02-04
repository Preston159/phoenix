import builtins from './coreutils/__exports__';
import { XDocumentPTT } from "../XDocumentPTT";
import { XDocumentPuterShell } from "./XDocumentPuterShell";
import ReadlineLib from "../ansi-shell/readline/readline";

import command_registry from './coreutils/__exports__';

// TODO: auto-gen argument parser registry from files
import SimpleArgParser from "../ansi-shell/arg-parsers/simple-parser";
import { ANSIShell } from "../ansi-shell/ANSIShell";
import { HiTIDE } from "hitide";
import { Context } from "contextlink";
import { SHELL_VERSIONS } from "../meta/versions";
import { PuterShellParser } from "../ansi-shell/parsing/PuterShellParser";
import { BuiltinCommandProvider } from "./providers/BuiltinCommandProvider";
import { CreateChatHistoryPlugin } from './plugins/ChatHistoryPlugin';

const argparser_registry = {
    [SimpleArgParser.name]: SimpleArgParser
};

export const launchPuterShell = async () => {
    const hitide = new HiTIDE();

    const ptt = new XDocumentPTT();
    const config = {};

    const puterShell = new XDocumentPuterShell({
        source: __CONFIG__['shell.href']
    });

    let resolveConfigured = null;
    const configured_ = new Promise(rslv => {
        resolveConfigured = rslv;
    });
    window.addEventListener('message', evt => {
        if ( evt.source !== window.parent ) return;
        if ( evt.data instanceof Uint8Array ) {
            return;
        }
        if ( ! evt.data.hasOwnProperty('$') ) {
            console.error(`unrecognized window message`, evt);
            return;
        }
        if ( evt.data.$ !== 'config' ) return;

        console.log('received configuration at ANSI shell');
        const configValues = { ...evt.data };
        delete configValues.$;
        for ( const k in configValues ) {
            config[k] = configValues[k];
        }
        puterShell.configure(config);
        resolveConfigured();
    });

    // let readyQueue = Promise.resolve();
    let readyQueue = Promise.resolve();

    // === Setup Puter Shell Iframe ===
    {
        const iframe = document.createElement('iframe');
        const xdEl = document.getElementById('cross-document-container');

        readyQueue = readyQueue.then(() => new Promise(rslv => {
            puterShell.addEventListener('ready', rslv)
        }));

        xdEl.appendChild(iframe);
        puterShell.attachToIframe(iframe);
    }

    const readline = ReadlineLib.create({
        in: ptt.in,
        out: ptt.out
    });

    await readyQueue;

    console.log('the adapter is saying ready');
    window.parent.postMessage({ $: 'ready' }, '*');
    console.log('the adapter said ready');

    await configured_;

    const sdkv2 = globalThis.puter;
    await sdkv2.setAuthToken(config['puter.auth.token']);
    const source_without_trailing_slash =
        (config.source && config.source.replace(/\/$/, ''))
        || 'https://api.puter.com';
    await sdkv2.setAPIOrigin(source_without_trailing_slash);

    const commandProvider = new BuiltinCommandProvider();

    const ctx = new Context({
        externs: new Context({
            config, puterShell,
            readline: readline.readline.bind(readline),
            in: ptt.in,
            out: ptt.out,
            parser: new PuterShellParser(),
            commandProvider,
            sdkv2,
            historyManager: readline.history,
        }),
        registries: new Context({
            argparsers: argparser_registry,
            // While we use the BuiltinCommandProvider to provide the
            // functionality of command lookup, we still need a registry
            // of builtins to support the `help` command.
            builtins,
        }),
        plugins: new Context(),
        locals: new Context(),
    });

    {
        const name = "chatHistory";
        const p = CreateChatHistoryPlugin(ctx);
        ctx.plugins[name] = new Context(p.expose);
        p.init();
    }

    const ansiShell = new ANSIShell(ctx);

    // TODO: move ioctl to PTY
    window.addEventListener('message', evt => {
        if ( evt.source !== window.parent ) return;
        if ( evt.data instanceof Uint8Array ) {
            return;
        }
        if ( ! evt.data.hasOwnProperty('$') ) {
            console.error(`unrecognized window message`, evt);
            return;
        }
        if ( evt.data.$ !== 'ioctl.set' ) return;
        
        
        ansiShell.dispatchEvent(new CustomEvent('signal.window-resize', {
            detail: {
                ...evt.data.windowSize
            }
        }))
    });

    ctx.externs.out.write(
        `\x1B[35;1mPuter Shell\x1B[0m [v${SHELL_VERSIONS[0].v}]\n` +
        `⛷  try typing \x1B[34;1mhelp\x1B[0m or ` +
        `\x1B[34;1mchangelog\x1B[0m to get started.\n`
    );

    if ( ! config.hasOwnProperty('puter.auth.token') ) {
        ctx.externs.out.write('\n');
        ctx.externs.out.write(
            `\x1B[33;1m⚠\x1B[0m` +
            `\x1B[31;1m` +
            ' You are not running this terminal or shell within puter.com\n' +
            `\x1B[0m` +
            'Use of the shell outside of puter.com is still experimental. You \n' +
            'will experience incomplete features and bugs.\n' +
            ''
        );
    }

    ctx.externs.out.write('\n');

    for ( ;; ) {
        await ansiShell.doPromptIteration();
    }
};
