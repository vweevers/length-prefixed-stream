const tape = require('tape')
const concat = require('concat-stream')
const { pipeline, Writable, Transform, Readable } = require('readable-stream')
const lpstream = require('./')

const chunk = function (ultra) {
  return new Transform({
    transform (data, enc, cb) {
      while (data.length) {
        const chunk = data.slice(0, ultra ? 1 : 1 + ((Math.random() * data.length) | 0))
        this.push(chunk)
        data = data.slice(chunk.length)
      }
      cb()
    }
  })
}

tape('encode -> decode', function (t) {
  const e = lpstream.encode()
  const d = lpstream.decode()

  d.on('data', function (data) {
    t.same(data.toString(), 'hello world')
    t.end()
  })

  e.write('hello world')
  e.pipe(d)
})

tape('buffered encode -> buffered decode', function (t) {
  const e = lpstream.encode()
  const d = lpstream.decode()

  d.on('data', function (data) {
    t.same(data.toString(), 'hello world')
    t.end()
  })

  e.write('hello world')
  e.end()

  e.pipe(concat(function (data) {
    d.end(data)
  }))
})

tape('encode -> decode twice', function (t) {
  t.plan(2)

  const e = lpstream.encode()
  const d = lpstream.decode()

  const expects = ['hello world', 'hola mundo']

  d.on('data', function (data) {
    t.same(data.toString(), expects.shift())
  })

  e.write('hello world')
  e.write('hola mundo')
  e.pipe(d)
})

tape('encode -> decode storm', function (t) {
  t.plan(50)

  const e = lpstream.encode()
  const d = lpstream.decode()
  const expects = []

  for (let i = 0; i < 50; i++) {
    expects.push(Buffer.allocUnsafe(50))
  }

  d.on('data', function (data) {
    t.same(data, expects.shift())
  })

  expects.forEach(function (b) {
    e.write(b)
  })

  e.pipe(d)
})

tape('chunked encode -> decode', function (t) {
  const e = lpstream.encode()
  const d = lpstream.decode()

  d.on('data', function (data) {
    t.same(data.toString(), 'hello world')
    t.end()
  })

  e.write('hello world')
  e.pipe(chunk()).pipe(d)
})

tape('chunked encode -> decode twice', function (t) {
  t.plan(2)

  const e = lpstream.encode()
  const d = lpstream.decode()

  const expects = ['hello world', 'hola mundo']

  d.on('data', function (data) {
    t.same(data.toString(), expects.shift())
  })

  e.write('hello world')
  e.write('hola mundo')
  e.pipe(chunk()).pipe(d)
})

tape('chunked encode -> decode storm', function (t) {
  t.plan(50)

  const e = lpstream.encode()
  const d = lpstream.decode()
  const expects = []

  for (let i = 0; i < 50; i++) {
    expects.push(Buffer.allocUnsafe(50))
  }

  d.on('data', function (data) {
    t.same(data, expects.shift())
  })

  expects.forEach(function (b) {
    e.write(b)
  })

  e.pipe(chunk()).pipe(d)
})

tape('ultra chunked encode -> decode', function (t) {
  const e = lpstream.encode()
  const d = lpstream.decode()

  d.on('data', function (data) {
    t.same(data.toString(), 'hello world')
    t.end()
  })

  e.write('hello world')
  e.pipe(chunk(true)).pipe(d)
})

tape('ultra chunked encode -> decode twice', function (t) {
  t.plan(2)

  const e = lpstream.encode()
  const d = lpstream.decode()

  const expects = ['hello world', 'hola mundo']

  d.on('data', function (data) {
    t.same(data.toString(), expects.shift())
  })

  e.write('hello world')
  e.write('hola mundo')
  e.pipe(chunk(true)).pipe(d)
})

tape('ultra chunked encode -> decode storm', function (t) {
  t.plan(50)

  const e = lpstream.encode()
  const d = lpstream.decode()
  const expects = []

  for (let i = 0; i < 50; i++) {
    expects.push(Buffer.allocUnsafe(50))
  }

  d.on('data', function (data) {
    t.same(data, expects.shift())
  })

  expects.forEach(function (b) {
    e.write(b)
  })

  e.pipe(chunk(true)).pipe(d)
})

tape('multibyte varints', function (t) {
  t.plan(5)

  const e = lpstream.encode()
  const d = lpstream.decode()
  const expects = []

  for (let i = 0; i < 5; i++) {
    expects.push(Buffer.allocUnsafe(64 * 1024))
  }

  d.on('data', function (data) {
    t.same(data, expects.shift())
  })

  expects.forEach(function (b) {
    e.write(b)
  })

  e.pipe(chunk(true)).pipe(d)
})

tape('overflow varint pool', function (t) {
  t.plan(4000)

  let i = 0
  const buf = Buffer.allocUnsafe(64 * 1024)
  const e = lpstream.encode()
  const d = lpstream.decode()

  d.on('data', function (data) {
    t.same(buf, data)
  })

  new Readable({ read }).pipe(e).pipe(d)

  // needed to not blow up in 0.10 :/
  const nextTick = global.setImmediate || process.nextTick

  function read (size) {
    nextTick(() => {
      if (i++ < 4000) return this.push(buf)
      this.push(null)
    })
  }
})

tape('message limit', function (t) {
  const d = lpstream.decode({ limit: 10 })

  d.on('error', function (err) {
    t.ok(err, 'should error')
    t.end()
  })

  d.write(Buffer.from('zzzzzzzzzzzzzz'))
})

tape('allow empty', function (t) {
  let d = lpstream.decode()

  d.on('data', function () {
    t.fail('should not emit empty buffers')
  })
  d.on('end', function () {
    d = lpstream.decode({ allowEmpty: true })
    d.on('data', function (data) {
      t.same(data, Buffer.alloc(0), 'empty buffer')
      t.end()
    })
    d.write(Buffer.from([0]))
    d.end()
  })

  d.write(Buffer.from([0]))
  d.end()
})

tape('emits close', function (t) {
  t.plan(3)

  const d = lpstream.decode()
  const e = lpstream.encode()

  d.on('close', function () {
    t.pass('decode closed')
  })

  e.on('close', function () {
    t.pass('encode closed')
  })

  d.on('data', function () {
    t.pass('got data')
  })

  e.pipe(d)
  e.write(Buffer.from([1]))
  e.end()
})

tape('pipeline() waits for close', function (t) {
  t.plan(2)

  const d = lpstream.decode()
  const e = lpstream.encode()
  const w = new Writable({ write (chunk, enc, cb) { cb() } })
  let closes = 0

  // Demonstrates gap in stream's willEmitClose() logic
  // d._destroy = e._destroy = function (err, cb) {
  //   setTimeout(cb, 100)
  // }

  function onclose () {
    closes++
  }

  d.on('close', onclose)
  e.on('close', onclose)

  pipeline(e, d, w, function (err) {
    t.ifError(err, 'no pipeline() error')
    t.is(closes, 2, 'was closed')
  })

  e.write(Buffer.from([1]))
  e.end()
})
