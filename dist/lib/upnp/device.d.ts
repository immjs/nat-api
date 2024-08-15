export interface ServiceInfo {
    serviceType: string;
    serviceId: string;
    SCPDURL: string;
    controlURL: string;
    eventSubURL: string;
}
export interface DeviceInfo {
    deviceType: string;
    friendlyName: string;
    manufacturer: string;
    manufacturerURL: string;
    modelDescription: string;
    modelName: string;
    modelURL: string;
    serialNumber: string;
    UDN: string;
    serviceList: {
        service?: ServiceInfo | ServiceInfo[];
    };
    deviceList: {
        device?: DeviceInfo | DeviceInfo[];
    };
}
export declare class Device {
    readonly url: string;
    services: string[];
    private device?;
    private lastUpdate;
    private ttl;
    private baseUrl;
    constructor(url: string);
    connectDevice(): Promise<DeviceInfo>;
    run(action: string, args: Record<string, number | string | undefined>): Promise<any>;
    private _getService;
}
