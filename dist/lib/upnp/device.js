"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const fast_xml_parser_1 = __importDefault(require("fast-xml-parser"));
function getAllServicesDevices(device) {
    const services = [];
    const devices = [];
    function toArray(item) {
        return Array.isArray(item) ? item : [item];
    }
    function traverseServices(service) {
        if (!service)
            return;
        services.push(service);
    }
    function traverseDevices(device) {
        if (!device)
            return;
        devices.push(device);
        if (device.deviceList && device.deviceList.device) {
            toArray(device.deviceList.device).forEach(traverseDevices);
        }
        if (device.serviceList && device.serviceList.service) {
            toArray(device.serviceList.service).forEach(traverseServices);
        }
    }
    traverseDevices(device);
    return {
        services: services,
        devices: devices,
    };
}
class Device {
    constructor(url) {
        this.url = url;
        this.lastUpdate = 0;
        this.ttl = 60 * 1000;
        this.baseUrl = '';
        this.services = [
            'urn:schemas-upnp-org:service:WANIPConnection:1',
            'urn:schemas-upnp-org:service:WANIPConnection:2',
            'urn:schemas-upnp-org:service:WANPPPConnection:1',
        ];
    }
    async connectDevice() {
        if (this.device) {
            const now = Date.now();
            if (now - this.lastUpdate < this.ttl) {
                // not expire
                return this.device;
            }
        }
        const res = await fetch(this.url);
        if (res.status !== 200) {
            throw new Error('Request failed: ' + res.status);
        }
        const data = await res.text();
        const info = new fast_xml_parser_1.default.XMLParser().parse(data);
        const device = info.root.device;
        if (!device) {
            throw new Error(`Invalid router device service! ${data.toString()}`);
        }
        this.device = device;
        this.baseUrl = info.baseUrl;
        this.lastUpdate = Date.now();
        return device;
    }
    async run(action, args) {
        const info = await this._getService(this.services);
        const body = '<?xml version="1.0"?>' +
            '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
            's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
            '<s:Body>' +
            '<u:' +
            action +
            ' xmlns:u=' +
            JSON.stringify(info.service) +
            '>' +
            Object.entries(args)
                .map((args) => {
                return ('<' +
                    args[0] +
                    '>' +
                    (args[1] !== undefined ? args[1] : '') +
                    '</' +
                    args[0] +
                    '>');
            })
                .join('') +
            '</u:' +
            action +
            '>' +
            '</s:Body>' +
            '</s:Envelope>';
        const res = await fetch(info.controlURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'Content-Length': Buffer.byteLength(body).toString(),
                Connection: 'close',
                SOAPAction: JSON.stringify(info.service + '#' + action),
            },
            body,
        });
        if (res.status !== 200) {
            throw new Error('Request failed: ' + res.status);
        }
        const data = await res.text();
        const parser = new fast_xml_parser_1.default.XMLParser({
            parseAttributeValue: true,
            ignoreAttributes: false,
        });
        const parsedData = parser.parse(data);
        const parsedBody = parsedData['s:Envelope']['s:Body'];
        return parsedBody;
    }
    async _getService(types) {
        const device = await this.connectDevice();
        const { services, devices } = getAllServicesDevices(device);
        const s = services.filter((service) => types.indexOf(service.serviceType) !== -1);
        // Use the first available service
        if (s.length === 0 || !s[0].controlURL || !s[0].SCPDURL) {
            throw new Error('Service not found');
        }
        const base = new URL(this.baseUrl || this.url);
        function addPrefix(u) {
            let uri;
            try {
                uri = new URL(u);
            }
            catch (err) {
                // Is only the path of the URL
                uri = new URL(u, base.href);
            }
            uri.host = uri.host || base.host;
            uri.protocol = uri.protocol || base.protocol;
            return uri.href;
        }
        return {
            service: s[0].serviceType,
            SCPDURL: addPrefix(s[0].SCPDURL),
            controlURL: addPrefix(s[0].controlURL),
        };
    }
}
exports.Device = Device;
