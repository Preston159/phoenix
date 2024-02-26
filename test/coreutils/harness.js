/*
 * Copyright (C) 2024  Puter Technologies Inc.
 *
 * This file is part of Phoenix Shell.
 *
 * Phoenix Shell is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { Context } from "contextlink";

export class WritableStringStream extends WritableStream {
    constructor() {
        super({
            write: (chunk) => {
                if (this.output_ === undefined)
                    this.output_ = "";
                this.output_ += chunk;
            }
        });
    }

    write(chunk) {
        if (!this.writer_)
            this.writer_ = this.getWriter();
        return this.writer_.write(chunk);
    }

    get output() { return this.output_ || ""; }
}

// TODO: Flesh this out as needed.
export const MakeTestContext = (command, { positionals = [],  values = {}, stdinInputs = [], env = {} }) => {
    return new Context({
        cmdExecState: { valid: true },
        externs: new Context({
            in_: new ReadableStream(stdinInputs).getReader(),
            out: new WritableStringStream(),
            err: new WritableStringStream(),
            sig: null,
        }),
        locals: new Context({
            args: [],
            command,
            positionals,
            values,
        }),
        platform: new Context({}),
        plugins: new Context({}),
        registries: new Context({}),
        env: env,
    });
}