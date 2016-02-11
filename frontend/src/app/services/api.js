import { rpc, Client } from 'nb-api';
import { hostname, port } from 'server-conf';

rpc.base_address = `ws://${
        hostname || window.location.hostname
    }:${
        port || window.location.port
    }`;

rpc.set_reply_logger(
    (...args) => console.info(...args)
);

export default Object.assign(new Client(), { rpc });
