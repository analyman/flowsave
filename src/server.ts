/* nodejs tcp forward */

import * as net   from 'net';
import * as event from 'events';

import { RelayConnection } from './tcprelayconnection';
import { logger } from './utils';
import { join } from 'path';

/*
 * events
 * |> error
 * |> close
 * |> connection
 * |> listening
 */
export class ForwardServer extends event.EventEmitter {
    private d_server: string;
    private d_port:   number;
    private connection_count: number = 0;
    private connection_error_count: number = 0;
    private connection_close_count: number = 0;
    private tcp_server: net.Server;

    private l_addr: string = null;
    private l_port: number = null;

    private in_directory:  string;
    private out_directory: string;

    public constructor(server_addr: string, server_port: number, in_directory: string, out_directory: string) //{
    {
        super();
        logger.info("new tcp relay server");
        this.d_server        = server_addr;
        this.d_port          = server_port;
        this.in_directory  = in_directory;
        this.out_directory = out_directory;

        this.tcp_server = new net.Server();
        this.tcp_server.on("connection", socket => this.emit("connection", socket));
        this.tcp_server.on("error", err => this.emit("error", err));
        this.tcp_server.on("listening", () => this.emit("listening"));

        this.on("connection", this.onconnection);
        this.on("error",      this.onerror);
        this.on("listening", () => {
            let msg = `listen at ${this.l_addr}:${this.l_port}\nforward message to ${this.d_server}:${this.d_port}`;
            logger.info(msg);
        });
    } //}

    private onconnection(socket: net.Socket) //{
    {
        logger.info(`Accept connection from ${socket.remoteAddress}:${socket.remotePort}`);
        let biconnection = new RelayConnection(this, socket, this.d_server, this.d_port, 
            join(this.in_directory,  this.connection_count.toString()), 
            join(this.out_directory, this.connection_count.toString()));
        biconnection.on("error", this.on_session_error.bind(this));
        biconnection.on("close", this.on_session_close.bind(this));
        biconnection.on("connect", this.on_session_connect.bind(this));
        this.connection_count += 1;
    } //}
    private onerror(err: Error) //{
    {
        if ((err as any).code === 'EADDRINUSE') {
            logger.warn(`address ${this.l_addr}:${this.l_port} in use, retrying`);
            this.listen(this.l_port, this.l_addr);
        }
        logger.error(`listen to ${this.l_addr}:${this.l_port} fail`);
    } //}

    private on_session_error(err: Error) //{
    {
        this.connection_error_count += 1;
        logger.warn(`${err.toString()}`);
    } //}
    private on_session_close(err: boolean) //{
    {
        this.connection_close_count += 1;
        logger.info("session closed");
    } //}
    private on_session_connect(socket: net.Socket) //{
    {
        logger.info(`socket <${socket.localAddress}:${socket.localPort} <-> ` + 
                     `${socket.remoteAddress}:${socket.remotePort}> established`);
    } //}

    public listen(port: number, addr: string) //{
    {
        this.l_port = port;
        this.l_addr = addr;
        this.tcp_server.listen(port, addr);
    } //}
    public close(callback: (err: Error) => void) //{
    {
        this.tcp_server.close(callback);
    } //}
};
