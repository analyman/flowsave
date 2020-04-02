import * as winston from 'winston';
import * as proc from 'process';
import { join } from 'path';
import { Socket } from 'net';

export const logger = winston.createLogger({
    level: "debug",
    defaultMeta: {application: "tcprelay"},
    transports: [
        new winston.transports.File({filename: join(proc.cwd(), "tcprelay.log")})
    ]
});

export function socket_ends(socket: Socket): string {
    return socket.localAddress  + ":" + (socket.localPort  || "??").toString() + " <-> " +
           socket.remoteAddress + ":" + (socket.remotePort || "??").toString();
}
