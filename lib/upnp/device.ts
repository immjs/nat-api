import fxparser from 'fast-xml-parser'
import http, { IncomingMessage } from 'http'
import url from 'url'

async function request(options: { method: string, url: string, headers?: Record<string, string | number>, body?: string }): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    http.request({ method: options.method, ...url.parse(options.url), headers: options.headers }, (res) => {
      resolve(res)
    }).on('error', reject)
      .end(options.body)
  })
}

async function getBody(res: IncomingMessage) {
  let result: Buffer[] = []
  res.on('data', (buf) => {
    result.push(buf)
  })
  return new Promise<Buffer>((resolve, reject) => {
    res.on('error', reject)
    res.on('end', () => { resolve(Buffer.concat(result)) })
  })
}

export interface ServiceInfo {
  serviceType: string
  serviceId: string
  SCPDURL: string
  controlURL: string
  eventSubURL: string
}

export interface DeviceInfo {
  deviceType: string
  friendlyName: string
  manufacturer: string
  manufacturerURL: string
  modelDescription: string
  modelName: string
  modelURL: string
  serialNumber: string
  UDN: string
  serviceList: {
    service?: ServiceInfo | ServiceInfo[]
  }
  deviceList: {
    device?: DeviceInfo | DeviceInfo[]
  }
}

function getAllServicesDevices(device: DeviceInfo) {
  const services: any[] = []
  const devices: any[] = []

  function toArray<T>(item: T | T[]): T[] {
    return Array.isArray(item) ? item : [item]
  }

  function traverseServices(service: ServiceInfo) {
    if (!service) return
    services.push(service)
  }

  function traverseDevices(device: DeviceInfo) {
    if (!device) return
    devices.push(device)

    if (device.deviceList && device.deviceList.device) {
      toArray(device.deviceList.device).forEach(traverseDevices)
    }

    if (device.serviceList && device.serviceList.service) {
      toArray(device.serviceList.service).forEach(traverseServices)
    }
  }

  traverseDevices(device)

  return {
    services: services,
    devices: devices
  }
}


export class Device {
  services: string[]

  private device?: DeviceInfo
  private lastUpdate: number = 0
  private ttl: number = 60 * 1000
  private baseUrl: string = ''

  constructor(readonly url: string) {
    this.services = [
      'urn:schemas-upnp-org:service:WANIPConnection:1',
      'urn:schemas-upnp-org:service:WANIPConnection:2',
      'urn:schemas-upnp-org:service:WANPPPConnection:1'
    ]
  }

  async connectDevice() {
    if (this.device) {
      const now = Date.now()
      if (now - this.lastUpdate < this.ttl) {
        // not expire
        return this.device
      }
    }

    const res = await request({ method: 'GET', url: this.url })
    if (res.statusCode !== 200) {
      throw new Error('Request failed: ' + res.statusCode)
    }

    const data = await getBody(res)

    const info = new fxparser.XMLParser().parse(data)

    const device = info.root.device as DeviceInfo

    if (!device) {
      throw new Error(`Invalid router device service! ${data.toString()}`)
    }

    this.device = device
    this.baseUrl = info.baseUrl
    this.lastUpdate = Date.now()

    return device
  }

  async run(action: string, args: Record<string, number | string | undefined>): Promise<any> {
    const info = await this._getService(this.services)

    const body = '<?xml version="1.0"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
      's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
      '<s:Body>' +
      '<u:' + action + ' xmlns:u=' + JSON.stringify(info.service) + '>' +
      Object.entries(args).map((args) => {
        return '<' + args[0] + '>' +
          (args[1] !== undefined ? args[1] : '') +
          '</' + args[0] + '>'
      }).join('') +
      '</u:' + action + '>' +
      '</s:Body>' +
      '</s:Envelope>'
    const res = await request({
      method: 'POST',
      url: info.controlURL,
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        'Content-Length': Buffer.byteLength(body),
        Connection: 'close',
        SOAPAction: JSON.stringify(info.service + '#' + action)
      },
      body,
    })

    if (res.statusCode !== 200) {
      throw new Error('Request failed: ' + res.statusCode)
    }

    const data = await getBody(res)
    const parser = new fxparser.XMLParser({ parseAttributeValue: true, ignoreAttributes: false })

    const parsedData = parser.parse(data)

    const parsedBody = parsedData['s:Envelope']['s:Body']

    return parsedBody
  }

  private async _getService(types: string[]) {
    const device = await this.connectDevice()
    const { services, devices } = getAllServicesDevices(device)
    const s = services.filter((service) => types.indexOf(service.serviceType) !== -1)

    // Use the first available service
    if (s.length === 0 || !s[0].controlURL || !s[0].SCPDURL) {
      throw new Error('Service not found')
    }

    const base = new URL(this.baseUrl || this.url)
    function addPrefix(u: string) {
      let uri
      try {
        uri = new URL(u)
      } catch (err) {
        // Is only the path of the URL
        uri = new URL(u, base.href)
      }

      uri.host = uri.host || base.host
      uri.protocol = uri.protocol || base.protocol

      return url.format(uri)
    }

    return {
      service: s[0].serviceType,
      SCPDURL: addPrefix(s[0].SCPDURL),
      controlURL: addPrefix(s[0].controlURL)
    }
  }
}

