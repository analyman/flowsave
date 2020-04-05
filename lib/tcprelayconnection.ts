import * as net from 'net';
import * as stream from 'stream';
import * as event from 'events';
import * as fs from 'fs';
import { ForwardServer } from './server';

import { logger, socket_ends} from './utils';

/*
 * events:
 * |> close    # object no longer valid, should be emited only once
 * |> error    # when something wrong happend, for example, the socket crash, just give up
 *   |> <Error>
 * |> connect  # successfully establish connection with server, just propagate socket event
 *   |> <Socket>
 */
export class RelayConnection extends event.EventEmitter {
    private RelayServer: ForwardServer;

    private in_socket:  net.Socket;
    private out_socket: net.Socket;

    private in_traffic_save : stream.Writable;
    private out_traffic_save: stream.Writable;

    private closed_socket: number = 0;

    public constructor (relayServer: ForwardServer, inSocket: net.Socket, 
        outAddr: string, outPort: number, in_file: string, out_file: string) //{
    {
        super();
        this.RelayServer = relayServer;
        this.in_socket = inSocket;
        this.out_socket = net.createConnection(outPort, outAddr);

        this.on("error", this.onerror);

        let fd = fs.openSync(in_file, "w");
        if (fd == null) {
            this.emit("error", new Error(`can't open file ${in_file}`));
            return;
        }
        this.in_traffic_save = fs.createWriteStream("", {fd: fd});

        fd = fs.openSync(out_file, "w");
        if (fd == null) {
            this.emit("error", new Error(`can't open file ${out_file}`));
            return;
        }
        this.out_traffic_save = fs.createWriteStream("", {fd: fd});

        this.sockets_relay_setup();
        this.sockets_error_setup();
        this.sockets_connect_setup();
        this.sockets_end_setup();

        this.filestream_error_setup();
    } //}

    private close_session(err: boolean) //{
    {
        if (!this.in_socket.writableEnded)  this.in_socket.end();
        if (!this.out_socket.writableEnded) this.out_socket.end();
        if (this.in_traffic_save  != null)  this.in_traffic_save.end();
        if (this.out_traffic_save != null)  this.out_traffic_save.end();
        logger.debug(
`close session, with incoming traffic ${socket_ends(this.in_socket)}
               and outcomming traffic ${socket_ends(this.out_socket)}`);
        this.emit("close");
    } //}
    private onerror(err: Error) //{
    {
        this.close_session(true);
    } //}

    private sockets_relay_setup() //{
    {
        let in_lock:  boolean = false;
        let out_lock: boolean = false;

        let func_write_out = () => {
            let buf: Buffer;
            while (true) {
                if (out_lock)
                    return;
                buf = this.in_socket.read();
                if (buf == null)
                    return;
                out_lock = !this.out_socket.write(buf);
                this.in_traffic_save.write(buf);
            }
        };
        this.in_socket.on("readable", () => {
            func_write_out();
        });
        this.out_socket.on("drain", () => {
            out_lock = false;
            func_write_out();
        });

        let func_write_in = () => {
            let buf: Buffer;
            while (true) {
                if (in_lock)
                    return;
                buf = this.out_socket.read();
                if (buf == null)
                    return;
                in_lock = !this.in_socket.write(buf);
                this.out_traffic_save.write(buf);
            }
        };
        this.out_socket.on("readable", () => {
            func_write_in();
        });
        this.in_socket.on("drain", () => {
            in_lock = false;
            func_write_in();
        });
    } //}
    private sockets_end_setup() //{
    {
        let hh = (socket: net.Socket) => {
            socket.end();
            this.closed_socket += 1;
            logger.debug(`send 'FIN', ${socket_ends(socket)}`);
            if (this.closed_socket == 2)
                this.close_session(false);
        };
        this. in_socket.on("end", () => hh(this.out_socket)); // forward the 'FIN' flag
        this.out_socket.on("end", () => hh(this.in_socket));
    } //}
    private sockets_error_setup() //{
    {
        let hh = (err: Error) => {
            this.emit("error", err);
        };
        this. in_socket.on("error", (err) => hh(err));
        this.out_socket.on("error", (err) => hh(err));
    } //}
    private sockets_connect_setup() //{
    {
        let hh = (socket: net.Socket) => {
            this.emit("connect", socket);
        };
        this.out_socket.on("connect", () => hh(this.out_socket));
    } //}

    private filestream_error_setup() //{
    {
        let hh = (err: Error) => this.emit("error", err);
        this. in_traffic_save.on("error", hh);
        this.out_traffic_save.on("error", hh);
    } //}
};
