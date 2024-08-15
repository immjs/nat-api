import { AddressInfo } from 'net';
import { Device } from './device';
import { createSsdp, Ssdp } from './ssdp';
export { createSsdp, Ssdp, Device, AddressInfo };
export declare function createUpnpClient(options?: {
    sourcePort?: number;
    interface?: string;
}): Promise<UpnpClient>;
export declare const ERROR_GATEWAY_NOTFOUND = "GatewayNotFound";
export interface GetMappingOptions {
    local?: boolean;
    description?: string | RegExp;
}
export interface Address {
    host?: string;
    port: number;
}
export interface UpnpMapOptions {
    description?: string;
    protocol?: 'tcp' | 'udp';
    public: Address | number | string;
    private?: Address | number | string;
    /**
     * Time to live in seconds
     */
    ttl?: number;
}
export interface UpnpUnmapOptions {
    protocol?: 'tcp' | 'udp';
    public: Address | number | string;
}
export interface MappingInfo {
    public: Address;
    private: Required<Address>;
    protocol: 'tcp' | 'udp';
    enabled: boolean;
    description: string;
    ttl: number;
    local: boolean;
}
export declare class UpnpClient {
    private ssdp;
    readonly timeout: number;
    private _destroyed;
    constructor(ssdp: Ssdp);
    map(options: UpnpMapOptions): Promise<void>;
    unmap(options: UpnpUnmapOptions): Promise<void>;
    getMappings(options?: GetMappingOptions): Promise<MappingInfo[]>;
    externalIp(): Promise<string>;
    findGateway(): Promise<{
        device: Device;
        address: AddressInfo;
    }>;
    destroy(): void;
}
