import NodeCache from "node-cache";
import { nanoid } from 'nanoid';

import { sha256 } from "../sub/crypto.js";
import { streamLifespan } from "../config.js";

const streamCache = new NodeCache({ stdTTL: streamLifespan/1000, checkperiod: 10, deleteOnExpire: true });
const salt = process.env.streamSalt;

streamCache.on("expired", (key) => {
    streamCache.del(key);
});

export function createStream(obj) {
    let streamID = nanoid(),
        exp = Math.floor(new Date().getTime()) + streamLifespan,
        ghmac = sha256(`${streamID},${obj.ip},${obj.service},${exp}`, salt);

    if (!streamCache.has(streamID)) {
        streamCache.set(streamID, {
            id: streamID,
            service: obj.service,
            type: obj.type,
            urls: obj.u,
            filename: obj.filename,
            hmac: ghmac,
            ip: obj.ip,
            exp: exp,
            isAudioOnly: !!obj.isAudioOnly,
            audioFormat: obj.audioFormat,
            time: obj.time ? obj.time : false,
            copy: !!obj.copy,
            mute: !!obj.mute,
            metadata: obj.fileMetadata ? obj.fileMetadata : false
        });
    } else {
        let streamInfo = streamCache.get(streamID);
        exp = streamInfo.exp;
        ghmac = streamInfo.hmac;
    }
    return `/api/stream?t=${streamID}&e=${exp}&h=${ghmac}`;
}

export function verifyStream(ip, id, hmac, exp) {
    try {
        if (id.length === 21) {
            let streamInfo = streamCache.get(id);
            if (!streamInfo) return { error: 'this stream token does not exist', status: 400 };

            let ghmac = sha256(`${id},${ip},${streamInfo.service},${exp}`, salt);
            if (String(hmac) === ghmac && String(exp) === String(streamInfo.exp) && ghmac === String(streamInfo.hmac)
                && String(ip) === streamInfo.ip && Number(exp) > Math.floor(new Date().getTime())) {
                return streamInfo;
            }
        }
        return { error: 'Unauthorized', status: 401 };
    } catch (e) {
        return { status: 500, body: { status: "error", text: "Internal Server Error" } };
    }
}
