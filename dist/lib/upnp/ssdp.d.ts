import dgram from 'dgram';
import { EventEmitter } from 'events';
import { AddressInfo } from 'net';
export interface SsdpSearchResult {
    info: Record<string, string>;
    address: AddressInfo;
}
export declare function createSsdp(options?: {
    sourcePort?: number;
    interface?: string;
}): Promise<Ssdp>;
export declare class Ssdp extends EventEmitter {
    readonly sourcePort: number;
    readonly socket: dgram.Socket;
    readonly multicast: string;
    readonly port: number;
    private _destroyed;
    constructor(sourcePort: number, socket: dgram.Socket);
    search(device: string): Promise<SsdpSearchResult>;
    private _parseResponse;
    private _parseMimeHeader;
    destroy(): void;
}
