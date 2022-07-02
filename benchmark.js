const stream = require('readable-stream')
const encode = require('./encode')
const decode = require('./decode')
const bufferAlloc = require('buffer-alloc')

const buf = bufferAlloc(32 * 1024)
const source = new stream.Readable()
let sent = 0

source._read = function () {
  if (sent > 5 * 1024 * 1024 * 1024) return source.push(null)
  sent += buf.length
  source.push(buf)
}

// silly benchmark that allows me to look for opts/deopts
const s = source.pipe(encode()).pipe(decode())
const now = Date.now()

s.resume()

s.on('end', function () {
  const delta = Date.now() - now
  console.log('%d b/s (%d)', Math.floor(100000 * sent / delta) / 100, delta)
})
