"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PmpClient = void 0;
exports.createPmpClient = createPmpClient;
const dgram_1 = __importDefault(require("dgram"));
// const assert = require('assert')
// const debug = require('debug')('nat-pmp')
const events_1 = require("events");
// Ports defined by draft
const CLIENT_PORT = 5350;
const SERVER_PORT = 5351;
// Opcodes
const OP_EXTERNAL_IP = 0;
const OP_MAP_UDP = 1;
const OP_MAP_TCP = 2;
const SERVER_DELTA = 128;
// Resulit codes
const RESULT_CODES = {
    0: 'Success',
    1: 'Unsupported Version',
    2: 'Not Authorized/Refused (gateway may have NAT-PMP disabled)',
    3: 'Network Failure (gateway may have not obtained a DHCP lease)',
    4: 'Out of Resources (no ports left)',
    5: 'Unsupported opcode',
};
async function createPmpClient(gateway) {
    const socket = dgram_1.default.createSocket({ type: 'udp4', reuseAddr: true });
    socket.bind(CLIENT_PORT);
    await new Promise((resolve, reject) => {
        socket.on('listening', resolve);
        socket.on('error', reject);
    });
    const client = new PmpClient(gateway, socket);
    return client;
}
class PmpClient extends events_1.EventEmitter {
    constructor(gateway, socket) {
        super();
        this.gateway = gateway;
        this.socket = socket;
        this._promise = Promise.resolve();
    }
    map(opts) {
        // debug('Client#portMapping()')
        let opcode;
        switch (String(opts.type || 'tcp').toLowerCase()) {
            case 'tcp':
                opcode = OP_MAP_TCP;
                break;
            case 'udp':
                opcode = OP_MAP_UDP;
                break;
            default:
                throw new Error('"type" must be either "tcp" or "udp"');
        }
        return this._request(opcode, opts);
    }
    unmap(opts) {
        // debug('Client#portUnmapping()')
        opts.ttl = 0;
        return this.map(opts);
    }
    externalIp() {
        // debug('Client#externalIp()')
        return this._request(OP_EXTERNAL_IP);
    }
    close() {
        if (this.socket) {
            this.socket.close();
        }
    }
    /**
     * Queues a UDP request to be send to the gateway device.
     */
    _request(op, obj) {
        // debug('Client#request()', [op, obj])
        let buf;
        let size;
        let pos = 0;
        let internal;
        let external;
        let ttl;
        switch (op) {
            case OP_MAP_UDP:
            case OP_MAP_TCP:
                if (!obj)
                    throw new Error('mapping a port requires an "options" object');
                internal = +(obj.private || 0);
                if (internal !== (internal | 0) || internal < 0) {
                    throw new Error('the "private" port must be a whole integer >= 0');
                }
                external = +(obj.public || 0);
                if (external !== (external | 0) || external < 0) {
                    throw new Error('the "public" port must be a whole integer >= 0');
                }
                if (obj.ttl === undefined)
                    obj.ttl = 7200;
                ttl = +obj.ttl;
                if (ttl !== (ttl | 0)) {
                    // The RECOMMENDED Port Mapping Lifetime is 7200 seconds (two hours)
                    ttl = 7200;
                }
                size = 12;
                buf = Buffer.alloc(size);
                buf.writeUInt8(0, pos);
                pos++; // Vers = 0
                buf.writeUInt8(op, pos);
                pos++; // OP = x
                buf.writeUInt16BE(0, pos);
                pos += 2; // Reserved (MUST be zero)
                buf.writeUInt16BE(internal, pos);
                pos += 2; // Internal Port
                buf.writeUInt16BE(external, pos);
                pos += 2; // Requested External Port
                buf.writeUInt32BE(ttl, pos);
                pos += 4; // Requested Port Mapping Lifetime in Seconds
                break;
            case OP_EXTERNAL_IP:
                size = 2;
                buf = Buffer.alloc(size);
                // Vers = 0
                buf.writeUInt8(0, 0);
                pos++;
                // OP = x
                buf.writeUInt8(op, 1);
                pos++;
                break;
            default:
                throw new Error('Invalid opcode: ' + op);
        }
        // assert.equal(pos, size, 'buffer not fully written!')
        const promise = new Promise((resolve, reject) => {
            this.socket.once('error', (err) => {
                reject(err);
                if (this.socket) {
                    this.socket.close();
                }
            });
            this.socket.once('message', (msg, rinfo) => {
                const parsed = { msg: msg };
                const vers = msg.readUInt8(0);
                const parsedOp = msg.readUInt8(1);
                if (parsedOp - SERVER_DELTA !== op) {
                    // debug('WARN: ignoring unexpected message opcode', parsedOp)
                    return;
                }
                // if we got here, then we're gonna invoke the request's callback,
                // so shift this request off of the queue.
                // debug('removing "req" off of the queue')
                if (vers !== 0) {
                    reject(new Error('"vers" must be 0. Got: ' + vers));
                    return;
                }
                // Xommon fields
                const resultCode = msg.readUInt16BE(2);
                const resultMessage = RESULT_CODES[resultCode];
                const epoch = msg.readUInt32BE(4);
                // Error
                if (resultCode !== 0) {
                    const err = new Error(resultMessage);
                    Object.assign(err, { code: resultCode });
                    reject(err);
                }
                else {
                    switch (op) {
                        case OP_MAP_UDP:
                        case OP_MAP_TCP:
                            parsed.private = msg.readUInt16BE(8);
                            parsed.public = msg.readUInt16BE(10);
                            parsed.ttl = msg.readUInt32BE(12);
                            parsed.type = op === OP_MAP_UDP ? 'udp' : 'tcp';
                            resolve({ ...parsed, resultCode, resultMessage, epoch });
                            break;
                        case OP_EXTERNAL_IP:
                            parsed.ip = [];
                            parsed.ip.push(msg.readUInt8(8));
                            parsed.ip.push(msg.readUInt8(9));
                            parsed.ip.push(msg.readUInt8(10));
                            parsed.ip.push(msg.readUInt8(11));
                            resolve({ ...parsed, resultCode, resultMessage, epoch });
                            break;
                        default:
                            reject(new Error('Unknown opcode: ' + op));
                    }
                }
            });
            this.socket.send(buf, 0, buf.length, SERVER_PORT, this.gateway);
        });
        this._promise = this._promise.finally(() => promise);
        return promise;
    }
}
exports.PmpClient = PmpClient;
