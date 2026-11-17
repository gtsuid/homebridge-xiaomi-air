const { createCipheriv, createDecipheriv, createHash, randomInt, timingSafeEqual } = require('node:crypto');
const { createSocket } = require('node:dgram');
const { EventEmitter } = require('node:events');

const PORT = 54321;
const MAGIC = 0x2131;
const HEADER_SIZE = 32;
const TIMEOUT = 2000;
const HELLO = Buffer.alloc(HEADER_SIZE, 0xff);
HELLO.writeUInt16BE(MAGIC);
HELLO.writeUInt16BE(HEADER_SIZE, 2);

function md5(...parts) {
    const hash = createHash('md5');
    for (const part of parts) hash.update(part);
    return hash.digest();
}

function timeoutError() {
    const error = new Error('Timed out waiting for a Xiaomi LAN reply');
    error.code = 'ETIMEDOUT';
    return error;
}

class LanDevice extends EventEmitter {
    constructor({ address, token }, { port = PORT, timeout = TIMEOUT } = {}) {
        super();
        if (typeof token !== 'string' || !/^[a-f0-9]{32}$/i.test(token)) {
            throw new Error('Device token must contain 32 hexadecimal characters');
        }
        this.address = address;
        this.port = port;
        this.timeout = timeout;
        this.token = Buffer.from(token, 'hex');
        this.key = md5(this.token);
        this.iv = md5(this.key, this.token);
        this.id = randomInt(1, 10000);
        this.queue = Promise.resolve();
        this.closed = false;
    }

    async open() {
        const socket = createSocket('udp4');
        this.socket = socket;
        socket.on('error', error => this.failRequest?.(error));
        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(timeoutError()), this.timeout);
                this.failRequest = error => {
                    clearTimeout(timer);
                    if (error) reject(error);
                    else resolve();
                };
                socket.connect(this.port, this.address, () => {
                    if (this.socket === socket) this.failRequest?.();
                });
            });
            socket.unref();
        } catch (error) {
            if (this.socket === socket) this.closeSocket();
            throw error;
        } finally {
            this.failRequest = null;
        }
    }

    exchange(packet, accept) {
        const socket = this.socket;
        return new Promise((resolve, reject) => {
            const done = (error, result) => {
                clearTimeout(timer);
                socket.off('message', onMessage);
                this.failRequest = null;
                if (error) reject(error);
                else resolve(result);
            };
            const onMessage = message => {
                if (message.length < HEADER_SIZE || message.readUInt16BE() !== MAGIC ||
                    message.readUInt16BE(2) !== message.length) return;
                const result = accept(message);
                if (result !== undefined) done(null, result);
            };
            const timer = setTimeout(() => done(timeoutError()), this.timeout);
            this.failRequest = done;
            socket.on('message', onMessage);
            socket.send(packet, error => {
                if (error && this.failRequest === done) done(error);
            });
        });
    }

    async handshake() {
        const message = await this.exchange(HELLO, reply => reply.length === HEADER_SIZE ? reply : undefined);
        const id = message.readUInt32BE(8);
        if (this.deviceId !== undefined && id !== this.deviceId) {
            this.destroy();
            throw new Error('A different Xiaomi device now answers at the configured address');
        }
        this.deviceId = id;
        this.updateStamp(message);
    }

    updateStamp(message) {
        this.stamp = message.readUInt32BE(12);
        this.stampTime = Date.now();
    }

    encode(request) {
        const cipher = createCipheriv('aes-128-cbc', this.key, this.iv);
        const payload = Buffer.concat([cipher.update(JSON.stringify(request), 'utf8'), cipher.final()]);
        const header = Buffer.alloc(HEADER_SIZE);
        header.writeUInt16BE(MAGIC);
        header.writeUInt16BE(HEADER_SIZE + payload.length, 2);
        header.writeUInt32BE(this.deviceId, 8);
        header.writeUInt32BE((this.stamp + Math.floor((Date.now() - this.stampTime) / 1000)) >>> 0, 12);
        md5(header.subarray(0, 16), this.token, payload).copy(header, 16);
        return Buffer.concat([header, payload]);
    }

    response(message, id) {
        if (message.length === HEADER_SIZE || message.readUInt32BE(8) !== this.deviceId) return;
        const payload = message.subarray(HEADER_SIZE);
        if (!timingSafeEqual(message.subarray(16, HEADER_SIZE), md5(message.subarray(0, 16), this.token, payload))) return;
        try {
            const cipher = createDecipheriv('aes-128-cbc', this.key, this.iv);
            const json = Buffer.concat([cipher.update(payload), cipher.final()]).toString('utf8');
            const response = JSON.parse(json.replace(/\0+$/, ''));
            if (response?.id !== id) return;
            this.updateStamp(message);
            return response;
        } catch {
            // Ignore an invalid datagram while waiting for this request's reply.
        }
    }

    call(method, params = []) {
        const result = this.queue.then(() => this.request(method, params));
        this.queue = result.catch(() => {});
        return result;
    }

    async request(method, params) {
        for (let attempt = 0; ; attempt++) {
            if (this.closed) throw new Error('Device connection is closed');
            try {
                if (!this.socket) await this.open();
                if (this.stampTime === undefined || Date.now() - this.stampTime >= 120000) await this.handshake();
                this.id = (this.id - 1 + (attempt ? 100 : 1)) % 9999 + 1;
                const id = this.id;
                const response = await this.exchange(this.encode({ id, method, params }), message => this.response(message, id));
                if (response.error) {
                    const error = new Error(response.error.message || 'Xiaomi device rejected the command');
                    error.code = response.error.code;
                    throw error;
                }
                return response.result;
            } catch (error) {
                if (this.closed) throw error;
                if (error.code !== 'ETIMEDOUT' && error.code !== -30001 && error.code !== -9999) throw error;
                this.stampTime = undefined;
                if (attempt === 2) throw error;
            }
        }
    }

    closeSocket() {
        const socket = this.socket;
        this.socket = null;
        if (socket) socket.close();
    }

    destroy() {
        if (this.closed) return;
        this.closed = true;
        this.failRequest?.(new Error('Device connection is closed'));
        this.closeSocket();
        this.emit('close');
    }
}

async function device(options) {
    const connection = new LanDevice(options);
    try {
        const info = await connection.call('miIO.info');
        connection.miioModel = info?.model;
        return connection;
    } catch (error) {
        connection.destroy();
        throw error;
    }
}

module.exports = { device, LanDevice };
