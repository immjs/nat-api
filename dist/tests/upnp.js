"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uvu_1 = require("uvu");
const assert_1 = __importDefault(require("uvu/assert"));
const upnp_1 = require("../lib/upnp");
(0, uvu_1.test)('upnp', async () => {
    const client = await (0, upnp_1.createUpnpClient)();
    const mappings = await client.getMappings();
    assert_1.default.ok(mappings);
    console.log(mappings);
    client.destroy();
});
(0, uvu_1.test)('upnp - external ip', async () => {
    const client = await (0, upnp_1.createUpnpClient)();
    const ip = await client.externalIp();
    assert_1.default.ok(ip);
    // console.log(ip)
    client.destroy();
});
uvu_1.test.run();
