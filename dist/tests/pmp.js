"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const default_gateway_1 = __importDefault(require("default-gateway"));
const os_1 = require("os");
const uvu_1 = require("uvu");
// import assert from 'uvu/assert'
const pmp_1 = require("../lib/pmp");
(0, uvu_1.test)('pmp', async () => {
    const interfaces = (0, os_1.networkInterfaces)();
    console.log(interfaces);
    const gateway = await default_gateway_1.default.gateway4async();
    console.log(gateway);
    const client = await (0, pmp_1.createPmpClient)(gateway.gateway);
    const result = await client.map({
        type: 'tcp',
        private: 25565,
        public: 25565,
        ttl: 60 * 1000,
    });
    console.log(result);
    await client.unmap({ type: 'tcp', private: 25565, public: 25565 });
    client.close();
});
