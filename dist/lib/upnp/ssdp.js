"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ssdp = void 0;
exports.createSsdp = createSsdp;
const dgram_1 = __importDefault(require("dgram"));
const events_1 = require("events");
const os_1 = __importDefault(require("os"));
const MULTICAST_IP_ADDRESS = '239.255.255.250';
const MULTICAST_PORT = 1900;
async function createSsdp(options = {}) {
    // Create sockets on all external interfaces
    const interfaces = os_1.default.networkInterfaces();
    const sourcePort = options.sourcePort ?? 0;
    function createSocket(interf) {
        let socket = dgram_1.default.createSocket(interf.family === 'IPv4' ? 'udp4' : 'udp6');
        return new Promise((resolve, reject) => {
            socket.on('listening', () => {
                resolve(socket);
            });
            socket.on('error', (e) => {
                // Ignore errors
                if (socket) {
                    socket.close();
                    // Force trigger onClose() - 'close()' does not guarantee to emit 'close'
                }
                throw e;
            });
            // socket.address = interf.address
            socket.bind(sourcePort, interf.address);
        });
    }
    const socket = await Promise.any(Object.entries(interfaces)
        .flatMap(([iface, infos]) => infos
        ?.filter((info) => !info.internal && (!options.interface || iface === options.interface))
        .map((item) => createSocket(item)) || []));
    return new Ssdp(sourcePort, socket);
}
class Ssdp extends events_1.EventEmitter {
    constructor(sourcePort, socket) {
        super();
        this.sourcePort = sourcePort;
        this.socket = socket;
        this.multicast = MULTICAST_IP_ADDRESS;
        this.port = MULTICAST_PORT;
        this._destroyed = false;
        this.socket = socket;
        socket.on('message', (message, info) => {
            // Ignore messages after closing sockets
            if (this._destroyed)
                return;
            // Parse response
            this._parseResponse(message.toString(), socket.address(), info);
        });
    }
    search(device) {
        if (this._destroyed)
            throw new Error('client is destroyed');
        return new Promise((resolve, reject) => {
            const query = Buffer.from('M-SEARCH * HTTP/1.1\r\n' +
                'HOST: ' +
                this.multicast +
                ':' +
                this.port +
                '\r\n' +
                'MAN: "ssdp:discover"\r\n' +
                'MX: 1\r\n' +
                'ST: ' +
                device +
                '\r\n' +
                '\r\n');
            // Send query on each socket
            this.socket.send(query, 0, query.length, this.port, this.multicast);
            const onDevice = (info, address) => {
                if (info.st !== device)
                    return;
                this.removeListener('_device', onDevice);
                resolve({
                    info,
                    address,
                });
            };
            this.on('_device', onDevice);
        });
    }
    // TODO create separate logic for parsing unsolicited upnp broadcasts,
    // if and when that need arises
    _parseResponse(response, addr, remote) {
        if (this._destroyed)
            return;
        // Ignore incorrect packets
        if (!/^(HTTP|NOTIFY)/m.test(response))
            return;
        const headers = this._parseMimeHeader(response);
        // Messages that match the original search target
        if (!headers.st)
            return;
        this.emit('_device', headers, addr);
    }
    _parseMimeHeader(headerStr) {
        const lines = headerStr.split(/\r\n/g);
        // Parse headers from lines to hashmap
        return lines.reduce((headers, line) => {
            line.replace(/^([^:]*)\s*:\s*(.*)$/, (a, key, value) => {
                headers[key.toLowerCase()] = value;
                return a;
            });
            return headers;
        }, {});
    }
    destroy() {
        this._destroyed = true;
        this.socket.close();
    }
}
exports.Ssdp = Ssdp;
