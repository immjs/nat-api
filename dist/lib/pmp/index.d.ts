import dgram from 'dgram';
import { EventEmitter } from 'events';
export declare function createPmpClient(gateway: string): Promise<PmpClient>;
export interface PmpMapOptions {
    type: 'tcp' | 'udp';
    /**
     * Private port
     */
    private: number;
    /**
     * Public port
     */
    public: number;
    ttl?: number;
}
export declare class PmpClient extends EventEmitter {
    readonly gateway: string;
    readonly socket: dgram.Socket;
    private _promise;
    constructor(gateway: string, socket: dgram.Socket);
    map(opts: PmpMapOptions): Promise<void>;
    unmap(opts: PmpMapOptions): Promise<void>;
    externalIp(): Promise<void>;
    close(): void;
    /**
     * Queues a UDP request to be send to the gateway device.
     */
    private _request;
}
