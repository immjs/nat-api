import defaultGateWay from 'default-gateway';
import { networkInterfaces } from 'os';
import { test } from 'uvu';
// import assert from 'uvu/assert'
import { createPmpClient } from '../lib/pmp';

test('pmp', async () => {
  const interfaces = networkInterfaces();
  console.log(interfaces);
  const gateway = await defaultGateWay.v4();
  console.log(gateway);

  const client = await createPmpClient(gateway.gateway);
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
