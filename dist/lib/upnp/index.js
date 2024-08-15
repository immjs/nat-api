"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpnpClient = exports.ERROR_GATEWAY_NOTFOUND = exports.Device = exports.Ssdp = exports.createSsdp = void 0;
exports.createUpnpClient = createUpnpClient;
const device_1 = require("./device");
Object.defineProperty(exports, "Device", { enumerable: true, get: function () { return device_1.Device; } });
const ssdp_1 = require("./ssdp");
Object.defineProperty(exports, "createSsdp", { enumerable: true, get: function () { return ssdp_1.createSsdp; } });
Object.defineProperty(exports, "Ssdp", { enumerable: true, get: function () { return ssdp_1.Ssdp; } });
async function createUpnpClient(options = {}) {
    const ssdp = await (0, ssdp_1.createSsdp)(options);
    const client = new UpnpClient(ssdp);
    return client;
}
exports.ERROR_GATEWAY_NOTFOUND = 'GatewayNotFound';
function normalize(option) {
    if (!option)
        return {};
    if (typeof option === 'string') {
        if (!Number.isNaN(option)) {
            return { port: Number(option) };
        }
        return {};
    }
    if (typeof option === 'number') {
        return { port: option };
    }
    return option;
}
class UpnpClient {
    constructor(ssdp) {
        this.ssdp = ssdp;
        this.timeout = 1800;
        this._destroyed = false;
    }
    async map(options) {
        if (this._destroyed)
            throw new Error('client is destroyed');
        const { device, address } = await this.findGateway();
        const remote = normalize(options.public);
        const remotePort = remote.port;
        if (remotePort === undefined) {
            throw new Error(`The options.public should assign the port of the port to expose!`);
        }
        const internal = normalize(options.private);
        const internalPort = internal.port ?? remotePort;
        const description = options.description || 'node:nat:upnp';
        const protocol = options.protocol ? options.protocol.toUpperCase() : 'TCP';
        let ttl = 60 * 30;
        if (typeof options.ttl === 'number')
            ttl = options.ttl;
        if (typeof options.ttl === 'string' && !isNaN(options.ttl))
            ttl = Number(options.ttl);
        await device.run('AddPortMapping', {
            NewRemoteHost: remote.host,
            NewExternalPort: remotePort,
            NewProtocol: protocol,
            NewInternalPort: internalPort,
            NewInternalClient: internal.host || address.address,
            NewEnabled: 1,
            NewPortMappingDescription: description,
            NewLeaseDuration: ttl,
        });
    }
    async unmap(options) {
        if (this._destroyed)
            throw new Error('client is destroyed');
        const { device } = await this.findGateway();
        const remote = normalize(options.public);
        const remotePort = remote.port;
        if (!remotePort) {
            throw new Error(`Cannot unmap the port undefined!`);
        }
        const protocol = options.protocol ? options.protocol.toUpperCase() : 'TCP';
        await device.run('DeletePortMapping', {
            NewRemoteHost: remote.host,
            NewExternalPort: remotePort,
            NewProtocol: protocol,
        });
    }
    async getMappings(options = {}) {
        if (this._destroyed)
            throw new Error('client is destroyed');
        const { device, address } = await this.findGateway();
        let results = [];
        for (let i = 0, end = false; !end; i++) {
            try {
                let entries = await device.run('GetGenericPortMappingEntry', {
                    NewPortMappingIndex: i,
                });
                const key = Object.keys(entries).find((k) => /:GetGenericPortMappingEntryResponse/.test(k));
                if (!key)
                    throw new Error('Incorrect response');
                const data = entries[key];
                const publicHost = (typeof data.NewRemoteHost === 'string' &&
                    (data.NewRemoteHost || '')) ||
                    undefined;
                const result = {
                    public: {
                        host: publicHost,
                        port: parseInt(data.NewExternalPort, 10),
                    },
                    private: {
                        host: data.NewInternalClient,
                        port: parseInt(data.NewInternalPort, 10),
                    },
                    protocol: data.NewProtocol.toLowerCase(),
                    enabled: data.NewEnabled === '1',
                    description: data.NewPortMappingDescription,
                    ttl: parseInt(data.NewLeaseDuration, 10),
                    local: publicHost === address,
                };
                results.push(result);
            }
            catch (e) {
                if (e) {
                    // If we got an error on index 0, ignore it in case this router starts indicies on 1
                    if (i !== 1)
                        end = true;
                }
            }
        }
        if (options.local) {
            results = results.filter((item) => item.local);
        }
        if (options.description) {
            const description = options.description;
            results = results.filter((item) => {
                if (typeof item.description !== 'string')
                    return false;
                if (description instanceof RegExp) {
                    return item.description.match(description) !== null;
                }
                else {
                    return item.description.indexOf(description) !== -1;
                }
            });
        }
        return results;
    }
    async externalIp() {
        if (this._destroyed)
            throw new Error('client is destroyed');
        const { device } = await this.findGateway();
        const data = await device.run('GetExternalIPAddress', {});
        let key = null;
        Object.keys(data).some(function (k) {
            if (!/:GetExternalIPAddressResponse$/.test(k))
                return false;
            key = k;
            return true;
        });
        if (!key)
            throw new Error('Incorrect response');
        return data[key].NewExternalIPAddress;
    }
    async findGateway() {
        if (this._destroyed)
            throw new Error('client is destroyed');
        const p = this.ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(function () {
                reject(Object.assign(new Error('Fail to find gateway. Maybe your router does not support upnp!'), { error: exports.ERROR_GATEWAY_NOTFOUND }));
            }, this.timeout);
            p.then(({ info, address }) => {
                resolve({ address, device: new device_1.Device(info.location) });
            }, reject).finally(() => {
                clearTimeout(timeout);
            });
        });
    }
    destroy() {
        this._destroyed = true;
        this.ssdp.destroy();
    }
}
exports.UpnpClient = UpnpClient;
