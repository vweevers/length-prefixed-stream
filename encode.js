var varint = require('varint')
var stream = require('readable-stream')
var inherits = require('inherits')

var pool = Buffer.allocUnsafe(10 * 1024)
var used = 0

var Encoder = function () {
  if (!(this instanceof Encoder)) return new Encoder()
  stream.Transform.call(this)
}

inherits(Encoder, stream.Transform)

Encoder.prototype._transform = function (data, enc, cb) {
  varint.encode(data.length, pool, used)
  used += varint.encode.bytes

  this.push(pool.slice(used - varint.encode.bytes, used))
  this.push(data)

  if (pool.length - used < 100) {
    pool = Buffer.allocUnsafe(10 * 1024)
    used = 0
  }

  cb()
}

module.exports = Encoder
