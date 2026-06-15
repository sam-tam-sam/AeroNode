self.__uv$config = {
    prefix: '/service/',
    bare: '/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/uv/uv.handler.js?v=2',
    bundle: '/uv/uv.bundle.js?v=2',
    config: '/uv.config.js?v=2',
    sw: '/uv/uv.sw.js?v=2',
};
