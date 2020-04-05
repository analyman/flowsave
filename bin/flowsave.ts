#!/usr/bin/env node
/* 
 * usage:
 *       -l    --listen=<s-addr:s-port>    listen at <s-addr:s-port>
 *       -c    --connect=<d-addr:d-port>   connect to <d-addr:d-port>
 *       -s    --send=<send-dir>           traffic send to <d-addr:d-port>
 *       -r    --recv=<recv-dir>           traffic recieve from <d-addr:d-port>
 *       -h    --help                      show this help
 */

const getopt = require('node-getopt');
import * as path from 'path';
import * as proc from 'process';
import * as fs   from 'fs';
import { ForwardServer } from 'flowsave';

function parseAddrPortPair(apPair: string): [string, number] {
    if (apPair == null) return [null, null];
    let colon_loc = apPair.lastIndexOf(":");
    let addr: string = apPair.substr(0, colon_loc);
    let port: number = parseInt(apPair.substring(colon_loc + 1));
    if (addr == null  || addr.length == 0 || port == null || isNaN(port))
        return [null, null];
    return [addr, port]
}

function prefix_path(rawpath: string): string {
    let abspath;
    if (path.isAbsolute(rawpath))
        abspath = rawpath;
    else
        abspath = path.join(proc.cwd(), rawpath);
    if (!fs.existsSync(path.dirname(abspath)))
        return null;
    if (!fs.existsSync(abspath))
        fs.mkdirSync(abspath);
    if (!fs.existsSync(abspath))
        return null;
    return abspath;
}

let __opt = getopt.create([
    ["l", "listen=<s-addr:s-port>",  "listen at <s-addr:s-port>"],
    ["c", "connect=<d-addr:d-port>", "connect to <d-addr:d-port>"],
    ["s", "send=<send-dir>",         "traffic send to <d-addr:d-port>",      "send"],
    ["r", "recv=<recv-dir>",         "traffic recieve from <d-addr:d-port>", "recv"],
    ["h", "help",                    "show this help"]
]);

let opt = __opt.bindHelp().parseSystem();
let options = opt.options;

if (options["h"] == true) {
    __opt.showHelp();
    proc.exit(0);
}

if (options["l"] == null || options["c"] == null || 
    options["s"] == null || options["r"] == null || opt.argv.length != 0) {
    __opt.showHelp();
    proc.exit(1);
}

let send_file_prefix = prefix_path(options["s"] as string);
let recv_file_prefix = prefix_path(options["r"] as string);
let [l_addr, l_port] = parseAddrPortPair(options["l"] as string);
let [c_addr, c_port] = parseAddrPortPair(options["c"] as string);

if (l_addr == null || c_addr == null || 
    send_file_prefix == null || recv_file_prefix == null) {
    __opt.showHelp();
    proc.exit(2);
}

let server = new ForwardServer(c_addr, c_port, send_file_prefix, recv_file_prefix);
server.listen(l_port, l_addr);

server.on("listening", () => {
    console.log(`listen at ${l_addr}:${l_port}`);
});
