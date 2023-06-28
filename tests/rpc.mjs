import { Buffer } from 'node:buffer';

let guuid = 0;

let promiseMap = new Map();

export function on_receive(obj) {
  let cb = promiseMap.get(obj._reply);
  promiseMap.delete(obj._reply);
  if (obj._error) {
    cb.ko(obj._error);
  } else {
    cb.ok(obj._result);
  }
}

export async function send(stream, method, ...args) {
  let uuid = ++guuid;
  let obj = {
    type: "weh#rpc",
    _request: uuid,
    _method: method,
    _args: args,
  };
  const buf = Buffer.allocUnsafe(4);
  const msg = JSON.stringify(obj) + "\n";
  buf.writeUInt32LE(msg.length, 0);
  stream.write(buf);
  stream.write(msg);
  return new Promise((ok, ko) => {
    promiseMap.set(uuid, {ok, ko});
  });
}

