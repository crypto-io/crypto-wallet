(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.CryptoWallet = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return (b64.length * 3 / 4) - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr((len * 3 / 4) - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0; i < l; i += 4) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (isArrayBuffer(value)) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || isArrayBuffer(string)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffers from another context (i.e. an iframe) do not pass the `instanceof` check
// but they should be treated as valid. See: https://github.com/feross/buffer/issues/166
function isArrayBuffer (obj) {
  return obj instanceof ArrayBuffer ||
    (obj != null && obj.constructor != null && obj.constructor.name === 'ArrayBuffer' &&
      typeof obj.byteLength === 'number')
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":3}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
(function (process,global,Buffer){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};
function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}
var core = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
		{
			module.exports = exports = factory();
		}
	})(commonjsGlobal, function () {
		var CryptoJS = CryptoJS || function (Math, undefined) {
			var create = Object.create || function () {
				function F() {}
				return function (obj) {
					var subtype;
					F.prototype = obj;
					subtype = new F();
					F.prototype = null;
					return subtype;
				};
			}();
			var C = {};
			var C_lib = C.lib = {};
			var Base = C_lib.Base = function () {
				return {
					extend: function (overrides) {
						var subtype = create(this);
						if (overrides) {
							subtype.mixIn(overrides);
						}
						if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
							subtype.init = function () {
								subtype.$super.init.apply(this, arguments);
							};
						}
						subtype.init.prototype = subtype;
						subtype.$super = this;
						return subtype;
					},
					create: function () {
						var instance = this.extend();
						instance.init.apply(instance, arguments);
						return instance;
					},
					init: function () {},
					mixIn: function (properties) {
						for (var propertyName in properties) {
							if (properties.hasOwnProperty(propertyName)) {
								this[propertyName] = properties[propertyName];
							}
						}
						if (properties.hasOwnProperty('toString')) {
							this.toString = properties.toString;
						}
					},
					clone: function () {
						return this.init.prototype.extend(this);
					}
				};
			}();
			var WordArray = C_lib.WordArray = Base.extend({
				init: function (words, sigBytes) {
					words = this.words = words || [];
					if (sigBytes != undefined) {
						this.sigBytes = sigBytes;
					} else {
						this.sigBytes = words.length * 4;
					}
				},
				toString: function (encoder) {
					return (encoder || Hex).stringify(this);
				},
				concat: function (wordArray) {
					var thisWords = this.words;
					var thatWords = wordArray.words;
					var thisSigBytes = this.sigBytes;
					var thatSigBytes = wordArray.sigBytes;
					this.clamp();
					if (thisSigBytes % 4) {
						for (var i = 0; i < thatSigBytes; i++) {
							var thatByte = thatWords[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
							thisWords[thisSigBytes + i >>> 2] |= thatByte << 24 - (thisSigBytes + i) % 4 * 8;
						}
					} else {
						for (var i = 0; i < thatSigBytes; i += 4) {
							thisWords[thisSigBytes + i >>> 2] = thatWords[i >>> 2];
						}
					}
					this.sigBytes += thatSigBytes;
					return this;
				},
				clamp: function () {
					var words = this.words;
					var sigBytes = this.sigBytes;
					words[sigBytes >>> 2] &= 0xffffffff << 32 - sigBytes % 4 * 8;
					words.length = Math.ceil(sigBytes / 4);
				},
				clone: function () {
					var clone = Base.clone.call(this);
					clone.words = this.words.slice(0);
					return clone;
				},
				random: function (nBytes) {
					var words = [];
					var r = function (m_w) {
						var m_w = m_w;
						var m_z = 0x3ade68b1;
						var mask = 0xffffffff;
						return function () {
							m_z = 0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10) & mask;
							m_w = 0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10) & mask;
							var result = (m_z << 0x10) + m_w & mask;
							result /= 0x100000000;
							result += 0.5;
							return result * (Math.random() > .5 ? 1 : -1);
						};
					};
					for (var i = 0, rcache; i < nBytes; i += 4) {
						var _r = r((rcache || Math.random()) * 0x100000000);
						rcache = _r() * 0x3ade67b7;
						words.push(_r() * 0x100000000 | 0);
					}
					return new WordArray.init(words, nBytes);
				}
			});
			var C_enc = C.enc = {};
			var Hex = C_enc.Hex = {
				stringify: function (wordArray) {
					var words = wordArray.words;
					var sigBytes = wordArray.sigBytes;
					var hexChars = [];
					for (var i = 0; i < sigBytes; i++) {
						var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
						hexChars.push((bite >>> 4).toString(16));
						hexChars.push((bite & 0x0f).toString(16));
					}
					return hexChars.join('');
				},
				parse: function (hexStr) {
					var hexStrLength = hexStr.length;
					var words = [];
					for (var i = 0; i < hexStrLength; i += 2) {
						words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << 24 - i % 8 * 4;
					}
					return new WordArray.init(words, hexStrLength / 2);
				}
			};
			var Latin1 = C_enc.Latin1 = {
				stringify: function (wordArray) {
					var words = wordArray.words;
					var sigBytes = wordArray.sigBytes;
					var latin1Chars = [];
					for (var i = 0; i < sigBytes; i++) {
						var bite = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
						latin1Chars.push(String.fromCharCode(bite));
					}
					return latin1Chars.join('');
				},
				parse: function (latin1Str) {
					var latin1StrLength = latin1Str.length;
					var words = [];
					for (var i = 0; i < latin1StrLength; i++) {
						words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << 24 - i % 4 * 8;
					}
					return new WordArray.init(words, latin1StrLength);
				}
			};
			var Utf8 = C_enc.Utf8 = {
				stringify: function (wordArray) {
					try {
						return decodeURIComponent(escape(Latin1.stringify(wordArray)));
					} catch (e) {
						throw new Error('Malformed UTF-8 data');
					}
				},
				parse: function (utf8Str) {
					return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
				}
			};
			var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
				reset: function () {
					this._data = new WordArray.init();
					this._nDataBytes = 0;
				},
				_append: function (data) {
					if (typeof data == 'string') {
						data = Utf8.parse(data);
					}
					this._data.concat(data);
					this._nDataBytes += data.sigBytes;
				},
				_process: function (doFlush) {
					var data = this._data;
					var dataWords = data.words;
					var dataSigBytes = data.sigBytes;
					var blockSize = this.blockSize;
					var blockSizeBytes = blockSize * 4;
					var nBlocksReady = dataSigBytes / blockSizeBytes;
					if (doFlush) {
						nBlocksReady = Math.ceil(nBlocksReady);
					} else {
						nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
					}
					var nWordsReady = nBlocksReady * blockSize;
					var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);
					if (nWordsReady) {
						for (var offset = 0; offset < nWordsReady; offset += blockSize) {
							this._doProcessBlock(dataWords, offset);
						}
						var processedWords = dataWords.splice(0, nWordsReady);
						data.sigBytes -= nBytesReady;
					}
					return new WordArray.init(processedWords, nBytesReady);
				},
				clone: function () {
					var clone = Base.clone.call(this);
					clone._data = this._data.clone();
					return clone;
				},
				_minBufferSize: 0
			});
			var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
				cfg: Base.extend(),
				init: function (cfg) {
					this.cfg = this.cfg.extend(cfg);
					this.reset();
				},
				reset: function () {
					BufferedBlockAlgorithm.reset.call(this);
					this._doReset();
				},
				update: function (messageUpdate) {
					this._append(messageUpdate);
					this._process();
					return this;
				},
				finalize: function (messageUpdate) {
					if (messageUpdate) {
						this._append(messageUpdate);
					}
					var hash = this._doFinalize();
					return hash;
				},
				blockSize: 512 / 32,
				_createHelper: function (hasher) {
					return function (message, cfg) {
						return new hasher.init(cfg).finalize(message);
					};
				},
				_createHmacHelper: function (hasher) {
					return function (message, key) {
						return new C_algo.HMAC.init(hasher, key).finalize(message);
					};
				}
			});
			var C_algo = C.algo = {};
			return C;
		}(Math);
		return CryptoJS;
	});
});
var encBase64 = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
		{
			module.exports = exports = factory(core);
		}
	})(commonjsGlobal, function (CryptoJS) {
		(function () {
			var C = CryptoJS;
			var C_lib = C.lib;
			var WordArray = C_lib.WordArray;
			var C_enc = C.enc;
			var Base64 = C_enc.Base64 = {
				stringify: function (wordArray) {
					var words = wordArray.words;
					var sigBytes = wordArray.sigBytes;
					var map = this._map;
					wordArray.clamp();
					var base64Chars = [];
					for (var i = 0; i < sigBytes; i += 3) {
						var byte1 = words[i >>> 2] >>> 24 - i % 4 * 8 & 0xff;
						var byte2 = words[i + 1 >>> 2] >>> 24 - (i + 1) % 4 * 8 & 0xff;
						var byte3 = words[i + 2 >>> 2] >>> 24 - (i + 2) % 4 * 8 & 0xff;
						var triplet = byte1 << 16 | byte2 << 8 | byte3;
						for (var j = 0; j < 4 && i + j * 0.75 < sigBytes; j++) {
							base64Chars.push(map.charAt(triplet >>> 6 * (3 - j) & 0x3f));
						}
					}
					var paddingChar = map.charAt(64);
					if (paddingChar) {
						while (base64Chars.length % 4) {
							base64Chars.push(paddingChar);
						}
					}
					return base64Chars.join('');
				},
				parse: function (base64Str) {
					var base64StrLength = base64Str.length;
					var map = this._map;
					var reverseMap = this._reverseMap;
					if (!reverseMap) {
						reverseMap = this._reverseMap = [];
						for (var j = 0; j < map.length; j++) {
							reverseMap[map.charCodeAt(j)] = j;
						}
					}
					var paddingChar = map.charAt(64);
					if (paddingChar) {
						var paddingIndex = base64Str.indexOf(paddingChar);
						if (paddingIndex !== -1) {
							base64StrLength = paddingIndex;
						}
					}
					return parseLoop(base64Str, base64StrLength, reverseMap);
				},
				_map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
			};
			function parseLoop(base64Str, base64StrLength, reverseMap) {
				var words = [];
				var nBytes = 0;
				for (var i = 0; i < base64StrLength; i++) {
					if (i % 4) {
						var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << i % 4 * 2;
						var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> 6 - i % 4 * 2;
						words[nBytes >>> 2] |= (bits1 | bits2) << 24 - nBytes % 4 * 8;
						nBytes++;
					}
				}
				return WordArray.create(words, nBytes);
			}
		})();
		return CryptoJS.enc.Base64;
	});
});
var md5 = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
		{
			module.exports = exports = factory(core);
		}
	})(commonjsGlobal, function (CryptoJS) {
		(function (Math) {
			var C = CryptoJS;
			var C_lib = C.lib;
			var WordArray = C_lib.WordArray;
			var Hasher = C_lib.Hasher;
			var C_algo = C.algo;
			var T = [];
			(function () {
				for (var i = 0; i < 64; i++) {
					T[i] = Math.abs(Math.sin(i + 1)) * 0x100000000 | 0;
				}
			})();
			var MD5 = C_algo.MD5 = Hasher.extend({
				_doReset: function () {
					this._hash = new WordArray.init([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
				},
				_doProcessBlock: function (M, offset) {
					for (var i = 0; i < 16; i++) {
						var offset_i = offset + i;
						var M_offset_i = M[offset_i];
						M[offset_i] = (M_offset_i << 8 | M_offset_i >>> 24) & 0x00ff00ff | (M_offset_i << 24 | M_offset_i >>> 8) & 0xff00ff00;
					}
					var H = this._hash.words;
					var M_offset_0 = M[offset + 0];
					var M_offset_1 = M[offset + 1];
					var M_offset_2 = M[offset + 2];
					var M_offset_3 = M[offset + 3];
					var M_offset_4 = M[offset + 4];
					var M_offset_5 = M[offset + 5];
					var M_offset_6 = M[offset + 6];
					var M_offset_7 = M[offset + 7];
					var M_offset_8 = M[offset + 8];
					var M_offset_9 = M[offset + 9];
					var M_offset_10 = M[offset + 10];
					var M_offset_11 = M[offset + 11];
					var M_offset_12 = M[offset + 12];
					var M_offset_13 = M[offset + 13];
					var M_offset_14 = M[offset + 14];
					var M_offset_15 = M[offset + 15];
					var a = H[0];
					var b = H[1];
					var c = H[2];
					var d = H[3];
					a = FF(a, b, c, d, M_offset_0, 7, T[0]);
					d = FF(d, a, b, c, M_offset_1, 12, T[1]);
					c = FF(c, d, a, b, M_offset_2, 17, T[2]);
					b = FF(b, c, d, a, M_offset_3, 22, T[3]);
					a = FF(a, b, c, d, M_offset_4, 7, T[4]);
					d = FF(d, a, b, c, M_offset_5, 12, T[5]);
					c = FF(c, d, a, b, M_offset_6, 17, T[6]);
					b = FF(b, c, d, a, M_offset_7, 22, T[7]);
					a = FF(a, b, c, d, M_offset_8, 7, T[8]);
					d = FF(d, a, b, c, M_offset_9, 12, T[9]);
					c = FF(c, d, a, b, M_offset_10, 17, T[10]);
					b = FF(b, c, d, a, M_offset_11, 22, T[11]);
					a = FF(a, b, c, d, M_offset_12, 7, T[12]);
					d = FF(d, a, b, c, M_offset_13, 12, T[13]);
					c = FF(c, d, a, b, M_offset_14, 17, T[14]);
					b = FF(b, c, d, a, M_offset_15, 22, T[15]);
					a = GG(a, b, c, d, M_offset_1, 5, T[16]);
					d = GG(d, a, b, c, M_offset_6, 9, T[17]);
					c = GG(c, d, a, b, M_offset_11, 14, T[18]);
					b = GG(b, c, d, a, M_offset_0, 20, T[19]);
					a = GG(a, b, c, d, M_offset_5, 5, T[20]);
					d = GG(d, a, b, c, M_offset_10, 9, T[21]);
					c = GG(c, d, a, b, M_offset_15, 14, T[22]);
					b = GG(b, c, d, a, M_offset_4, 20, T[23]);
					a = GG(a, b, c, d, M_offset_9, 5, T[24]);
					d = GG(d, a, b, c, M_offset_14, 9, T[25]);
					c = GG(c, d, a, b, M_offset_3, 14, T[26]);
					b = GG(b, c, d, a, M_offset_8, 20, T[27]);
					a = GG(a, b, c, d, M_offset_13, 5, T[28]);
					d = GG(d, a, b, c, M_offset_2, 9, T[29]);
					c = GG(c, d, a, b, M_offset_7, 14, T[30]);
					b = GG(b, c, d, a, M_offset_12, 20, T[31]);
					a = HH(a, b, c, d, M_offset_5, 4, T[32]);
					d = HH(d, a, b, c, M_offset_8, 11, T[33]);
					c = HH(c, d, a, b, M_offset_11, 16, T[34]);
					b = HH(b, c, d, a, M_offset_14, 23, T[35]);
					a = HH(a, b, c, d, M_offset_1, 4, T[36]);
					d = HH(d, a, b, c, M_offset_4, 11, T[37]);
					c = HH(c, d, a, b, M_offset_7, 16, T[38]);
					b = HH(b, c, d, a, M_offset_10, 23, T[39]);
					a = HH(a, b, c, d, M_offset_13, 4, T[40]);
					d = HH(d, a, b, c, M_offset_0, 11, T[41]);
					c = HH(c, d, a, b, M_offset_3, 16, T[42]);
					b = HH(b, c, d, a, M_offset_6, 23, T[43]);
					a = HH(a, b, c, d, M_offset_9, 4, T[44]);
					d = HH(d, a, b, c, M_offset_12, 11, T[45]);
					c = HH(c, d, a, b, M_offset_15, 16, T[46]);
					b = HH(b, c, d, a, M_offset_2, 23, T[47]);
					a = II(a, b, c, d, M_offset_0, 6, T[48]);
					d = II(d, a, b, c, M_offset_7, 10, T[49]);
					c = II(c, d, a, b, M_offset_14, 15, T[50]);
					b = II(b, c, d, a, M_offset_5, 21, T[51]);
					a = II(a, b, c, d, M_offset_12, 6, T[52]);
					d = II(d, a, b, c, M_offset_3, 10, T[53]);
					c = II(c, d, a, b, M_offset_10, 15, T[54]);
					b = II(b, c, d, a, M_offset_1, 21, T[55]);
					a = II(a, b, c, d, M_offset_8, 6, T[56]);
					d = II(d, a, b, c, M_offset_15, 10, T[57]);
					c = II(c, d, a, b, M_offset_6, 15, T[58]);
					b = II(b, c, d, a, M_offset_13, 21, T[59]);
					a = II(a, b, c, d, M_offset_4, 6, T[60]);
					d = II(d, a, b, c, M_offset_11, 10, T[61]);
					c = II(c, d, a, b, M_offset_2, 15, T[62]);
					b = II(b, c, d, a, M_offset_9, 21, T[63]);
					H[0] = H[0] + a | 0;
					H[1] = H[1] + b | 0;
					H[2] = H[2] + c | 0;
					H[3] = H[3] + d | 0;
				},
				_doFinalize: function () {
					var data = this._data;
					var dataWords = data.words;
					var nBitsTotal = this._nDataBytes * 8;
					var nBitsLeft = data.sigBytes * 8;
					dataWords[nBitsLeft >>> 5] |= 0x80 << 24 - nBitsLeft % 32;
					var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
					var nBitsTotalL = nBitsTotal;
					dataWords[(nBitsLeft + 64 >>> 9 << 4) + 15] = (nBitsTotalH << 8 | nBitsTotalH >>> 24) & 0x00ff00ff | (nBitsTotalH << 24 | nBitsTotalH >>> 8) & 0xff00ff00;
					dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = (nBitsTotalL << 8 | nBitsTotalL >>> 24) & 0x00ff00ff | (nBitsTotalL << 24 | nBitsTotalL >>> 8) & 0xff00ff00;
					data.sigBytes = (dataWords.length + 1) * 4;
					this._process();
					var hash = this._hash;
					var H = hash.words;
					for (var i = 0; i < 4; i++) {
						var H_i = H[i];
						H[i] = (H_i << 8 | H_i >>> 24) & 0x00ff00ff | (H_i << 24 | H_i >>> 8) & 0xff00ff00;
					}
					return hash;
				},
				clone: function () {
					var clone = Hasher.clone.call(this);
					clone._hash = this._hash.clone();
					return clone;
				}
			});
			function FF(a, b, c, d, x, s, t) {
				var n = a + (b & c | ~b & d) + x + t;
				return (n << s | n >>> 32 - s) + b;
			}
			function GG(a, b, c, d, x, s, t) {
				var n = a + (b & d | c & ~d) + x + t;
				return (n << s | n >>> 32 - s) + b;
			}
			function HH(a, b, c, d, x, s, t) {
				var n = a + (b ^ c ^ d) + x + t;
				return (n << s | n >>> 32 - s) + b;
			}
			function II(a, b, c, d, x, s, t) {
				var n = a + (c ^ (b | ~d)) + x + t;
				return (n << s | n >>> 32 - s) + b;
			}
			C.MD5 = Hasher._createHelper(MD5);
			C.HmacMD5 = Hasher._createHmacHelper(MD5);
		})(Math);
		return CryptoJS.MD5;
	});
});
var sha1 = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
		{
			module.exports = exports = factory(core);
		}
	})(commonjsGlobal, function (CryptoJS) {
		(function () {
			var C = CryptoJS;
			var C_lib = C.lib;
			var WordArray = C_lib.WordArray;
			var Hasher = C_lib.Hasher;
			var C_algo = C.algo;
			var W = [];
			var SHA1 = C_algo.SHA1 = Hasher.extend({
				_doReset: function () {
					this._hash = new WordArray.init([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
				},
				_doProcessBlock: function (M, offset) {
					var H = this._hash.words;
					var a = H[0];
					var b = H[1];
					var c = H[2];
					var d = H[3];
					var e = H[4];
					for (var i = 0; i < 80; i++) {
						if (i < 16) {
							W[i] = M[offset + i] | 0;
						} else {
							var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
							W[i] = n << 1 | n >>> 31;
						}
						var t = (a << 5 | a >>> 27) + e + W[i];
						if (i < 20) {
							t += (b & c | ~b & d) + 0x5a827999;
						} else if (i < 40) {
							t += (b ^ c ^ d) + 0x6ed9eba1;
						} else if (i < 60) {
							t += (b & c | b & d | c & d) - 0x70e44324;
						} else {
							t += (b ^ c ^ d) - 0x359d3e2a;
						}
						e = d;
						d = c;
						c = b << 30 | b >>> 2;
						b = a;
						a = t;
					}
					H[0] = H[0] + a | 0;
					H[1] = H[1] + b | 0;
					H[2] = H[2] + c | 0;
					H[3] = H[3] + d | 0;
					H[4] = H[4] + e | 0;
				},
				_doFinalize: function () {
					var data = this._data;
					var dataWords = data.words;
					var nBitsTotal = this._nDataBytes * 8;
					var nBitsLeft = data.sigBytes * 8;
					dataWords[nBitsLeft >>> 5] |= 0x80 << 24 - nBitsLeft % 32;
					dataWords[(nBitsLeft + 64 >>> 9 << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
					dataWords[(nBitsLeft + 64 >>> 9 << 4) + 15] = nBitsTotal;
					data.sigBytes = dataWords.length * 4;
					this._process();
					return this._hash;
				},
				clone: function () {
					var clone = Hasher.clone.call(this);
					clone._hash = this._hash.clone();
					return clone;
				}
			});
			C.SHA1 = Hasher._createHelper(SHA1);
			C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
		})();
		return CryptoJS.SHA1;
	});
});
var hmac = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
		{
			module.exports = exports = factory(core);
		}
	})(commonjsGlobal, function (CryptoJS) {
		(function () {
			var C = CryptoJS;
			var C_lib = C.lib;
			var Base = C_lib.Base;
			var C_enc = C.enc;
			var Utf8 = C_enc.Utf8;
			var C_algo = C.algo;
			var HMAC = C_algo.HMAC = Base.extend({
				init: function (hasher, key) {
					hasher = this._hasher = new hasher.init();
					if (typeof key == 'string') {
						key = Utf8.parse(key);
					}
					var hasherBlockSize = hasher.blockSize;
					var hasherBlockSizeBytes = hasherBlockSize * 4;
					if (key.sigBytes > hasherBlockSizeBytes) {
						key = hasher.finalize(key);
					}
					key.clamp();
					var oKey = this._oKey = key.clone();
					var iKey = this._iKey = key.clone();
					var oKeyWords = oKey.words;
					var iKeyWords = iKey.words;
					for (var i = 0; i < hasherBlockSize; i++) {
						oKeyWords[i] ^= 0x5c5c5c5c;
						iKeyWords[i] ^= 0x36363636;
					}
					oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;
					this.reset();
				},
				reset: function () {
					var hasher = this._hasher;
					hasher.reset();
					hasher.update(this._iKey);
				},
				update: function (messageUpdate) {
					this._hasher.update(messageUpdate);
					return this;
				},
				finalize: function (messageUpdate) {
					var hasher = this._hasher;
					var innerHash = hasher.finalize(messageUpdate);
					hasher.reset();
					var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));
					return hmac;
				}
			});
		})();
	});
});
var evpkdf = createCommonjsModule(function (module, exports) {
	(function (root, factory, undef) {
		{
			module.exports = exports = factory(core, sha1, hmac);
		}
	})(commonjsGlobal, function (CryptoJS) {
		(function () {
			var C = CryptoJS;
			var C_lib = C.lib;
			var Base = C_lib.Base;
			var WordArray = C_lib.WordArray;
			var C_algo = C.algo;
			var MD5 = C_algo.MD5;
			var EvpKDF = C_algo.EvpKDF = Base.extend({
				cfg: Base.extend({
					keySize: 128 / 32,
					hasher: MD5,
					iterations: 1
				}),
				init: function (cfg) {
					this.cfg = this.cfg.extend(cfg);
				},
				compute: function (password, salt) {
					var cfg = this.cfg;
					var hasher = cfg.hasher.create();
					var derivedKey = WordArray.create();
					var derivedKeyWords = derivedKey.words;
					var keySize = cfg.keySize;
					var iterations = cfg.iterations;
					while (derivedKeyWords.length < keySize) {
						if (block) {
							hasher.update(block);
						}
						var block = hasher.update(password).finalize(salt);
						hasher.reset();
						for (var i = 1; i < iterations; i++) {
							block = hasher.finalize(block);
							hasher.reset();
						}
						derivedKey.concat(block);
					}
					derivedKey.sigBytes = keySize * 4;
					return derivedKey;
				}
			});
			C.EvpKDF = function (password, salt, cfg) {
				return EvpKDF.create(cfg).compute(password, salt);
			};
		})();
		return CryptoJS.EvpKDF;
	});
});
var cipherCore = createCommonjsModule(function (module, exports) {
	(function (root, factory, undef) {
		{
			module.exports = exports = factory(core, evpkdf);
		}
	})(commonjsGlobal, function (CryptoJS) {
		CryptoJS.lib.Cipher || function (undefined) {
			var C = CryptoJS;
			var C_lib = C.lib;
			var Base = C_lib.Base;
			var WordArray = C_lib.WordArray;
			var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
			var C_enc = C.enc;
			var Utf8 = C_enc.Utf8;
			var Base64 = C_enc.Base64;
			var C_algo = C.algo;
			var EvpKDF = C_algo.EvpKDF;
			var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
				cfg: Base.extend(),
				createEncryptor: function (key, cfg) {
					return this.create(this._ENC_XFORM_MODE, key, cfg);
				},
				createDecryptor: function (key, cfg) {
					return this.create(this._DEC_XFORM_MODE, key, cfg);
				},
				init: function (xformMode, key, cfg) {
					this.cfg = this.cfg.extend(cfg);
					this._xformMode = xformMode;
					this._key = key;
					this.reset();
				},
				reset: function () {
					BufferedBlockAlgorithm.reset.call(this);
					this._doReset();
				},
				process: function (dataUpdate) {
					this._append(dataUpdate);
					return this._process();
				},
				finalize: function (dataUpdate) {
					if (dataUpdate) {
						this._append(dataUpdate);
					}
					var finalProcessedData = this._doFinalize();
					return finalProcessedData;
				},
				keySize: 128 / 32,
				ivSize: 128 / 32,
				_ENC_XFORM_MODE: 1,
				_DEC_XFORM_MODE: 2,
				_createHelper: function () {
					function selectCipherStrategy(key) {
						if (typeof key == 'string') {
							return PasswordBasedCipher;
						} else {
							return SerializableCipher;
						}
					}
					return function (cipher) {
						return {
							encrypt: function (message, key, cfg) {
								return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
							},
							decrypt: function (ciphertext, key, cfg) {
								return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
							}
						};
					};
				}()
			});
			var StreamCipher = C_lib.StreamCipher = Cipher.extend({
				_doFinalize: function () {
					var finalProcessedBlocks = this._process(!!'flush');
					return finalProcessedBlocks;
				},
				blockSize: 1
			});
			var C_mode = C.mode = {};
			var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
				createEncryptor: function (cipher, iv) {
					return this.Encryptor.create(cipher, iv);
				},
				createDecryptor: function (cipher, iv) {
					return this.Decryptor.create(cipher, iv);
				},
				init: function (cipher, iv) {
					this._cipher = cipher;
					this._iv = iv;
				}
			});
			var CBC = C_mode.CBC = function () {
				var CBC = BlockCipherMode.extend();
				CBC.Encryptor = CBC.extend({
					processBlock: function (words, offset) {
						var cipher = this._cipher;
						var blockSize = cipher.blockSize;
						xorBlock.call(this, words, offset, blockSize);
						cipher.encryptBlock(words, offset);
						this._prevBlock = words.slice(offset, offset + blockSize);
					}
				});
				CBC.Decryptor = CBC.extend({
					processBlock: function (words, offset) {
						var cipher = this._cipher;
						var blockSize = cipher.blockSize;
						var thisBlock = words.slice(offset, offset + blockSize);
						cipher.decryptBlock(words, offset);
						xorBlock.call(this, words, offset, blockSize);
						this._prevBlock = thisBlock;
					}
				});
				function xorBlock(words, offset, blockSize) {
					var iv = this._iv;
					if (iv) {
						var block = iv;
						this._iv = undefined;
					} else {
						var block = this._prevBlock;
					}
					for (var i = 0; i < blockSize; i++) {
						words[offset + i] ^= block[i];
					}
				}
				return CBC;
			}();
			var C_pad = C.pad = {};
			var Pkcs7 = C_pad.Pkcs7 = {
				pad: function (data, blockSize) {
					var blockSizeBytes = blockSize * 4;
					var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;
					var paddingWord = nPaddingBytes << 24 | nPaddingBytes << 16 | nPaddingBytes << 8 | nPaddingBytes;
					var paddingWords = [];
					for (var i = 0; i < nPaddingBytes; i += 4) {
						paddingWords.push(paddingWord);
					}
					var padding = WordArray.create(paddingWords, nPaddingBytes);
					data.concat(padding);
				},
				unpad: function (data) {
					var nPaddingBytes = data.words[data.sigBytes - 1 >>> 2] & 0xff;
					data.sigBytes -= nPaddingBytes;
				}
			};
			var BlockCipher = C_lib.BlockCipher = Cipher.extend({
				cfg: Cipher.cfg.extend({
					mode: CBC,
					padding: Pkcs7
				}),
				reset: function () {
					Cipher.reset.call(this);
					var cfg = this.cfg;
					var iv = cfg.iv;
					var mode = cfg.mode;
					if (this._xformMode == this._ENC_XFORM_MODE) {
						var modeCreator = mode.createEncryptor;
					} else {
						var modeCreator = mode.createDecryptor;
						this._minBufferSize = 1;
					}
					if (this._mode && this._mode.__creator == modeCreator) {
						this._mode.init(this, iv && iv.words);
					} else {
						this._mode = modeCreator.call(mode, this, iv && iv.words);
						this._mode.__creator = modeCreator;
					}
				},
				_doProcessBlock: function (words, offset) {
					this._mode.processBlock(words, offset);
				},
				_doFinalize: function () {
					var padding = this.cfg.padding;
					if (this._xformMode == this._ENC_XFORM_MODE) {
						padding.pad(this._data, this.blockSize);
						var finalProcessedBlocks = this._process(!!'flush');
					} else {
						var finalProcessedBlocks = this._process(!!'flush');
						padding.unpad(finalProcessedBlocks);
					}
					return finalProcessedBlocks;
				},
				blockSize: 128 / 32
			});
			var CipherParams = C_lib.CipherParams = Base.extend({
				init: function (cipherParams) {
					this.mixIn(cipherParams);
				},
				toString: function (formatter) {
					return (formatter || this.formatter).stringify(this);
				}
			});
			var C_format = C.format = {};
			var OpenSSLFormatter = C_format.OpenSSL = {
				stringify: function (cipherParams) {
					var ciphertext = cipherParams.ciphertext;
					var salt = cipherParams.salt;
					if (salt) {
						var wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
					} else {
						var wordArray = ciphertext;
					}
					return wordArray.toString(Base64);
				},
				parse: function (openSSLStr) {
					var ciphertext = Base64.parse(openSSLStr);
					var ciphertextWords = ciphertext.words;
					if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
						var salt = WordArray.create(ciphertextWords.slice(2, 4));
						ciphertextWords.splice(0, 4);
						ciphertext.sigBytes -= 16;
					}
					return CipherParams.create({ ciphertext: ciphertext, salt: salt });
				}
			};
			var SerializableCipher = C_lib.SerializableCipher = Base.extend({
				cfg: Base.extend({
					format: OpenSSLFormatter
				}),
				encrypt: function (cipher, message, key, cfg) {
					cfg = this.cfg.extend(cfg);
					var encryptor = cipher.createEncryptor(key, cfg);
					var ciphertext = encryptor.finalize(message);
					var cipherCfg = encryptor.cfg;
					return CipherParams.create({
						ciphertext: ciphertext,
						key: key,
						iv: cipherCfg.iv,
						algorithm: cipher,
						mode: cipherCfg.mode,
						padding: cipherCfg.padding,
						blockSize: cipher.blockSize,
						formatter: cfg.format
					});
				},
				decrypt: function (cipher, ciphertext, key, cfg) {
					cfg = this.cfg.extend(cfg);
					ciphertext = this._parse(ciphertext, cfg.format);
					var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);
					return plaintext;
				},
				_parse: function (ciphertext, format) {
					if (typeof ciphertext == 'string') {
						return format.parse(ciphertext, this);
					} else {
						return ciphertext;
					}
				}
			});
			var C_kdf = C.kdf = {};
			var OpenSSLKdf = C_kdf.OpenSSL = {
				execute: function (password, keySize, ivSize, salt) {
					if (!salt) {
						salt = WordArray.random(64 / 8);
					}
					var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);
					var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
					key.sigBytes = keySize * 4;
					return CipherParams.create({ key: key, iv: iv, salt: salt });
				}
			};
			var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
				cfg: SerializableCipher.cfg.extend({
					kdf: OpenSSLKdf
				}),
				encrypt: function (cipher, message, password, cfg) {
					cfg = this.cfg.extend(cfg);
					var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);
					cfg.iv = derivedParams.iv;
					var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);
					ciphertext.mixIn(derivedParams);
					return ciphertext;
				},
				decrypt: function (cipher, ciphertext, password, cfg) {
					cfg = this.cfg.extend(cfg);
					ciphertext = this._parse(ciphertext, cfg.format);
					var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);
					cfg.iv = derivedParams.iv;
					var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);
					return plaintext;
				}
			});
		}();
	});
});
var aes = createCommonjsModule(function (module, exports) {
	(function (root, factory, undef) {
		{
			module.exports = exports = factory(core, encBase64, md5, evpkdf, cipherCore);
		}
	})(commonjsGlobal, function (CryptoJS) {
		(function () {
			var C = CryptoJS;
			var C_lib = C.lib;
			var BlockCipher = C_lib.BlockCipher;
			var C_algo = C.algo;
			var SBOX = [];
			var INV_SBOX = [];
			var SUB_MIX_0 = [];
			var SUB_MIX_1 = [];
			var SUB_MIX_2 = [];
			var SUB_MIX_3 = [];
			var INV_SUB_MIX_0 = [];
			var INV_SUB_MIX_1 = [];
			var INV_SUB_MIX_2 = [];
			var INV_SUB_MIX_3 = [];
			(function () {
				var d = [];
				for (var i = 0; i < 256; i++) {
					if (i < 128) {
						d[i] = i << 1;
					} else {
						d[i] = i << 1 ^ 0x11b;
					}
				}
				var x = 0;
				var xi = 0;
				for (var i = 0; i < 256; i++) {
					var sx = xi ^ xi << 1 ^ xi << 2 ^ xi << 3 ^ xi << 4;
					sx = sx >>> 8 ^ sx & 0xff ^ 0x63;
					SBOX[x] = sx;
					INV_SBOX[sx] = x;
					var x2 = d[x];
					var x4 = d[x2];
					var x8 = d[x4];
					var t = d[sx] * 0x101 ^ sx * 0x1010100;
					SUB_MIX_0[x] = t << 24 | t >>> 8;
					SUB_MIX_1[x] = t << 16 | t >>> 16;
					SUB_MIX_2[x] = t << 8 | t >>> 24;
					SUB_MIX_3[x] = t;
					var t = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
					INV_SUB_MIX_0[sx] = t << 24 | t >>> 8;
					INV_SUB_MIX_1[sx] = t << 16 | t >>> 16;
					INV_SUB_MIX_2[sx] = t << 8 | t >>> 24;
					INV_SUB_MIX_3[sx] = t;
					if (!x) {
						x = xi = 1;
					} else {
						x = x2 ^ d[d[d[x8 ^ x2]]];
						xi ^= d[d[xi]];
					}
				}
			})();
			var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
			var AES = C_algo.AES = BlockCipher.extend({
				_doReset: function () {
					if (this._nRounds && this._keyPriorReset === this._key) {
						return;
					}
					var key = this._keyPriorReset = this._key;
					var keyWords = key.words;
					var keySize = key.sigBytes / 4;
					var nRounds = this._nRounds = keySize + 6;
					var ksRows = (nRounds + 1) * 4;
					var keySchedule = this._keySchedule = [];
					for (var ksRow = 0; ksRow < ksRows; ksRow++) {
						if (ksRow < keySize) {
							keySchedule[ksRow] = keyWords[ksRow];
						} else {
							var t = keySchedule[ksRow - 1];
							if (!(ksRow % keySize)) {
								t = t << 8 | t >>> 24;
								t = SBOX[t >>> 24] << 24 | SBOX[t >>> 16 & 0xff] << 16 | SBOX[t >>> 8 & 0xff] << 8 | SBOX[t & 0xff];
								t ^= RCON[ksRow / keySize | 0] << 24;
							} else if (keySize > 6 && ksRow % keySize == 4) {
								t = SBOX[t >>> 24] << 24 | SBOX[t >>> 16 & 0xff] << 16 | SBOX[t >>> 8 & 0xff] << 8 | SBOX[t & 0xff];
							}
							keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
						}
					}
					var invKeySchedule = this._invKeySchedule = [];
					for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
						var ksRow = ksRows - invKsRow;
						if (invKsRow % 4) {
							var t = keySchedule[ksRow];
						} else {
							var t = keySchedule[ksRow - 4];
						}
						if (invKsRow < 4 || ksRow <= 4) {
							invKeySchedule[invKsRow] = t;
						} else {
							invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[t >>> 16 & 0xff]] ^ INV_SUB_MIX_2[SBOX[t >>> 8 & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
						}
					}
				},
				encryptBlock: function (M, offset) {
					this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
				},
				decryptBlock: function (M, offset) {
					var t = M[offset + 1];
					M[offset + 1] = M[offset + 3];
					M[offset + 3] = t;
					this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);
					var t = M[offset + 1];
					M[offset + 1] = M[offset + 3];
					M[offset + 3] = t;
				},
				_doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
					var nRounds = this._nRounds;
					var s0 = M[offset] ^ keySchedule[0];
					var s1 = M[offset + 1] ^ keySchedule[1];
					var s2 = M[offset + 2] ^ keySchedule[2];
					var s3 = M[offset + 3] ^ keySchedule[3];
					var ksRow = 4;
					for (var round = 1; round < nRounds; round++) {
						var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[s1 >>> 16 & 0xff] ^ SUB_MIX_2[s2 >>> 8 & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
						var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[s2 >>> 16 & 0xff] ^ SUB_MIX_2[s3 >>> 8 & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
						var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[s3 >>> 16 & 0xff] ^ SUB_MIX_2[s0 >>> 8 & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
						var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[s0 >>> 16 & 0xff] ^ SUB_MIX_2[s1 >>> 8 & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];
						s0 = t0;
						s1 = t1;
						s2 = t2;
						s3 = t3;
					}
					var t0 = (SBOX[s0 >>> 24] << 24 | SBOX[s1 >>> 16 & 0xff] << 16 | SBOX[s2 >>> 8 & 0xff] << 8 | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
					var t1 = (SBOX[s1 >>> 24] << 24 | SBOX[s2 >>> 16 & 0xff] << 16 | SBOX[s3 >>> 8 & 0xff] << 8 | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
					var t2 = (SBOX[s2 >>> 24] << 24 | SBOX[s3 >>> 16 & 0xff] << 16 | SBOX[s0 >>> 8 & 0xff] << 8 | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
					var t3 = (SBOX[s3 >>> 24] << 24 | SBOX[s0 >>> 16 & 0xff] << 16 | SBOX[s1 >>> 8 & 0xff] << 8 | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];
					M[offset] = t0;
					M[offset + 1] = t1;
					M[offset + 2] = t2;
					M[offset + 3] = t3;
				},
				keySize: 256 / 32
			});
			C.AES = BlockCipher._createHelper(AES);
		})();
		return CryptoJS.AES;
	});
});
var encUtf8 = createCommonjsModule(function (module, exports) {
	(function (root, factory) {
		{
			module.exports = exports = factory(core);
		}
	})(commonjsGlobal, function (CryptoJS) {
		return CryptoJS.enc.Utf8;
	});
});
const encrypt = (data, key) => new Promise((resolve, reject) => {
	if (!data || !key) reject(`${key ? 'data' : 'key'} missing`);else resolve(aes.encrypt(data, key));
});
const decrypt = (cipher, key) => new Promise((resolve, reject) => {
	if (!cipher || !key) reject(`${key ? 'cipher' : 'key'} missing`);else resolve(aes.decrypt(cipher.toString(), key).toString(encUtf8));
});
const trymore = (context, params, count = 0) => new Promise(async (resolve, reject) => {
	const max = params.length - 1;
	const parts = params[count].split('|');
	try {
		const file = await context(parts[0], parts[1]);
		resolve([parts[0], file]);
	} catch (error) {
		if (count < max) {
			count++;
			try {
				resolve((await trymore(context, params, count)));
			} catch (error) {
				if (count < max) {
					resolve((await trymore(context, params, count)));
				} else {
					reject(error);
				}
			}
		} else {
			reject(error);
		}
	}
});

var commonjsGlobal$1 = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};



function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule$1(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var store = createCommonjsModule$1(function (module, exports) {
  'use strict';
  Object.defineProperty(exports, '__esModule', { value: true });
  class StoreHandler$1 {
    constructor(enc = 'hex') {
      this.enc = enc;
    }
    set secret(value) {
      if (value) {
        this._defineStrictProperty('_secret', value);
      }
    }
    get secret() {
      return this._secret.toString(this.enc);
    }
    set public(value) {
      this._defineStrictProperty('public', value);
    }
    get public() {
      return encode(this._public);
    }
    _defineStrictProperty(property, value) {
      if (value && property) {
        return Object.defineProperty(this, property, {
          configurable: false,
          writable: false,
          value: value
        });
      }
      console.warn(`${property ? 'value' : 'property'} undefined`);
    }
  }
  const StoreHandler = StoreHandler$1;
  class Store {
    constructor(namespace = 'default', enc = 'hex') {
      let store;
      if ('object' !== 'undefined' && module.exports) {
        commonjsGlobal$1.__store__ = {};
        store = commonjsGlobal$1.__store__;
      } else {
        window.__store__ = {};
        store = window.__store__;
      }
      if (!store[namespace]) {
        store[namespace] = new StoreHandler(enc);
      }
      return store[namespace];
    }
  }
  exports.StoreHandler = StoreHandler;
  exports.Store = Store;
});
unwrapExports(store);
var store_1 = store.StoreHandler;

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var inited = false;
function init() {
  inited = true;
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }
  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;
}
function toByteArray(b64) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4');
  }
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;
  arr = new Arr(len * 3 / 4 - placeHolders);
  l = placeHolders > 0 ? len - 4 : len;
  var L = 0;
  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = tmp >> 16 & 0xFF;
    arr[L++] = tmp >> 8 & 0xFF;
    arr[L++] = tmp & 0xFF;
  }
  if (placeHolders === 2) {
    tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
    arr[L++] = tmp & 0xFF;
  } else if (placeHolders === 1) {
    tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
    arr[L++] = tmp >> 8 & 0xFF;
    arr[L++] = tmp & 0xFF;
  }
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
}
function encodeChunk(uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2];
    output.push(tripletToBase64(tmp));
  }
  return output.join('');
}
function fromByteArray(uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3;
  var output = '';
  var parts = [];
  var maxChunkLength = 16383;
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
  }
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[tmp << 4 & 0x3F];
    output += '==';
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    output += lookup[tmp >> 10];
    output += lookup[tmp >> 4 & 0x3F];
    output += lookup[tmp << 2 & 0x3F];
    output += '=';
  }
  parts.push(output);
  return parts.join('');
}

function read(buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? nBytes - 1 : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}
  m = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}
  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  var i = isLE ? 0 : nBytes - 1;
  var d = isLE ? 1 : -1;
  var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  value = Math.abs(value);
  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }
    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }
  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}
  e = e << mLen | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}
  buffer[offset + i - d] |= s * 128;
}

var toString = {}.toString;
var isArray = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
var INSPECT_MAX_BYTES = 50;
Buffer$2.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined ? global.TYPED_ARRAY_SUPPORT : true;
var _kMaxLength = kMaxLength();
function kMaxLength() {
  return Buffer$2.TYPED_ARRAY_SUPPORT ? 0x7fffffff : 0x3fffffff;
}
function createBuffer(that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length');
  }
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    that = new Uint8Array(length);
    that.__proto__ = Buffer$2.prototype;
  } else {
    if (that === null) {
      that = new Buffer$2(length);
    }
    that.length = length;
  }
  return that;
}
function Buffer$2(arg, encodingOrOffset, length) {
  if (!Buffer$2.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$2)) {
    return new Buffer$2(arg, encodingOrOffset, length);
  }
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error('If encoding is specified then the first argument must be a string');
    }
    return allocUnsafe(this, arg);
  }
  return from(this, arg, encodingOrOffset, length);
}
Buffer$2.poolSize = 8192;
Buffer$2._augment = function (arr) {
  arr.__proto__ = Buffer$2.prototype;
  return arr;
};
function from(that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number');
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length);
  }
  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset);
  }
  return fromObject(that, value);
}
Buffer$2.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length);
};
if (Buffer$2.TYPED_ARRAY_SUPPORT) {
  Buffer$2.prototype.__proto__ = Uint8Array.prototype;
  Buffer$2.__proto__ = Uint8Array;
  if (typeof Symbol !== 'undefined' && Symbol.species && Buffer$2[Symbol.species] === Buffer$2) {
  }
}
function assertSize(size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number');
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative');
  }
}
function alloc(that, size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size);
  }
  if (fill !== undefined) {
    return typeof encoding === 'string' ? createBuffer(that, size).fill(fill, encoding) : createBuffer(that, size).fill(fill);
  }
  return createBuffer(that, size);
}
Buffer$2.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding);
};
function allocUnsafe(that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer$2.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that;
}
Buffer$2.allocUnsafe = function (size) {
  return allocUnsafe(null, size);
};
Buffer$2.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size);
};
function fromString(that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }
  if (!Buffer$2.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding');
  }
  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);
  var actual = that.write(string, encoding);
  if (actual !== length) {
    that = that.slice(0, actual);
  }
  return that;
}
function fromArrayLike(that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that;
}
function fromArrayBuffer(that, array, byteOffset, length) {
  array.byteLength;
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds');
  }
  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds');
  }
  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    that = array;
    that.__proto__ = Buffer$2.prototype;
  } else {
    that = fromArrayLike(that, array);
  }
  return that;
}
function fromObject(that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);
    if (that.length === 0) {
      return that;
    }
    obj.copy(that, 0, 0, len);
    return that;
  }
  if (obj) {
    if (typeof ArrayBuffer !== 'undefined' && obj.buffer instanceof ArrayBuffer || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0);
      }
      return fromArrayLike(that, obj);
    }
    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data);
    }
  }
  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.');
}
function checked(length) {
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' + 'size: 0x' + kMaxLength().toString(16) + ' bytes');
  }
  return length | 0;
}
function SlowBuffer(length) {
  if (+length != length) {
    length = 0;
  }
  return Buffer$2.alloc(+length);
}
Buffer$2.isBuffer = isBuffer;
function internalIsBuffer(b) {
  return !!(b != null && b._isBuffer);
}
Buffer$2.compare = function compare(a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers');
  }
  if (a === b) return 0;
  var x = a.length;
  var y = b.length;
  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }
  if (x < y) return -1;
  if (y < x) return 1;
  return 0;
};
Buffer$2.isEncoding = function isEncoding(encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true;
    default:
      return false;
  }
};
Buffer$2.concat = function concat(list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers');
  }
  if (list.length === 0) {
    return Buffer$2.alloc(0);
  }
  var i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }
  var buffer = Buffer$2.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer;
};
function byteLength(string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length;
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' && (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength;
  }
  if (typeof string !== 'string') {
    string = '' + string;
  }
  var len = string.length;
  if (len === 0) return 0;
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len;
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length;
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2;
      case 'hex':
        return len >>> 1;
      case 'base64':
        return base64ToBytes(string).length;
      default:
        if (loweredCase) return utf8ToBytes(string).length;
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer$2.byteLength = byteLength;
function slowToString(encoding, start, end) {
  var loweredCase = false;
  if (start === undefined || start < 0) {
    start = 0;
  }
  if (start > this.length) {
    return '';
  }
  if (end === undefined || end > this.length) {
    end = this.length;
  }
  if (end <= 0) {
    return '';
  }
  end >>>= 0;
  start >>>= 0;
  if (end <= start) {
    return '';
  }
  if (!encoding) encoding = 'utf8';
  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end);
      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end);
      case 'ascii':
        return asciiSlice(this, start, end);
      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end);
      case 'base64':
        return base64Slice(this, start, end);
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end);
      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer$2.prototype._isBuffer = true;
function swap(b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}
Buffer$2.prototype.swap16 = function swap16() {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits');
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this;
};
Buffer$2.prototype.swap32 = function swap32() {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits');
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this;
};
Buffer$2.prototype.swap64 = function swap64() {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits');
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this;
};
Buffer$2.prototype.toString = function toString() {
  var length = this.length | 0;
  if (length === 0) return '';
  if (arguments.length === 0) return utf8Slice(this, 0, length);
  return slowToString.apply(this, arguments);
};
Buffer$2.prototype.equals = function equals(b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer');
  if (this === b) return true;
  return Buffer$2.compare(this, b) === 0;
};
Buffer$2.prototype.inspect = function inspect() {
  var str = '';
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }
  return '<Buffer ' + str + '>';
};
Buffer$2.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer');
  }
  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }
  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index');
  }
  if (thisStart >= thisEnd && start >= end) {
    return 0;
  }
  if (thisStart >= thisEnd) {
    return -1;
  }
  if (start >= end) {
    return 1;
  }
  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;
  if (this === target) return 0;
  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);
  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);
  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break;
    }
  }
  if (x < y) return -1;
  if (y < x) return 1;
  return 0;
};
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  if (buffer.length === 0) return -1;
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;
  if (isNaN(byteOffset)) {
    byteOffset = dir ? 0 : buffer.length - 1;
  }
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1;else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;else return -1;
  }
  if (typeof val === 'string') {
    val = Buffer$2.from(val, encoding);
  }
  if (internalIsBuffer(val)) {
    if (val.length === 0) {
      return -1;
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === 'number') {
    val = val & 0xFF;
    if (Buffer$2.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }
  throw new TypeError('val must be string, number or Buffer');
}
function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;
  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1;
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }
  function read$$1(buf, i) {
    if (indexSize === 1) {
      return buf[i];
    } else {
      return buf.readUInt16BE(i * indexSize);
    }
  }
  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read$$1(arr, i) === read$$1(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read$$1(arr, i + j) !== read$$1(val, j)) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
  }
  return -1;
}
Buffer$2.prototype.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1;
};
Buffer$2.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
};
Buffer$2.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
};
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }
  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string');
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i;
    buf[offset + i] = parsed;
  }
  return i;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function latin1Write(buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
Buffer$2.prototype.write = function write$$1(string, offset, length, encoding) {
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  } else {
    throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported');
  }
  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;
  if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds');
  }
  if (!encoding) encoding = 'utf8';
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length);
      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length);
      case 'ascii':
        return asciiWrite(this, string, offset, length);
      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length);
      case 'base64':
        return base64Write(this, string, offset, length);
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length);
      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};
Buffer$2.prototype.toJSON = function toJSON() {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  };
};
function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf);
  } else {
    return fromByteArray(buf.slice(start, end));
  }
}
function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];
  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = firstByte > 0xEF ? 4 : firstByte > 0xDF ? 3 : firstByte > 0xBF ? 2 : 1;
    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | secondByte & 0x3F;
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | thirdByte & 0x3F;
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | fourthByte & 0x3F;
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }
    if (codePoint === null) {
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }
    res.push(codePoint);
    i += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
var MAX_ARGUMENTS_LENGTH = 0x1000;
function decodeCodePointsArray(codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints);
  }
  var res = '';
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
  }
  return res;
}
function asciiSlice(buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);
  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret;
}
function latin1Slice(buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);
  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret;
}
function hexSlice(buf, start, end) {
  var len = buf.length;
  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;
  var out = '';
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }
  return out;
}
function utf16leSlice(buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res;
}
Buffer$2.prototype.slice = function slice(start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;
  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }
  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }
  if (end < start) end = start;
  var newBuf;
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer$2.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer$2(sliceLen, undefined);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }
  return newBuf;
};
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint');
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length');
}
Buffer$2.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);
  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  return val;
};
Buffer$2.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }
  var val = this[offset + --byteLength];
  var mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }
  return val;
};
Buffer$2.prototype.readUInt8 = function readUInt8(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset];
};
Buffer$2.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | this[offset + 1] << 8;
};
Buffer$2.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] << 8 | this[offset + 1];
};
Buffer$2.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 0x1000000;
};
Buffer$2.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] * 0x1000000 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
};
Buffer$2.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);
  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;
  if (val >= mul) val -= Math.pow(2, 8 * byteLength);
  return val;
};
Buffer$2.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);
  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;
  if (val >= mul) val -= Math.pow(2, 8 * byteLength);
  return val;
};
Buffer$2.prototype.readInt8 = function readInt8(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return this[offset];
  return (0xff - this[offset] + 1) * -1;
};
Buffer$2.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | this[offset + 1] << 8;
  return val & 0x8000 ? val | 0xFFFF0000 : val;
};
Buffer$2.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | this[offset] << 8;
  return val & 0x8000 ? val | 0xFFFF0000 : val;
};
Buffer$2.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
};
Buffer$2.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
};
Buffer$2.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4);
};
Buffer$2.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4);
};
Buffer$2.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8);
};
Buffer$2.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8);
};
function checkInt(buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length) throw new RangeError('Index out of range');
}
Buffer$2.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }
  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = value / mul & 0xFF;
  }
  return offset + byteLength;
};
Buffer$2.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }
  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = value / mul & 0xFF;
  }
  return offset + byteLength;
};
Buffer$2.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer$2.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = value & 0xff;
  return offset + 1;
};
function objectWriteUInt16(buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & 0xff << 8 * (littleEndian ? i : 1 - i)) >>> (littleEndian ? i : 1 - i) * 8;
  }
}
Buffer$2.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2;
};
Buffer$2.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 0xff;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2;
};
function objectWriteUInt32(buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = value >>> (littleEndian ? i : 3 - i) * 8 & 0xff;
  }
}
Buffer$2.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = value >>> 24;
    this[offset + 2] = value >>> 16;
    this[offset + 1] = value >>> 8;
    this[offset] = value & 0xff;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4;
};
Buffer$2.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4;
};
Buffer$2.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);
    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }
  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 0xFF;
  }
  return offset + byteLength;
};
Buffer$2.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);
    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }
  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 0xFF;
  }
  return offset + byteLength;
};
Buffer$2.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer$2.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = value & 0xff;
  return offset + 1;
};
Buffer$2.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2;
};
Buffer$2.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 0xff;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2;
};
Buffer$2.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 0xff;
    this[offset + 1] = value >>> 8;
    this[offset + 2] = value >>> 16;
    this[offset + 3] = value >>> 24;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4;
};
Buffer$2.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 0xff;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4;
};
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range');
  if (offset < 0) throw new RangeError('Index out of range');
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4;
}
Buffer$2.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert);
};
Buffer$2.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert);
};
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8;
}
Buffer$2.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert);
};
Buffer$2.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert);
};
Buffer$2.prototype.copy = function copy(target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;
  if (end === start) return 0;
  if (target.length === 0 || this.length === 0) return 0;
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds');
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds');
  if (end < 0) throw new RangeError('sourceEnd out of bounds');
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }
  var len = end - start;
  var i;
  if (this === target && start < targetStart && targetStart < end) {
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer$2.TYPED_ARRAY_SUPPORT) {
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
  }
  return len;
};
Buffer$2.prototype.fill = function fill(val, start, end, encoding) {
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string');
    }
    if (typeof encoding === 'string' && !Buffer$2.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding);
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  }
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index');
  }
  if (end <= start) {
    return this;
  }
  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;
  if (!val) val = 0;
  var i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val) ? val : utf8ToBytes(new Buffer$2(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }
  return this;
};
var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;
function base64clean(str) {
  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
  if (str.length < 2) return '';
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str;
}
function stringtrim(str) {
  if (str.trim) return str.trim();
  return str.replace(/^\s+|\s+$/g, '');
}
function toHex(n) {
  if (n < 16) return '0' + n.toString(16);
  return n.toString(16);
}
function utf8ToBytes(string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];
  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      if (!leadSurrogate) {
        if (codePoint > 0xDBFF) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue;
        } else if (i + 1 === length) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }
    leadSurrogate = null;
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break;
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break;
      bytes.push(codePoint >> 0x6 | 0xC0, codePoint & 0x3F | 0x80);
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break;
      bytes.push(codePoint >> 0xC | 0xE0, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break;
      bytes.push(codePoint >> 0x12 | 0xF0, codePoint >> 0xC & 0x3F | 0x80, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
    } else {
      throw new Error('Invalid code point');
    }
  }
  return bytes;
}
function asciiToBytes(str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray;
}
function utf16leToBytes(str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break;
    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) break;
    dst[i + offset] = src[i];
  }
  return i;
}
function isnan(val) {
  return val !== val;
}
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj));
}
function isFastBuffer(obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj);
}
function isSlowBuffer(obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0));
}

var bufferEs6 = Object.freeze({
	INSPECT_MAX_BYTES: INSPECT_MAX_BYTES,
	kMaxLength: _kMaxLength,
	Buffer: Buffer$2,
	SlowBuffer: SlowBuffer,
	isBuffer: isBuffer
});

var safeBuffer = createCommonjsModule$1(function (module, exports) {
  var Buffer = bufferEs6.Buffer;
  function copyProps(src, dst) {
    for (var key in src) {
      dst[key] = src[key];
    }
  }
  if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
    module.exports = bufferEs6;
  } else {
    copyProps(bufferEs6, exports);
    exports.Buffer = SafeBuffer;
  }
  function SafeBuffer(arg, encodingOrOffset, length) {
    return Buffer(arg, encodingOrOffset, length);
  }
  copyProps(Buffer, SafeBuffer);
  SafeBuffer.from = function (arg, encodingOrOffset, length) {
    if (typeof arg === 'number') {
      throw new TypeError('Argument must not be a number');
    }
    return Buffer(arg, encodingOrOffset, length);
  };
  SafeBuffer.alloc = function (size, fill, encoding) {
    if (typeof size !== 'number') {
      throw new TypeError('Argument must be a number');
    }
    var buf = Buffer(size);
    if (fill !== undefined) {
      if (typeof encoding === 'string') {
        buf.fill(fill, encoding);
      } else {
        buf.fill(fill);
      }
    } else {
      buf.fill(0);
    }
    return buf;
  };
  SafeBuffer.allocUnsafe = function (size) {
    if (typeof size !== 'number') {
      throw new TypeError('Argument must be a number');
    }
    return Buffer(size);
  };
  SafeBuffer.allocUnsafeSlow = function (size) {
    if (typeof size !== 'number') {
      throw new TypeError('Argument must be a number');
    }
    return bufferEs6.SlowBuffer(size);
  };
});

var Buffer$3 = safeBuffer.Buffer;
function check(buffer) {
  if (buffer.length < 8) return false;
  if (buffer.length > 72) return false;
  if (buffer[0] !== 0x30) return false;
  if (buffer[1] !== buffer.length - 2) return false;
  if (buffer[2] !== 0x02) return false;
  var lenR = buffer[3];
  if (lenR === 0) return false;
  if (5 + lenR >= buffer.length) return false;
  if (buffer[4 + lenR] !== 0x02) return false;
  var lenS = buffer[5 + lenR];
  if (lenS === 0) return false;
  if (6 + lenR + lenS !== buffer.length) return false;
  if (buffer[4] & 0x80) return false;
  if (lenR > 1 && buffer[4] === 0x00 && !(buffer[5] & 0x80)) return false;
  if (buffer[lenR + 6] & 0x80) return false;
  if (lenS > 1 && buffer[lenR + 6] === 0x00 && !(buffer[lenR + 7] & 0x80)) return false;
  return true;
}
function decode$1(buffer) {
  if (buffer.length < 8) throw new Error('DER sequence length is too short');
  if (buffer.length > 72) throw new Error('DER sequence length is too long');
  if (buffer[0] !== 0x30) throw new Error('Expected DER sequence');
  if (buffer[1] !== buffer.length - 2) throw new Error('DER sequence length is invalid');
  if (buffer[2] !== 0x02) throw new Error('Expected DER integer');
  var lenR = buffer[3];
  if (lenR === 0) throw new Error('R length is zero');
  if (5 + lenR >= buffer.length) throw new Error('R length is too long');
  if (buffer[4 + lenR] !== 0x02) throw new Error('Expected DER integer (2)');
  var lenS = buffer[5 + lenR];
  if (lenS === 0) throw new Error('S length is zero');
  if (6 + lenR + lenS !== buffer.length) throw new Error('S length is invalid');
  if (buffer[4] & 0x80) throw new Error('R value is negative');
  if (lenR > 1 && buffer[4] === 0x00 && !(buffer[5] & 0x80)) throw new Error('R value excessively padded');
  if (buffer[lenR + 6] & 0x80) throw new Error('S value is negative');
  if (lenS > 1 && buffer[lenR + 6] === 0x00 && !(buffer[lenR + 7] & 0x80)) throw new Error('S value excessively padded');
  return {
    r: buffer.slice(4, 4 + lenR),
    s: buffer.slice(6 + lenR)
  };
}
function encode$2(r, s) {
  var lenR = r.length;
  var lenS = s.length;
  if (lenR === 0) throw new Error('R length is zero');
  if (lenS === 0) throw new Error('S length is zero');
  if (lenR > 33) throw new Error('R length is too long');
  if (lenS > 33) throw new Error('S length is too long');
  if (r[0] & 0x80) throw new Error('R value is negative');
  if (s[0] & 0x80) throw new Error('S value is negative');
  if (lenR > 1 && r[0] === 0x00 && !(r[1] & 0x80)) throw new Error('R value excessively padded');
  if (lenS > 1 && s[0] === 0x00 && !(s[1] & 0x80)) throw new Error('S value excessively padded');
  var signature = Buffer$3.allocUnsafe(6 + lenR + lenS);
  signature[0] = 0x30;
  signature[1] = signature.length - 2;
  signature[2] = 0x02;
  signature[3] = r.length;
  r.copy(signature, 4);
  signature[4 + lenR] = 0x02;
  signature[5 + lenR] = s.length;
  s.copy(signature, 6 + lenR);
  return signature;
}
var bip66 = {
  check: check,
  decode: decode$1,
  encode: encode$2
};

var OP_FALSE = 0;
var OP_0 = 0;
var OP_PUSHDATA1 = 76;
var OP_PUSHDATA2 = 77;
var OP_PUSHDATA4 = 78;
var OP_1NEGATE = 79;
var OP_RESERVED = 80;
var OP_1 = 81;
var OP_TRUE = 81;
var OP_2 = 82;
var OP_3 = 83;
var OP_4 = 84;
var OP_5 = 85;
var OP_6 = 86;
var OP_7 = 87;
var OP_8 = 88;
var OP_9 = 89;
var OP_10 = 90;
var OP_11 = 91;
var OP_12 = 92;
var OP_13 = 93;
var OP_14 = 94;
var OP_15 = 95;
var OP_16 = 96;
var OP_NOP = 97;
var OP_VER = 98;
var OP_IF = 99;
var OP_NOTIF = 100;
var OP_VERIF = 101;
var OP_VERNOTIF = 102;
var OP_ELSE = 103;
var OP_ENDIF = 104;
var OP_VERIFY = 105;
var OP_RETURN = 106;
var OP_TOALTSTACK = 107;
var OP_FROMALTSTACK = 108;
var OP_2DROP = 109;
var OP_2DUP = 110;
var OP_3DUP = 111;
var OP_2OVER = 112;
var OP_2ROT = 113;
var OP_2SWAP = 114;
var OP_IFDUP = 115;
var OP_DEPTH = 116;
var OP_DROP = 117;
var OP_DUP = 118;
var OP_NIP = 119;
var OP_OVER = 120;
var OP_PICK = 121;
var OP_ROLL = 122;
var OP_ROT = 123;
var OP_SWAP = 124;
var OP_TUCK = 125;
var OP_CAT = 126;
var OP_SUBSTR = 127;
var OP_LEFT = 128;
var OP_RIGHT = 129;
var OP_SIZE = 130;
var OP_INVERT = 131;
var OP_AND = 132;
var OP_OR = 133;
var OP_XOR = 134;
var OP_EQUAL = 135;
var OP_EQUALVERIFY = 136;
var OP_RESERVED1 = 137;
var OP_RESERVED2 = 138;
var OP_1ADD = 139;
var OP_1SUB = 140;
var OP_2MUL = 141;
var OP_2DIV = 142;
var OP_NEGATE = 143;
var OP_ABS = 144;
var OP_NOT = 145;
var OP_0NOTEQUAL = 146;
var OP_ADD = 147;
var OP_SUB = 148;
var OP_MUL = 149;
var OP_DIV = 150;
var OP_MOD = 151;
var OP_LSHIFT = 152;
var OP_RSHIFT = 153;
var OP_BOOLAND = 154;
var OP_BOOLOR = 155;
var OP_NUMEQUAL = 156;
var OP_NUMEQUALVERIFY = 157;
var OP_NUMNOTEQUAL = 158;
var OP_LESSTHAN = 159;
var OP_GREATERTHAN = 160;
var OP_LESSTHANOREQUAL = 161;
var OP_GREATERTHANOREQUAL = 162;
var OP_MIN = 163;
var OP_MAX = 164;
var OP_WITHIN = 165;
var OP_RIPEMD160 = 166;
var OP_SHA1 = 167;
var OP_SHA256 = 168;
var OP_HASH160 = 169;
var OP_HASH256 = 170;
var OP_CODESEPARATOR = 171;
var OP_CHECKSIG = 172;
var OP_CHECKSIGVERIFY = 173;
var OP_CHECKMULTISIG = 174;
var OP_CHECKMULTISIGVERIFY = 175;
var OP_NOP1 = 176;
var OP_NOP2 = 177;
var OP_CHECKLOCKTIMEVERIFY = 177;
var OP_NOP3 = 178;
var OP_CHECKSEQUENCEVERIFY = 178;
var OP_NOP4 = 179;
var OP_NOP5 = 180;
var OP_NOP6 = 181;
var OP_NOP7 = 182;
var OP_NOP8 = 183;
var OP_NOP9 = 184;
var OP_NOP10 = 185;
var OP_PUBKEYHASH = 253;
var OP_PUBKEY = 254;
var OP_INVALIDOPCODE = 255;
var index$2 = {
	OP_FALSE: OP_FALSE,
	OP_0: OP_0,
	OP_PUSHDATA1: OP_PUSHDATA1,
	OP_PUSHDATA2: OP_PUSHDATA2,
	OP_PUSHDATA4: OP_PUSHDATA4,
	OP_1NEGATE: OP_1NEGATE,
	OP_RESERVED: OP_RESERVED,
	OP_1: OP_1,
	OP_TRUE: OP_TRUE,
	OP_2: OP_2,
	OP_3: OP_3,
	OP_4: OP_4,
	OP_5: OP_5,
	OP_6: OP_6,
	OP_7: OP_7,
	OP_8: OP_8,
	OP_9: OP_9,
	OP_10: OP_10,
	OP_11: OP_11,
	OP_12: OP_12,
	OP_13: OP_13,
	OP_14: OP_14,
	OP_15: OP_15,
	OP_16: OP_16,
	OP_NOP: OP_NOP,
	OP_VER: OP_VER,
	OP_IF: OP_IF,
	OP_NOTIF: OP_NOTIF,
	OP_VERIF: OP_VERIF,
	OP_VERNOTIF: OP_VERNOTIF,
	OP_ELSE: OP_ELSE,
	OP_ENDIF: OP_ENDIF,
	OP_VERIFY: OP_VERIFY,
	OP_RETURN: OP_RETURN,
	OP_TOALTSTACK: OP_TOALTSTACK,
	OP_FROMALTSTACK: OP_FROMALTSTACK,
	OP_2DROP: OP_2DROP,
	OP_2DUP: OP_2DUP,
	OP_3DUP: OP_3DUP,
	OP_2OVER: OP_2OVER,
	OP_2ROT: OP_2ROT,
	OP_2SWAP: OP_2SWAP,
	OP_IFDUP: OP_IFDUP,
	OP_DEPTH: OP_DEPTH,
	OP_DROP: OP_DROP,
	OP_DUP: OP_DUP,
	OP_NIP: OP_NIP,
	OP_OVER: OP_OVER,
	OP_PICK: OP_PICK,
	OP_ROLL: OP_ROLL,
	OP_ROT: OP_ROT,
	OP_SWAP: OP_SWAP,
	OP_TUCK: OP_TUCK,
	OP_CAT: OP_CAT,
	OP_SUBSTR: OP_SUBSTR,
	OP_LEFT: OP_LEFT,
	OP_RIGHT: OP_RIGHT,
	OP_SIZE: OP_SIZE,
	OP_INVERT: OP_INVERT,
	OP_AND: OP_AND,
	OP_OR: OP_OR,
	OP_XOR: OP_XOR,
	OP_EQUAL: OP_EQUAL,
	OP_EQUALVERIFY: OP_EQUALVERIFY,
	OP_RESERVED1: OP_RESERVED1,
	OP_RESERVED2: OP_RESERVED2,
	OP_1ADD: OP_1ADD,
	OP_1SUB: OP_1SUB,
	OP_2MUL: OP_2MUL,
	OP_2DIV: OP_2DIV,
	OP_NEGATE: OP_NEGATE,
	OP_ABS: OP_ABS,
	OP_NOT: OP_NOT,
	OP_0NOTEQUAL: OP_0NOTEQUAL,
	OP_ADD: OP_ADD,
	OP_SUB: OP_SUB,
	OP_MUL: OP_MUL,
	OP_DIV: OP_DIV,
	OP_MOD: OP_MOD,
	OP_LSHIFT: OP_LSHIFT,
	OP_RSHIFT: OP_RSHIFT,
	OP_BOOLAND: OP_BOOLAND,
	OP_BOOLOR: OP_BOOLOR,
	OP_NUMEQUAL: OP_NUMEQUAL,
	OP_NUMEQUALVERIFY: OP_NUMEQUALVERIFY,
	OP_NUMNOTEQUAL: OP_NUMNOTEQUAL,
	OP_LESSTHAN: OP_LESSTHAN,
	OP_GREATERTHAN: OP_GREATERTHAN,
	OP_LESSTHANOREQUAL: OP_LESSTHANOREQUAL,
	OP_GREATERTHANOREQUAL: OP_GREATERTHANOREQUAL,
	OP_MIN: OP_MIN,
	OP_MAX: OP_MAX,
	OP_WITHIN: OP_WITHIN,
	OP_RIPEMD160: OP_RIPEMD160,
	OP_SHA1: OP_SHA1,
	OP_SHA256: OP_SHA256,
	OP_HASH160: OP_HASH160,
	OP_HASH256: OP_HASH256,
	OP_CODESEPARATOR: OP_CODESEPARATOR,
	OP_CHECKSIG: OP_CHECKSIG,
	OP_CHECKSIGVERIFY: OP_CHECKSIGVERIFY,
	OP_CHECKMULTISIG: OP_CHECKMULTISIG,
	OP_CHECKMULTISIGVERIFY: OP_CHECKMULTISIGVERIFY,
	OP_NOP1: OP_NOP1,
	OP_NOP2: OP_NOP2,
	OP_CHECKLOCKTIMEVERIFY: OP_CHECKLOCKTIMEVERIFY,
	OP_NOP3: OP_NOP3,
	OP_CHECKSEQUENCEVERIFY: OP_CHECKSEQUENCEVERIFY,
	OP_NOP4: OP_NOP4,
	OP_NOP5: OP_NOP5,
	OP_NOP6: OP_NOP6,
	OP_NOP7: OP_NOP7,
	OP_NOP8: OP_NOP8,
	OP_NOP9: OP_NOP9,
	OP_NOP10: OP_NOP10,
	OP_PUBKEYHASH: OP_PUBKEYHASH,
	OP_PUBKEY: OP_PUBKEY,
	OP_INVALIDOPCODE: OP_INVALIDOPCODE
};

var bitcoinOps = Object.freeze({
	OP_FALSE: OP_FALSE,
	OP_0: OP_0,
	OP_PUSHDATA1: OP_PUSHDATA1,
	OP_PUSHDATA2: OP_PUSHDATA2,
	OP_PUSHDATA4: OP_PUSHDATA4,
	OP_1NEGATE: OP_1NEGATE,
	OP_RESERVED: OP_RESERVED,
	OP_1: OP_1,
	OP_TRUE: OP_TRUE,
	OP_2: OP_2,
	OP_3: OP_3,
	OP_4: OP_4,
	OP_5: OP_5,
	OP_6: OP_6,
	OP_7: OP_7,
	OP_8: OP_8,
	OP_9: OP_9,
	OP_10: OP_10,
	OP_11: OP_11,
	OP_12: OP_12,
	OP_13: OP_13,
	OP_14: OP_14,
	OP_15: OP_15,
	OP_16: OP_16,
	OP_NOP: OP_NOP,
	OP_VER: OP_VER,
	OP_IF: OP_IF,
	OP_NOTIF: OP_NOTIF,
	OP_VERIF: OP_VERIF,
	OP_VERNOTIF: OP_VERNOTIF,
	OP_ELSE: OP_ELSE,
	OP_ENDIF: OP_ENDIF,
	OP_VERIFY: OP_VERIFY,
	OP_RETURN: OP_RETURN,
	OP_TOALTSTACK: OP_TOALTSTACK,
	OP_FROMALTSTACK: OP_FROMALTSTACK,
	OP_2DROP: OP_2DROP,
	OP_2DUP: OP_2DUP,
	OP_3DUP: OP_3DUP,
	OP_2OVER: OP_2OVER,
	OP_2ROT: OP_2ROT,
	OP_2SWAP: OP_2SWAP,
	OP_IFDUP: OP_IFDUP,
	OP_DEPTH: OP_DEPTH,
	OP_DROP: OP_DROP,
	OP_DUP: OP_DUP,
	OP_NIP: OP_NIP,
	OP_OVER: OP_OVER,
	OP_PICK: OP_PICK,
	OP_ROLL: OP_ROLL,
	OP_ROT: OP_ROT,
	OP_SWAP: OP_SWAP,
	OP_TUCK: OP_TUCK,
	OP_CAT: OP_CAT,
	OP_SUBSTR: OP_SUBSTR,
	OP_LEFT: OP_LEFT,
	OP_RIGHT: OP_RIGHT,
	OP_SIZE: OP_SIZE,
	OP_INVERT: OP_INVERT,
	OP_AND: OP_AND,
	OP_OR: OP_OR,
	OP_XOR: OP_XOR,
	OP_EQUAL: OP_EQUAL,
	OP_EQUALVERIFY: OP_EQUALVERIFY,
	OP_RESERVED1: OP_RESERVED1,
	OP_RESERVED2: OP_RESERVED2,
	OP_1ADD: OP_1ADD,
	OP_1SUB: OP_1SUB,
	OP_2MUL: OP_2MUL,
	OP_2DIV: OP_2DIV,
	OP_NEGATE: OP_NEGATE,
	OP_ABS: OP_ABS,
	OP_NOT: OP_NOT,
	OP_0NOTEQUAL: OP_0NOTEQUAL,
	OP_ADD: OP_ADD,
	OP_SUB: OP_SUB,
	OP_MUL: OP_MUL,
	OP_DIV: OP_DIV,
	OP_MOD: OP_MOD,
	OP_LSHIFT: OP_LSHIFT,
	OP_RSHIFT: OP_RSHIFT,
	OP_BOOLAND: OP_BOOLAND,
	OP_BOOLOR: OP_BOOLOR,
	OP_NUMEQUAL: OP_NUMEQUAL,
	OP_NUMEQUALVERIFY: OP_NUMEQUALVERIFY,
	OP_NUMNOTEQUAL: OP_NUMNOTEQUAL,
	OP_LESSTHAN: OP_LESSTHAN,
	OP_GREATERTHAN: OP_GREATERTHAN,
	OP_LESSTHANOREQUAL: OP_LESSTHANOREQUAL,
	OP_GREATERTHANOREQUAL: OP_GREATERTHANOREQUAL,
	OP_MIN: OP_MIN,
	OP_MAX: OP_MAX,
	OP_WITHIN: OP_WITHIN,
	OP_RIPEMD160: OP_RIPEMD160,
	OP_SHA1: OP_SHA1,
	OP_SHA256: OP_SHA256,
	OP_HASH160: OP_HASH160,
	OP_HASH256: OP_HASH256,
	OP_CODESEPARATOR: OP_CODESEPARATOR,
	OP_CHECKSIG: OP_CHECKSIG,
	OP_CHECKSIGVERIFY: OP_CHECKSIGVERIFY,
	OP_CHECKMULTISIG: OP_CHECKMULTISIG,
	OP_CHECKMULTISIGVERIFY: OP_CHECKMULTISIGVERIFY,
	OP_NOP1: OP_NOP1,
	OP_NOP2: OP_NOP2,
	OP_CHECKLOCKTIMEVERIFY: OP_CHECKLOCKTIMEVERIFY,
	OP_NOP3: OP_NOP3,
	OP_CHECKSEQUENCEVERIFY: OP_CHECKSEQUENCEVERIFY,
	OP_NOP4: OP_NOP4,
	OP_NOP5: OP_NOP5,
	OP_NOP6: OP_NOP6,
	OP_NOP7: OP_NOP7,
	OP_NOP8: OP_NOP8,
	OP_NOP9: OP_NOP9,
	OP_NOP10: OP_NOP10,
	OP_PUBKEYHASH: OP_PUBKEYHASH,
	OP_PUBKEY: OP_PUBKEY,
	OP_INVALIDOPCODE: OP_INVALIDOPCODE,
	default: index$2
});

var ops = ( bitcoinOps && index$2 ) || bitcoinOps;

function encodingLength(i) {
  return i < ops.OP_PUSHDATA1 ? 1 : i <= 0xff ? 2 : i <= 0xffff ? 3 : 5;
}
function encode$3(buffer, number, offset) {
  var size = encodingLength(number);
  if (size === 1) {
    buffer.writeUInt8(number, offset);
  } else if (size === 2) {
    buffer.writeUInt8(ops.OP_PUSHDATA1, offset);
    buffer.writeUInt8(number, offset + 1);
  } else if (size === 3) {
    buffer.writeUInt8(ops.OP_PUSHDATA2, offset);
    buffer.writeUInt16LE(number, offset + 1);
  } else {
    buffer.writeUInt8(ops.OP_PUSHDATA4, offset);
    buffer.writeUInt32LE(number, offset + 1);
  }
  return size;
}
function decode$2(buffer, offset) {
  var opcode = buffer.readUInt8(offset);
  var number, size;
  if (opcode < ops.OP_PUSHDATA1) {
    number = opcode;
    size = 1;
  } else if (opcode === ops.OP_PUSHDATA1) {
    if (offset + 2 > buffer.length) return null;
    number = buffer.readUInt8(offset + 1);
    size = 2;
  } else if (opcode === ops.OP_PUSHDATA2) {
    if (offset + 3 > buffer.length) return null;
    number = buffer.readUInt16LE(offset + 1);
    size = 3;
  } else {
    if (offset + 5 > buffer.length) return null;
    if (opcode !== ops.OP_PUSHDATA4) throw new Error('Unexpected opcode');
    number = buffer.readUInt32LE(offset + 1);
    size = 5;
  }
  return {
    opcode: opcode,
    number: number,
    size: size
  };
}
var pushdataBitcoin = {
  encodingLength: encodingLength,
  encode: encode$3,
  decode: decode$2
};

var types = {
  Array: function (value) {
    return value !== null && value !== undefined && value.constructor === Array;
  },
  Boolean: function (value) {
    return typeof value === 'boolean';
  },
  Function: function (value) {
    return typeof value === 'function';
  },
  Nil: function (value) {
    return value === undefined || value === null;
  },
  Number: function (value) {
    return typeof value === 'number';
  },
  Object: function (value) {
    return typeof value === 'object';
  },
  String: function (value) {
    return typeof value === 'string';
  },
  '': function () {
    return true;
  }
};types.Null = types.Nil;
for (var typeName$1 in types) {
  types[typeName$1].toJSON = function (t) {
    return t;
  }.bind(null, typeName$1);
}
var native_1 = types;

function getTypeName(fn) {
  return fn.name || fn.toString().match(/function (.*?)\s*\(/)[1];
}
function getValueTypeName$1(value) {
  return native_1.Nil(value) ? '' : getTypeName(value.constructor);
}
function getValue(value) {
  if (native_1.Function(value)) return '';
  if (native_1.String(value)) return JSON.stringify(value);
  if (value && native_1.Object(value)) return '';
  return value;
}
function tfJSON$1(type) {
  if (native_1.Function(type)) return type.toJSON ? type.toJSON() : getTypeName(type);
  if (native_1.Array(type)) return 'Array';
  if (type && native_1.Object(type)) return 'Object';
  return type !== undefined ? type : '';
}
function tfErrorString(type, value, valueTypeName) {
  var valueJson = getValue(value);
  return 'Expected ' + tfJSON$1(type) + ', got' + (valueTypeName !== '' ? ' ' + valueTypeName : '') + (valueJson !== '' ? ' ' + valueJson : '');
}
function TfTypeError$1(type, value, valueTypeName) {
  valueTypeName = valueTypeName || getValueTypeName$1(value);
  this.message = tfErrorString(type, value, valueTypeName);
  Error.captureStackTrace(this, TfTypeError$1);
  this.__type = type;
  this.__value = value;
  this.__valueTypeName = valueTypeName;
}
TfTypeError$1.prototype = Object.create(Error.prototype);
TfTypeError$1.prototype.constructor = TfTypeError$1;
function tfPropertyErrorString(type, label, name, value, valueTypeName) {
  var description = '" of type ';
  if (label === 'key') description = '" with key type ';
  return tfErrorString('property "' + tfJSON$1(name) + description + tfJSON$1(type), value, valueTypeName);
}
function TfPropertyTypeError$1(type, property, label, value, valueTypeName) {
  if (type) {
    valueTypeName = valueTypeName || getValueTypeName$1(value);
    this.message = tfPropertyErrorString(type, label, property, value, valueTypeName);
  } else {
    this.message = 'Unexpected property "' + property + '"';
  }
  Error.captureStackTrace(this, TfTypeError$1);
  this.__label = label;
  this.__property = property;
  this.__type = type;
  this.__value = value;
  this.__valueTypeName = valueTypeName;
}
TfPropertyTypeError$1.prototype = Object.create(Error.prototype);
TfPropertyTypeError$1.prototype.constructor = TfTypeError$1;
function tfCustomError(expected, actual) {
  return new TfTypeError$1(expected, {}, actual);
}
function tfSubError$1(e, property, label) {
  if (e instanceof TfPropertyTypeError$1) {
    property = property + '.' + e.__property;
    e = new TfPropertyTypeError$1(e.__type, property, e.__label, e.__value, e.__valueTypeName);
  } else if (e instanceof TfTypeError$1) {
    e = new TfPropertyTypeError$1(e.__type, property, label, e.__value, e.__valueTypeName);
  }
  Error.captureStackTrace(e);
  return e;
}
var errors = {
  TfTypeError: TfTypeError$1,
  TfPropertyTypeError: TfPropertyTypeError$1,
  tfCustomError: tfCustomError,
  tfSubError: tfSubError$1,
  tfJSON: tfJSON$1,
  getValueTypeName: getValueTypeName$1
};

function _Buffer(value) {
  return Buffer.isBuffer(value);
}
function Hex(value) {
  return typeof value === 'string' && /^([0-9a-f]{2})+$/i.test(value);
}
function _LengthN(type, length) {
  var name = type.toJSON();
  function Length(value) {
    if (!type(value)) return false;
    if (value.length === length) return true;
    throw errors.tfCustomError(name + '(Length: ' + length + ')', name + '(Length: ' + value.length + ')');
  }
  Length.toJSON = function () {
    return name;
  };
  return Length;
}
var _ArrayN = _LengthN.bind(null, native_1.Array);
var _BufferN = _LengthN.bind(null, _Buffer);
var _HexN = _LengthN.bind(null, Hex);
var _StringN = _LengthN.bind(null, native_1.String);
var UINT53_MAX = Math.pow(2, 53) - 1;
function Finite(value) {
  return typeof value === 'number' && isFinite(value);
}
function Int8(value) {
  return value << 24 >> 24 === value;
}
function Int16(value) {
  return value << 16 >> 16 === value;
}
function Int32(value) {
  return (value | 0) === value;
}
function UInt8(value) {
  return (value & 0xff) === value;
}
function UInt16(value) {
  return (value & 0xffff) === value;
}
function UInt32(value) {
  return value >>> 0 === value;
}
function UInt53(value) {
  return typeof value === 'number' && value >= 0 && value <= UINT53_MAX && Math.floor(value) === value;
}
var types$1 = {
  ArrayN: _ArrayN,
  Buffer: _Buffer,
  BufferN: _BufferN,
  Finite: Finite,
  Hex: Hex,
  HexN: _HexN,
  Int8: Int8,
  Int16: Int16,
  Int32: Int32,
  StringN: _StringN,
  UInt8: UInt8,
  UInt16: UInt16,
  UInt32: UInt32,
  UInt53: UInt53
};
for (var typeName$2 in types$1) {
  types$1[typeName$2].toJSON = function (t) {
    return t;
  }.bind(null, typeName$2);
}
var extra = types$1;

var tfJSON = errors.tfJSON;
var TfTypeError = errors.TfTypeError;
var TfPropertyTypeError = errors.TfPropertyTypeError;
var tfSubError = errors.tfSubError;
var getValueTypeName = errors.getValueTypeName;
var TYPES = {
  arrayOf: function arrayOf(type) {
    type = compile$1(type);
    function _arrayOf(array, strict) {
      if (!native_1.Array(array)) return false;
      if (native_1.Nil(array)) return false;
      return array.every(function (value, i) {
        try {
          return typeforce(type, value, strict);
        } catch (e) {
          throw tfSubError(e, i);
        }
      });
    }
    _arrayOf.toJSON = function () {
      return '[' + tfJSON(type) + ']';
    };
    return _arrayOf;
  },
  maybe: function maybe(type) {
    type = compile$1(type);
    function _maybe(value, strict) {
      return native_1.Nil(value) || type(value, strict, maybe);
    }
    _maybe.toJSON = function () {
      return '?' + tfJSON(type);
    };
    return _maybe;
  },
  map: function map(propertyType, propertyKeyType) {
    propertyType = compile$1(propertyType);
    if (propertyKeyType) propertyKeyType = compile$1(propertyKeyType);
    function _map(value, strict) {
      if (!native_1.Object(value)) return false;
      if (native_1.Nil(value)) return false;
      for (var propertyName in value) {
        try {
          if (propertyKeyType) {
            typeforce(propertyKeyType, propertyName, strict);
          }
        } catch (e) {
          throw tfSubError(e, propertyName, 'key');
        }
        try {
          var propertyValue = value[propertyName];
          typeforce(propertyType, propertyValue, strict);
        } catch (e) {
          throw tfSubError(e, propertyName);
        }
      }
      return true;
    }
    if (propertyKeyType) {
      _map.toJSON = function () {
        return '{' + tfJSON(propertyKeyType) + ': ' + tfJSON(propertyType) + '}';
      };
    } else {
      _map.toJSON = function () {
        return '{' + tfJSON(propertyType) + '}';
      };
    }
    return _map;
  },
  object: function object(uncompiled) {
    var type = {};
    for (var typePropertyName in uncompiled) {
      type[typePropertyName] = compile$1(uncompiled[typePropertyName]);
    }
    function _object(value, strict) {
      if (!native_1.Object(value)) return false;
      if (native_1.Nil(value)) return false;
      var propertyName;
      try {
        for (propertyName in type) {
          var propertyType = type[propertyName];
          var propertyValue = value[propertyName];
          typeforce(propertyType, propertyValue, strict);
        }
      } catch (e) {
        throw tfSubError(e, propertyName);
      }
      if (strict) {
        for (propertyName in value) {
          if (type[propertyName]) continue;
          throw new TfPropertyTypeError(undefined, propertyName);
        }
      }
      return true;
    }
    _object.toJSON = function () {
      return tfJSON(type);
    };
    return _object;
  },
  oneOf: function oneOf() {
    var types = [].slice.call(arguments).map(compile$1);
    function _oneOf(value, strict) {
      return types.some(function (type) {
        try {
          return typeforce(type, value, strict);
        } catch (e) {
          return false;
        }
      });
    }
    _oneOf.toJSON = function () {
      return types.map(tfJSON).join('|');
    };
    return _oneOf;
  },
  quacksLike: function quacksLike(type) {
    function _quacksLike(value) {
      return type === getValueTypeName(value);
    }
    _quacksLike.toJSON = function () {
      return type;
    };
    return _quacksLike;
  },
  tuple: function tuple() {
    var types = [].slice.call(arguments).map(compile$1);
    function _tuple(values, strict) {
      if (native_1.Nil(values)) return false;
      if (native_1.Nil(values.length)) return false;
      if (strict && values.length !== types.length) return false;
      return types.every(function (type, i) {
        try {
          return typeforce(type, values[i], strict);
        } catch (e) {
          throw tfSubError(e, i);
        }
      });
    }
    _tuple.toJSON = function () {
      return '(' + types.map(tfJSON).join(', ') + ')';
    };
    return _tuple;
  },
  value: function value(expected) {
    function _value(actual) {
      return actual === expected;
    }
    _value.toJSON = function () {
      return expected;
    };
    return _value;
  }
};
function compile$1(type) {
  if (native_1.String(type)) {
    if (type[0] === '?') return TYPES.maybe(type.slice(1));
    return native_1[type] || TYPES.quacksLike(type);
  } else if (type && native_1.Object(type)) {
    if (native_1.Array(type)) return TYPES.arrayOf(type[0]);
    return TYPES.object(type);
  } else if (native_1.Function(type)) {
    return type;
  }
  return TYPES.value(type);
}
function typeforce(type, value, strict, surrogate) {
  if (native_1.Function(type)) {
    if (type(value, strict)) return true;
    throw new TfTypeError(surrogate || type, value);
  }
  return typeforce(compile$1(type), value, strict);
}
for (var typeName in native_1) {
  typeforce[typeName] = native_1[typeName];
}
for (typeName in TYPES) {
  typeforce[typeName] = TYPES[typeName];
}
for (typeName in extra) {
  typeforce[typeName] = extra[typeName];
}
function __async(type, value, strict, callback) {
  if (typeof strict === 'function') return __async(type, value, false, strict);
  try {
    typeforce(type, value, strict);
  } catch (e) {
    return callback(e);
  }
  callback();
}
typeforce.async = __async;
typeforce.compile = compile$1;
typeforce.TfTypeError = TfTypeError;
typeforce.TfPropertyTypeError = TfPropertyTypeError;
var typeforce_1 = typeforce;

var UINT31_MAX = Math.pow(2, 31) - 1;
function UInt31(value) {
  return typeforce_1.UInt32(value) && value <= UINT31_MAX;
}
function BIP32Path(value) {
  return typeforce_1.String(value) && value.match(/^(m\/)?(\d+'?\/)*\d+'?$/);
}
BIP32Path.toJSON = function () {
  return 'BIP32 derivation path';
};
var SATOSHI_MAX = 21 * 1e14;
function Satoshi(value) {
  return typeforce_1.UInt53(value) && value <= SATOSHI_MAX;
}
var BigInt = typeforce_1.quacksLike('BigInteger');
var ECPoint = typeforce_1.quacksLike('Point');
var ECSignature = typeforce_1.compile({ r: BigInt, s: BigInt });
var Network = typeforce_1.compile({
  messagePrefix: typeforce_1.oneOf(typeforce_1.Buffer, typeforce_1.String),
  bip32: {
    public: typeforce_1.UInt32,
    private: typeforce_1.UInt32
  },
  pubKeyHash: typeforce_1.UInt8,
  scriptHash: typeforce_1.UInt8,
  wif: typeforce_1.UInt8
});
var types$2 = {
  BigInt: BigInt,
  BIP32Path: BIP32Path,
  Buffer256bit: typeforce_1.BufferN(32),
  ECPoint: ECPoint,
  ECSignature: ECSignature,
  Hash160bit: typeforce_1.BufferN(20),
  Hash256bit: typeforce_1.BufferN(32),
  Network: Network,
  Satoshi: Satoshi,
  UInt31: UInt31
};
for (var typeName$3 in typeforce_1) {
  types$2[typeName$3] = typeforce_1[typeName$3];
}
var types_1 = types$2;

var Buffer$4 = safeBuffer.Buffer;
function decode$3(buffer, maxLength, minimal) {
  maxLength = maxLength || 4;
  minimal = minimal === undefined ? true : minimal;
  var length = buffer.length;
  if (length === 0) return 0;
  if (length > maxLength) throw new TypeError('Script number overflow');
  if (minimal) {
    if ((buffer[length - 1] & 0x7f) === 0) {
      if (length <= 1 || (buffer[length - 2] & 0x80) === 0) throw new Error('Non-minimally encoded script number');
    }
  }
  if (length === 5) {
    var a = buffer.readUInt32LE(0);
    var b = buffer.readUInt8(4);
    if (b & 0x80) return -((b & ~0x80) * 0x100000000 + a);
    return b * 0x100000000 + a;
  }
  var result = 0;
  for (var i = 0; i < length; ++i) {
    result |= buffer[i] << 8 * i;
  }
  if (buffer[length - 1] & 0x80) return -(result & ~(0x80 << 8 * (length - 1)));
  return result;
}
function scriptNumSize(i) {
  return i > 0x7fffffff ? 5 : i > 0x7fffff ? 4 : i > 0x7fff ? 3 : i > 0x7f ? 2 : i > 0x00 ? 1 : 0;
}
function encode$4(number) {
  var value = Math.abs(number);
  var size = scriptNumSize(value);
  var buffer = Buffer$4.allocUnsafe(size);
  var negative = number < 0;
  for (var i = 0; i < size; ++i) {
    buffer.writeUInt8(value & 0xff, i);
    value >>= 8;
  }
  if (buffer[size - 1] & 0x80) {
    buffer.writeUInt8(negative ? 0x80 : 0x00, size - 1);
  } else if (negative) {
    buffer[size - 1] |= 0x80;
  }
  return buffer;
}
var script_number = {
  decode: decode$3,
  encode: encode$4
};

var map = {};
for (var op in ops) {
  var code = ops[op];
  map[code] = op;
}
var map_1 = map;

var Buffer$1 = safeBuffer.Buffer;
var OP_INT_BASE = ops.OP_RESERVED;
function isOPInt(value) {
  return types_1.Number(value) && (value === ops.OP_0 || value >= ops.OP_1 && value <= ops.OP_16 || value === ops.OP_1NEGATE);
}
function isPushOnlyChunk(value) {
  return types_1.Buffer(value) || isOPInt(value);
}
function isPushOnly(value) {
  return types_1.Array(value) && value.every(isPushOnlyChunk);
}
function asMinimalOP(buffer) {
  if (buffer.length === 0) return ops.OP_0;
  if (buffer.length !== 1) return;
  if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
  if (buffer[0] === 0x81) return ops.OP_1NEGATE;
}
function compile(chunks) {
  if (Buffer$1.isBuffer(chunks)) return chunks;
  typeforce_1(types_1.Array, chunks);
  var bufferSize = chunks.reduce(function (accum, chunk) {
    if (Buffer$1.isBuffer(chunk)) {
      if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
        return accum + 1;
      }
      return accum + pushdataBitcoin.encodingLength(chunk.length) + chunk.length;
    }
    return accum + 1;
  }, 0.0);
  var buffer = Buffer$1.allocUnsafe(bufferSize);
  var offset = 0;
  chunks.forEach(function (chunk) {
    if (Buffer$1.isBuffer(chunk)) {
      var opcode = asMinimalOP(chunk);
      if (opcode !== undefined) {
        buffer.writeUInt8(opcode, offset);
        offset += 1;
        return;
      }
      offset += pushdataBitcoin.encode(buffer, chunk.length, offset);
      chunk.copy(buffer, offset);
      offset += chunk.length;
    } else {
      buffer.writeUInt8(chunk, offset);
      offset += 1;
    }
  });
  if (offset !== buffer.length) throw new Error('Could not decode chunks');
  return buffer;
}
function decompile(buffer) {
  if (types_1.Array(buffer)) return buffer;
  typeforce_1(types_1.Buffer, buffer);
  var chunks = [];
  var i = 0;
  while (i < buffer.length) {
    var opcode = buffer[i];
    if (opcode > ops.OP_0 && opcode <= ops.OP_PUSHDATA4) {
      var d = pushdataBitcoin.decode(buffer, i);
      if (d === null) return [];
      i += d.size;
      if (i + d.number > buffer.length) return [];
      var data = buffer.slice(i, i + d.number);
      i += d.number;
      var op = asMinimalOP(data);
      if (op !== undefined) {
        chunks.push(op);
      } else {
        chunks.push(data);
      }
    } else {
      chunks.push(opcode);
      i += 1;
    }
  }
  return chunks;
}
function toASM(chunks) {
  if (Buffer$1.isBuffer(chunks)) {
    chunks = decompile(chunks);
  }
  return chunks.map(function (chunk) {
    if (Buffer$1.isBuffer(chunk)) {
      var op = asMinimalOP(chunk);
      if (op === undefined) return chunk.toString('hex');
      chunk = op;
    }
    return map_1[chunk];
  }).join(' ');
}
function fromASM(asm) {
  typeforce_1(types_1.String, asm);
  return compile(asm.split(' ').map(function (chunkStr) {
    if (ops[chunkStr] !== undefined) return ops[chunkStr];
    typeforce_1(types_1.Hex, chunkStr);
    return Buffer$1.from(chunkStr, 'hex');
  }));
}
function toStack(chunks) {
  chunks = decompile(chunks);
  typeforce_1(isPushOnly, chunks);
  return chunks.map(function (op) {
    if (Buffer$1.isBuffer(op)) return op;
    if (op === ops.OP_0) return Buffer$1.allocUnsafe(0);
    return script_number.encode(op - OP_INT_BASE);
  });
}
function isCanonicalPubKey(buffer) {
  if (!Buffer$1.isBuffer(buffer)) return false;
  if (buffer.length < 33) return false;
  switch (buffer[0]) {
    case 0x02:
    case 0x03:
      return buffer.length === 33;
    case 0x04:
      return buffer.length === 65;
  }
  return false;
}
function isDefinedHashType(hashType) {
  var hashTypeMod = hashType & ~0x80;
  return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}
function isCanonicalSignature(buffer) {
  if (!Buffer$1.isBuffer(buffer)) return false;
  if (!isDefinedHashType(buffer[buffer.length - 1])) return false;
  return bip66.check(buffer.slice(0, -1));
}
var script = {
  compile: compile,
  decompile: decompile,
  fromASM: fromASM,
  toASM: toASM,
  toStack: toStack,
  number: script_number,
  isCanonicalPubKey: isCanonicalPubKey,
  isCanonicalSignature: isCanonicalSignature,
  isPushOnly: isPushOnly,
  isDefinedHashType: isDefinedHashType
};

var OP_INT_BASE$1 = ops.OP_RESERVED;
function check$2(script$$1, allowIncomplete) {
  var chunks = script.decompile(script$$1);
  if (chunks.length < 4) return false;
  if (chunks[chunks.length - 1] !== ops.OP_CHECKMULTISIG) return false;
  if (!types_1.Number(chunks[0])) return false;
  if (!types_1.Number(chunks[chunks.length - 2])) return false;
  var m = chunks[0] - OP_INT_BASE$1;
  var n = chunks[chunks.length - 2] - OP_INT_BASE$1;
  if (m <= 0) return false;
  if (n > 16) return false;
  if (m > n) return false;
  if (n !== chunks.length - 3) return false;
  if (allowIncomplete) return true;
  var keys = chunks.slice(1, -2);
  return keys.every(script.isCanonicalPubKey);
}
check$2.toJSON = function () {
  return 'multi-sig output';
};
function encode$6(m, pubKeys) {
  typeforce_1({
    m: types_1.Number,
    pubKeys: [script.isCanonicalPubKey]
  }, {
    m: m,
    pubKeys: pubKeys
  });
  var n = pubKeys.length;
  if (n < m) throw new TypeError('Not enough pubKeys provided');
  return script.compile([].concat(OP_INT_BASE$1 + m, pubKeys, OP_INT_BASE$1 + n, ops.OP_CHECKMULTISIG));
}
function decode$5(buffer, allowIncomplete) {
  var chunks = script.decompile(buffer);
  typeforce_1(check$2, chunks, allowIncomplete);
  return {
    m: chunks[0] - OP_INT_BASE$1,
    pubKeys: chunks.slice(1, -2)
  };
}
var output = {
  check: check$2,
  decode: decode$5,
  encode: encode$6
};

var Buffer$5 = safeBuffer.Buffer;
function partialSignature(value) {
  return value === ops.OP_0 || script.isCanonicalSignature(value);
}
function check$1(script$$1, allowIncomplete) {
  var chunks = script.decompile(script$$1);
  if (chunks.length < 2) return false;
  if (chunks[0] !== ops.OP_0) return false;
  if (allowIncomplete) {
    return chunks.slice(1).every(partialSignature);
  }
  return chunks.slice(1).every(script.isCanonicalSignature);
}
check$1.toJSON = function () {
  return 'multisig input';
};
var EMPTY_BUFFER = Buffer$5.allocUnsafe(0);
function encodeStack(signatures, scriptPubKey) {
  typeforce_1([partialSignature], signatures);
  if (scriptPubKey) {
    var scriptData = output.decode(scriptPubKey);
    if (signatures.length < scriptData.m) {
      throw new TypeError('Not enough signatures provided');
    }
    if (signatures.length > scriptData.pubKeys.length) {
      throw new TypeError('Too many signatures provided');
    }
  }
  return [].concat(EMPTY_BUFFER, signatures.map(function (sig) {
    if (sig === ops.OP_0) {
      return EMPTY_BUFFER;
    }
    return sig;
  }));
}
function encode$5(signatures, scriptPubKey) {
  return script.compile(encodeStack(signatures, scriptPubKey));
}
function decodeStack(stack, allowIncomplete) {
  typeforce_1(typeforce_1.Array, stack);
  typeforce_1(check$1, stack, allowIncomplete);
  return stack.slice(1);
}
function decode$4(buffer, allowIncomplete) {
  var stack = script.decompile(buffer);
  return decodeStack(stack, allowIncomplete);
}
var input = {
  check: check$1,
  decode: decode$4,
  decodeStack: decodeStack,
  encode: encode$5,
  encodeStack: encodeStack
};

var multisig = {
  input: input,
  output: output
};

function check$3(script$$1) {
  var buffer = script.compile(script$$1);
  return buffer.length > 1 && buffer[0] === ops.OP_RETURN;
}
check$3.toJSON = function () {
  return 'null data output';
};
function encode$7(data) {
  typeforce_1(types_1.Buffer, data);
  return script.compile([ops.OP_RETURN, data]);
}
function decode$6(buffer) {
  typeforce_1(check$3, buffer);
  return buffer.slice(2);
}
var nulldata = {
  output: {
    check: check$3,
    decode: decode$6,
    encode: encode$7
  }
};

function check$4(script$$1) {
  var chunks = script.decompile(script$$1);
  return chunks.length === 1 && script.isCanonicalSignature(chunks[0]);
}
check$4.toJSON = function () {
  return 'pubKey input';
};
function encodeStack$1(signature) {
  typeforce_1(script.isCanonicalSignature, signature);
  return [signature];
}
function encode$8(signature) {
  return script.compile(encodeStack$1(signature));
}
function decodeStack$1(stack) {
  typeforce_1(typeforce_1.Array, stack);
  typeforce_1(check$4, stack);
  return stack[0];
}
function decode$7(buffer) {
  var stack = script.decompile(buffer);
  return decodeStack$1(stack);
}
var input$2 = {
  check: check$4,
  decode: decode$7,
  decodeStack: decodeStack$1,
  encode: encode$8,
  encodeStack: encodeStack$1
};

function check$5(script$$1) {
  var chunks = script.decompile(script$$1);
  return chunks.length === 2 && script.isCanonicalPubKey(chunks[0]) && chunks[1] === ops.OP_CHECKSIG;
}
check$5.toJSON = function () {
  return 'pubKey output';
};
function encode$9(pubKey) {
  typeforce_1(script.isCanonicalPubKey, pubKey);
  return script.compile([pubKey, ops.OP_CHECKSIG]);
}
function decode$8(buffer) {
  var chunks = script.decompile(buffer);
  typeforce_1(check$5, chunks);
  return chunks[0];
}
var output$2 = {
  check: check$5,
  decode: decode$8,
  encode: encode$9
};

var pubkey = {
  input: input$2,
  output: output$2
};

function check$6(script$$1) {
  var chunks = script.decompile(script$$1);
  return chunks.length === 2 && script.isCanonicalSignature(chunks[0]) && script.isCanonicalPubKey(chunks[1]);
}
check$6.toJSON = function () {
  return 'pubKeyHash input';
};
function encodeStack$2(signature, pubKey) {
  typeforce_1({
    signature: script.isCanonicalSignature,
    pubKey: script.isCanonicalPubKey
  }, {
    signature: signature,
    pubKey: pubKey
  });
  return [signature, pubKey];
}
function encode$10(signature, pubKey) {
  return script.compile(encodeStack$2(signature, pubKey));
}
function decodeStack$2(stack) {
  typeforce_1(typeforce_1.Array, stack);
  typeforce_1(check$6, stack);
  return {
    signature: stack[0],
    pubKey: stack[1]
  };
}
function decode$9(buffer) {
  var stack = script.decompile(buffer);
  return decodeStack$2(stack);
}
var input$4 = {
  check: check$6,
  decode: decode$9,
  decodeStack: decodeStack$2,
  encode: encode$10,
  encodeStack: encodeStack$2
};

function check$7(script$$1) {
  var buffer = script.compile(script$$1);
  return buffer.length === 25 && buffer[0] === ops.OP_DUP && buffer[1] === ops.OP_HASH160 && buffer[2] === 0x14 && buffer[23] === ops.OP_EQUALVERIFY && buffer[24] === ops.OP_CHECKSIG;
}
check$7.toJSON = function () {
  return 'pubKeyHash output';
};
function encode$11(pubKeyHash) {
  typeforce_1(types_1.Hash160bit, pubKeyHash);
  return script.compile([ops.OP_DUP, ops.OP_HASH160, pubKeyHash, ops.OP_EQUALVERIFY, ops.OP_CHECKSIG]);
}
function decode$10(buffer) {
  typeforce_1(check$7, buffer);
  return buffer.slice(3, 23);
}
var output$4 = {
  check: check$7,
  decode: decode$10,
  encode: encode$11
};

var pubkeyhash = {
  input: input$4,
  output: output$4
};

function check$9(script$$1) {
  var buffer = script.compile(script$$1);
  return buffer.length === 22 && buffer[0] === ops.OP_0 && buffer[1] === 0x14;
}
check$9.toJSON = function () {
  return 'Witness pubKeyHash output';
};
function encode$13(pubKeyHash) {
  typeforce_1(types_1.Hash160bit, pubKeyHash);
  return script.compile([ops.OP_0, pubKeyHash]);
}
function decode$12(buffer) {
  typeforce_1(check$9, buffer);
  return buffer.slice(2);
}
var output$6 = {
  check: check$9,
  decode: decode$12,
  encode: encode$13
};

function check$10(script$$1) {
  var buffer = script.compile(script$$1);
  return buffer.length === 34 && buffer[0] === ops.OP_0 && buffer[1] === 0x20;
}
check$10.toJSON = function () {
  return 'Witness scriptHash output';
};
function encode$14(scriptHash) {
  typeforce_1(types_1.Hash256bit, scriptHash);
  return script.compile([ops.OP_0, scriptHash]);
}
function decode$13(buffer) {
  typeforce_1(check$10, buffer);
  return buffer.slice(2);
}
var output$8 = {
  check: check$10,
  decode: decode$13,
  encode: encode$14
};

var Buffer$6 = safeBuffer.Buffer;
function check$8(script$$1, allowIncomplete) {
  var chunks = script.decompile(script$$1);
  if (chunks.length < 1) return false;
  var lastChunk = chunks[chunks.length - 1];
  if (!Buffer$6.isBuffer(lastChunk)) return false;
  var scriptSigChunks = script.decompile(script.compile(chunks.slice(0, -1)));
  var redeemScriptChunks = script.decompile(lastChunk);
  if (redeemScriptChunks.length === 0) return false;
  if (!script.isPushOnly(scriptSigChunks)) return false;
  if (chunks.length === 1) {
    return output$8.check(redeemScriptChunks) || output$6.check(redeemScriptChunks);
  }
  if (pubkeyhash.input.check(scriptSigChunks) && pubkeyhash.output.check(redeemScriptChunks)) return true;
  if (multisig.input.check(scriptSigChunks, allowIncomplete) && multisig.output.check(redeemScriptChunks)) return true;
  if (pubkey.input.check(scriptSigChunks) && pubkey.output.check(redeemScriptChunks)) return true;
  return false;
}
check$8.toJSON = function () {
  return 'scriptHash input';
};
function encodeStack$3(redeemScriptStack, redeemScript) {
  var serializedScriptPubKey = script.compile(redeemScript);
  return [].concat(redeemScriptStack, serializedScriptPubKey);
}
function encode$12(redeemScriptSig, redeemScript) {
  var redeemScriptStack = script.decompile(redeemScriptSig);
  return script.compile(encodeStack$3(redeemScriptStack, redeemScript));
}
function decodeStack$3(stack) {
  typeforce_1(typeforce_1.Array, stack);
  typeforce_1(check$8, stack);
  return {
    redeemScriptStack: stack.slice(0, -1),
    redeemScript: stack[stack.length - 1]
  };
}
function decode$11(buffer) {
  var stack = script.decompile(buffer);
  var result = decodeStack$3(stack);
  result.redeemScriptSig = script.compile(result.redeemScriptStack);
  delete result.redeemScriptStack;
  return result;
}
var input$6 = {
  check: check$8,
  decode: decode$11,
  decodeStack: decodeStack$3,
  encode: encode$12,
  encodeStack: encodeStack$3
};

function check$11(script$$1) {
  var buffer = script.compile(script$$1);
  return buffer.length === 23 && buffer[0] === ops.OP_HASH160 && buffer[1] === 0x14 && buffer[22] === ops.OP_EQUAL;
}
check$11.toJSON = function () {
  return 'scriptHash output';
};
function encode$15(scriptHash) {
  typeforce_1(types_1.Hash160bit, scriptHash);
  return script.compile([ops.OP_HASH160, scriptHash, ops.OP_EQUAL]);
}
function decode$14(buffer) {
  typeforce_1(check$11, buffer);
  return buffer.slice(2, 22);
}
var output$10 = {
  check: check$11,
  decode: decode$14,
  encode: encode$15
};

var scripthash = {
  input: input$6,
  output: output$10
};

function isCompressedCanonicalPubKey(pubKey) {
  return script.isCanonicalPubKey(pubKey) && pubKey.length === 33;
}
function check$12(script$$1) {
  var chunks = script.decompile(script$$1);
  return chunks.length === 2 && script.isCanonicalSignature(chunks[0]) && isCompressedCanonicalPubKey(chunks[1]);
}
check$12.toJSON = function () {
  return 'witnessPubKeyHash input';
};
function encodeStack$4(signature, pubKey) {
  typeforce_1({
    signature: script.isCanonicalSignature,
    pubKey: isCompressedCanonicalPubKey
  }, {
    signature: signature,
    pubKey: pubKey
  });
  return [signature, pubKey];
}
function decodeStack$4(stack) {
  typeforce_1(typeforce_1.Array, stack);
  typeforce_1(check$12, stack);
  return {
    signature: stack[0],
    pubKey: stack[1]
  };
}
var input$8 = {
  check: check$12,
  decodeStack: decodeStack$4,
  encodeStack: encodeStack$4
};

var witnesspubkeyhash = {
  input: input$8,
  output: output$6
};

function check$13(chunks, allowIncomplete) {
  typeforce_1(types_1.Array, chunks);
  if (chunks.length < 1) return false;
  var witnessScript = chunks[chunks.length - 1];
  if (!Buffer.isBuffer(witnessScript)) return false;
  var witnessScriptChunks = script.decompile(witnessScript);
  if (witnessScriptChunks.length === 0) return false;
  var witnessRawScriptSig = script.compile(chunks.slice(0, -1));
  if (pubkeyhash.input.check(witnessRawScriptSig) && pubkeyhash.output.check(witnessScriptChunks)) return true;
  if (multisig.input.check(witnessRawScriptSig, allowIncomplete) && multisig.output.check(witnessScriptChunks)) return true;
  if (pubkey.input.check(witnessRawScriptSig) && pubkey.output.check(witnessScriptChunks)) return true;
  return false;
}
check$13.toJSON = function () {
  return 'witnessScriptHash input';
};
function encodeStack$5(witnessData, witnessScript) {
  typeforce_1({
    witnessData: [types_1.Buffer],
    witnessScript: types_1.Buffer
  }, {
    witnessData: witnessData,
    witnessScript: witnessScript
  });
  return [].concat(witnessData, witnessScript);
}
function decodeStack$5(stack) {
  typeforce_1(typeforce_1.Array, stack);
  typeforce_1(check$13, stack);
  return {
    witnessData: stack.slice(0, -1),
    witnessScript: stack[stack.length - 1]
  };
}
var input$10 = {
  check: check$13,
  decodeStack: decodeStack$5,
  encodeStack: encodeStack$5
};

var witnessscripthash = {
  input: input$10,
  output: output$8
};

var Buffer$7 = safeBuffer.Buffer;
var HEADER = Buffer$7.from('aa21a9ed', 'hex');
function check$14(script$$1) {
  var buffer = script.compile(script$$1);
  return buffer.length > 37 && buffer[0] === ops.OP_RETURN && buffer[1] === 0x24 && buffer.slice(2, 6).equals(HEADER);
}
check$14.toJSON = function () {
  return 'Witness commitment output';
};
function encode$16(commitment) {
  typeforce_1(types_1.Hash256bit, commitment);
  var buffer = Buffer$7.allocUnsafe(36);
  HEADER.copy(buffer, 0);
  commitment.copy(buffer, 4);
  return script.compile([ops.OP_RETURN, buffer]);
}
function decode$15(buffer) {
  typeforce_1(check$14, buffer);
  return script.decompile(buffer)[1].slice(4, 36);
}
var output$12 = {
  check: check$14,
  decode: decode$15,
  encode: encode$16
};

var witnesscommitment = {
  output: output$12
};

var decompile$1 = script.decompile;
var types$4 = {
  MULTISIG: 'multisig',
  NONSTANDARD: 'nonstandard',
  NULLDATA: 'nulldata',
  P2PK: 'pubkey',
  P2PKH: 'pubkeyhash',
  P2SH: 'scripthash',
  P2WPKH: 'witnesspubkeyhash',
  P2WSH: 'witnessscripthash',
  WITNESS_COMMITMENT: 'witnesscommitment'
};
function classifyOutput(script$$1) {
  if (witnesspubkeyhash.output.check(script$$1)) return types$4.P2WPKH;
  if (witnessscripthash.output.check(script$$1)) return types$4.P2WSH;
  if (pubkeyhash.output.check(script$$1)) return types$4.P2PKH;
  if (scripthash.output.check(script$$1)) return types$4.P2SH;
  var chunks = decompile$1(script$$1);
  if (multisig.output.check(chunks)) return types$4.MULTISIG;
  if (pubkey.output.check(chunks)) return types$4.P2PK;
  if (witnesscommitment.output.check(chunks)) return types$4.WITNESS_COMMITMENT;
  if (nulldata.output.check(chunks)) return types$4.NULLDATA;
  return types$4.NONSTANDARD;
}
function classifyInput(script$$1, allowIncomplete) {
  var chunks = decompile$1(script$$1);
  if (pubkeyhash.input.check(chunks)) return types$4.P2PKH;
  if (scripthash.input.check(chunks, allowIncomplete)) return types$4.P2SH;
  if (multisig.input.check(chunks, allowIncomplete)) return types$4.MULTISIG;
  if (pubkey.input.check(chunks)) return types$4.P2PK;
  return types$4.NONSTANDARD;
}
function classifyWitness(script$$1, allowIncomplete) {
  var chunks = decompile$1(script$$1);
  if (witnesspubkeyhash.input.check(chunks)) return types$4.P2WPKH;
  if (witnessscripthash.input.check(chunks, allowIncomplete)) return types$4.P2WSH;
  return types$4.NONSTANDARD;
}
var templates = {
  classifyInput: classifyInput,
  classifyOutput: classifyOutput,
  classifyWitness: classifyWitness,
  multisig: multisig,
  nullData: nulldata,
  pubKey: pubkey,
  pubKeyHash: pubkeyhash,
  scriptHash: scripthash,
  witnessPubKeyHash: witnesspubkeyhash,
  witnessScriptHash: witnessscripthash,
  witnessCommitment: witnesscommitment,
  types: types$4
};

var Buffer$8 = safeBuffer.Buffer;
var MAX_SAFE_INTEGER = 9007199254740991;
function checkUInt53(n) {
  if (n < 0 || n > MAX_SAFE_INTEGER || n % 1 !== 0) throw new RangeError('value out of range');
}
function encode$17(number, buffer, offset) {
  checkUInt53(number);
  if (!buffer) buffer = Buffer$8.allocUnsafe(encodingLength$1(number));
  if (!Buffer$8.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer instance');
  if (!offset) offset = 0;
  if (number < 0xfd) {
    buffer.writeUInt8(number, offset);
    encode$17.bytes = 1;
  } else if (number <= 0xffff) {
    buffer.writeUInt8(0xfd, offset);
    buffer.writeUInt16LE(number, offset + 1);
    encode$17.bytes = 3;
  } else if (number <= 0xffffffff) {
    buffer.writeUInt8(0xfe, offset);
    buffer.writeUInt32LE(number, offset + 1);
    encode$17.bytes = 5;
  } else {
    buffer.writeUInt8(0xff, offset);
    buffer.writeUInt32LE(number >>> 0, offset + 1);
    buffer.writeUInt32LE(number / 0x100000000 | 0, offset + 5);
    encode$17.bytes = 9;
  }
  return buffer;
}
function decode$16(buffer, offset) {
  if (!Buffer$8.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer instance');
  if (!offset) offset = 0;
  var first = buffer.readUInt8(offset);
  if (first < 0xfd) {
    decode$16.bytes = 1;
    return first;
  } else if (first === 0xfd) {
    decode$16.bytes = 3;
    return buffer.readUInt16LE(offset + 1);
  } else if (first === 0xfe) {
    decode$16.bytes = 5;
    return buffer.readUInt32LE(offset + 1);
  } else {
    decode$16.bytes = 9;
    var lo = buffer.readUInt32LE(offset + 1);
    var hi = buffer.readUInt32LE(offset + 5);
    var number = hi * 0x0100000000 + lo;
    checkUInt53(number);
    return number;
  }
}
function encodingLength$1(number) {
  checkUInt53(number);
  return number < 0xfd ? 1 : number <= 0xffff ? 3 : number <= 0xffffffff ? 5 : 9;
}
var varuintBitcoin = { encode: encode$17, decode: decode$16, encodingLength: encodingLength$1 };

function verifuint(value, max) {
  if (typeof value !== 'number') throw new Error('cannot write a non-number as a number');
  if (value < 0) throw new Error('specified a negative value for writing an unsigned value');
  if (value > max) throw new Error('RangeError: value out of range');
  if (Math.floor(value) !== value) throw new Error('value has a fractional component');
}
function readUInt64LE(buffer, offset) {
  var a = buffer.readUInt32LE(offset);
  var b = buffer.readUInt32LE(offset + 4);
  b *= 0x100000000;
  verifuint(b + a, 0x001fffffffffffff);
  return b + a;
}
function writeUInt64LE(buffer, value, offset) {
  verifuint(value, 0x001fffffffffffff);
  buffer.writeInt32LE(value & -1, offset);
  buffer.writeUInt32LE(Math.floor(value / 0x100000000), offset + 4);
  return offset + 8;
}
function readVarInt(buffer, offset) {
  var result = varuintBitcoin.decode(buffer, offset);
  return {
    number: result,
    size: varuintBitcoin.decode.bytes
  };
}
function writeVarInt(buffer, number, offset) {
  varuintBitcoin.encode(number, buffer, offset);
  return varuintBitcoin.encode.bytes;
}
var bufferutils = {
  pushDataSize: pushdataBitcoin.encodingLength,
  readPushDataInt: pushdataBitcoin.decode,
  readUInt64LE: readUInt64LE,
  readVarInt: readVarInt,
  varIntBuffer: varuintBitcoin.encode,
  varIntSize: varuintBitcoin.encodingLength,
  writePushDataInt: pushdataBitcoin.encode,
  writeUInt64LE: writeUInt64LE,
  writeVarInt: writeVarInt
};

var inherits_browser = createCommonjsModule$1(function (module) {
  if (typeof Object.create === 'function') {
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  } else {
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    };
  }
});

var intSize = 4;
var zeroBuffer = new Buffer(intSize);
zeroBuffer.fill(0);
var charSize = 8;
var hashSize = 16;
function toArray(buf) {
  if (buf.length % intSize !== 0) {
    var len = buf.length + (intSize - buf.length % intSize);
    buf = Buffer.concat([buf, zeroBuffer], len);
  }
  var arr = new Array(buf.length >>> 2);
  for (var i = 0, j = 0; i < buf.length; i += intSize, j++) {
    arr[j] = buf.readInt32LE(i);
  }
  return arr;
}
var makeHash = function hash(buf, fn) {
  var arr = fn(toArray(buf), buf.length * charSize);
  buf = new Buffer(hashSize);
  for (var i = 0; i < arr.length; i++) {
    buf.writeInt32LE(arr[i], i << 2, true);
  }
  return buf;
};

function core_md5(x, len) {
  x[len >> 5] |= 0x80 << len % 32;
  x[(len + 64 >>> 9 << 4) + 14] = len;
  var a = 1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d = 271733878;
  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    a = md5_ff(a, b, c, d, x[i + 0], 7, -680876936);
    d = md5_ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = md5_ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = md5_ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = md5_ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = md5_ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = md5_gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = md5_gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = md5_gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = md5_gg(b, c, d, a, x[i + 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = md5_gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = md5_gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = md5_gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = md5_gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = md5_gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = md5_gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = md5_hh(a, b, c, d, x[i + 5], 4, -378558);
    d = md5_hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = md5_hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = md5_hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = md5_hh(d, a, b, c, x[i + 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = md5_hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = md5_hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = md5_ii(a, b, c, d, x[i + 0], 6, -198630844);
    d = md5_ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = md5_ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = md5_ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = md5_ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return [a, b, c, d];
}
function md5_cmn(q, a, b, x, s, t) {
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
}
function md5_ff(a, b, c, d, x, s, t) {
  return md5_cmn(b & c | ~b & d, a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t) {
  return md5_cmn(b & d | c & ~d, a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t) {
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t) {
  return md5_cmn(c ^ (b | ~d), a, b, x, s, t);
}
function safe_add(x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return msw << 16 | lsw & 0xFFFF;
}
function bit_rol(num, cnt) {
  return num << cnt | num >>> 32 - cnt;
}
var md5$1 = function md5(buf) {
  return makeHash(buf, core_md5);
};

var domain;
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);
function EventEmitter() {
  EventEmitter.init.call(this);
}
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.usingDomains = false;
EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;
EventEmitter.defaultMaxListeners = 10;
EventEmitter.init = function () {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    if (domain.active && !(this instanceof domain.Domain)) {
      this.domain = domain.active;
    }
  }
  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }
  this._maxListeners = this._maxListeners || undefined;
};
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n)) throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};
function $getMaxListeners(that) {
  if (that._maxListeners === undefined) return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}
EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};
function emitNone(handler, isFn, self) {
  if (isFn) handler.call(self);else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i) listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn) handler.call(self, arg1);else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i) listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn) handler.call(self, arg1, arg2);else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i) listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn) handler.call(self, arg1, arg2, arg3);else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i) listeners[i].call(self, arg1, arg2, arg3);
  }
}
function emitMany(handler, isFn, self, args) {
  if (isFn) handler.apply(self, args);else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i) listeners[i].apply(self, args);
  }
}
EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var needDomainExit = false;
  var doError = type === 'error';
  events = this._events;
  if (events) doError = doError && events.error == null;else if (!doError) return false;
  domain = this.domain;
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er) er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er;
    } else {
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }
  handler = events[type];
  if (!handler) return false;
  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++) args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }
  if (needDomainExit) domain.exit();
  return true;
};
function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;
  if (typeof listener !== 'function') throw new TypeError('"listener" argument must be a function');
  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    if (events.newListener) {
      target.emit('newListener', type, listener.listener ? listener.listener : listener);
      events = target._events;
    }
    existing = events[type];
  }
  if (!existing) {
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      existing = events[type] = prepend ? [listener, existing] : [existing, listener];
    } else {
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' + existing.length + ' ' + type + ' listeners added. ' + 'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }
  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};
EventEmitter.prototype.on = EventEmitter.prototype.addListener;
EventEmitter.prototype.prependListener = function prependListener(type, listener) {
  return _addListener(this, type, listener, true);
};
function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}
EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function') throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};
EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener) {
  if (typeof listener !== 'function') throw new TypeError('"listener" argument must be a function');
  this.prependListener(type, _onceWrap(this, type, listener));
  return this;
};
EventEmitter.prototype.removeListener = function removeListener(type, listener) {
  var list, events, position, i, originalListener;
  if (typeof listener !== 'function') throw new TypeError('"listener" argument must be a function');
  events = this._events;
  if (!events) return this;
  list = events[type];
  if (!list) return this;
  if (list === listener || list.listener && list.listener === listener) {
    if (--this._eventsCount === 0) this._events = new EventHandlers();else {
      delete events[type];
      if (events.removeListener) this.emit('removeListener', type, list.listener || listener);
    }
  } else if (typeof list !== 'function') {
    position = -1;
    for (i = list.length; i-- > 0;) {
      if (list[i] === listener || list[i].listener && list[i].listener === listener) {
        originalListener = list[i].listener;
        position = i;
        break;
      }
    }
    if (position < 0) return this;
    if (list.length === 1) {
      list[0] = undefined;
      if (--this._eventsCount === 0) {
        this._events = new EventHandlers();
        return this;
      } else {
        delete events[type];
      }
    } else {
      spliceOne(list, position);
    }
    if (events.removeListener) this.emit('removeListener', type, originalListener || listener);
  }
  return this;
};
EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
  var listeners, events;
  events = this._events;
  if (!events) return this;
  if (!events.removeListener) {
    if (arguments.length === 0) {
      this._events = new EventHandlers();
      this._eventsCount = 0;
    } else if (events[type]) {
      if (--this._eventsCount === 0) this._events = new EventHandlers();else delete events[type];
    }
    return this;
  }
  if (arguments.length === 0) {
    var keys = Object.keys(events);
    for (var i = 0, key; i < keys.length; ++i) {
      key = keys[i];
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = new EventHandlers();
    this._eventsCount = 0;
    return this;
  }
  listeners = events[type];
  if (typeof listeners === 'function') {
    this.removeListener(type, listeners);
  } else if (listeners) {
    do {
      this.removeListener(type, listeners[listeners.length - 1]);
    } while (listeners[0]);
  }
  return this;
};
EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;
  if (!events) ret = [];else {
    evlistener = events[type];
    if (!evlistener) ret = [];else if (typeof evlistener === 'function') ret = [evlistener.listener || evlistener];else ret = unwrapListeners(evlistener);
  }
  return ret;
};
EventEmitter.listenerCount = function (emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};
EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;
  if (events) {
    var evlistener = events[type];
    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }
  return 0;
}
EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1) list[i] = list[k];
  list.pop();
}
function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--) copy[i] = arr[i];
  return copy;
}
function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout() {
    throw new Error('clearTimeout has not been defined');
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
if (typeof global.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
}
if (typeof global.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
}
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        return setTimeout(fun, 0);
    }
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        return cachedSetTimeout(fun, 0);
    } catch (e) {
        try {
            return cachedSetTimeout.call(null, fun, 0);
        } catch (e) {
            return cachedSetTimeout.call(this, fun, 0);
        }
    }
}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        return clearTimeout(marker);
    }
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        return cachedClearTimeout(marker);
    } catch (e) {
        try {
            return cachedClearTimeout.call(null, marker);
        } catch (e) {
            return cachedClearTimeout.call(this, marker);
        }
    }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}
function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;
    var len = queue.length;
    while (len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
var title = 'browser';
var platform = 'browser';
var browser$2 = true;
var env = {};
var argv = [];
var version = '';
var versions = {};
var release = {};
var config = {};
function noop() {}
var on = noop;
var addListener = noop;
var once = noop;
var off = noop;
var removeListener = noop;
var removeAllListeners = noop;
var emit = noop;
function binding(name) {
    throw new Error('process.binding is not supported');
}
function cwd() {
    return '/';
}
function chdir(dir) {
    throw new Error('process.chdir is not supported');
}
function umask() {
    return 0;
}
var performance = global.performance || {};
var performanceNow = performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function () {
    return new Date().getTime();
};
function hrtime(previousTimestamp) {
    var clocktime = performanceNow.call(performance) * 1e-3;
    var seconds = Math.floor(clocktime);
    var nanoseconds = Math.floor(clocktime % 1 * 1e9);
    if (previousTimestamp) {
        seconds = seconds - previousTimestamp[0];
        nanoseconds = nanoseconds - previousTimestamp[1];
        if (nanoseconds < 0) {
            seconds--;
            nanoseconds += 1e9;
        }
    }
    return [seconds, nanoseconds];
}
var startTime = new Date();
function uptime() {
    var currentTime = new Date();
    var dif = currentTime - startTime;
    return dif / 1000;
}
var process$1 = {
    nextTick: nextTick,
    title: title,
    browser: browser$2,
    env: env,
    argv: argv,
    version: version,
    versions: versions,
    on: on,
    addListener: addListener,
    once: once,
    off: off,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
    emit: emit,
    binding: binding,
    cwd: cwd,
    chdir: chdir,
    umask: umask,
    hrtime: hrtime,
    platform: platform,
    release: release,
    config: config,
    uptime: uptime
};

var inherits;
if (typeof Object.create === 'function') {
  inherits = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  inherits = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}
var inherits$1 = inherits;

var formatRegExp = /%[sdj%]/g;
function format(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }
  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function (x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s':
        return String(args[i++]);
      case '%d':
        return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
}
function deprecate(fn, msg) {
  if (isUndefined(global.process)) {
    return function () {
      return deprecate(fn, msg).apply(this, arguments);
    };
  }
  if (process$1.noDeprecation === true) {
    return fn;
  }
  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process$1.throwDeprecation) {
        throw new Error(msg);
      } else if (process$1.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }
  return deprecated;
}
var debugs = {};
var debugEnviron;
function debuglog(set) {
  if (isUndefined(debugEnviron)) debugEnviron = process$1.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = 0;
      debugs[set] = function () {
        var msg = format.apply(null, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function () {};
    }
  }
  return debugs[set];
}
function inspect(obj, opts) {
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    ctx.showHidden = opts;
  } else if (opts) {
    _extend(ctx, opts);
  }
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
inspect.colors = {
  'bold': [1, 22],
  'italic': [3, 23],
  'underline': [4, 24],
  'inverse': [7, 27],
  'white': [37, 39],
  'grey': [90, 39],
  'black': [30, 39],
  'blue': [34, 39],
  'cyan': [36, 39],
  'green': [32, 39],
  'magenta': [35, 39],
  'red': [31, 39],
  'yellow': [33, 39]
};
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  'regexp': 'red'
};
function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];
  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str + '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}
function stylizeNoColor(str, styleType) {
  return str;
}
function arrayToHash(array) {
  var hash = {};
  array.forEach(function (val, idx) {
    hash[val] = true;
  });
  return hash;
}
function formatValue(ctx, value, recurseTimes) {
  if (ctx.customInspect && value && isFunction(value.inspect) &&
  value.inspect !== inspect &&
  !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);
  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }
  if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }
  var base = '',
      array = false,
      braces = ['{', '}'];
  if (isArray$1(value)) {
    array = true;
    braces = ['[', ']'];
  }
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }
  if (isError(value)) {
    base = ' ' + formatError(value);
  }
  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }
  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }
  ctx.seen.push(value);
  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function (key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }
  ctx.seen.pop();
  return reduceToSingleString(output, base, braces);
}
function formatPrimitive(ctx, value) {
  if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value)) return ctx.stylize('' + value, 'number');
  if (isBoolean(value)) return ctx.stylize('' + value, 'boolean');
  if (isNull(value)) return ctx.stylize('null', 'null');
}
function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}
function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function (key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
    }
  });
  return output;
}
function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function (line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function (line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }
  return name + ': ' + str;
}
function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function (prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);
  if (length > 60) {
    return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
  }
  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}
function isArray$1(ar) {
  return Array.isArray(ar);
}
function isBoolean(arg) {
  return typeof arg === 'boolean';
}
function isNull(arg) {
  return arg === null;
}

function isNumber(arg) {
  return typeof arg === 'number';
}
function isString(arg) {
  return typeof arg === 'string';
}

function isUndefined(arg) {
  return arg === void 0;
}
function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
function isError(e) {
  return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
}
function isFunction(arg) {
  return typeof arg === 'function';
}
function isPrimitive(arg) {
  return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' ||
  typeof arg === 'undefined';
}

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

function _extend(origin, add) {
  if (!add || !isObject(add)) return origin;
  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
}
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function BufferList$1() {
  this.head = null;
  this.tail = null;
  this.length = 0;
}
BufferList$1.prototype.push = function (v) {
  var entry = { data: v, next: null };
  if (this.length > 0) this.tail.next = entry;else this.head = entry;
  this.tail = entry;
  ++this.length;
};
BufferList$1.prototype.unshift = function (v) {
  var entry = { data: v, next: this.head };
  if (this.length === 0) this.tail = entry;
  this.head = entry;
  ++this.length;
};
BufferList$1.prototype.shift = function () {
  if (this.length === 0) return;
  var ret = this.head.data;
  if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
  --this.length;
  return ret;
};
BufferList$1.prototype.clear = function () {
  this.head = this.tail = null;
  this.length = 0;
};
BufferList$1.prototype.join = function (s) {
  if (this.length === 0) return '';
  var p = this.head;
  var ret = '' + p.data;
  while (p = p.next) {
    ret += s + p.data;
  }return ret;
};
BufferList$1.prototype.concat = function (n) {
  if (this.length === 0) return Buffer$2.alloc(0);
  if (this.length === 1) return this.head.data;
  var ret = Buffer$2.allocUnsafe(n >>> 0);
  var p = this.head;
  var i = 0;
  while (p) {
    p.data.copy(ret, i);
    i += p.data.length;
    p = p.next;
  }
  return ret;
};

var isBufferEncoding = Buffer$2.isEncoding || function (encoding) {
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};
function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}
function StringDecoder(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }
  this.charBuffer = new Buffer$2(6);
  this.charReceived = 0;
  this.charLength = 0;
}
StringDecoder.prototype.write = function (buffer) {
  var charStr = '';
  while (this.charLength) {
    var available = buffer.length >= this.charLength - this.charReceived ? this.charLength - this.charReceived : buffer.length;
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;
    if (this.charReceived < this.charLength) {
      return '';
    }
    buffer = buffer.slice(available, buffer.length);
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }
  this.detectIncompleteChar(buffer);
  var end = buffer.length;
  if (this.charLength) {
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }
  charStr += buffer.toString(this.encoding, 0, end);
  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }
  return charStr;
};
StringDecoder.prototype.detectIncompleteChar = function (buffer) {
  var i = buffer.length >= 3 ? 3 : buffer.length;
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};
StringDecoder.prototype.end = function (buffer) {
  var res = '';
  if (buffer && buffer.length) res = this.write(buffer);
  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }
  return res;
};
function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}
function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}
function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

var stringDecoder = Object.freeze({
	StringDecoder: StringDecoder
});

Readable$1.ReadableState = ReadableState;
var debug = debuglog('stream');
inherits$1(Readable$1, EventEmitter);
function prependListener(emitter, event, fn) {
  if (typeof emitter.prependListener === 'function') {
    return emitter.prependListener(event, fn);
  } else {
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
  }
}
function listenerCount$1(emitter, type) {
  return emitter.listeners(type).length;
}
function ReadableState(options, stream) {
  options = options || {};
  this.objectMode = !!options.objectMode;
  if (stream instanceof Duplex$1) this.objectMode = this.objectMode || !!options.readableObjectMode;
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;
  this.highWaterMark = ~~this.highWaterMark;
  this.buffer = new BufferList$1();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;
  this.sync = true;
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;
  this.defaultEncoding = options.defaultEncoding || 'utf8';
  this.ranOut = false;
  this.awaitDrain = 0;
  this.readingMore = false;
  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}
function Readable$1(options) {
  if (!(this instanceof Readable$1)) return new Readable$1(options);
  this._readableState = new ReadableState(options, this);
  this.readable = true;
  if (options && typeof options.read === 'function') this._read = options.read;
  EventEmitter.call(this);
}
Readable$1.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = Buffer.from(chunk, encoding);
      encoding = '';
    }
  }
  return readableAddChunk(this, state, chunk, encoding, false);
};
Readable$1.prototype.unshift = function (chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};
Readable$1.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};
function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var _e = new Error('stream.unshift() after end event');
      stream.emit('error', _e);
    } else {
      var skipAdd;
      if (state.decoder && !addToFront && !encoding) {
        chunk = state.decoder.write(chunk);
        skipAdd = !state.objectMode && chunk.length === 0;
      }
      if (!addToFront) state.reading = false;
      if (!skipAdd) {
        if (state.flowing && state.length === 0 && !state.sync) {
          stream.emit('data', chunk);
          stream.read(0);
        } else {
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);
          if (state.needReadable) emitReadable(stream);
        }
      }
      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }
  return needMoreData(state);
}
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}
Readable$1.prototype.setEncoding = function (enc) {
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}
Readable$1.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;
  if (n !== 0) state.emittedReadable = false;
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }
  n = howMuchToRead(n, state);
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }
  var doRead = state.needReadable;
  debug('need readable', doRead);
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    if (state.length === 0) state.needReadable = true;
    this._read(state.highWaterMark);
    state.sync = false;
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }
  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;
  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }
  if (state.length === 0) {
    if (!state.ended) state.needReadable = true;
    if (nOrig !== n && state.ended) endReadable(this);
  }
  if (ret !== null) this.emit('data', ret);
  return ret;
};
function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}
function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;
  emitReadable(stream);
}
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) nextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}
function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    nextTick(maybeReadMore_, stream, state);
  }
}
function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      break;else len = state.length;
  }
  state.readingMore = false;
}
Readable$1.prototype._read = function (n) {
  this.emit('error', new Error('not implemented'));
};
Readable$1.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;
  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);
  var doEnd = !pipeOpts || pipeOpts.end !== false;
  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted) nextTick(endFn);else src.once('end', endFn);
  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }
  function onend() {
    debug('onend');
    dest.end();
  }
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);
  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);
    cleanedUp = true;
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (listenerCount$1(dest, 'error') === 0) dest.emit('error', er);
  }
  prependListener(dest, 'error', onerror);
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);
  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }
  dest.emit('pipe', src);
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }
  return dest;
};
function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && src.listeners('data').length) {
      state.flowing = true;
      flow(src);
    }
  };
}
Readable$1.prototype.unpipe = function (dest) {
  var state = this._readableState;
  if (state.pipesCount === 0) return this;
  if (state.pipesCount === 1) {
    if (dest && dest !== state.pipes) return this;
    if (!dest) dest = state.pipes;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this);
    return this;
  }
  if (!dest) {
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    for (var _i = 0; _i < len; _i++) {
      dests[_i].emit('unpipe', this);
    }return this;
  }
  var i = indexOf(state.pipes, dest);
  if (i === -1) return this;
  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];
  dest.emit('unpipe', this);
  return this;
};
Readable$1.prototype.on = function (ev, fn) {
  var res = EventEmitter.prototype.on.call(this, ev, fn);
  if (ev === 'data') {
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        nextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }
  return res;
};
Readable$1.prototype.addListener = Readable$1.prototype.on;
function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}
Readable$1.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};
function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    nextTick(resume_, stream, state);
  }
}
function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }
  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}
Readable$1.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};
function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}
Readable$1.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;
  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }
    self.push(null);
  });
  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;
    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function (ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };
  return self;
};
Readable$1._fromList = fromList;
function fromList(n, state) {
  if (state.length === 0) return null;
  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    ret = fromListPartial(n, state.buffer, state.decoder);
  }
  return ret;
}
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    ret = list.shift();
  } else {
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}
function endReadable(stream) {
  var state = stream._readableState;
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');
  if (!state.endEmitted) {
    state.ended = true;
    nextTick(endReadableNT, state, stream);
  }
}
function endReadableNT(state, stream) {
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}
function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}
function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

Writable$1.WritableState = WritableState;
inherits$1(Writable$1, EventEmitter);
function nop() {}
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}
function WritableState(options, stream) {
  Object.defineProperty(this, 'buffer', {
    get: deprecate(function () {
      return this.getBuffer();
    }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
  });
  options = options || {};
  this.objectMode = !!options.objectMode;
  if (stream instanceof Duplex$1) this.objectMode = this.objectMode || !!options.writableObjectMode;
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;
  this.highWaterMark = ~~this.highWaterMark;
  this.needDrain = false;
  this.ending = false;
  this.ended = false;
  this.finished = false;
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;
  this.defaultEncoding = options.defaultEncoding || 'utf8';
  this.length = 0;
  this.writing = false;
  this.corked = 0;
  this.sync = true;
  this.bufferProcessing = false;
  this.onwrite = function (er) {
    onwrite(stream, er);
  };
  this.writecb = null;
  this.writelen = 0;
  this.bufferedRequest = null;
  this.lastBufferedRequest = null;
  this.pendingcb = 0;
  this.prefinished = false;
  this.errorEmitted = false;
  this.bufferedRequestCount = 0;
  this.corkedRequestsFree = new CorkedRequest(this);
}
WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};
function Writable$1(options) {
  if (!(this instanceof Writable$1) && !(this instanceof Duplex$1)) return new Writable$1(options);
  this._writableState = new WritableState(options, this);
  this.writable = true;
  if (options) {
    if (typeof options.write === 'function') this._write = options.write;
    if (typeof options.writev === 'function') this._writev = options.writev;
  }
  EventEmitter.call(this);
}
Writable$1.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};
function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  stream.emit('error', er);
  nextTick(cb, er);
}
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;
  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (!Buffer$2.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    nextTick(cb, er);
    valid = false;
  }
  return valid;
}
Writable$1.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  if (Buffer$2.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;
  if (typeof cb !== 'function') cb = nop;
  if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }
  return ret;
};
Writable$1.prototype.cork = function () {
  var state = this._writableState;
  state.corked++;
};
Writable$1.prototype.uncork = function () {
  var state = this._writableState;
  if (state.corked) {
    state.corked--;
    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};
Writable$1.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};
function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer$2.from(chunk, encoding);
  }
  return chunk;
}
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (Buffer$2.isBuffer(chunk)) encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;
  state.length += len;
  var ret = state.length < state.highWaterMark;
  if (!ret) state.needDrain = true;
  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }
  return ret;
}
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}
function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) nextTick(cb, er);else cb(er);
  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}
function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}
function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;
  onwriteStateUpdate(state);
  if (er) onwriteError(stream, state, sync, er, cb);else {
    var finished = needFinish(state);
    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }
    if (sync) {
      nextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}
function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;
  if (stream._writev && entry && entry.next) {
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;
    var count = 0;
    while (entry) {
      buffer[count] = entry;
      entry = entry.next;
      count += 1;
    }
    doWrite(stream, state, true, state.length, buffer, '', holder.finish);
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
  } else {
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;
      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      if (state.writing) {
        break;
      }
    }
    if (entry === null) state.lastBufferedRequest = null;
  }
  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}
Writable$1.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('not implemented'));
};
Writable$1.prototype._writev = null;
Writable$1.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;
  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};
function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}
function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}
function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}
function CorkedRequest(state) {
  var _this = this;
  this.next = null;
  this.entry = null;
  this.finish = function (err) {
    var entry = _this.entry;
    _this.entry = null;
    while (entry) {
      var cb = entry.callback;
      state.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    if (state.corkedRequestsFree) {
      state.corkedRequestsFree.next = _this;
    } else {
      state.corkedRequestsFree = _this;
    }
  };
}

inherits$1(Duplex$1, Readable$1);
var keys = Object.keys(Writable$1.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex$1.prototype[method]) Duplex$1.prototype[method] = Writable$1.prototype[method];
}
function Duplex$1(options) {
  if (!(this instanceof Duplex$1)) return new Duplex$1(options);
  Readable$1.call(this, options);
  Writable$1.call(this, options);
  if (options && options.readable === false) this.readable = false;
  if (options && options.writable === false) this.writable = false;
  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
  this.once('end', onend);
}
function onend() {
  if (this.allowHalfOpen || this._writableState.ended) return;
  nextTick(onEndNT, this);
}
function onEndNT(self) {
  self.end();
}

inherits$1(Transform$2, Duplex$1);
function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };
  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}
function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;
  var cb = ts.writecb;
  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));
  ts.writechunk = null;
  ts.writecb = null;
  if (data !== null && data !== undefined) stream.push(data);
  cb(er);
  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}
function Transform$2(options) {
  if (!(this instanceof Transform$2)) return new Transform$2(options);
  Duplex$1.call(this, options);
  this._transformState = new TransformState(this);
  var stream = this;
  this._readableState.needReadable = true;
  this._readableState.sync = false;
  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;
    if (typeof options.flush === 'function') this._flush = options.flush;
  }
  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er) {
      done(stream, er);
    });else done(stream);
  });
}
Transform$2.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex$1.prototype.push.call(this, chunk, encoding);
};
Transform$2.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('Not implemented');
};
Transform$2.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};
Transform$2.prototype._read = function (n) {
  var ts = this._transformState;
  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    ts.needTransform = true;
  }
};
function done(stream, er) {
  if (er) return stream.emit('error', er);
  var ws = stream._writableState;
  var ts = stream._transformState;
  if (ws.length) throw new Error('Calling transform done when ws.length != 0');
  if (ts.transforming) throw new Error('Calling transform done when still transforming');
  return stream.push(null);
}

inherits$1(PassThrough$1, Transform$2);
function PassThrough$1(options) {
  if (!(this instanceof PassThrough$1)) return new PassThrough$1(options);
  Transform$2.call(this, options);
}
PassThrough$1.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};

inherits$1(Stream$1, EventEmitter);
Stream$1.Readable = Readable$1;
Stream$1.Writable = Writable$1;
Stream$1.Duplex = Duplex$1;
Stream$1.Transform = Transform$2;
Stream$1.PassThrough = PassThrough$1;
Stream$1.Stream = Stream$1;
function Stream$1() {
  EventEmitter.call(this);
}
Stream$1.prototype.pipe = function (dest, options) {
  var source = this;
  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }
  source.on('data', ondata);
  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }
  dest.on('drain', ondrain);
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }
  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;
    dest.end();
  }
  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;
    if (typeof dest.destroy === 'function') dest.destroy();
  }
  function onerror(er) {
    cleanup();
    if (EventEmitter.listenerCount(this, 'error') === 0) {
      throw er;
    }
  }
  source.on('error', onerror);
  dest.on('error', onerror);
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);
    source.removeListener('end', onend);
    source.removeListener('close', onclose);
    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);
    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);
    dest.removeListener('close', cleanup);
  }
  source.on('end', cleanup);
  source.on('close', cleanup);
  dest.on('close', cleanup);
  dest.emit('pipe', source);
  return dest;
};

var stream = Object.freeze({
	default: Stream$1,
	Readable: Readable$1,
	Writable: Writable$1,
	Duplex: Duplex$1,
	Transform: Transform$2,
	PassThrough: PassThrough$1,
	Stream: Stream$1
});

var require$$1$5 = ( stream && Stream$1 ) || stream;

var Transform = require$$1$5.Transform;
function HashBase(blockSize) {
  Transform.call(this);
  this._block = new Buffer(blockSize);
  this._blockSize = blockSize;
  this._blockOffset = 0;
  this._length = [0, 0, 0, 0];
  this._finalized = false;
}
inherits_browser(HashBase, Transform);
HashBase.prototype._transform = function (chunk, encoding, callback) {
  var error = null;
  try {
    if (encoding !== 'buffer') chunk = new Buffer(chunk, encoding);
    this.update(chunk);
  } catch (err) {
    error = err;
  }
  callback(error);
};
HashBase.prototype._flush = function (callback) {
  var error = null;
  try {
    this.push(this._digest());
  } catch (err) {
    error = err;
  }
  callback(error);
};
HashBase.prototype.update = function (data, encoding) {
  if (!Buffer.isBuffer(data) && typeof data !== 'string') throw new TypeError('Data must be a string or a buffer');
  if (this._finalized) throw new Error('Digest already called');
  if (!Buffer.isBuffer(data)) data = new Buffer(data, encoding || 'binary');
  var block = this._block;
  var offset = 0;
  while (this._blockOffset + data.length - offset >= this._blockSize) {
    for (var i = this._blockOffset; i < this._blockSize;) block[i++] = data[offset++];
    this._update();
    this._blockOffset = 0;
  }
  while (offset < data.length) block[this._blockOffset++] = data[offset++];
  for (var j = 0, carry = data.length * 8; carry > 0; ++j) {
    this._length[j] += carry;
    carry = this._length[j] / 0x0100000000 | 0;
    if (carry > 0) this._length[j] -= 0x0100000000 * carry;
  }
  return this;
};
HashBase.prototype._update = function (data) {
  throw new Error('_update is not implemented');
};
HashBase.prototype.digest = function (encoding) {
  if (this._finalized) throw new Error('Digest already called');
  this._finalized = true;
  var digest = this._digest();
  if (encoding !== undefined) digest = digest.toString(encoding);
  return digest;
};
HashBase.prototype._digest = function () {
  throw new Error('_digest is not implemented');
};
var hashBase = HashBase;

function RIPEMD160() {
  hashBase.call(this, 64);
  this._a = 0x67452301;
  this._b = 0xefcdab89;
  this._c = 0x98badcfe;
  this._d = 0x10325476;
  this._e = 0xc3d2e1f0;
}
inherits_browser(RIPEMD160, hashBase);
RIPEMD160.prototype._update = function () {
  var m = new Array(16);
  for (var i = 0; i < 16; ++i) m[i] = this._block.readInt32LE(i * 4);
  var al = this._a;
  var bl = this._b;
  var cl = this._c;
  var dl = this._d;
  var el = this._e;
  al = fn1(al, bl, cl, dl, el, m[0], 0x00000000, 11);cl = rotl(cl, 10);
  el = fn1(el, al, bl, cl, dl, m[1], 0x00000000, 14);bl = rotl(bl, 10);
  dl = fn1(dl, el, al, bl, cl, m[2], 0x00000000, 15);al = rotl(al, 10);
  cl = fn1(cl, dl, el, al, bl, m[3], 0x00000000, 12);el = rotl(el, 10);
  bl = fn1(bl, cl, dl, el, al, m[4], 0x00000000, 5);dl = rotl(dl, 10);
  al = fn1(al, bl, cl, dl, el, m[5], 0x00000000, 8);cl = rotl(cl, 10);
  el = fn1(el, al, bl, cl, dl, m[6], 0x00000000, 7);bl = rotl(bl, 10);
  dl = fn1(dl, el, al, bl, cl, m[7], 0x00000000, 9);al = rotl(al, 10);
  cl = fn1(cl, dl, el, al, bl, m[8], 0x00000000, 11);el = rotl(el, 10);
  bl = fn1(bl, cl, dl, el, al, m[9], 0x00000000, 13);dl = rotl(dl, 10);
  al = fn1(al, bl, cl, dl, el, m[10], 0x00000000, 14);cl = rotl(cl, 10);
  el = fn1(el, al, bl, cl, dl, m[11], 0x00000000, 15);bl = rotl(bl, 10);
  dl = fn1(dl, el, al, bl, cl, m[12], 0x00000000, 6);al = rotl(al, 10);
  cl = fn1(cl, dl, el, al, bl, m[13], 0x00000000, 7);el = rotl(el, 10);
  bl = fn1(bl, cl, dl, el, al, m[14], 0x00000000, 9);dl = rotl(dl, 10);
  al = fn1(al, bl, cl, dl, el, m[15], 0x00000000, 8);cl = rotl(cl, 10);
  el = fn2(el, al, bl, cl, dl, m[7], 0x5a827999, 7);bl = rotl(bl, 10);
  dl = fn2(dl, el, al, bl, cl, m[4], 0x5a827999, 6);al = rotl(al, 10);
  cl = fn2(cl, dl, el, al, bl, m[13], 0x5a827999, 8);el = rotl(el, 10);
  bl = fn2(bl, cl, dl, el, al, m[1], 0x5a827999, 13);dl = rotl(dl, 10);
  al = fn2(al, bl, cl, dl, el, m[10], 0x5a827999, 11);cl = rotl(cl, 10);
  el = fn2(el, al, bl, cl, dl, m[6], 0x5a827999, 9);bl = rotl(bl, 10);
  dl = fn2(dl, el, al, bl, cl, m[15], 0x5a827999, 7);al = rotl(al, 10);
  cl = fn2(cl, dl, el, al, bl, m[3], 0x5a827999, 15);el = rotl(el, 10);
  bl = fn2(bl, cl, dl, el, al, m[12], 0x5a827999, 7);dl = rotl(dl, 10);
  al = fn2(al, bl, cl, dl, el, m[0], 0x5a827999, 12);cl = rotl(cl, 10);
  el = fn2(el, al, bl, cl, dl, m[9], 0x5a827999, 15);bl = rotl(bl, 10);
  dl = fn2(dl, el, al, bl, cl, m[5], 0x5a827999, 9);al = rotl(al, 10);
  cl = fn2(cl, dl, el, al, bl, m[2], 0x5a827999, 11);el = rotl(el, 10);
  bl = fn2(bl, cl, dl, el, al, m[14], 0x5a827999, 7);dl = rotl(dl, 10);
  al = fn2(al, bl, cl, dl, el, m[11], 0x5a827999, 13);cl = rotl(cl, 10);
  el = fn2(el, al, bl, cl, dl, m[8], 0x5a827999, 12);bl = rotl(bl, 10);
  dl = fn3(dl, el, al, bl, cl, m[3], 0x6ed9eba1, 11);al = rotl(al, 10);
  cl = fn3(cl, dl, el, al, bl, m[10], 0x6ed9eba1, 13);el = rotl(el, 10);
  bl = fn3(bl, cl, dl, el, al, m[14], 0x6ed9eba1, 6);dl = rotl(dl, 10);
  al = fn3(al, bl, cl, dl, el, m[4], 0x6ed9eba1, 7);cl = rotl(cl, 10);
  el = fn3(el, al, bl, cl, dl, m[9], 0x6ed9eba1, 14);bl = rotl(bl, 10);
  dl = fn3(dl, el, al, bl, cl, m[15], 0x6ed9eba1, 9);al = rotl(al, 10);
  cl = fn3(cl, dl, el, al, bl, m[8], 0x6ed9eba1, 13);el = rotl(el, 10);
  bl = fn3(bl, cl, dl, el, al, m[1], 0x6ed9eba1, 15);dl = rotl(dl, 10);
  al = fn3(al, bl, cl, dl, el, m[2], 0x6ed9eba1, 14);cl = rotl(cl, 10);
  el = fn3(el, al, bl, cl, dl, m[7], 0x6ed9eba1, 8);bl = rotl(bl, 10);
  dl = fn3(dl, el, al, bl, cl, m[0], 0x6ed9eba1, 13);al = rotl(al, 10);
  cl = fn3(cl, dl, el, al, bl, m[6], 0x6ed9eba1, 6);el = rotl(el, 10);
  bl = fn3(bl, cl, dl, el, al, m[13], 0x6ed9eba1, 5);dl = rotl(dl, 10);
  al = fn3(al, bl, cl, dl, el, m[11], 0x6ed9eba1, 12);cl = rotl(cl, 10);
  el = fn3(el, al, bl, cl, dl, m[5], 0x6ed9eba1, 7);bl = rotl(bl, 10);
  dl = fn3(dl, el, al, bl, cl, m[12], 0x6ed9eba1, 5);al = rotl(al, 10);
  cl = fn4(cl, dl, el, al, bl, m[1], 0x8f1bbcdc, 11);el = rotl(el, 10);
  bl = fn4(bl, cl, dl, el, al, m[9], 0x8f1bbcdc, 12);dl = rotl(dl, 10);
  al = fn4(al, bl, cl, dl, el, m[11], 0x8f1bbcdc, 14);cl = rotl(cl, 10);
  el = fn4(el, al, bl, cl, dl, m[10], 0x8f1bbcdc, 15);bl = rotl(bl, 10);
  dl = fn4(dl, el, al, bl, cl, m[0], 0x8f1bbcdc, 14);al = rotl(al, 10);
  cl = fn4(cl, dl, el, al, bl, m[8], 0x8f1bbcdc, 15);el = rotl(el, 10);
  bl = fn4(bl, cl, dl, el, al, m[12], 0x8f1bbcdc, 9);dl = rotl(dl, 10);
  al = fn4(al, bl, cl, dl, el, m[4], 0x8f1bbcdc, 8);cl = rotl(cl, 10);
  el = fn4(el, al, bl, cl, dl, m[13], 0x8f1bbcdc, 9);bl = rotl(bl, 10);
  dl = fn4(dl, el, al, bl, cl, m[3], 0x8f1bbcdc, 14);al = rotl(al, 10);
  cl = fn4(cl, dl, el, al, bl, m[7], 0x8f1bbcdc, 5);el = rotl(el, 10);
  bl = fn4(bl, cl, dl, el, al, m[15], 0x8f1bbcdc, 6);dl = rotl(dl, 10);
  al = fn4(al, bl, cl, dl, el, m[14], 0x8f1bbcdc, 8);cl = rotl(cl, 10);
  el = fn4(el, al, bl, cl, dl, m[5], 0x8f1bbcdc, 6);bl = rotl(bl, 10);
  dl = fn4(dl, el, al, bl, cl, m[6], 0x8f1bbcdc, 5);al = rotl(al, 10);
  cl = fn4(cl, dl, el, al, bl, m[2], 0x8f1bbcdc, 12);el = rotl(el, 10);
  bl = fn5(bl, cl, dl, el, al, m[4], 0xa953fd4e, 9);dl = rotl(dl, 10);
  al = fn5(al, bl, cl, dl, el, m[0], 0xa953fd4e, 15);cl = rotl(cl, 10);
  el = fn5(el, al, bl, cl, dl, m[5], 0xa953fd4e, 5);bl = rotl(bl, 10);
  dl = fn5(dl, el, al, bl, cl, m[9], 0xa953fd4e, 11);al = rotl(al, 10);
  cl = fn5(cl, dl, el, al, bl, m[7], 0xa953fd4e, 6);el = rotl(el, 10);
  bl = fn5(bl, cl, dl, el, al, m[12], 0xa953fd4e, 8);dl = rotl(dl, 10);
  al = fn5(al, bl, cl, dl, el, m[2], 0xa953fd4e, 13);cl = rotl(cl, 10);
  el = fn5(el, al, bl, cl, dl, m[10], 0xa953fd4e, 12);bl = rotl(bl, 10);
  dl = fn5(dl, el, al, bl, cl, m[14], 0xa953fd4e, 5);al = rotl(al, 10);
  cl = fn5(cl, dl, el, al, bl, m[1], 0xa953fd4e, 12);el = rotl(el, 10);
  bl = fn5(bl, cl, dl, el, al, m[3], 0xa953fd4e, 13);dl = rotl(dl, 10);
  al = fn5(al, bl, cl, dl, el, m[8], 0xa953fd4e, 14);cl = rotl(cl, 10);
  el = fn5(el, al, bl, cl, dl, m[11], 0xa953fd4e, 11);bl = rotl(bl, 10);
  dl = fn5(dl, el, al, bl, cl, m[6], 0xa953fd4e, 8);al = rotl(al, 10);
  cl = fn5(cl, dl, el, al, bl, m[15], 0xa953fd4e, 5);el = rotl(el, 10);
  bl = fn5(bl, cl, dl, el, al, m[13], 0xa953fd4e, 6);dl = rotl(dl, 10);
  var ar = this._a;
  var br = this._b;
  var cr = this._c;
  var dr = this._d;
  var er = this._e;
  ar = fn5(ar, br, cr, dr, er, m[5], 0x50a28be6, 8);cr = rotl(cr, 10);
  er = fn5(er, ar, br, cr, dr, m[14], 0x50a28be6, 9);br = rotl(br, 10);
  dr = fn5(dr, er, ar, br, cr, m[7], 0x50a28be6, 9);ar = rotl(ar, 10);
  cr = fn5(cr, dr, er, ar, br, m[0], 0x50a28be6, 11);er = rotl(er, 10);
  br = fn5(br, cr, dr, er, ar, m[9], 0x50a28be6, 13);dr = rotl(dr, 10);
  ar = fn5(ar, br, cr, dr, er, m[2], 0x50a28be6, 15);cr = rotl(cr, 10);
  er = fn5(er, ar, br, cr, dr, m[11], 0x50a28be6, 15);br = rotl(br, 10);
  dr = fn5(dr, er, ar, br, cr, m[4], 0x50a28be6, 5);ar = rotl(ar, 10);
  cr = fn5(cr, dr, er, ar, br, m[13], 0x50a28be6, 7);er = rotl(er, 10);
  br = fn5(br, cr, dr, er, ar, m[6], 0x50a28be6, 7);dr = rotl(dr, 10);
  ar = fn5(ar, br, cr, dr, er, m[15], 0x50a28be6, 8);cr = rotl(cr, 10);
  er = fn5(er, ar, br, cr, dr, m[8], 0x50a28be6, 11);br = rotl(br, 10);
  dr = fn5(dr, er, ar, br, cr, m[1], 0x50a28be6, 14);ar = rotl(ar, 10);
  cr = fn5(cr, dr, er, ar, br, m[10], 0x50a28be6, 14);er = rotl(er, 10);
  br = fn5(br, cr, dr, er, ar, m[3], 0x50a28be6, 12);dr = rotl(dr, 10);
  ar = fn5(ar, br, cr, dr, er, m[12], 0x50a28be6, 6);cr = rotl(cr, 10);
  er = fn4(er, ar, br, cr, dr, m[6], 0x5c4dd124, 9);br = rotl(br, 10);
  dr = fn4(dr, er, ar, br, cr, m[11], 0x5c4dd124, 13);ar = rotl(ar, 10);
  cr = fn4(cr, dr, er, ar, br, m[3], 0x5c4dd124, 15);er = rotl(er, 10);
  br = fn4(br, cr, dr, er, ar, m[7], 0x5c4dd124, 7);dr = rotl(dr, 10);
  ar = fn4(ar, br, cr, dr, er, m[0], 0x5c4dd124, 12);cr = rotl(cr, 10);
  er = fn4(er, ar, br, cr, dr, m[13], 0x5c4dd124, 8);br = rotl(br, 10);
  dr = fn4(dr, er, ar, br, cr, m[5], 0x5c4dd124, 9);ar = rotl(ar, 10);
  cr = fn4(cr, dr, er, ar, br, m[10], 0x5c4dd124, 11);er = rotl(er, 10);
  br = fn4(br, cr, dr, er, ar, m[14], 0x5c4dd124, 7);dr = rotl(dr, 10);
  ar = fn4(ar, br, cr, dr, er, m[15], 0x5c4dd124, 7);cr = rotl(cr, 10);
  er = fn4(er, ar, br, cr, dr, m[8], 0x5c4dd124, 12);br = rotl(br, 10);
  dr = fn4(dr, er, ar, br, cr, m[12], 0x5c4dd124, 7);ar = rotl(ar, 10);
  cr = fn4(cr, dr, er, ar, br, m[4], 0x5c4dd124, 6);er = rotl(er, 10);
  br = fn4(br, cr, dr, er, ar, m[9], 0x5c4dd124, 15);dr = rotl(dr, 10);
  ar = fn4(ar, br, cr, dr, er, m[1], 0x5c4dd124, 13);cr = rotl(cr, 10);
  er = fn4(er, ar, br, cr, dr, m[2], 0x5c4dd124, 11);br = rotl(br, 10);
  dr = fn3(dr, er, ar, br, cr, m[15], 0x6d703ef3, 9);ar = rotl(ar, 10);
  cr = fn3(cr, dr, er, ar, br, m[5], 0x6d703ef3, 7);er = rotl(er, 10);
  br = fn3(br, cr, dr, er, ar, m[1], 0x6d703ef3, 15);dr = rotl(dr, 10);
  ar = fn3(ar, br, cr, dr, er, m[3], 0x6d703ef3, 11);cr = rotl(cr, 10);
  er = fn3(er, ar, br, cr, dr, m[7], 0x6d703ef3, 8);br = rotl(br, 10);
  dr = fn3(dr, er, ar, br, cr, m[14], 0x6d703ef3, 6);ar = rotl(ar, 10);
  cr = fn3(cr, dr, er, ar, br, m[6], 0x6d703ef3, 6);er = rotl(er, 10);
  br = fn3(br, cr, dr, er, ar, m[9], 0x6d703ef3, 14);dr = rotl(dr, 10);
  ar = fn3(ar, br, cr, dr, er, m[11], 0x6d703ef3, 12);cr = rotl(cr, 10);
  er = fn3(er, ar, br, cr, dr, m[8], 0x6d703ef3, 13);br = rotl(br, 10);
  dr = fn3(dr, er, ar, br, cr, m[12], 0x6d703ef3, 5);ar = rotl(ar, 10);
  cr = fn3(cr, dr, er, ar, br, m[2], 0x6d703ef3, 14);er = rotl(er, 10);
  br = fn3(br, cr, dr, er, ar, m[10], 0x6d703ef3, 13);dr = rotl(dr, 10);
  ar = fn3(ar, br, cr, dr, er, m[0], 0x6d703ef3, 13);cr = rotl(cr, 10);
  er = fn3(er, ar, br, cr, dr, m[4], 0x6d703ef3, 7);br = rotl(br, 10);
  dr = fn3(dr, er, ar, br, cr, m[13], 0x6d703ef3, 5);ar = rotl(ar, 10);
  cr = fn2(cr, dr, er, ar, br, m[8], 0x7a6d76e9, 15);er = rotl(er, 10);
  br = fn2(br, cr, dr, er, ar, m[6], 0x7a6d76e9, 5);dr = rotl(dr, 10);
  ar = fn2(ar, br, cr, dr, er, m[4], 0x7a6d76e9, 8);cr = rotl(cr, 10);
  er = fn2(er, ar, br, cr, dr, m[1], 0x7a6d76e9, 11);br = rotl(br, 10);
  dr = fn2(dr, er, ar, br, cr, m[3], 0x7a6d76e9, 14);ar = rotl(ar, 10);
  cr = fn2(cr, dr, er, ar, br, m[11], 0x7a6d76e9, 14);er = rotl(er, 10);
  br = fn2(br, cr, dr, er, ar, m[15], 0x7a6d76e9, 6);dr = rotl(dr, 10);
  ar = fn2(ar, br, cr, dr, er, m[0], 0x7a6d76e9, 14);cr = rotl(cr, 10);
  er = fn2(er, ar, br, cr, dr, m[5], 0x7a6d76e9, 6);br = rotl(br, 10);
  dr = fn2(dr, er, ar, br, cr, m[12], 0x7a6d76e9, 9);ar = rotl(ar, 10);
  cr = fn2(cr, dr, er, ar, br, m[2], 0x7a6d76e9, 12);er = rotl(er, 10);
  br = fn2(br, cr, dr, er, ar, m[13], 0x7a6d76e9, 9);dr = rotl(dr, 10);
  ar = fn2(ar, br, cr, dr, er, m[9], 0x7a6d76e9, 12);cr = rotl(cr, 10);
  er = fn2(er, ar, br, cr, dr, m[7], 0x7a6d76e9, 5);br = rotl(br, 10);
  dr = fn2(dr, er, ar, br, cr, m[10], 0x7a6d76e9, 15);ar = rotl(ar, 10);
  cr = fn2(cr, dr, er, ar, br, m[14], 0x7a6d76e9, 8);er = rotl(er, 10);
  br = fn1(br, cr, dr, er, ar, m[12], 0x00000000, 8);dr = rotl(dr, 10);
  ar = fn1(ar, br, cr, dr, er, m[15], 0x00000000, 5);cr = rotl(cr, 10);
  er = fn1(er, ar, br, cr, dr, m[10], 0x00000000, 12);br = rotl(br, 10);
  dr = fn1(dr, er, ar, br, cr, m[4], 0x00000000, 9);ar = rotl(ar, 10);
  cr = fn1(cr, dr, er, ar, br, m[1], 0x00000000, 12);er = rotl(er, 10);
  br = fn1(br, cr, dr, er, ar, m[5], 0x00000000, 5);dr = rotl(dr, 10);
  ar = fn1(ar, br, cr, dr, er, m[8], 0x00000000, 14);cr = rotl(cr, 10);
  er = fn1(er, ar, br, cr, dr, m[7], 0x00000000, 6);br = rotl(br, 10);
  dr = fn1(dr, er, ar, br, cr, m[6], 0x00000000, 8);ar = rotl(ar, 10);
  cr = fn1(cr, dr, er, ar, br, m[2], 0x00000000, 13);er = rotl(er, 10);
  br = fn1(br, cr, dr, er, ar, m[13], 0x00000000, 6);dr = rotl(dr, 10);
  ar = fn1(ar, br, cr, dr, er, m[14], 0x00000000, 5);cr = rotl(cr, 10);
  er = fn1(er, ar, br, cr, dr, m[0], 0x00000000, 15);br = rotl(br, 10);
  dr = fn1(dr, er, ar, br, cr, m[3], 0x00000000, 13);ar = rotl(ar, 10);
  cr = fn1(cr, dr, er, ar, br, m[9], 0x00000000, 11);er = rotl(er, 10);
  br = fn1(br, cr, dr, er, ar, m[11], 0x00000000, 11);dr = rotl(dr, 10);
  var t = this._b + cl + dr | 0;
  this._b = this._c + dl + er | 0;
  this._c = this._d + el + ar | 0;
  this._d = this._e + al + br | 0;
  this._e = this._a + bl + cr | 0;
  this._a = t;
};
RIPEMD160.prototype._digest = function () {
  this._block[this._blockOffset++] = 0x80;
  if (this._blockOffset > 56) {
    this._block.fill(0, this._blockOffset, 64);
    this._update();
    this._blockOffset = 0;
  }
  this._block.fill(0, this._blockOffset, 56);
  this._block.writeUInt32LE(this._length[0], 56);
  this._block.writeUInt32LE(this._length[1], 60);
  this._update();
  var buffer = new Buffer(20);
  buffer.writeInt32LE(this._a, 0);
  buffer.writeInt32LE(this._b, 4);
  buffer.writeInt32LE(this._c, 8);
  buffer.writeInt32LE(this._d, 12);
  buffer.writeInt32LE(this._e, 16);
  return buffer;
};
function rotl(x, n) {
  return x << n | x >>> 32 - n;
}
function fn1(a, b, c, d, e, m, k, s) {
  return rotl(a + (b ^ c ^ d) + m + k | 0, s) + e | 0;
}
function fn2(a, b, c, d, e, m, k, s) {
  return rotl(a + (b & c | ~b & d) + m + k | 0, s) + e | 0;
}
function fn3(a, b, c, d, e, m, k, s) {
  return rotl(a + ((b | ~c) ^ d) + m + k | 0, s) + e | 0;
}
function fn4(a, b, c, d, e, m, k, s) {
  return rotl(a + (b & d | c & ~d) + m + k | 0, s) + e | 0;
}
function fn5(a, b, c, d, e, m, k, s) {
  return rotl(a + (b ^ (c | ~d)) + m + k | 0, s) + e | 0;
}
var ripemd160$1 = RIPEMD160;

var Buffer$11 = safeBuffer.Buffer;
function Hash$1(blockSize, finalSize) {
  this._block = Buffer$11.alloc(blockSize);
  this._finalSize = finalSize;
  this._blockSize = blockSize;
  this._len = 0;
}
Hash$1.prototype.update = function (data, enc) {
  if (typeof data === 'string') {
    enc = enc || 'utf8';
    data = Buffer$11.from(data, enc);
  }
  var block = this._block;
  var blockSize = this._blockSize;
  var length = data.length;
  var accum = this._len;
  for (var offset = 0; offset < length;) {
    var assigned = accum % blockSize;
    var remainder = Math.min(length - offset, blockSize - assigned);
    for (var i = 0; i < remainder; i++) {
      block[assigned + i] = data[offset + i];
    }
    accum += remainder;
    offset += remainder;
    if (accum % blockSize === 0) {
      this._update(block);
    }
  }
  this._len += length;
  return this;
};
Hash$1.prototype.digest = function (enc) {
  var rem = this._len % this._blockSize;
  this._block[rem] = 0x80;
  this._block.fill(0, rem + 1);
  if (rem >= this._finalSize) {
    this._update(this._block);
    this._block.fill(0);
  }
  var bits = this._len * 8;
  if (bits <= 0xffffffff) {
    this._block.writeUInt32BE(bits, this._blockSize - 4);
  } else {
    var lowBits = bits & 0xffffffff;
    var highBits = (bits - lowBits) / 0x100000000;
    this._block.writeUInt32BE(highBits, this._blockSize - 8);
    this._block.writeUInt32BE(lowBits, this._blockSize - 4);
  }
  this._update(this._block);
  var hash = this._hash();
  return enc ? hash.toString(enc) : hash;
};
Hash$1.prototype._update = function () {
  throw new Error('_update must be implemented by subclass');
};
var hash = Hash$1;

var Buffer$10 = safeBuffer.Buffer;
var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0];
var W = new Array(80);
function Sha() {
  this.init();
  this._w = W;
  hash.call(this, 64, 56);
}
inherits_browser(Sha, hash);
Sha.prototype.init = function () {
  this._a = 0x67452301;
  this._b = 0xefcdab89;
  this._c = 0x98badcfe;
  this._d = 0x10325476;
  this._e = 0xc3d2e1f0;
  return this;
};
function rotl5(num) {
  return num << 5 | num >>> 27;
}
function rotl30(num) {
  return num << 30 | num >>> 2;
}
function ft(s, b, c, d) {
  if (s === 0) return b & c | ~b & d;
  if (s === 2) return b & c | b & d | c & d;
  return b ^ c ^ d;
}
Sha.prototype._update = function (M) {
  var W = this._w;
  var a = this._a | 0;
  var b = this._b | 0;
  var c = this._c | 0;
  var d = this._d | 0;
  var e = this._e | 0;
  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4);
  for (; i < 80; ++i) W[i] = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20);
    var t = rotl5(a) + ft(s, b, c, d) + e + W[j] + K[s] | 0;
    e = d;
    d = c;
    c = rotl30(b);
    b = a;
    a = t;
  }
  this._a = a + this._a | 0;
  this._b = b + this._b | 0;
  this._c = c + this._c | 0;
  this._d = d + this._d | 0;
  this._e = e + this._e | 0;
};
Sha.prototype._hash = function () {
  var H = Buffer$10.allocUnsafe(20);
  H.writeInt32BE(this._a | 0, 0);
  H.writeInt32BE(this._b | 0, 4);
  H.writeInt32BE(this._c | 0, 8);
  H.writeInt32BE(this._d | 0, 12);
  H.writeInt32BE(this._e | 0, 16);
  return H;
};
var sha = Sha;

var Buffer$12 = safeBuffer.Buffer;
var K$1 = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0];
var W$1 = new Array(80);
function Sha1() {
  this.init();
  this._w = W$1;
  hash.call(this, 64, 56);
}
inherits_browser(Sha1, hash);
Sha1.prototype.init = function () {
  this._a = 0x67452301;
  this._b = 0xefcdab89;
  this._c = 0x98badcfe;
  this._d = 0x10325476;
  this._e = 0xc3d2e1f0;
  return this;
};
function rotl1(num) {
  return num << 1 | num >>> 31;
}
function rotl5$1(num) {
  return num << 5 | num >>> 27;
}
function rotl30$1(num) {
  return num << 30 | num >>> 2;
}
function ft$1(s, b, c, d) {
  if (s === 0) return b & c | ~b & d;
  if (s === 2) return b & c | b & d | c & d;
  return b ^ c ^ d;
}
Sha1.prototype._update = function (M) {
  var W = this._w;
  var a = this._a | 0;
  var b = this._b | 0;
  var c = this._c | 0;
  var d = this._d | 0;
  var e = this._e | 0;
  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4);
  for (; i < 80; ++i) W[i] = rotl1(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]);
  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20);
    var t = rotl5$1(a) + ft$1(s, b, c, d) + e + W[j] + K$1[s] | 0;
    e = d;
    d = c;
    c = rotl30$1(b);
    b = a;
    a = t;
  }
  this._a = a + this._a | 0;
  this._b = b + this._b | 0;
  this._c = c + this._c | 0;
  this._d = d + this._d | 0;
  this._e = e + this._e | 0;
};
Sha1.prototype._hash = function () {
  var H = Buffer$12.allocUnsafe(20);
  H.writeInt32BE(this._a | 0, 0);
  H.writeInt32BE(this._b | 0, 4);
  H.writeInt32BE(this._c | 0, 8);
  H.writeInt32BE(this._d | 0, 12);
  H.writeInt32BE(this._e | 0, 16);
  return H;
};
var sha1$2 = Sha1;

var Buffer$14 = safeBuffer.Buffer;
var K$2 = [0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2];
var W$3 = new Array(64);
function Sha256() {
  this.init();
  this._w = W$3;
  hash.call(this, 64, 56);
}
inherits_browser(Sha256, hash);
Sha256.prototype.init = function () {
  this._a = 0x6a09e667;
  this._b = 0xbb67ae85;
  this._c = 0x3c6ef372;
  this._d = 0xa54ff53a;
  this._e = 0x510e527f;
  this._f = 0x9b05688c;
  this._g = 0x1f83d9ab;
  this._h = 0x5be0cd19;
  return this;
};
function ch(x, y, z) {
  return z ^ x & (y ^ z);
}
function maj(x, y, z) {
  return x & y | z & (x | y);
}
function sigma0(x) {
  return (x >>> 2 | x << 30) ^ (x >>> 13 | x << 19) ^ (x >>> 22 | x << 10);
}
function sigma1(x) {
  return (x >>> 6 | x << 26) ^ (x >>> 11 | x << 21) ^ (x >>> 25 | x << 7);
}
function gamma0(x) {
  return (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3;
}
function gamma1(x) {
  return (x >>> 17 | x << 15) ^ (x >>> 19 | x << 13) ^ x >>> 10;
}
Sha256.prototype._update = function (M) {
  var W = this._w;
  var a = this._a | 0;
  var b = this._b | 0;
  var c = this._c | 0;
  var d = this._d | 0;
  var e = this._e | 0;
  var f = this._f | 0;
  var g = this._g | 0;
  var h = this._h | 0;
  for (var i = 0; i < 16; ++i) W[i] = M.readInt32BE(i * 4);
  for (; i < 64; ++i) W[i] = gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16] | 0;
  for (var j = 0; j < 64; ++j) {
    var T1 = h + sigma1(e) + ch(e, f, g) + K$2[j] + W[j] | 0;
    var T2 = sigma0(a) + maj(a, b, c) | 0;
    h = g;
    g = f;
    f = e;
    e = d + T1 | 0;
    d = c;
    c = b;
    b = a;
    a = T1 + T2 | 0;
  }
  this._a = a + this._a | 0;
  this._b = b + this._b | 0;
  this._c = c + this._c | 0;
  this._d = d + this._d | 0;
  this._e = e + this._e | 0;
  this._f = f + this._f | 0;
  this._g = g + this._g | 0;
  this._h = h + this._h | 0;
};
Sha256.prototype._hash = function () {
  var H = Buffer$14.allocUnsafe(32);
  H.writeInt32BE(this._a, 0);
  H.writeInt32BE(this._b, 4);
  H.writeInt32BE(this._c, 8);
  H.writeInt32BE(this._d, 12);
  H.writeInt32BE(this._e, 16);
  H.writeInt32BE(this._f, 20);
  H.writeInt32BE(this._g, 24);
  H.writeInt32BE(this._h, 28);
  return H;
};
var sha256$1 = Sha256;

var Buffer$13 = safeBuffer.Buffer;
var W$2 = new Array(64);
function Sha224() {
  this.init();
  this._w = W$2;
  hash.call(this, 64, 56);
}
inherits_browser(Sha224, sha256$1);
Sha224.prototype.init = function () {
  this._a = 0xc1059ed8;
  this._b = 0x367cd507;
  this._c = 0x3070dd17;
  this._d = 0xf70e5939;
  this._e = 0xffc00b31;
  this._f = 0x68581511;
  this._g = 0x64f98fa7;
  this._h = 0xbefa4fa4;
  return this;
};
Sha224.prototype._hash = function () {
  var H = Buffer$13.allocUnsafe(28);
  H.writeInt32BE(this._a, 0);
  H.writeInt32BE(this._b, 4);
  H.writeInt32BE(this._c, 8);
  H.writeInt32BE(this._d, 12);
  H.writeInt32BE(this._e, 16);
  H.writeInt32BE(this._f, 20);
  H.writeInt32BE(this._g, 24);
  return H;
};
var sha224 = Sha224;

var Buffer$16 = safeBuffer.Buffer;
var K$3 = [0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118, 0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2, 0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694, 0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65, 0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5, 0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70, 0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df, 0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b, 0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8, 0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8, 0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3, 0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec, 0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b, 0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b, 0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a, 0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817];
var W$5 = new Array(160);
function Sha512() {
  this.init();
  this._w = W$5;
  hash.call(this, 128, 112);
}
inherits_browser(Sha512, hash);
Sha512.prototype.init = function () {
  this._ah = 0x6a09e667;
  this._bh = 0xbb67ae85;
  this._ch = 0x3c6ef372;
  this._dh = 0xa54ff53a;
  this._eh = 0x510e527f;
  this._fh = 0x9b05688c;
  this._gh = 0x1f83d9ab;
  this._hh = 0x5be0cd19;
  this._al = 0xf3bcc908;
  this._bl = 0x84caa73b;
  this._cl = 0xfe94f82b;
  this._dl = 0x5f1d36f1;
  this._el = 0xade682d1;
  this._fl = 0x2b3e6c1f;
  this._gl = 0xfb41bd6b;
  this._hl = 0x137e2179;
  return this;
};
function Ch(x, y, z) {
  return z ^ x & (y ^ z);
}
function maj$1(x, y, z) {
  return x & y | z & (x | y);
}
function sigma0$1(x, xl) {
  return (x >>> 28 | xl << 4) ^ (xl >>> 2 | x << 30) ^ (xl >>> 7 | x << 25);
}
function sigma1$1(x, xl) {
  return (x >>> 14 | xl << 18) ^ (x >>> 18 | xl << 14) ^ (xl >>> 9 | x << 23);
}
function Gamma0(x, xl) {
  return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ x >>> 7;
}
function Gamma0l(x, xl) {
  return (x >>> 1 | xl << 31) ^ (x >>> 8 | xl << 24) ^ (x >>> 7 | xl << 25);
}
function Gamma1(x, xl) {
  return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ x >>> 6;
}
function Gamma1l(x, xl) {
  return (x >>> 19 | xl << 13) ^ (xl >>> 29 | x << 3) ^ (x >>> 6 | xl << 26);
}
function getCarry(a, b) {
  return a >>> 0 < b >>> 0 ? 1 : 0;
}
Sha512.prototype._update = function (M) {
  var W = this._w;
  var ah = this._ah | 0;
  var bh = this._bh | 0;
  var ch = this._ch | 0;
  var dh = this._dh | 0;
  var eh = this._eh | 0;
  var fh = this._fh | 0;
  var gh = this._gh | 0;
  var hh = this._hh | 0;
  var al = this._al | 0;
  var bl = this._bl | 0;
  var cl = this._cl | 0;
  var dl = this._dl | 0;
  var el = this._el | 0;
  var fl = this._fl | 0;
  var gl = this._gl | 0;
  var hl = this._hl | 0;
  for (var i = 0; i < 32; i += 2) {
    W[i] = M.readInt32BE(i * 4);
    W[i + 1] = M.readInt32BE(i * 4 + 4);
  }
  for (; i < 160; i += 2) {
    var xh = W[i - 15 * 2];
    var xl = W[i - 15 * 2 + 1];
    var gamma0 = Gamma0(xh, xl);
    var gamma0l = Gamma0l(xl, xh);
    xh = W[i - 2 * 2];
    xl = W[i - 2 * 2 + 1];
    var gamma1 = Gamma1(xh, xl);
    var gamma1l = Gamma1l(xl, xh);
    var Wi7h = W[i - 7 * 2];
    var Wi7l = W[i - 7 * 2 + 1];
    var Wi16h = W[i - 16 * 2];
    var Wi16l = W[i - 16 * 2 + 1];
    var Wil = gamma0l + Wi7l | 0;
    var Wih = gamma0 + Wi7h + getCarry(Wil, gamma0l) | 0;
    Wil = Wil + gamma1l | 0;
    Wih = Wih + gamma1 + getCarry(Wil, gamma1l) | 0;
    Wil = Wil + Wi16l | 0;
    Wih = Wih + Wi16h + getCarry(Wil, Wi16l) | 0;
    W[i] = Wih;
    W[i + 1] = Wil;
  }
  for (var j = 0; j < 160; j += 2) {
    Wih = W[j];
    Wil = W[j + 1];
    var majh = maj$1(ah, bh, ch);
    var majl = maj$1(al, bl, cl);
    var sigma0h = sigma0$1(ah, al);
    var sigma0l = sigma0$1(al, ah);
    var sigma1h = sigma1$1(eh, el);
    var sigma1l = sigma1$1(el, eh);
    var Kih = K$3[j];
    var Kil = K$3[j + 1];
    var chh = Ch(eh, fh, gh);
    var chl = Ch(el, fl, gl);
    var t1l = hl + sigma1l | 0;
    var t1h = hh + sigma1h + getCarry(t1l, hl) | 0;
    t1l = t1l + chl | 0;
    t1h = t1h + chh + getCarry(t1l, chl) | 0;
    t1l = t1l + Kil | 0;
    t1h = t1h + Kih + getCarry(t1l, Kil) | 0;
    t1l = t1l + Wil | 0;
    t1h = t1h + Wih + getCarry(t1l, Wil) | 0;
    var t2l = sigma0l + majl | 0;
    var t2h = sigma0h + majh + getCarry(t2l, sigma0l) | 0;
    hh = gh;
    hl = gl;
    gh = fh;
    gl = fl;
    fh = eh;
    fl = el;
    el = dl + t1l | 0;
    eh = dh + t1h + getCarry(el, dl) | 0;
    dh = ch;
    dl = cl;
    ch = bh;
    cl = bl;
    bh = ah;
    bl = al;
    al = t1l + t2l | 0;
    ah = t1h + t2h + getCarry(al, t1l) | 0;
  }
  this._al = this._al + al | 0;
  this._bl = this._bl + bl | 0;
  this._cl = this._cl + cl | 0;
  this._dl = this._dl + dl | 0;
  this._el = this._el + el | 0;
  this._fl = this._fl + fl | 0;
  this._gl = this._gl + gl | 0;
  this._hl = this._hl + hl | 0;
  this._ah = this._ah + ah + getCarry(this._al, al) | 0;
  this._bh = this._bh + bh + getCarry(this._bl, bl) | 0;
  this._ch = this._ch + ch + getCarry(this._cl, cl) | 0;
  this._dh = this._dh + dh + getCarry(this._dl, dl) | 0;
  this._eh = this._eh + eh + getCarry(this._el, el) | 0;
  this._fh = this._fh + fh + getCarry(this._fl, fl) | 0;
  this._gh = this._gh + gh + getCarry(this._gl, gl) | 0;
  this._hh = this._hh + hh + getCarry(this._hl, hl) | 0;
};
Sha512.prototype._hash = function () {
  var H = Buffer$16.allocUnsafe(64);
  function writeInt64BE(h, l, offset) {
    H.writeInt32BE(h, offset);
    H.writeInt32BE(l, offset + 4);
  }
  writeInt64BE(this._ah, this._al, 0);
  writeInt64BE(this._bh, this._bl, 8);
  writeInt64BE(this._ch, this._cl, 16);
  writeInt64BE(this._dh, this._dl, 24);
  writeInt64BE(this._eh, this._el, 32);
  writeInt64BE(this._fh, this._fl, 40);
  writeInt64BE(this._gh, this._gl, 48);
  writeInt64BE(this._hh, this._hl, 56);
  return H;
};
var sha512 = Sha512;

var Buffer$15 = safeBuffer.Buffer;
var W$4 = new Array(160);
function Sha384() {
  this.init();
  this._w = W$4;
  hash.call(this, 128, 112);
}
inherits_browser(Sha384, sha512);
Sha384.prototype.init = function () {
  this._ah = 0xcbbb9d5d;
  this._bh = 0x629a292a;
  this._ch = 0x9159015a;
  this._dh = 0x152fecd8;
  this._eh = 0x67332667;
  this._fh = 0x8eb44a87;
  this._gh = 0xdb0c2e0d;
  this._hh = 0x47b5481d;
  this._al = 0xc1059ed8;
  this._bl = 0x367cd507;
  this._cl = 0x3070dd17;
  this._dl = 0xf70e5939;
  this._el = 0xffc00b31;
  this._fl = 0x68581511;
  this._gl = 0x64f98fa7;
  this._hl = 0xbefa4fa4;
  return this;
};
Sha384.prototype._hash = function () {
  var H = Buffer$15.allocUnsafe(48);
  function writeInt64BE(h, l, offset) {
    H.writeInt32BE(h, offset);
    H.writeInt32BE(l, offset + 4);
  }
  writeInt64BE(this._ah, this._al, 0);
  writeInt64BE(this._bh, this._bl, 8);
  writeInt64BE(this._ch, this._cl, 16);
  writeInt64BE(this._dh, this._dl, 24);
  writeInt64BE(this._eh, this._el, 32);
  writeInt64BE(this._fh, this._fl, 40);
  return H;
};
var sha384 = Sha384;

var sha_js = createCommonjsModule$1(function (module) {
  var exports = module.exports = function SHA(algorithm) {
    algorithm = algorithm.toLowerCase();
    var Algorithm = exports[algorithm];
    if (!Algorithm) throw new Error(algorithm + ' is not supported (we accept pull requests)');
    return new Algorithm();
  };
  exports.sha = sha;
  exports.sha1 = sha1$2;
  exports.sha224 = sha224;
  exports.sha256 = sha256$1;
  exports.sha384 = sha384;
  exports.sha512 = sha512;
});

var Buffer$17 = safeBuffer.Buffer;
var Transform$3 = require$$1$5.Transform;
var StringDecoder$1 = stringDecoder.StringDecoder;
function CipherBase(hashMode) {
  Transform$3.call(this);
  this.hashMode = typeof hashMode === 'string';
  if (this.hashMode) {
    this[hashMode] = this._finalOrDigest;
  } else {
    this.final = this._finalOrDigest;
  }
  if (this._final) {
    this.__final = this._final;
    this._final = null;
  }
  this._decoder = null;
  this._encoding = null;
}
inherits_browser(CipherBase, Transform$3);
CipherBase.prototype.update = function (data, inputEnc, outputEnc) {
  if (typeof data === 'string') {
    data = Buffer$17.from(data, inputEnc);
  }
  var outData = this._update(data);
  if (this.hashMode) return this;
  if (outputEnc) {
    outData = this._toString(outData, outputEnc);
  }
  return outData;
};
CipherBase.prototype.setAutoPadding = function () {};
CipherBase.prototype.getAuthTag = function () {
  throw new Error('trying to get auth tag in unsupported state');
};
CipherBase.prototype.setAuthTag = function () {
  throw new Error('trying to set auth tag in unsupported state');
};
CipherBase.prototype.setAAD = function () {
  throw new Error('trying to set aad in unsupported state');
};
CipherBase.prototype._transform = function (data, _, next) {
  var err;
  try {
    if (this.hashMode) {
      this._update(data);
    } else {
      this.push(this._update(data));
    }
  } catch (e) {
    err = e;
  } finally {
    next(err);
  }
};
CipherBase.prototype._flush = function (done) {
  var err;
  try {
    this.push(this.__final());
  } catch (e) {
    err = e;
  }
  done(err);
};
CipherBase.prototype._finalOrDigest = function (outputEnc) {
  var outData = this.__final() || Buffer$17.alloc(0);
  if (outputEnc) {
    outData = this._toString(outData, outputEnc, true);
  }
  return outData;
};
CipherBase.prototype._toString = function (value, enc, fin) {
  if (!this._decoder) {
    this._decoder = new StringDecoder$1(enc);
    this._encoding = enc;
  }
  if (this._encoding !== enc) throw new Error('can\'t switch encodings');
  var out = this._decoder.write(value);
  if (fin) {
    out += this._decoder.end();
  }
  return out;
};
var cipherBase = CipherBase;

function HashNoConstructor(hash) {
  cipherBase.call(this, 'digest');
  this._hash = hash;
  this.buffers = [];
}
inherits_browser(HashNoConstructor, cipherBase);
HashNoConstructor.prototype._update = function (data) {
  this.buffers.push(data);
};
HashNoConstructor.prototype._final = function () {
  var buf = Buffer.concat(this.buffers);
  var r = this._hash(buf);
  this.buffers = null;
  return r;
};
function Hash(hash) {
  cipherBase.call(this, 'digest');
  this._hash = hash;
}
inherits_browser(Hash, cipherBase);
Hash.prototype._update = function (data) {
  this._hash.update(data);
};
Hash.prototype._final = function () {
  return this._hash.digest();
};
var browser = function createHash(alg) {
  alg = alg.toLowerCase();
  if (alg === 'md5') return new HashNoConstructor(md5$1);
  if (alg === 'rmd160' || alg === 'ripemd160') return new Hash(new ripemd160$1());
  return new Hash(sha_js(alg));
};

function ripemd160(buffer) {
  return browser('rmd160').update(buffer).digest();
}
function sha1$1(buffer) {
  return browser('sha1').update(buffer).digest();
}
function sha256(buffer) {
  return browser('sha256').update(buffer).digest();
}
function hash160(buffer) {
  return ripemd160(sha256(buffer));
}
function hash256(buffer) {
  return sha256(sha256(buffer));
}
var crypto = {
  hash160: hash160,
  hash256: hash256,
  ripemd160: ripemd160,
  sha1: sha1$1,
  sha256: sha256
};

var fastRoot = function fastRoot(values, digestFn) {
  if (!Array.isArray(values)) throw TypeError('Expected values Array');
  if (typeof digestFn !== 'function') throw TypeError('Expected digest Function');
  var length = values.length;
  var results = values.concat();
  while (length > 1) {
    var j = 0;
    for (var i = 0; i < length; i += 2, ++j) {
      var left = results[i];
      var right = i + 1 === length ? left : results[i + 1];
      var data = Buffer.concat([left, right]);
      results[j] = digestFn(data);
    }
    length = j;
  }
  return results[0];
};

var Buffer$18 = safeBuffer.Buffer;
function varSliceSize(someScript) {
  var length = someScript.length;
  return varuintBitcoin.encodingLength(length) + length;
}
function vectorSize(someVector) {
  var length = someVector.length;
  return varuintBitcoin.encodingLength(length) + someVector.reduce(function (sum, witness) {
    return sum + varSliceSize(witness);
  }, 0);
}
function Transaction() {
  this.version = 1;
  this.locktime = 0;
  this.ins = [];
  this.outs = [];
}
Transaction.DEFAULT_SEQUENCE = 0xffffffff;
Transaction.SIGHASH_ALL = 0x01;
Transaction.SIGHASH_NONE = 0x02;
Transaction.SIGHASH_SINGLE = 0x03;
Transaction.SIGHASH_ANYONECANPAY = 0x80;
Transaction.ADVANCED_TRANSACTION_MARKER = 0x00;
Transaction.ADVANCED_TRANSACTION_FLAG = 0x01;
var EMPTY_SCRIPT = Buffer$18.allocUnsafe(0);
var EMPTY_WITNESS = [];
var ZERO = Buffer$18.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
var ONE = Buffer$18.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex');
var VALUE_UINT64_MAX = Buffer$18.from('ffffffffffffffff', 'hex');
var BLANK_OUTPUT = {
  script: EMPTY_SCRIPT,
  valueBuffer: VALUE_UINT64_MAX
};
Transaction.fromBuffer = function (buffer, __noStrict) {
  var offset = 0;
  function readSlice(n) {
    offset += n;
    return buffer.slice(offset - n, offset);
  }
  function readUInt32() {
    var i = buffer.readUInt32LE(offset);
    offset += 4;
    return i;
  }
  function readInt32() {
    var i = buffer.readInt32LE(offset);
    offset += 4;
    return i;
  }
  function readUInt64() {
    var i = bufferutils.readUInt64LE(buffer, offset);
    offset += 8;
    return i;
  }
  function readVarInt() {
    var vi = varuintBitcoin.decode(buffer, offset);
    offset += varuintBitcoin.decode.bytes;
    return vi;
  }
  function readVarSlice() {
    return readSlice(readVarInt());
  }
  function readVector() {
    var count = readVarInt();
    var vector = [];
    for (var i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }
  var tx = new Transaction();
  tx.version = readInt32();
  var marker = buffer.readUInt8(offset);
  var flag = buffer.readUInt8(offset + 1);
  var hasWitnesses = false;
  if (marker === Transaction.ADVANCED_TRANSACTION_MARKER && flag === Transaction.ADVANCED_TRANSACTION_FLAG) {
    offset += 2;
    hasWitnesses = true;
  }
  var vinLen = readVarInt();
  for (var i = 0; i < vinLen; ++i) {
    tx.ins.push({
      hash: readSlice(32),
      index: readUInt32(),
      script: readVarSlice(),
      sequence: readUInt32(),
      witness: EMPTY_WITNESS
    });
  }
  var voutLen = readVarInt();
  for (i = 0; i < voutLen; ++i) {
    tx.outs.push({
      value: readUInt64(),
      script: readVarSlice()
    });
  }
  if (hasWitnesses) {
    for (i = 0; i < vinLen; ++i) {
      tx.ins[i].witness = readVector();
    }
    if (!tx.hasWitnesses()) throw new Error('Transaction has superfluous witness data');
  }
  tx.locktime = readUInt32();
  if (__noStrict) return tx;
  if (offset !== buffer.length) throw new Error('Transaction has unexpected data');
  return tx;
};
Transaction.fromHex = function (hex) {
  return Transaction.fromBuffer(Buffer$18.from(hex, 'hex'));
};
Transaction.isCoinbaseHash = function (buffer) {
  typeforce_1(types_1.Hash256bit, buffer);
  for (var i = 0; i < 32; ++i) {
    if (buffer[i] !== 0) return false;
  }
  return true;
};
Transaction.prototype.isCoinbase = function () {
  return this.ins.length === 1 && Transaction.isCoinbaseHash(this.ins[0].hash);
};
Transaction.prototype.addInput = function (hash, index, sequence, scriptSig) {
  typeforce_1(types_1.tuple(types_1.Hash256bit, types_1.UInt32, types_1.maybe(types_1.UInt32), types_1.maybe(types_1.Buffer)), arguments);
  if (types_1.Null(sequence)) {
    sequence = Transaction.DEFAULT_SEQUENCE;
  }
  return this.ins.push({
    hash: hash,
    index: index,
    script: scriptSig || EMPTY_SCRIPT,
    sequence: sequence,
    witness: EMPTY_WITNESS
  }) - 1;
};
Transaction.prototype.addOutput = function (scriptPubKey, value) {
  typeforce_1(types_1.tuple(types_1.Buffer, types_1.Satoshi), arguments);
  return this.outs.push({
    script: scriptPubKey,
    value: value
  }) - 1;
};
Transaction.prototype.hasWitnesses = function () {
  return this.ins.some(function (x) {
    return x.witness.length !== 0;
  });
};
Transaction.prototype.weight = function () {
  var base = this.__byteLength(false);
  var total = this.__byteLength(true);
  return base * 3 + total;
};
Transaction.prototype.virtualSize = function () {
  return Math.ceil(this.weight() / 4);
};
Transaction.prototype.byteLength = function () {
  return this.__byteLength(true);
};
Transaction.prototype.__byteLength = function (__allowWitness) {
  var hasWitnesses = __allowWitness && this.hasWitnesses();
  return (hasWitnesses ? 10 : 8) + varuintBitcoin.encodingLength(this.ins.length) + varuintBitcoin.encodingLength(this.outs.length) + this.ins.reduce(function (sum, input) {
    return sum + 40 + varSliceSize(input.script);
  }, 0) + this.outs.reduce(function (sum, output) {
    return sum + 8 + varSliceSize(output.script);
  }, 0) + (hasWitnesses ? this.ins.reduce(function (sum, input) {
    return sum + vectorSize(input.witness);
  }, 0) : 0);
};
Transaction.prototype.clone = function () {
  var newTx = new Transaction();
  newTx.version = this.version;
  newTx.locktime = this.locktime;
  newTx.ins = this.ins.map(function (txIn) {
    return {
      hash: txIn.hash,
      index: txIn.index,
      script: txIn.script,
      sequence: txIn.sequence,
      witness: txIn.witness
    };
  });
  newTx.outs = this.outs.map(function (txOut) {
    return {
      script: txOut.script,
      value: txOut.value
    };
  });
  return newTx;
};
Transaction.prototype.hashForSignature = function (inIndex, prevOutScript, hashType) {
  typeforce_1(types_1.tuple(types_1.UInt32, types_1.Buffer,                  types_1.Number), arguments);
  if (inIndex >= this.ins.length) return ONE;
  var ourScript = script.compile(script.decompile(prevOutScript).filter(function (x) {
    return x !== ops.OP_CODESEPARATOR;
  }));
  var txTmp = this.clone();
  if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) {
    txTmp.outs = [];
    txTmp.ins.forEach(function (input, i) {
      if (i === inIndex) return;
      input.sequence = 0;
    });
  } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) {
    if (inIndex >= this.outs.length) return ONE;
    txTmp.outs.length = inIndex + 1;
    for (var i = 0; i < inIndex; i++) {
      txTmp.outs[i] = BLANK_OUTPUT;
    }
    txTmp.ins.forEach(function (input, y) {
      if (y === inIndex) return;
      input.sequence = 0;
    });
  }
  if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
    txTmp.ins = [txTmp.ins[inIndex]];
    txTmp.ins[0].script = ourScript;
  } else {
    txTmp.ins.forEach(function (input) {
      input.script = EMPTY_SCRIPT;
    });
    txTmp.ins[inIndex].script = ourScript;
  }
  var buffer = Buffer$18.allocUnsafe(txTmp.__byteLength(false) + 4);
  buffer.writeInt32LE(hashType, buffer.length - 4);
  txTmp.__toBuffer(buffer, 0, false);
  return crypto.hash256(buffer);
};
Transaction.prototype.hashForWitnessV0 = function (inIndex, prevOutScript, value, hashType) {
  typeforce_1(types_1.tuple(types_1.UInt32, types_1.Buffer, types_1.Satoshi, types_1.UInt32), arguments);
  var tbuffer, toffset;
  function writeSlice(slice) {
    toffset += slice.copy(tbuffer, toffset);
  }
  function writeUInt32(i) {
    toffset = tbuffer.writeUInt32LE(i, toffset);
  }
  function writeUInt64(i) {
    toffset = bufferutils.writeUInt64LE(tbuffer, i, toffset);
  }
  function writeVarInt(i) {
    varuintBitcoin.encode(i, tbuffer, toffset);
    toffset += varuintBitcoin.encode.bytes;
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);writeSlice(slice);
  }
  var hashOutputs = ZERO;
  var hashPrevouts = ZERO;
  var hashSequence = ZERO;
  if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
    tbuffer = Buffer$18.allocUnsafe(36 * this.ins.length);
    toffset = 0;
    this.ins.forEach(function (txIn) {
      writeSlice(txIn.hash);
      writeUInt32(txIn.index);
    });
    hashPrevouts = crypto.hash256(tbuffer);
  }
  if (!(hashType & Transaction.SIGHASH_ANYONECANPAY) && (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE && (hashType & 0x1f) !== Transaction.SIGHASH_NONE) {
    tbuffer = Buffer$18.allocUnsafe(4 * this.ins.length);
    toffset = 0;
    this.ins.forEach(function (txIn) {
      writeUInt32(txIn.sequence);
    });
    hashSequence = crypto.hash256(tbuffer);
  }
  if ((hashType & 0x1f) !== Transaction.SIGHASH_SINGLE && (hashType & 0x1f) !== Transaction.SIGHASH_NONE) {
    var txOutsSize = this.outs.reduce(function (sum, output) {
      return sum + 8 + varSliceSize(output.script);
    }, 0);
    tbuffer = Buffer$18.allocUnsafe(txOutsSize);
    toffset = 0;
    this.outs.forEach(function (out) {
      writeUInt64(out.value);
      writeVarSlice(out.script);
    });
    hashOutputs = crypto.hash256(tbuffer);
  } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE && inIndex < this.outs.length) {
    var output = this.outs[inIndex];
    tbuffer = Buffer$18.allocUnsafe(8 + varSliceSize(output.script));
    toffset = 0;
    writeUInt64(output.value);
    writeVarSlice(output.script);
    hashOutputs = crypto.hash256(tbuffer);
  }
  tbuffer = Buffer$18.allocUnsafe(156 + varSliceSize(prevOutScript));
  toffset = 0;
  var input = this.ins[inIndex];
  writeUInt32(this.version);
  writeSlice(hashPrevouts);
  writeSlice(hashSequence);
  writeSlice(input.hash);
  writeUInt32(input.index);
  writeVarSlice(prevOutScript);
  writeUInt64(value);
  writeUInt32(input.sequence);
  writeSlice(hashOutputs);
  writeUInt32(this.locktime);
  writeUInt32(hashType);
  return crypto.hash256(tbuffer);
};
Transaction.prototype.getHash = function () {
  return crypto.hash256(this.__toBuffer(undefined, undefined, false));
};
Transaction.prototype.getId = function () {
  return this.getHash().reverse().toString('hex');
};
Transaction.prototype.toBuffer = function (buffer, initialOffset) {
  return this.__toBuffer(buffer, initialOffset, true);
};
Transaction.prototype.__toBuffer = function (buffer, initialOffset, __allowWitness) {
  if (!buffer) buffer = Buffer$18.allocUnsafe(this.__byteLength(__allowWitness));
  var offset = initialOffset || 0;
  function writeSlice(slice) {
    offset += slice.copy(buffer, offset);
  }
  function writeUInt8(i) {
    offset = buffer.writeUInt8(i, offset);
  }
  function writeUInt32(i) {
    offset = buffer.writeUInt32LE(i, offset);
  }
  function writeInt32(i) {
    offset = buffer.writeInt32LE(i, offset);
  }
  function writeUInt64(i) {
    offset = bufferutils.writeUInt64LE(buffer, i, offset);
  }
  function writeVarInt(i) {
    varuintBitcoin.encode(i, buffer, offset);
    offset += varuintBitcoin.encode.bytes;
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);writeSlice(slice);
  }
  function writeVector(vector) {
    writeVarInt(vector.length);vector.forEach(writeVarSlice);
  }
  writeInt32(this.version);
  var hasWitnesses = __allowWitness && this.hasWitnesses();
  if (hasWitnesses) {
    writeUInt8(Transaction.ADVANCED_TRANSACTION_MARKER);
    writeUInt8(Transaction.ADVANCED_TRANSACTION_FLAG);
  }
  writeVarInt(this.ins.length);
  this.ins.forEach(function (txIn) {
    writeSlice(txIn.hash);
    writeUInt32(txIn.index);
    writeVarSlice(txIn.script);
    writeUInt32(txIn.sequence);
  });
  writeVarInt(this.outs.length);
  this.outs.forEach(function (txOut) {
    if (!txOut.valueBuffer) {
      writeUInt64(txOut.value);
    } else {
      writeSlice(txOut.valueBuffer);
    }
    writeVarSlice(txOut.script);
  });
  if (hasWitnesses) {
    this.ins.forEach(function (input) {
      writeVector(input.witness);
    });
  }
  writeUInt32(this.locktime);
  if (initialOffset !== undefined) return buffer.slice(initialOffset, offset);
  return buffer;
};
Transaction.prototype.toHex = function () {
  return this.toBuffer().toString('hex');
};
Transaction.prototype.setInputScript = function (index, scriptSig) {
  typeforce_1(types_1.tuple(types_1.Number, types_1.Buffer), arguments);
  this.ins[index].script = scriptSig;
};
Transaction.prototype.setWitness = function (index, witness) {
  typeforce_1(types_1.tuple(types_1.Number, [types_1.Buffer]), arguments);
  this.ins[index].witness = witness;
};
var transaction = Transaction;

var Buffer$9 = safeBuffer.Buffer;
function Block() {
  this.version = 1;
  this.prevHash = null;
  this.merkleRoot = null;
  this.timestamp = 0;
  this.bits = 0;
  this.nonce = 0;
}
Block.fromBuffer = function (buffer) {
  if (buffer.length < 80) throw new Error('Buffer too small (< 80 bytes)');
  var offset = 0;
  function readSlice(n) {
    offset += n;
    return buffer.slice(offset - n, offset);
  }
  function readUInt32() {
    var i = buffer.readUInt32LE(offset);
    offset += 4;
    return i;
  }
  function readInt32() {
    var i = buffer.readInt32LE(offset);
    offset += 4;
    return i;
  }
  var block = new Block();
  block.version = readInt32();
  block.prevHash = readSlice(32);
  block.merkleRoot = readSlice(32);
  block.timestamp = readUInt32();
  block.bits = readUInt32();
  block.nonce = readUInt32();
  if (buffer.length === 80) return block;
  function readVarInt() {
    var vi = varuintBitcoin.decode(buffer, offset);
    offset += varuintBitcoin.decode.bytes;
    return vi;
  }
  function readTransaction() {
    var tx = transaction.fromBuffer(buffer.slice(offset), true);
    offset += tx.byteLength();
    return tx;
  }
  var nTransactions = readVarInt();
  block.transactions = [];
  for (var i = 0; i < nTransactions; ++i) {
    var tx = readTransaction();
    block.transactions.push(tx);
  }
  return block;
};
Block.prototype.byteLength = function (headersOnly) {
  if (headersOnly || !this.transactions) return 80;
  return 80 + varuintBitcoin.encodingLength(this.transactions.length) + this.transactions.reduce(function (a, x) {
    return a + x.byteLength();
  }, 0);
};
Block.fromHex = function (hex) {
  return Block.fromBuffer(Buffer$9.from(hex, 'hex'));
};
Block.prototype.getHash = function () {
  return crypto.hash256(this.toBuffer(true));
};
Block.prototype.getId = function () {
  return this.getHash().reverse().toString('hex');
};
Block.prototype.getUTCDate = function () {
  var date = new Date(0);
  date.setUTCSeconds(this.timestamp);
  return date;
};
Block.prototype.toBuffer = function (headersOnly) {
  var buffer = Buffer$9.allocUnsafe(this.byteLength(headersOnly));
  var offset = 0;
  function writeSlice(slice) {
    slice.copy(buffer, offset);
    offset += slice.length;
  }
  function writeInt32(i) {
    buffer.writeInt32LE(i, offset);
    offset += 4;
  }
  function writeUInt32(i) {
    buffer.writeUInt32LE(i, offset);
    offset += 4;
  }
  writeInt32(this.version);
  writeSlice(this.prevHash);
  writeSlice(this.merkleRoot);
  writeUInt32(this.timestamp);
  writeUInt32(this.bits);
  writeUInt32(this.nonce);
  if (headersOnly || !this.transactions) return buffer;
  varuintBitcoin.encode(this.transactions.length, buffer, offset);
  offset += varuintBitcoin.encode.bytes;
  this.transactions.forEach(function (tx) {
    var txSize = tx.byteLength();
    tx.toBuffer(buffer, offset);
    offset += txSize;
  });
  return buffer;
};
Block.prototype.toHex = function (headersOnly) {
  return this.toBuffer(headersOnly).toString('hex');
};
Block.calculateTarget = function (bits) {
  var exponent = ((bits & 0xff000000) >> 24) - 3;
  var mantissa = bits & 0x007fffff;
  var target = Buffer$9.alloc(32, 0);
  target.writeUInt32BE(mantissa, 28 - exponent);
  return target;
};
Block.calculateMerkleRoot = function (transactions) {
  typeforce_1([{ getHash: types_1.Function }], transactions);
  if (transactions.length === 0) throw TypeError('Cannot compute merkle root for zero transactions');
  var hashes = transactions.map(function (transaction$$1) {
    return transaction$$1.getHash();
  });
  return fastRoot(hashes, crypto.hash256);
};
Block.prototype.checkMerkleRoot = function () {
  if (!this.transactions) return false;
  var actualMerkleRoot = Block.calculateMerkleRoot(this.transactions);
  return this.merkleRoot.compare(actualMerkleRoot) === 0;
};
Block.prototype.checkProofOfWork = function () {
  var hash = this.getHash().reverse();
  var target = Block.calculateTarget(this.bits);
  return hash.compare(target) <= 0;
};
var block = Block;

var ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
var ALPHABET_MAP = {};
for (var z = 0; z < ALPHABET.length; z++) {
  var x = ALPHABET.charAt(z);
  if (ALPHABET_MAP[x] !== undefined) throw new TypeError(x + ' is ambiguous');
  ALPHABET_MAP[x] = z;
}
function polymodStep(pre) {
  var b = pre >> 25;
  return (pre & 0x1FFFFFF) << 5 ^ -(b >> 0 & 1) & 0x3b6a57b2 ^ -(b >> 1 & 1) & 0x26508e6d ^ -(b >> 2 & 1) & 0x1ea119fa ^ -(b >> 3 & 1) & 0x3d4233dd ^ -(b >> 4 & 1) & 0x2a1462b3;
}
function prefixChk(prefix) {
  var chk = 1;
  for (var i = 0; i < prefix.length; ++i) {
    var c = prefix.charCodeAt(i);
    if (c < 33 || c > 126) throw new Error('Invalid prefix (' + prefix + ')');
    chk = polymodStep(chk) ^ c >> 5;
  }
  chk = polymodStep(chk);
  for (i = 0; i < prefix.length; ++i) {
    var v = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ v & 0x1f;
  }
  return chk;
}
function encode$18(prefix, words, LIMIT) {
  LIMIT = LIMIT || 90;
  if (prefix.length + 7 + words.length > LIMIT) throw new TypeError('Exceeds length limit');
  prefix = prefix.toLowerCase();
  var chk = prefixChk(prefix);
  var result = prefix + '1';
  for (var i = 0; i < words.length; ++i) {
    var x = words[i];
    if (x >> 5 !== 0) throw new Error('Non 5-bit word');
    chk = polymodStep(chk) ^ x;
    result += ALPHABET.charAt(x);
  }
  for (i = 0; i < 6; ++i) {
    chk = polymodStep(chk);
  }
  chk ^= 1;
  for (i = 0; i < 6; ++i) {
    var v = chk >> (5 - i) * 5 & 0x1f;
    result += ALPHABET.charAt(v);
  }
  return result;
}
function decode$17(str, LIMIT) {
  LIMIT = LIMIT || 90;
  if (str.length < 8) throw new TypeError(str + ' too short');
  if (str.length > LIMIT) throw new TypeError('Exceeds length limit');
  var lowered = str.toLowerCase();
  var uppered = str.toUpperCase();
  if (str !== lowered && str !== uppered) throw new Error('Mixed-case string ' + str);
  str = lowered;
  var split = str.lastIndexOf('1');
  if (split === -1) throw new Error('No separator character for ' + str);
  if (split === 0) throw new Error('Missing prefix for ' + str);
  var prefix = str.slice(0, split);
  var wordChars = str.slice(split + 1);
  if (wordChars.length < 6) throw new Error('Data too short');
  var chk = prefixChk(prefix);
  var words = [];
  for (var i = 0; i < wordChars.length; ++i) {
    var c = wordChars.charAt(i);
    var v = ALPHABET_MAP[c];
    if (v === undefined) throw new Error('Unknown character ' + c);
    chk = polymodStep(chk) ^ v;
    if (i + 6 >= wordChars.length) continue;
    words.push(v);
  }
  if (chk !== 1) throw new Error('Invalid checksum for ' + str);
  return { prefix: prefix, words: words };
}
function convert(data, inBits, outBits, pad) {
  var value = 0;
  var bits = 0;
  var maxV = (1 << outBits) - 1;
  var result = [];
  for (var i = 0; i < data.length; ++i) {
    value = value << inBits | data[i];
    bits += inBits;
    while (bits >= outBits) {
      bits -= outBits;
      result.push(value >> bits & maxV);
    }
  }
  if (pad) {
    if (bits > 0) {
      result.push(value << outBits - bits & maxV);
    }
  } else {
    if (bits >= inBits) throw new Error('Excess padding');
    if (value << outBits - bits & maxV) throw new Error('Non-zero padding');
  }
  return result;
}
function toWords(bytes) {
  return convert(bytes, 8, 5, true);
}
function fromWords(words) {
  return convert(words, 5, 8, false);
}
var bech32 = {
  decode: decode$17,
  encode: encode$18,
  toWords: toWords,
  fromWords: fromWords
};

var Buffer$21 = safeBuffer.Buffer;
var baseX = function base(ALPHABET) {
  var ALPHABET_MAP = {};
  var BASE = ALPHABET.length;
  var LEADER = ALPHABET.charAt(0);
  for (var z = 0; z < ALPHABET.length; z++) {
    var x = ALPHABET.charAt(z);
    if (ALPHABET_MAP[x] !== undefined) throw new TypeError(x + ' is ambiguous');
    ALPHABET_MAP[x] = z;
  }
  function encode(source) {
    if (source.length === 0) return '';
    var digits = [0];
    for (var i = 0; i < source.length; ++i) {
      for (var j = 0, carry = source[i]; j < digits.length; ++j) {
        carry += digits[j] << 8;
        digits[j] = carry % BASE;
        carry = carry / BASE | 0;
      }
      while (carry > 0) {
        digits.push(carry % BASE);
        carry = carry / BASE | 0;
      }
    }
    var string = '';
    for (var k = 0; source[k] === 0 && k < source.length - 1; ++k) string += LEADER;
    for (var q = digits.length - 1; q >= 0; --q) string += ALPHABET[digits[q]];
    return string;
  }
  function decodeUnsafe(string) {
    if (typeof string !== 'string') throw new TypeError('Expected String');
    if (string.length === 0) return Buffer$21.allocUnsafe(0);
    var bytes = [0];
    for (var i = 0; i < string.length; i++) {
      var value = ALPHABET_MAP[string[i]];
      if (value === undefined) return;
      for (var j = 0, carry = value; j < bytes.length; ++j) {
        carry += bytes[j] * BASE;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }
    for (var k = 0; string[k] === LEADER && k < string.length - 1; ++k) {
      bytes.push(0);
    }
    return Buffer$21.from(bytes.reverse());
  }
  function decode(string) {
    var buffer = decodeUnsafe(string);
    if (buffer) return buffer;
    throw new Error('Non-base' + BASE + ' character');
  }
  return {
    encode: encode,
    decodeUnsafe: decodeUnsafe,
    decode: decode
  };
};

var ALPHABET$1 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
var bs58 = baseX(ALPHABET$1);

var Buffer$20 = safeBuffer.Buffer;
var base = function (checksumFn) {
  function encode(payload) {
    var checksum = checksumFn(payload);
    return bs58.encode(Buffer$20.concat([payload, checksum], payload.length + 4));
  }
  function decodeRaw(buffer) {
    var payload = buffer.slice(0, -4);
    var checksum = buffer.slice(-4);
    var newChecksum = checksumFn(payload);
    if (checksum[0] ^ newChecksum[0] | checksum[1] ^ newChecksum[1] | checksum[2] ^ newChecksum[2] | checksum[3] ^ newChecksum[3]) return;
    return payload;
  }
  function decodeUnsafe(string) {
    var buffer = bs58.decodeUnsafe(string);
    if (!buffer) return;
    return decodeRaw(buffer);
  }
  function decode(string) {
    var buffer = bs58.decode(string);
    var payload = decodeRaw(buffer, checksumFn);
    if (!payload) throw new Error('Invalid checksum');
    return payload;
  }
  return {
    encode: encode,
    decode: decode,
    decodeUnsafe: decodeUnsafe
  };
};

function sha256x2(buffer) {
  var tmp = browser('sha256').update(buffer).digest();
  return browser('sha256').update(tmp).digest();
}
var bs58check = base(sha256x2);

var networks$1 = {
  bitcoin: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
      public: 0x0488b21e,
      private: 0x0488ade4
    },
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80
  },
  testnet: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'tb',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  },
  litecoin: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    bip32: {
      public: 0x019da462,
      private: 0x019d9cfe
    },
    pubKeyHash: 0x30,
    scriptHash: 0x32,
    wif: 0xb0
  }
};

var Buffer$19 = safeBuffer.Buffer;
function fromBase58Check(address) {
  var payload = bs58check.decode(address);
  if (payload.length < 21) throw new TypeError(address + ' is too short');
  if (payload.length > 21) throw new TypeError(address + ' is too long');
  var version = payload.readUInt8(0);
  var hash = payload.slice(1);
  return { version: version, hash: hash };
}
function fromBech32(address) {
  var result = bech32.decode(address);
  var data = bech32.fromWords(result.words.slice(1));
  return {
    version: result.words[0],
    prefix: result.prefix,
    data: Buffer$19.from(data)
  };
}
function toBase58Check(hash, version) {
  typeforce_1(types_1.tuple(types_1.Hash160bit, types_1.UInt8), arguments);
  var payload = Buffer$19.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);
  return bs58check.encode(payload);
}
function toBech32(data, version, prefix) {
  var words = bech32.toWords(data);
  words.unshift(version);
  return bech32.encode(prefix, words);
}
function fromOutputScript(outputScript, network) {
  network = network || networks$1.bitcoin;
  if (templates.pubKeyHash.output.check(outputScript)) return toBase58Check(script.compile(outputScript).slice(3, 23), network.pubKeyHash);
  if (templates.scriptHash.output.check(outputScript)) return toBase58Check(script.compile(outputScript).slice(2, 22), network.scriptHash);
  if (templates.witnessPubKeyHash.output.check(outputScript)) return toBech32(script.compile(outputScript).slice(2, 22), 0, network.bech32);
  if (templates.witnessScriptHash.output.check(outputScript)) return toBech32(script.compile(outputScript).slice(2, 34), 0, network.bech32);
  throw new Error(script.toASM(outputScript) + ' has no matching Address');
}
function toOutputScript(address, network) {
  network = network || networks$1.bitcoin;
  var decode;
  try {
    decode = fromBase58Check(address);
  } catch (e) {}
  if (decode) {
    if (decode.version === network.pubKeyHash) return templates.pubKeyHash.output.encode(decode.hash);
    if (decode.version === network.scriptHash) return templates.scriptHash.output.encode(decode.hash);
  } else {
    try {
      decode = fromBech32(address);
    } catch (e) {}
    if (decode) {
      if (decode.prefix !== network.bech32) throw new Error(address + ' has an invalid prefix');
      if (decode.version === 0) {
        if (decode.data.length === 20) return templates.witnessPubKeyHash.output.encode(decode.data);
        if (decode.data.length === 32) return templates.witnessScriptHash.output.encode(decode.data);
      }
    }
  }
  throw new Error(address + ' has no matching Script');
}
var address = {
  fromBase58Check: fromBase58Check,
  fromBech32: fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toBech32: toBech32,
  toOutputScript: toOutputScript
};

var Buffer$24 = safeBuffer.Buffer;
var ZEROS$1 = Buffer$24.alloc(128);
var blocksize = 64;
function Hmac$1(alg, key) {
  cipherBase.call(this, 'digest');
  if (typeof key === 'string') {
    key = Buffer$24.from(key);
  }
  this._alg = alg;
  this._key = key;
  if (key.length > blocksize) {
    key = alg(key);
  } else if (key.length < blocksize) {
    key = Buffer$24.concat([key, ZEROS$1], blocksize);
  }
  var ipad = this._ipad = Buffer$24.allocUnsafe(blocksize);
  var opad = this._opad = Buffer$24.allocUnsafe(blocksize);
  for (var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36;
    opad[i] = key[i] ^ 0x5C;
  }
  this._hash = [ipad];
}
inherits_browser(Hmac$1, cipherBase);
Hmac$1.prototype._update = function (data) {
  this._hash.push(data);
};
Hmac$1.prototype._final = function () {
  var h = this._alg(Buffer$24.concat(this._hash));
  return this._alg(Buffer$24.concat([this._opad, h]));
};
var legacy = Hmac$1;

var Buffer$23 = safeBuffer.Buffer;
var ZEROS = Buffer$23.alloc(128);
function Hmac(alg, key) {
  cipherBase.call(this, 'digest');
  if (typeof key === 'string') {
    key = Buffer$23.from(key);
  }
  var blocksize = alg === 'sha512' || alg === 'sha384' ? 128 : 64;
  this._alg = alg;
  this._key = key;
  if (key.length > blocksize) {
    var hash = alg === 'rmd160' ? new ripemd160$1() : sha_js(alg);
    key = hash.update(key).digest();
  } else if (key.length < blocksize) {
    key = Buffer$23.concat([key, ZEROS], blocksize);
  }
  var ipad = this._ipad = Buffer$23.allocUnsafe(blocksize);
  var opad = this._opad = Buffer$23.allocUnsafe(blocksize);
  for (var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36;
    opad[i] = key[i] ^ 0x5C;
  }
  this._hash = alg === 'rmd160' ? new ripemd160$1() : sha_js(alg);
  this._hash.update(ipad);
}
inherits_browser(Hmac, cipherBase);
Hmac.prototype._update = function (data) {
  this._hash.update(data);
};
Hmac.prototype._final = function () {
  var h = this._hash.digest();
  var hash = this._alg === 'rmd160' ? new ripemd160$1() : sha_js(this._alg);
  return hash.update(this._opad).update(h).digest();
};
var browser$3 = function createHmac(alg, key) {
  alg = alg.toLowerCase();
  if (alg === 'rmd160' || alg === 'ripemd160') {
    return new Hmac('rmd160', key);
  }
  if (alg === 'md5') {
    return new legacy(md5$1, key);
  }
  return new Hmac(alg, key);
};

var name = "bigi";
var version$1 = "1.4.2";
var description = "Big integers.";
var keywords = ["cryptography", "math", "bitcoin", "arbitrary", "precision", "arithmetic", "big", "integer", "int", "number", "biginteger", "bigint", "bignumber", "decimal", "float"];
var devDependencies = { "coveralls": "^2.11.2", "istanbul": "^0.3.5", "jshint": "^2.5.1", "mocha": "^2.1.0", "mochify": "^2.1.0" };
var repository = { "url": "https://github.com/cryptocoinjs/bigi", "type": "git" };
var main = "./lib/index.js";
var scripts = { "browser-test": "./node_modules/.bin/mochify --wd -R spec", "test": "./node_modules/.bin/_mocha -- test/*.js", "jshint": "./node_modules/.bin/jshint --config jshint.json lib/*.js ; true", "unit": "./node_modules/.bin/mocha", "coverage": "./node_modules/.bin/istanbul cover ./node_modules/.bin/_mocha -- --reporter list test/*.js", "coveralls": "npm run-script coverage && node ./node_modules/.bin/coveralls < coverage/lcov.info" };
var dependencies = {};
var testling = { "files": "test/*.js", "harness": "mocha", "browsers": ["ie/9..latest", "firefox/latest", "chrome/latest", "safari/6.0..latest", "iphone/6.0..latest", "android-browser/4.2..latest"] };
var _package = {
	name: name,
	version: version$1,
	description: description,
	keywords: keywords,
	devDependencies: devDependencies,
	repository: repository,
	main: main,
	scripts: scripts,
	dependencies: dependencies,
	testling: testling
};

var _package$1 = Object.freeze({
	name: name,
	version: version$1,
	description: description,
	keywords: keywords,
	devDependencies: devDependencies,
	repository: repository,
	main: main,
	scripts: scripts,
	dependencies: dependencies,
	testling: testling,
	default: _package
});

var require$$0$9 = ( _package$1 && _package ) || _package$1;

function BigInteger(a, b, c) {
  if (!(this instanceof BigInteger)) return new BigInteger(a, b, c);
  if (a != null) {
    if ("number" == typeof a) this.fromNumber(a, b, c);else if (b == null && "string" != typeof a) this.fromString(a, 256);else this.fromString(a, b);
  }
}
var proto = BigInteger.prototype;
proto.__bigi = require$$0$9.version;
BigInteger.isBigInteger = function (obj, check_ver) {
  return obj && obj.__bigi && (!check_ver || obj.__bigi === proto.__bigi);
};
var dbits;
function am1(i, x, w, j, c, n) {
  while (--n >= 0) {
    var v = x * this[i++] + w[j] + c;
    c = Math.floor(v / 0x4000000);
    w[j++] = v & 0x3ffffff;
  }
  return c;
}
BigInteger.prototype.am = am1;
dbits = 26;
BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = (1 << dbits) - 1;
var DV = BigInteger.prototype.DV = 1 << dbits;
var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2, BI_FP);
BigInteger.prototype.F1 = BI_FP - dbits;
BigInteger.prototype.F2 = 2 * dbits - BI_FP;
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr;
var vv;
rr = "0".charCodeAt(0);
for (vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
function int2char(n) {
  return BI_RM.charAt(n);
}
function intAt(s, i) {
  var c = BI_RC[s.charCodeAt(i)];
  return c == null ? -1 : c;
}
function bnpCopyTo(r) {
  for (var i = this.t - 1; i >= 0; --i) r[i] = this[i];
  r.t = this.t;
  r.s = this.s;
}
function bnpFromInt(x) {
  this.t = 1;
  this.s = x < 0 ? -1 : 0;
  if (x > 0) this[0] = x;else if (x < -1) this[0] = x + DV;else this.t = 0;
}
function nbv(i) {
  var r = new BigInteger();
  r.fromInt(i);
  return r;
}
function bnpFromString(s, b) {
  var self = this;
  var k;
  if (b == 16) k = 4;else if (b == 8) k = 3;else if (b == 256) k = 8;
  else if (b == 2) k = 1;else if (b == 32) k = 5;else if (b == 4) k = 2;else {
      self.fromRadix(s, b);
      return;
    }
  self.t = 0;
  self.s = 0;
  var i = s.length,
      mi = false,
      sh = 0;
  while (--i >= 0) {
    var x = k == 8 ? s[i] & 0xff : intAt(s, i);
    if (x < 0) {
      if (s.charAt(i) == "-") mi = true;
      continue;
    }
    mi = false;
    if (sh == 0) self[self.t++] = x;else if (sh + k > self.DB) {
      self[self.t - 1] |= (x & (1 << self.DB - sh) - 1) << sh;
      self[self.t++] = x >> self.DB - sh;
    } else self[self.t - 1] |= x << sh;
    sh += k;
    if (sh >= self.DB) sh -= self.DB;
  }
  if (k == 8 && (s[0] & 0x80) != 0) {
    self.s = -1;
    if (sh > 0) self[self.t - 1] |= (1 << self.DB - sh) - 1 << sh;
  }
  self.clamp();
  if (mi) BigInteger.ZERO.subTo(self, self);
}
function bnpClamp() {
  var c = this.s & this.DM;
  while (this.t > 0 && this[this.t - 1] == c) --this.t;
}
function bnToString(b) {
  var self = this;
  if (self.s < 0) return "-" + self.negate().toString(b);
  var k;
  if (b == 16) k = 4;else if (b == 8) k = 3;else if (b == 2) k = 1;else if (b == 32) k = 5;else if (b == 4) k = 2;else return self.toRadix(b);
  var km = (1 << k) - 1,
      d,
      m = false,
      r = "",
      i = self.t;
  var p = self.DB - i * self.DB % k;
  if (i-- > 0) {
    if (p < self.DB && (d = self[i] >> p) > 0) {
      m = true;
      r = int2char(d);
    }
    while (i >= 0) {
      if (p < k) {
        d = (self[i] & (1 << p) - 1) << k - p;
        d |= self[--i] >> (p += self.DB - k);
      } else {
        d = self[i] >> (p -= k) & km;
        if (p <= 0) {
          p += self.DB;
          --i;
        }
      }
      if (d > 0) m = true;
      if (m) r += int2char(d);
    }
  }
  return m ? r : "0";
}
function bnNegate() {
  var r = new BigInteger();
  BigInteger.ZERO.subTo(this, r);
  return r;
}
function bnAbs() {
  return this.s < 0 ? this.negate() : this;
}
function bnCompareTo(a) {
  var r = this.s - a.s;
  if (r != 0) return r;
  var i = this.t;
  r = i - a.t;
  if (r != 0) return this.s < 0 ? -r : r;
  while (--i >= 0) if ((r = this[i] - a[i]) != 0) return r;
  return 0;
}
function nbits(x) {
  var r = 1,
      t;
  if ((t = x >>> 16) != 0) {
    x = t;
    r += 16;
  }
  if ((t = x >> 8) != 0) {
    x = t;
    r += 8;
  }
  if ((t = x >> 4) != 0) {
    x = t;
    r += 4;
  }
  if ((t = x >> 2) != 0) {
    x = t;
    r += 2;
  }
  if ((t = x >> 1) != 0) {
    x = t;
    r += 1;
  }
  return r;
}
function bnBitLength() {
  if (this.t <= 0) return 0;
  return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ this.s & this.DM);
}
function bnByteLength() {
  return this.bitLength() >> 3;
}
function bnpDLShiftTo(n, r) {
  var i;
  for (i = this.t - 1; i >= 0; --i) r[i + n] = this[i];
  for (i = n - 1; i >= 0; --i) r[i] = 0;
  r.t = this.t + n;
  r.s = this.s;
}
function bnpDRShiftTo(n, r) {
  for (var i = n; i < this.t; ++i) r[i - n] = this[i];
  r.t = Math.max(this.t - n, 0);
  r.s = this.s;
}
function bnpLShiftTo(n, r) {
  var self = this;
  var bs = n % self.DB;
  var cbs = self.DB - bs;
  var bm = (1 << cbs) - 1;
  var ds = Math.floor(n / self.DB),
      c = self.s << bs & self.DM,
      i;
  for (i = self.t - 1; i >= 0; --i) {
    r[i + ds + 1] = self[i] >> cbs | c;
    c = (self[i] & bm) << bs;
  }
  for (i = ds - 1; i >= 0; --i) r[i] = 0;
  r[ds] = c;
  r.t = self.t + ds + 1;
  r.s = self.s;
  r.clamp();
}
function bnpRShiftTo(n, r) {
  var self = this;
  r.s = self.s;
  var ds = Math.floor(n / self.DB);
  if (ds >= self.t) {
    r.t = 0;
    return;
  }
  var bs = n % self.DB;
  var cbs = self.DB - bs;
  var bm = (1 << bs) - 1;
  r[0] = self[ds] >> bs;
  for (var i = ds + 1; i < self.t; ++i) {
    r[i - ds - 1] |= (self[i] & bm) << cbs;
    r[i - ds] = self[i] >> bs;
  }
  if (bs > 0) r[self.t - ds - 1] |= (self.s & bm) << cbs;
  r.t = self.t - ds;
  r.clamp();
}
function bnpSubTo(a, r) {
  var self = this;
  var i = 0,
      c = 0,
      m = Math.min(a.t, self.t);
  while (i < m) {
    c += self[i] - a[i];
    r[i++] = c & self.DM;
    c >>= self.DB;
  }
  if (a.t < self.t) {
    c -= a.s;
    while (i < self.t) {
      c += self[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c += self.s;
  } else {
    c += self.s;
    while (i < a.t) {
      c -= a[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c -= a.s;
  }
  r.s = c < 0 ? -1 : 0;
  if (c < -1) r[i++] = self.DV + c;else if (c > 0) r[i++] = c;
  r.t = i;
  r.clamp();
}
function bnpMultiplyTo(a, r) {
  var x = this.abs(),
      y = a.abs();
  var i = x.t;
  r.t = i + y.t;
  while (--i >= 0) r[i] = 0;
  for (i = 0; i < y.t; ++i) r[i + x.t] = x.am(0, y[i], r, i, 0, x.t);
  r.s = 0;
  r.clamp();
  if (this.s != a.s) BigInteger.ZERO.subTo(r, r);
}
function bnpSquareTo(r) {
  var x = this.abs();
  var i = r.t = 2 * x.t;
  while (--i >= 0) r[i] = 0;
  for (i = 0; i < x.t - 1; ++i) {
    var c = x.am(i, x[i], r, 2 * i, 0, 1);
    if ((r[i + x.t] += x.am(i + 1, 2 * x[i], r, 2 * i + 1, c, x.t - i - 1)) >= x.DV) {
      r[i + x.t] -= x.DV;
      r[i + x.t + 1] = 1;
    }
  }
  if (r.t > 0) r[r.t - 1] += x.am(i, x[i], r, 2 * i, 0, 1);
  r.s = 0;
  r.clamp();
}
function bnpDivRemTo(m, q, r) {
  var self = this;
  var pm = m.abs();
  if (pm.t <= 0) return;
  var pt = self.abs();
  if (pt.t < pm.t) {
    if (q != null) q.fromInt(0);
    if (r != null) self.copyTo(r);
    return;
  }
  if (r == null) r = new BigInteger();
  var y = new BigInteger(),
      ts = self.s,
      ms = m.s;
  var nsh = self.DB - nbits(pm[pm.t - 1]);
  if (nsh > 0) {
    pm.lShiftTo(nsh, y);
    pt.lShiftTo(nsh, r);
  } else {
    pm.copyTo(y);
    pt.copyTo(r);
  }
  var ys = y.t;
  var y0 = y[ys - 1];
  if (y0 == 0) return;
  var yt = y0 * (1 << self.F1) + (ys > 1 ? y[ys - 2] >> self.F2 : 0);
  var d1 = self.FV / yt,
      d2 = (1 << self.F1) / yt,
      e = 1 << self.F2;
  var i = r.t,
      j = i - ys,
      t = q == null ? new BigInteger() : q;
  y.dlShiftTo(j, t);
  if (r.compareTo(t) >= 0) {
    r[r.t++] = 1;
    r.subTo(t, r);
  }
  BigInteger.ONE.dlShiftTo(ys, t);
  t.subTo(y, y);
  while (y.t < ys) y[y.t++] = 0;
  while (--j >= 0) {
    var qd = r[--i] == y0 ? self.DM : Math.floor(r[i] * d1 + (r[i - 1] + e) * d2);
    if ((r[i] += y.am(0, qd, r, j, 0, ys)) < qd) {
      y.dlShiftTo(j, t);
      r.subTo(t, r);
      while (r[i] < --qd) r.subTo(t, r);
    }
  }
  if (q != null) {
    r.drShiftTo(ys, q);
    if (ts != ms) BigInteger.ZERO.subTo(q, q);
  }
  r.t = ys;
  r.clamp();
  if (nsh > 0) r.rShiftTo(nsh, r);
  if (ts < 0) BigInteger.ZERO.subTo(r, r);
}
function bnMod(a) {
  var r = new BigInteger();
  this.abs().divRemTo(a, null, r);
  if (this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r, r);
  return r;
}
function Classic(m) {
  this.m = m;
}
function cConvert(x) {
  if (x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);else return x;
}
function cRevert(x) {
  return x;
}
function cReduce(x) {
  x.divRemTo(this.m, null, x);
}
function cMulTo(x, y, r) {
  x.multiplyTo(y, r);
  this.reduce(r);
}
function cSqrTo(x, r) {
  x.squareTo(r);
  this.reduce(r);
}
Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;
function bnpInvDigit() {
  if (this.t < 1) return 0;
  var x = this[0];
  if ((x & 1) == 0) return 0;
  var y = x & 3;
  y = y * (2 - (x & 0xf) * y) & 0xf;
  y = y * (2 - (x & 0xff) * y) & 0xff;
  y = y * (2 - ((x & 0xffff) * y & 0xffff)) & 0xffff;
  y = y * (2 - x * y % this.DV) % this.DV;
  return y > 0 ? this.DV - y : -y;
}
function Montgomery(m) {
  this.m = m;
  this.mp = m.invDigit();
  this.mpl = this.mp & 0x7fff;
  this.mph = this.mp >> 15;
  this.um = (1 << m.DB - 15) - 1;
  this.mt2 = 2 * m.t;
}
function montConvert(x) {
  var r = new BigInteger();
  x.abs().dlShiftTo(this.m.t, r);
  r.divRemTo(this.m, null, r);
  if (x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r, r);
  return r;
}
function montRevert(x) {
  var r = new BigInteger();
  x.copyTo(r);
  this.reduce(r);
  return r;
}
function montReduce(x) {
  while (x.t <= this.mt2)
  x[x.t++] = 0;
  for (var i = 0; i < this.m.t; ++i) {
    var j = x[i] & 0x7fff;
    var u0 = j * this.mpl + ((j * this.mph + (x[i] >> 15) * this.mpl & this.um) << 15) & x.DM;
    j = i + this.m.t;
    x[j] += this.m.am(0, u0, x, i, 0, this.m.t);
    while (x[j] >= x.DV) {
      x[j] -= x.DV;
      x[++j]++;
    }
  }
  x.clamp();
  x.drShiftTo(this.m.t, x);
  if (x.compareTo(this.m) >= 0) x.subTo(this.m, x);
}
function montSqrTo(x, r) {
  x.squareTo(r);
  this.reduce(r);
}
function montMulTo(x, y, r) {
  x.multiplyTo(y, r);
  this.reduce(r);
}
Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;
function bnpIsEven() {
  return (this.t > 0 ? this[0] & 1 : this.s) == 0;
}
function bnpExp(e, z) {
  if (e > 0xffffffff || e < 1) return BigInteger.ONE;
  var r = new BigInteger(),
      r2 = new BigInteger(),
      g = z.convert(this),
      i = nbits(e) - 1;
  g.copyTo(r);
  while (--i >= 0) {
    z.sqrTo(r, r2);
    if ((e & 1 << i) > 0) z.mulTo(r2, g, r);else {
      var t = r;
      r = r2;
      r2 = t;
    }
  }
  return z.revert(r);
}
function bnModPowInt(e, m) {
  var z;
  if (e < 256 || m.isEven()) z = new Classic(m);else z = new Montgomery(m);
  return this.exp(e, z);
}
proto.copyTo = bnpCopyTo;
proto.fromInt = bnpFromInt;
proto.fromString = bnpFromString;
proto.clamp = bnpClamp;
proto.dlShiftTo = bnpDLShiftTo;
proto.drShiftTo = bnpDRShiftTo;
proto.lShiftTo = bnpLShiftTo;
proto.rShiftTo = bnpRShiftTo;
proto.subTo = bnpSubTo;
proto.multiplyTo = bnpMultiplyTo;
proto.squareTo = bnpSquareTo;
proto.divRemTo = bnpDivRemTo;
proto.invDigit = bnpInvDigit;
proto.isEven = bnpIsEven;
proto.exp = bnpExp;
proto.toString = bnToString;
proto.negate = bnNegate;
proto.abs = bnAbs;
proto.compareTo = bnCompareTo;
proto.bitLength = bnBitLength;
proto.byteLength = bnByteLength;
proto.mod = bnMod;
proto.modPowInt = bnModPowInt;
function bnClone() {
  var r = new BigInteger();
  this.copyTo(r);
  return r;
}
function bnIntValue() {
  if (this.s < 0) {
    if (this.t == 1) return this[0] - this.DV;else if (this.t == 0) return -1;
  } else if (this.t == 1) return this[0];else if (this.t == 0) return 0;
  return (this[1] & (1 << 32 - this.DB) - 1) << this.DB | this[0];
}
function bnByteValue() {
  return this.t == 0 ? this.s : this[0] << 24 >> 24;
}
function bnShortValue() {
  return this.t == 0 ? this.s : this[0] << 16 >> 16;
}
function bnpChunkSize(r) {
  return Math.floor(Math.LN2 * this.DB / Math.log(r));
}
function bnSigNum() {
  if (this.s < 0) return -1;else if (this.t <= 0 || this.t == 1 && this[0] <= 0) return 0;else return 1;
}
function bnpToRadix(b) {
  if (b == null) b = 10;
  if (this.signum() == 0 || b < 2 || b > 36) return "0";
  var cs = this.chunkSize(b);
  var a = Math.pow(b, cs);
  var d = nbv(a),
      y = new BigInteger(),
      z = new BigInteger(),
      r = "";
  this.divRemTo(d, y, z);
  while (y.signum() > 0) {
    r = (a + z.intValue()).toString(b).substr(1) + r;
    y.divRemTo(d, y, z);
  }
  return z.intValue().toString(b) + r;
}
function bnpFromRadix(s, b) {
  var self = this;
  self.fromInt(0);
  if (b == null) b = 10;
  var cs = self.chunkSize(b);
  var d = Math.pow(b, cs),
      mi = false,
      j = 0,
      w = 0;
  for (var i = 0; i < s.length; ++i) {
    var x = intAt(s, i);
    if (x < 0) {
      if (s.charAt(i) == "-" && self.signum() == 0) mi = true;
      continue;
    }
    w = b * w + x;
    if (++j >= cs) {
      self.dMultiply(d);
      self.dAddOffset(w, 0);
      j = 0;
      w = 0;
    }
  }
  if (j > 0) {
    self.dMultiply(Math.pow(b, j));
    self.dAddOffset(w, 0);
  }
  if (mi) BigInteger.ZERO.subTo(self, self);
}
function bnpFromNumber(a, b, c) {
  var self = this;
  if ("number" == typeof b) {
    if (a < 2) self.fromInt(1);else {
      self.fromNumber(a, c);
      if (!self.testBit(a - 1))
        self.bitwiseTo(BigInteger.ONE.shiftLeft(a - 1), op_or, self);
      if (self.isEven()) self.dAddOffset(1, 0);
      while (!self.isProbablePrime(b)) {
        self.dAddOffset(2, 0);
        if (self.bitLength() > a) self.subTo(BigInteger.ONE.shiftLeft(a - 1), self);
      }
    }
  } else {
    var x = new Array(),
        t = a & 7;
    x.length = (a >> 3) + 1;
    b.nextBytes(x);
    if (t > 0) x[0] &= (1 << t) - 1;else x[0] = 0;
    self.fromString(x, 256);
  }
}
function bnToByteArray() {
  var self = this;
  var i = self.t,
      r = new Array();
  r[0] = self.s;
  var p = self.DB - i * self.DB % 8,
      d,
      k = 0;
  if (i-- > 0) {
    if (p < self.DB && (d = self[i] >> p) != (self.s & self.DM) >> p) r[k++] = d | self.s << self.DB - p;
    while (i >= 0) {
      if (p < 8) {
        d = (self[i] & (1 << p) - 1) << 8 - p;
        d |= self[--i] >> (p += self.DB - 8);
      } else {
        d = self[i] >> (p -= 8) & 0xff;
        if (p <= 0) {
          p += self.DB;
          --i;
        }
      }
      if ((d & 0x80) != 0) d |= -256;
      if (k === 0 && (self.s & 0x80) != (d & 0x80)) ++k;
      if (k > 0 || d != self.s) r[k++] = d;
    }
  }
  return r;
}
function bnEquals(a) {
  return this.compareTo(a) == 0;
}
function bnMin(a) {
  return this.compareTo(a) < 0 ? this : a;
}
function bnMax(a) {
  return this.compareTo(a) > 0 ? this : a;
}
function bnpBitwiseTo(a, op, r) {
  var self = this;
  var i,
      f,
      m = Math.min(a.t, self.t);
  for (i = 0; i < m; ++i) r[i] = op(self[i], a[i]);
  if (a.t < self.t) {
    f = a.s & self.DM;
    for (i = m; i < self.t; ++i) r[i] = op(self[i], f);
    r.t = self.t;
  } else {
    f = self.s & self.DM;
    for (i = m; i < a.t; ++i) r[i] = op(f, a[i]);
    r.t = a.t;
  }
  r.s = op(self.s, a.s);
  r.clamp();
}
function op_and(x, y) {
  return x & y;
}
function bnAnd(a) {
  var r = new BigInteger();
  this.bitwiseTo(a, op_and, r);
  return r;
}
function op_or(x, y) {
  return x | y;
}
function bnOr(a) {
  var r = new BigInteger();
  this.bitwiseTo(a, op_or, r);
  return r;
}
function op_xor(x, y) {
  return x ^ y;
}
function bnXor(a) {
  var r = new BigInteger();
  this.bitwiseTo(a, op_xor, r);
  return r;
}
function op_andnot(x, y) {
  return x & ~y;
}
function bnAndNot(a) {
  var r = new BigInteger();
  this.bitwiseTo(a, op_andnot, r);
  return r;
}
function bnNot() {
  var r = new BigInteger();
  for (var i = 0; i < this.t; ++i) r[i] = this.DM & ~this[i];
  r.t = this.t;
  r.s = ~this.s;
  return r;
}
function bnShiftLeft(n) {
  var r = new BigInteger();
  if (n < 0) this.rShiftTo(-n, r);else this.lShiftTo(n, r);
  return r;
}
function bnShiftRight(n) {
  var r = new BigInteger();
  if (n < 0) this.lShiftTo(-n, r);else this.rShiftTo(n, r);
  return r;
}
function lbit(x) {
  if (x == 0) return -1;
  var r = 0;
  if ((x & 0xffff) == 0) {
    x >>= 16;
    r += 16;
  }
  if ((x & 0xff) == 0) {
    x >>= 8;
    r += 8;
  }
  if ((x & 0xf) == 0) {
    x >>= 4;
    r += 4;
  }
  if ((x & 3) == 0) {
    x >>= 2;
    r += 2;
  }
  if ((x & 1) == 0) ++r;
  return r;
}
function bnGetLowestSetBit() {
  for (var i = 0; i < this.t; ++i) if (this[i] != 0) return i * this.DB + lbit(this[i]);
  if (this.s < 0) return this.t * this.DB;
  return -1;
}
function cbit(x) {
  var r = 0;
  while (x != 0) {
    x &= x - 1;
    ++r;
  }
  return r;
}
function bnBitCount() {
  var r = 0,
      x = this.s & this.DM;
  for (var i = 0; i < this.t; ++i) r += cbit(this[i] ^ x);
  return r;
}
function bnTestBit(n) {
  var j = Math.floor(n / this.DB);
  if (j >= this.t) return this.s != 0;
  return (this[j] & 1 << n % this.DB) != 0;
}
function bnpChangeBit(n, op) {
  var r = BigInteger.ONE.shiftLeft(n);
  this.bitwiseTo(r, op, r);
  return r;
}
function bnSetBit(n) {
  return this.changeBit(n, op_or);
}
function bnClearBit(n) {
  return this.changeBit(n, op_andnot);
}
function bnFlipBit(n) {
  return this.changeBit(n, op_xor);
}
function bnpAddTo(a, r) {
  var self = this;
  var i = 0,
      c = 0,
      m = Math.min(a.t, self.t);
  while (i < m) {
    c += self[i] + a[i];
    r[i++] = c & self.DM;
    c >>= self.DB;
  }
  if (a.t < self.t) {
    c += a.s;
    while (i < self.t) {
      c += self[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c += self.s;
  } else {
    c += self.s;
    while (i < a.t) {
      c += a[i];
      r[i++] = c & self.DM;
      c >>= self.DB;
    }
    c += a.s;
  }
  r.s = c < 0 ? -1 : 0;
  if (c > 0) r[i++] = c;else if (c < -1) r[i++] = self.DV + c;
  r.t = i;
  r.clamp();
}
function bnAdd(a) {
  var r = new BigInteger();
  this.addTo(a, r);
  return r;
}
function bnSubtract(a) {
  var r = new BigInteger();
  this.subTo(a, r);
  return r;
}
function bnMultiply(a) {
  var r = new BigInteger();
  this.multiplyTo(a, r);
  return r;
}
function bnSquare() {
  var r = new BigInteger();
  this.squareTo(r);
  return r;
}
function bnDivide(a) {
  var r = new BigInteger();
  this.divRemTo(a, r, null);
  return r;
}
function bnRemainder(a) {
  var r = new BigInteger();
  this.divRemTo(a, null, r);
  return r;
}
function bnDivideAndRemainder(a) {
  var q = new BigInteger(),
      r = new BigInteger();
  this.divRemTo(a, q, r);
  return new Array(q, r);
}
function bnpDMultiply(n) {
  this[this.t] = this.am(0, n - 1, this, 0, 0, this.t);
  ++this.t;
  this.clamp();
}
function bnpDAddOffset(n, w) {
  if (n == 0) return;
  while (this.t <= w) this[this.t++] = 0;
  this[w] += n;
  while (this[w] >= this.DV) {
    this[w] -= this.DV;
    if (++w >= this.t) this[this.t++] = 0;
    ++this[w];
  }
}
function NullExp() {}
function nNop(x) {
  return x;
}
function nMulTo(x, y, r) {
  x.multiplyTo(y, r);
}
function nSqrTo(x, r) {
  x.squareTo(r);
}
NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;
function bnPow(e) {
  return this.exp(e, new NullExp());
}
function bnpMultiplyLowerTo(a, n, r) {
  var i = Math.min(this.t + a.t, n);
  r.s = 0;
  r.t = i;
  while (i > 0) r[--i] = 0;
  var j;
  for (j = r.t - this.t; i < j; ++i) r[i + this.t] = this.am(0, a[i], r, i, 0, this.t);
  for (j = Math.min(a.t, n); i < j; ++i) this.am(0, a[i], r, i, 0, n - i);
  r.clamp();
}
function bnpMultiplyUpperTo(a, n, r) {
  --n;
  var i = r.t = this.t + a.t - n;
  r.s = 0;
  while (--i >= 0) r[i] = 0;
  for (i = Math.max(n - this.t, 0); i < a.t; ++i) r[this.t + i - n] = this.am(n - i, a[i], r, 0, 0, this.t + i - n);
  r.clamp();
  r.drShiftTo(1, r);
}
function Barrett(m) {
  this.r2 = new BigInteger();
  this.q3 = new BigInteger();
  BigInteger.ONE.dlShiftTo(2 * m.t, this.r2);
  this.mu = this.r2.divide(m);
  this.m = m;
}
function barrettConvert(x) {
  if (x.s < 0 || x.t > 2 * this.m.t) return x.mod(this.m);else if (x.compareTo(this.m) < 0) return x;else {
    var r = new BigInteger();
    x.copyTo(r);
    this.reduce(r);
    return r;
  }
}
function barrettRevert(x) {
  return x;
}
function barrettReduce(x) {
  var self = this;
  x.drShiftTo(self.m.t - 1, self.r2);
  if (x.t > self.m.t + 1) {
    x.t = self.m.t + 1;
    x.clamp();
  }
  self.mu.multiplyUpperTo(self.r2, self.m.t + 1, self.q3);
  self.m.multiplyLowerTo(self.q3, self.m.t + 1, self.r2);
  while (x.compareTo(self.r2) < 0) x.dAddOffset(1, self.m.t + 1);
  x.subTo(self.r2, x);
  while (x.compareTo(self.m) >= 0) x.subTo(self.m, x);
}
function barrettSqrTo(x, r) {
  x.squareTo(r);
  this.reduce(r);
}
function barrettMulTo(x, y, r) {
  x.multiplyTo(y, r);
  this.reduce(r);
}
Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;
function bnModPow(e, m) {
  var i = e.bitLength(),
      k,
      r = nbv(1),
      z;
  if (i <= 0) return r;else if (i < 18) k = 1;else if (i < 48) k = 3;else if (i < 144) k = 4;else if (i < 768) k = 5;else k = 6;
  if (i < 8) z = new Classic(m);else if (m.isEven()) z = new Barrett(m);else z = new Montgomery(m);
  var g = new Array(),
      n = 3,
      k1 = k - 1,
      km = (1 << k) - 1;
  g[1] = z.convert(this);
  if (k > 1) {
    var g2 = new BigInteger();
    z.sqrTo(g[1], g2);
    while (n <= km) {
      g[n] = new BigInteger();
      z.mulTo(g2, g[n - 2], g[n]);
      n += 2;
    }
  }
  var j = e.t - 1,
      w,
      is1 = true,
      r2 = new BigInteger(),
      t;
  i = nbits(e[j]) - 1;
  while (j >= 0) {
    if (i >= k1) w = e[j] >> i - k1 & km;else {
      w = (e[j] & (1 << i + 1) - 1) << k1 - i;
      if (j > 0) w |= e[j - 1] >> this.DB + i - k1;
    }
    n = k;
    while ((w & 1) == 0) {
      w >>= 1;
      --n;
    }
    if ((i -= n) < 0) {
      i += this.DB;
      --j;
    }
    if (is1) {
      g[w].copyTo(r);
      is1 = false;
    } else {
      while (n > 1) {
        z.sqrTo(r, r2);
        z.sqrTo(r2, r);
        n -= 2;
      }
      if (n > 0) z.sqrTo(r, r2);else {
        t = r;
        r = r2;
        r2 = t;
      }
      z.mulTo(r2, g[w], r);
    }
    while (j >= 0 && (e[j] & 1 << i) == 0) {
      z.sqrTo(r, r2);
      t = r;
      r = r2;
      r2 = t;
      if (--i < 0) {
        i = this.DB - 1;
        --j;
      }
    }
  }
  return z.revert(r);
}
function bnGCD(a) {
  var x = this.s < 0 ? this.negate() : this.clone();
  var y = a.s < 0 ? a.negate() : a.clone();
  if (x.compareTo(y) < 0) {
    var t = x;
    x = y;
    y = t;
  }
  var i = x.getLowestSetBit(),
      g = y.getLowestSetBit();
  if (g < 0) return x;
  if (i < g) g = i;
  if (g > 0) {
    x.rShiftTo(g, x);
    y.rShiftTo(g, y);
  }
  while (x.signum() > 0) {
    if ((i = x.getLowestSetBit()) > 0) x.rShiftTo(i, x);
    if ((i = y.getLowestSetBit()) > 0) y.rShiftTo(i, y);
    if (x.compareTo(y) >= 0) {
      x.subTo(y, x);
      x.rShiftTo(1, x);
    } else {
      y.subTo(x, y);
      y.rShiftTo(1, y);
    }
  }
  if (g > 0) y.lShiftTo(g, y);
  return y;
}
function bnpModInt(n) {
  if (n <= 0) return 0;
  var d = this.DV % n,
      r = this.s < 0 ? n - 1 : 0;
  if (this.t > 0) if (d == 0) r = this[0] % n;else for (var i = this.t - 1; i >= 0; --i) r = (d * r + this[i]) % n;
  return r;
}
function bnModInverse(m) {
  var ac = m.isEven();
  if (this.signum() === 0) throw new Error('division by zero');
  if (this.isEven() && ac || m.signum() == 0) return BigInteger.ZERO;
  var u = m.clone(),
      v = this.clone();
  var a = nbv(1),
      b = nbv(0),
      c = nbv(0),
      d = nbv(1);
  while (u.signum() != 0) {
    while (u.isEven()) {
      u.rShiftTo(1, u);
      if (ac) {
        if (!a.isEven() || !b.isEven()) {
          a.addTo(this, a);
          b.subTo(m, b);
        }
        a.rShiftTo(1, a);
      } else if (!b.isEven()) b.subTo(m, b);
      b.rShiftTo(1, b);
    }
    while (v.isEven()) {
      v.rShiftTo(1, v);
      if (ac) {
        if (!c.isEven() || !d.isEven()) {
          c.addTo(this, c);
          d.subTo(m, d);
        }
        c.rShiftTo(1, c);
      } else if (!d.isEven()) d.subTo(m, d);
      d.rShiftTo(1, d);
    }
    if (u.compareTo(v) >= 0) {
      u.subTo(v, u);
      if (ac) a.subTo(c, a);
      b.subTo(d, b);
    } else {
      v.subTo(u, v);
      if (ac) c.subTo(a, c);
      d.subTo(b, d);
    }
  }
  if (v.compareTo(BigInteger.ONE) != 0) return BigInteger.ZERO;
  while (d.compareTo(m) >= 0) d.subTo(m, d);
  while (d.signum() < 0) d.addTo(m, d);
  return d;
}
var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];
function bnIsProbablePrime(t) {
  var i,
      x = this.abs();
  if (x.t == 1 && x[0] <= lowprimes[lowprimes.length - 1]) {
    for (i = 0; i < lowprimes.length; ++i) if (x[0] == lowprimes[i]) return true;
    return false;
  }
  if (x.isEven()) return false;
  i = 1;
  while (i < lowprimes.length) {
    var m = lowprimes[i],
        j = i + 1;
    while (j < lowprimes.length && m < lplim) m *= lowprimes[j++];
    m = x.modInt(m);
    while (i < j) if (m % lowprimes[i++] == 0) return false;
  }
  return x.millerRabin(t);
}
function bnpMillerRabin(t) {
  var n1 = this.subtract(BigInteger.ONE);
  var k = n1.getLowestSetBit();
  if (k <= 0) return false;
  var r = n1.shiftRight(k);
  t = t + 1 >> 1;
  if (t > lowprimes.length) t = lowprimes.length;
  var a = new BigInteger(null);
  var j,
      bases = [];
  for (var i = 0; i < t; ++i) {
    for (;;) {
      j = lowprimes[Math.floor(Math.random() * lowprimes.length)];
      if (bases.indexOf(j) == -1) break;
    }
    bases.push(j);
    a.fromInt(j);
    var y = a.modPow(r, this);
    if (y.compareTo(BigInteger.ONE) != 0 && y.compareTo(n1) != 0) {
      var j = 1;
      while (j++ < k && y.compareTo(n1) != 0) {
        y = y.modPowInt(2, this);
        if (y.compareTo(BigInteger.ONE) == 0) return false;
      }
      if (y.compareTo(n1) != 0) return false;
    }
  }
  return true;
}
proto.chunkSize = bnpChunkSize;
proto.toRadix = bnpToRadix;
proto.fromRadix = bnpFromRadix;
proto.fromNumber = bnpFromNumber;
proto.bitwiseTo = bnpBitwiseTo;
proto.changeBit = bnpChangeBit;
proto.addTo = bnpAddTo;
proto.dMultiply = bnpDMultiply;
proto.dAddOffset = bnpDAddOffset;
proto.multiplyLowerTo = bnpMultiplyLowerTo;
proto.multiplyUpperTo = bnpMultiplyUpperTo;
proto.modInt = bnpModInt;
proto.millerRabin = bnpMillerRabin;
proto.clone = bnClone;
proto.intValue = bnIntValue;
proto.byteValue = bnByteValue;
proto.shortValue = bnShortValue;
proto.signum = bnSigNum;
proto.toByteArray = bnToByteArray;
proto.equals = bnEquals;
proto.min = bnMin;
proto.max = bnMax;
proto.and = bnAnd;
proto.or = bnOr;
proto.xor = bnXor;
proto.andNot = bnAndNot;
proto.not = bnNot;
proto.shiftLeft = bnShiftLeft;
proto.shiftRight = bnShiftRight;
proto.getLowestSetBit = bnGetLowestSetBit;
proto.bitCount = bnBitCount;
proto.testBit = bnTestBit;
proto.setBit = bnSetBit;
proto.clearBit = bnClearBit;
proto.flipBit = bnFlipBit;
proto.add = bnAdd;
proto.subtract = bnSubtract;
proto.multiply = bnMultiply;
proto.divide = bnDivide;
proto.remainder = bnRemainder;
proto.divideAndRemainder = bnDivideAndRemainder;
proto.modPow = bnModPow;
proto.modInverse = bnModInverse;
proto.pow = bnPow;
proto.gcd = bnGCD;
proto.isProbablePrime = bnIsProbablePrime;
proto.square = bnSquare;
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);
BigInteger.valueOf = nbv;
var bigi$1 = BigInteger;

function compare(a, b) {
  if (a === b) {
    return 0;
  }
  var x = a.length;
  var y = b.length;
  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }
  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
var hasOwn = Object.prototype.hasOwnProperty;
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};
var pSlice = Array.prototype.slice;
var _functionsHaveNames;
function functionsHaveNames() {
  if (typeof _functionsHaveNames !== 'undefined') {
    return _functionsHaveNames;
  }
  return _functionsHaveNames = function () {
    return function foo() {}.name === 'foo';
  }();
}
function pToString(obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
function assert(value, message) {
  if (!value) fail(value, true, message, '==', ok);
}
var regex = /\s*function\s+([^\(\s]*)\s*/;
function getName(func) {
  if (!isFunction(func)) {
    return;
  }
  if (functionsHaveNames()) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = AssertionError;
function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    var err = new Error();
    if (err.stack) {
      var out = err.stack;
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }
      this.stack = out;
    }
  }
}
inherits$1(AssertionError, Error);
function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect$1(something) {
  if (functionsHaveNames() || !isFunction(something)) {
    return inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' + name + ']';
}
function getMessage(self) {
  return truncate(inspect$1(self.actual), 128) + ' ' + self.operator + ' ' + truncate(inspect$1(self.expected), 128);
}
function fail(actual, expected, message, operator, stackStartFunction) {
  throw new AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}
assert.fail = fail;
function ok(value, message) {
  if (!value) fail(value, true, message, '==', ok);
}
assert.ok = ok;
assert.equal = equal;
function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', equal);
}
assert.notEqual = notEqual;
function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', notEqual);
  }
}
assert.deepEqual = deepEqual;
function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', deepEqual);
  }
}
assert.deepStrictEqual = deepStrictEqual;
function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', deepStrictEqual);
  }
}
function _deepEqual(actual, expected, strict, memos) {
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;
  } else if (isDate(actual) && isDate(expected)) {
    return actual.getTime() === expected.getTime();
  } else if (isRegExp(actual) && isRegExp(expected)) {
    return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase;
  } else if ((actual === null || typeof actual !== 'object') && (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;
  } else if (isView(actual) && isView(expected) && pToString(actual) === pToString(expected) && !(actual instanceof Float32Array || actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer), new Uint8Array(expected.buffer)) === 0;
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || { actual: [], expected: [] };
    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }
    memos.actual.push(actual);
    memos.expected.push(expected);
    return objEquiv(actual, expected, strict, memos);
  }
}
function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}
function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (isPrimitive(a) || isPrimitive(b)) return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if (aIsArgs && !bIsArgs || !aIsArgs && bIsArgs) return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  if (ka.length !== kb.length) return false;
  ka.sort();
  kb.sort();
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i]) return false;
  }
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects)) return false;
  }
  return true;
}
assert.notDeepEqual = notDeepEqual;
function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', notDeepEqual);
  }
}
assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}
assert.strictEqual = strictEqual;
function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', strictEqual);
  }
}
assert.notStrictEqual = notStrictEqual;
function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', notStrictEqual);
  }
}
function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }
  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }
  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
  }
  if (Error.isPrototypeOf(expected)) {
    return false;
  }
  return expected.call({}, actual) === true;
}
function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}
function _throws(shouldThrow, block, expected, message) {
  var actual;
  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }
  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }
  actual = _tryBlock(block);
  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') + (message ? ' ' + message : '.');
  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }
  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;
  if (isUnwantedException && userProvidedMessage && expectedException(actual, expected) || isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }
  if (shouldThrow && actual && expected && !expectedException(actual, expected) || !shouldThrow && actual) {
    throw actual;
  }
}
assert.throws = throws;
function throws(block,             error,             message) {
  _throws(true, block, error, message);
}
assert.doesNotThrow = doesNotThrow;
function doesNotThrow(block,             error,             message) {
  _throws(false, block, error, message);
}
assert.ifError = ifError;
function ifError(err) {
  if (err) throw err;
}

var assert$2 = Object.freeze({
	default: assert,
	AssertionError: AssertionError,
	fail: fail,
	ok: ok,
	assert: ok,
	equal: equal,
	notEqual: notEqual,
	deepEqual: deepEqual,
	deepStrictEqual: deepStrictEqual,
	notDeepEqual: notDeepEqual,
	notDeepStrictEqual: notDeepStrictEqual,
	strictEqual: strictEqual,
	notStrictEqual: notStrictEqual,
	throws: throws,
	doesNotThrow: doesNotThrow,
	ifError: ifError
});

var assert$3 = ( assert$2 && assert ) || assert$2;

bigi$1.fromByteArrayUnsigned = function (byteArray) {
  if (byteArray[0] & 0x80) {
    return new bigi$1([0].concat(byteArray));
  }
  return new bigi$1(byteArray);
};
bigi$1.prototype.toByteArrayUnsigned = function () {
  var byteArray = this.toByteArray();
  return byteArray[0] === 0 ? byteArray.slice(1) : byteArray;
};
bigi$1.fromDERInteger = function (byteArray) {
  return new bigi$1(byteArray);
};
bigi$1.prototype.toDERInteger = bigi$1.prototype.toByteArray;
bigi$1.fromBuffer = function (buffer) {
  if (buffer[0] & 0x80) {
    var byteArray = Array.prototype.slice.call(buffer);
    return new bigi$1([0].concat(byteArray));
  }
  return new bigi$1(buffer);
};
bigi$1.fromHex = function (hex) {
  if (hex === '') return bigi$1.ZERO;
  assert$3.equal(hex, hex.match(/^[A-Fa-f0-9]+/), 'Invalid hex string');
  assert$3.equal(hex.length % 2, 0, 'Incomplete hex');
  return new bigi$1(hex, 16);
};
bigi$1.prototype.toBuffer = function (size) {
  var byteArray = this.toByteArrayUnsigned();
  var zeros = [];
  var padding = size - byteArray.length;
  while (zeros.length < padding) zeros.push(0);
  return new Buffer(zeros.concat(byteArray));
};
bigi$1.prototype.toHex = function (size) {
  return this.toBuffer(size).toString('hex');
};

var lib = bigi$1;

function ECSignature$1(r, s) {
  typeforce_1(types_1.tuple(types_1.BigInt, types_1.BigInt), arguments);
  this.r = r;
  this.s = s;
}
ECSignature$1.parseCompact = function (buffer) {
  typeforce_1(types_1.BufferN(65), buffer);
  var flagByte = buffer.readUInt8(0) - 27;
  if (flagByte !== (flagByte & 7)) throw new Error('Invalid signature parameter');
  var compressed = !!(flagByte & 4);
  var recoveryParam = flagByte & 3;
  var signature = ECSignature$1.fromRSBuffer(buffer.slice(1));
  return {
    compressed: compressed,
    i: recoveryParam,
    signature: signature
  };
};
ECSignature$1.fromRSBuffer = function (buffer) {
  typeforce_1(types_1.BufferN(64), buffer);
  var r = lib.fromBuffer(buffer.slice(0, 32));
  var s = lib.fromBuffer(buffer.slice(32, 64));
  return new ECSignature$1(r, s);
};
ECSignature$1.fromDER = function (buffer) {
  var decode = bip66.decode(buffer);
  var r = lib.fromDERInteger(decode.r);
  var s = lib.fromDERInteger(decode.s);
  return new ECSignature$1(r, s);
};
ECSignature$1.parseScriptSignature = function (buffer) {
  var hashType = buffer.readUInt8(buffer.length - 1);
  var hashTypeMod = hashType & ~0x80;
  if (hashTypeMod <= 0x00 || hashTypeMod >= 0x04) throw new Error('Invalid hashType ' + hashType);
  return {
    signature: ECSignature$1.fromDER(buffer.slice(0, -1)),
    hashType: hashType
  };
};
ECSignature$1.prototype.toCompact = function (i, compressed) {
  if (compressed) {
    i += 4;
  }
  i += 27;
  var buffer = Buffer.alloc(65);
  buffer.writeUInt8(i, 0);
  this.toRSBuffer(buffer, 1);
  return buffer;
};
ECSignature$1.prototype.toDER = function () {
  var r = Buffer.from(this.r.toDERInteger());
  var s = Buffer.from(this.s.toDERInteger());
  return bip66.encode(r, s);
};
ECSignature$1.prototype.toRSBuffer = function (buffer, offset) {
  buffer = buffer || Buffer.alloc(64);
  this.r.toBuffer(32).copy(buffer, offset);
  this.s.toBuffer(32).copy(buffer, offset + 32);
  return buffer;
};
ECSignature$1.prototype.toScriptSignature = function (hashType) {
  var hashTypeMod = hashType & ~0x80;
  if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new Error('Invalid hashType ' + hashType);
  var hashTypeBuffer = Buffer.alloc(1);
  hashTypeBuffer.writeUInt8(hashType, 0);
  return Buffer.concat([this.toDER(), hashTypeBuffer]);
};
var ecsignature = ECSignature$1;

var Buffer$25 = safeBuffer.Buffer;
var THREE = lib.valueOf(3);
function Point(curve, x, y, z) {
  assert$3.notStrictEqual(z, undefined, 'Missing Z coordinate');
  this.curve = curve;
  this.x = x;
  this.y = y;
  this.z = z;
  this._zInv = null;
  this.compressed = true;
}
Object.defineProperty(Point.prototype, 'zInv', {
  get: function () {
    if (this._zInv === null) {
      this._zInv = this.z.modInverse(this.curve.p);
    }
    return this._zInv;
  }
});
Object.defineProperty(Point.prototype, 'affineX', {
  get: function () {
    return this.x.multiply(this.zInv).mod(this.curve.p);
  }
});
Object.defineProperty(Point.prototype, 'affineY', {
  get: function () {
    return this.y.multiply(this.zInv).mod(this.curve.p);
  }
});
Point.fromAffine = function (curve, x, y) {
  return new Point(curve, x, y, lib.ONE);
};
Point.prototype.equals = function (other) {
  if (other === this) return true;
  if (this.curve.isInfinity(this)) return this.curve.isInfinity(other);
  if (this.curve.isInfinity(other)) return this.curve.isInfinity(this);
  var u = other.y.multiply(this.z).subtract(this.y.multiply(other.z)).mod(this.curve.p);
  if (u.signum() !== 0) return false;
  var v = other.x.multiply(this.z).subtract(this.x.multiply(other.z)).mod(this.curve.p);
  return v.signum() === 0;
};
Point.prototype.negate = function () {
  var y = this.curve.p.subtract(this.y);
  return new Point(this.curve, this.x, y, this.z);
};
Point.prototype.add = function (b) {
  if (this.curve.isInfinity(this)) return b;
  if (this.curve.isInfinity(b)) return this;
  var x1 = this.x;
  var y1 = this.y;
  var x2 = b.x;
  var y2 = b.y;
  var u = y2.multiply(this.z).subtract(y1.multiply(b.z)).mod(this.curve.p);
  var v = x2.multiply(this.z).subtract(x1.multiply(b.z)).mod(this.curve.p);
  if (v.signum() === 0) {
    if (u.signum() === 0) {
      return this.twice();
    }
    return this.curve.infinity;
  }
  var v2 = v.square();
  var v3 = v2.multiply(v);
  var x1v2 = x1.multiply(v2);
  var zu2 = u.square().multiply(this.z);
  var x3 = zu2.subtract(x1v2.shiftLeft(1)).multiply(b.z).subtract(v3).multiply(v).mod(this.curve.p);
  var y3 = x1v2.multiply(THREE).multiply(u).subtract(y1.multiply(v3)).subtract(zu2.multiply(u)).multiply(b.z).add(u.multiply(v3)).mod(this.curve.p);
  var z3 = v3.multiply(this.z).multiply(b.z).mod(this.curve.p);
  return new Point(this.curve, x3, y3, z3);
};
Point.prototype.twice = function () {
  if (this.curve.isInfinity(this)) return this;
  if (this.y.signum() === 0) return this.curve.infinity;
  var x1 = this.x;
  var y1 = this.y;
  var y1z1 = y1.multiply(this.z).mod(this.curve.p);
  var y1sqz1 = y1z1.multiply(y1).mod(this.curve.p);
  var a = this.curve.a;
  var w = x1.square().multiply(THREE);
  if (a.signum() !== 0) {
    w = w.add(this.z.square().multiply(a));
  }
  w = w.mod(this.curve.p);
  var x3 = w.square().subtract(x1.shiftLeft(3).multiply(y1sqz1)).shiftLeft(1).multiply(y1z1).mod(this.curve.p);
  var y3 = w.multiply(THREE).multiply(x1).subtract(y1sqz1.shiftLeft(1)).shiftLeft(2).multiply(y1sqz1).subtract(w.pow(3)).mod(this.curve.p);
  var z3 = y1z1.pow(3).shiftLeft(3).mod(this.curve.p);
  return new Point(this.curve, x3, y3, z3);
};
Point.prototype.multiply = function (k) {
  if (this.curve.isInfinity(this)) return this;
  if (k.signum() === 0) return this.curve.infinity;
  var e = k;
  var h = e.multiply(THREE);
  var neg = this.negate();
  var R = this;
  for (var i = h.bitLength() - 2; i > 0; --i) {
    var hBit = h.testBit(i);
    var eBit = e.testBit(i);
    R = R.twice();
    if (hBit !== eBit) {
      R = R.add(hBit ? this : neg);
    }
  }
  return R;
};
Point.prototype.multiplyTwo = function (j, x, k) {
  var i = Math.max(j.bitLength(), k.bitLength()) - 1;
  var R = this.curve.infinity;
  var both = this.add(x);
  while (i >= 0) {
    var jBit = j.testBit(i);
    var kBit = k.testBit(i);
    R = R.twice();
    if (jBit) {
      if (kBit) {
        R = R.add(both);
      } else {
        R = R.add(this);
      }
    } else if (kBit) {
      R = R.add(x);
    }
    --i;
  }
  return R;
};
Point.prototype.getEncoded = function (compressed) {
  if (compressed == null) compressed = this.compressed;
  if (this.curve.isInfinity(this)) return Buffer$25.alloc(1, 0);
  var x = this.affineX;
  var y = this.affineY;
  var byteLength = this.curve.pLength;
  var buffer;
  if (compressed) {
    buffer = Buffer$25.allocUnsafe(1 + byteLength);
    buffer.writeUInt8(y.isEven() ? 0x02 : 0x03, 0);
  } else {
    buffer = Buffer$25.allocUnsafe(1 + byteLength + byteLength);
    buffer.writeUInt8(0x04, 0);
    y.toBuffer(byteLength).copy(buffer, 1 + byteLength);
  }
  x.toBuffer(byteLength).copy(buffer, 1);
  return buffer;
};
Point.decodeFrom = function (curve, buffer) {
  var type = buffer.readUInt8(0);
  var compressed = type !== 4;
  var byteLength = Math.floor((curve.p.bitLength() + 7) / 8);
  var x = lib.fromBuffer(buffer.slice(1, 1 + byteLength));
  var Q;
  if (compressed) {
    assert$3.equal(buffer.length, byteLength + 1, 'Invalid sequence length');
    assert$3(type === 0x02 || type === 0x03, 'Invalid sequence tag');
    var isOdd = type === 0x03;
    Q = curve.pointFromX(isOdd, x);
  } else {
    assert$3.equal(buffer.length, 1 + byteLength + byteLength, 'Invalid sequence length');
    var y = lib.fromBuffer(buffer.slice(1 + byteLength));
    Q = Point.fromAffine(curve, x, y);
  }
  Q.compressed = compressed;
  return Q;
};
Point.prototype.toString = function () {
  if (this.curve.isInfinity(this)) return '(INFINITY)';
  return '(' + this.affineX.toString() + ',' + this.affineY.toString() + ')';
};
var point = Point;

function Curve(p, a, b, Gx, Gy, n, h) {
  this.p = p;
  this.a = a;
  this.b = b;
  this.G = point.fromAffine(this, Gx, Gy);
  this.n = n;
  this.h = h;
  this.infinity = new point(this, null, null, lib.ZERO);
  this.pOverFour = p.add(lib.ONE).shiftRight(2);
  this.pLength = Math.floor((this.p.bitLength() + 7) / 8);
}
Curve.prototype.pointFromX = function (isOdd, x) {
  var alpha = x.pow(3).add(this.a.multiply(x)).add(this.b).mod(this.p);
  var beta = alpha.modPow(this.pOverFour, this.p);
  var y = beta;
  if (beta.isEven() ^ !isOdd) {
    y = this.p.subtract(y);
  }
  return point.fromAffine(this, x, y);
};
Curve.prototype.isInfinity = function (Q) {
  if (Q === this.infinity) return true;
  return Q.z.signum() === 0 && Q.y.signum() !== 0;
};
Curve.prototype.isOnCurve = function (Q) {
  if (this.isInfinity(Q)) return true;
  var x = Q.affineX;
  var y = Q.affineY;
  var a = this.a;
  var b = this.b;
  var p = this.p;
  if (x.signum() < 0 || x.compareTo(p) >= 0) return false;
  if (y.signum() < 0 || y.compareTo(p) >= 0) return false;
  var lhs = y.square().mod(p);
  var rhs = x.pow(3).add(a.multiply(x)).add(b).mod(p);
  return lhs.equals(rhs);
};
Curve.prototype.validate = function (Q) {
  assert$3(!this.isInfinity(Q), 'Point is at infinity');
  assert$3(this.isOnCurve(Q), 'Point is not on the curve');
  var nQ = Q.multiply(this.n);
  assert$3(this.isInfinity(nQ), 'Point is not a scalar multiple of G');
  return true;
};
var curve = Curve;

var secp128r1 = { "p": "fffffffdffffffffffffffffffffffff", "a": "fffffffdfffffffffffffffffffffffc", "b": "e87579c11079f43dd824993c2cee5ed3", "n": "fffffffe0000000075a30d1b9038a115", "h": "01", "Gx": "161ff7528b899b2d0c28607ca52c5b86", "Gy": "cf5ac8395bafeb13c02da292dded7a83" };
var secp160k1 = { "p": "fffffffffffffffffffffffffffffffeffffac73", "a": "00", "b": "07", "n": "0100000000000000000001b8fa16dfab9aca16b6b3", "h": "01", "Gx": "3b4c382ce37aa192a4019e763036f4f5dd4d7ebb", "Gy": "938cf935318fdced6bc28286531733c3f03c4fee" };
var secp160r1 = { "p": "ffffffffffffffffffffffffffffffff7fffffff", "a": "ffffffffffffffffffffffffffffffff7ffffffc", "b": "1c97befc54bd7a8b65acf89f81d4d4adc565fa45", "n": "0100000000000000000001f4c8f927aed3ca752257", "h": "01", "Gx": "4a96b5688ef573284664698968c38bb913cbfc82", "Gy": "23a628553168947d59dcc912042351377ac5fb32" };
var secp192k1 = { "p": "fffffffffffffffffffffffffffffffffffffffeffffee37", "a": "00", "b": "03", "n": "fffffffffffffffffffffffe26f2fc170f69466a74defd8d", "h": "01", "Gx": "db4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d", "Gy": "9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d" };
var secp192r1 = { "p": "fffffffffffffffffffffffffffffffeffffffffffffffff", "a": "fffffffffffffffffffffffffffffffefffffffffffffffc", "b": "64210519e59c80e70fa7e9ab72243049feb8deecc146b9b1", "n": "ffffffffffffffffffffffff99def836146bc9b1b4d22831", "h": "01", "Gx": "188da80eb03090f67cbf20eb43a18800f4ff0afd82ff1012", "Gy": "07192b95ffc8da78631011ed6b24cdd573f977a11e794811" };
var secp256k1$2 = { "p": "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f", "a": "00", "b": "07", "n": "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141", "h": "01", "Gx": "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798", "Gy": "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8" };
var secp256r1 = { "p": "ffffffff00000001000000000000000000000000ffffffffffffffffffffffff", "a": "ffffffff00000001000000000000000000000000fffffffffffffffffffffffc", "b": "5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b", "n": "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551", "h": "01", "Gx": "6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296", "Gy": "4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5" };
var curves = {
	secp128r1: secp128r1,
	secp160k1: secp160k1,
	secp160r1: secp160r1,
	secp192k1: secp192k1,
	secp192r1: secp192r1,
	secp256k1: secp256k1$2,
	secp256r1: secp256r1
};

var curves$1 = Object.freeze({
	secp128r1: secp128r1,
	secp160k1: secp160k1,
	secp160r1: secp160r1,
	secp192k1: secp192k1,
	secp192r1: secp192r1,
	secp256k1: secp256k1$2,
	secp256r1: secp256r1,
	default: curves
});

var curves$2 = ( curves$1 && curves ) || curves$1;

function getCurveByName(name) {
  var curve$$1 = curves$2[name];
  if (!curve$$1) return null;
  var p = new lib(curve$$1.p, 16);
  var a = new lib(curve$$1.a, 16);
  var b = new lib(curve$$1.b, 16);
  var n = new lib(curve$$1.n, 16);
  var h = new lib(curve$$1.h, 16);
  var Gx = new lib(curve$$1.Gx, 16);
  var Gy = new lib(curve$$1.Gy, 16);
  return new curve(p, a, b, Gx, Gy, n, h);
}
var names = getCurveByName;

var lib$2 = {
  Curve: curve,
  Point: point,
  getCurveByName: names
};

var Buffer$22 = safeBuffer.Buffer;
var ZERO$1 = Buffer$22.alloc(1, 0);
var ONE$1 = Buffer$22.alloc(1, 1);
var secp256k1$1 = lib$2.getCurveByName('secp256k1');
function deterministicGenerateK(hash, x, checkSig) {
  typeforce_1(types_1.tuple(types_1.Hash256bit, types_1.Buffer256bit, types_1.Function), arguments);
  var k = Buffer$22.alloc(32, 0);
  var v = Buffer$22.alloc(32, 1);
  k = browser$3('sha256', k).update(v).update(ZERO$1).update(x).update(hash).digest();
  v = browser$3('sha256', k).update(v).digest();
  k = browser$3('sha256', k).update(v).update(ONE$1).update(x).update(hash).digest();
  v = browser$3('sha256', k).update(v).digest();
  v = browser$3('sha256', k).update(v).digest();
  var T = lib.fromBuffer(v);
  while (T.signum() <= 0 || T.compareTo(secp256k1$1.n) >= 0 || !checkSig(T)) {
    k = browser$3('sha256', k).update(v).update(ZERO$1).digest();
    v = browser$3('sha256', k).update(v).digest();
    v = browser$3('sha256', k).update(v).digest();
    T = lib.fromBuffer(v);
  }
  return T;
}
var N_OVER_TWO = secp256k1$1.n.shiftRight(1);
function sign(hash, d) {
  typeforce_1(types_1.tuple(types_1.Hash256bit, types_1.BigInt), arguments);
  var x = d.toBuffer(32);
  var e = lib.fromBuffer(hash);
  var n = secp256k1$1.n;
  var G = secp256k1$1.G;
  var r, s;
  deterministicGenerateK(hash, x, function (k) {
    var Q = G.multiply(k);
    if (secp256k1$1.isInfinity(Q)) return false;
    r = Q.affineX.mod(n);
    if (r.signum() === 0) return false;
    s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n);
    if (s.signum() === 0) return false;
    return true;
  });
  if (s.compareTo(N_OVER_TWO) > 0) {
    s = n.subtract(s);
  }
  return new ecsignature(r, s);
}
function verify(hash, signature, Q) {
  typeforce_1(types_1.tuple(types_1.Hash256bit, types_1.ECSignature, types_1.ECPoint), arguments);
  var n = secp256k1$1.n;
  var G = secp256k1$1.G;
  var r = signature.r;
  var s = signature.s;
  if (r.signum() <= 0 || r.compareTo(n) >= 0) return false;
  if (s.signum() <= 0 || s.compareTo(n) >= 0) return false;
  var e = lib.fromBuffer(hash);
  var sInv = s.modInverse(n);
  var u1 = e.multiply(sInv).mod(n);
  var u2 = r.multiply(sInv).mod(n);
  var R = G.multiplyTwo(u1, Q, u2);
  if (secp256k1$1.isInfinity(R)) return false;
  var xR = R.affineX;
  var v = xR.mod(n);
  return v.equals(r);
}
var ecdsa = {
  deterministicGenerateK: deterministicGenerateK,
  sign: sign,
  verify: verify,
  __curve: secp256k1$1
};

var browser$5 = createCommonjsModule$1(function (module) {
  'use strict';
  function oldBrowser() {
    throw new Error('Secure random number generation is not supported by this browser.\nUse Chrome, Firefox or Internet Explorer 11');
  }
  var Buffer = safeBuffer.Buffer;
  var crypto = commonjsGlobal$1.crypto || commonjsGlobal$1.msCrypto;
  if (crypto && crypto.getRandomValues) {
    module.exports = randomBytes;
  } else {
    module.exports = oldBrowser;
  }
  function randomBytes(size, cb) {
    if (size > 65536) throw new Error('requested too many random bytes');
    var rawBytes = new commonjsGlobal$1.Uint8Array(size);
    if (size > 0) {
      crypto.getRandomValues(rawBytes);
    }
    var bytes = Buffer.from(rawBytes.buffer);
    if (typeof cb === 'function') {
      return process.nextTick(function () {
        cb(null, bytes);
      });
    }
    return bytes;
  }
});

function decodeRaw(buffer, version) {
  if (version !== undefined && buffer[0] !== version) throw new Error('Invalid network version');
  if (buffer.length === 33) {
    return {
      version: buffer[0],
      privateKey: buffer.slice(1, 33),
      compressed: false
    };
  }
  if (buffer.length !== 34) throw new Error('Invalid WIF length');
  if (buffer[33] !== 0x01) throw new Error('Invalid compression flag');
  return {
    version: buffer[0],
    privateKey: buffer.slice(1, 33),
    compressed: true
  };
}
function encodeRaw(version, privateKey, compressed) {
  var result = new Buffer(compressed ? 34 : 33);
  result.writeUInt8(version, 0);
  privateKey.copy(result, 1);
  if (compressed) {
    result[33] = 0x01;
  }
  return result;
}
function decode$18(string, version) {
  return decodeRaw(bs58check.decode(string), version);
}
function encode$19(version, privateKey, compressed) {
  if (typeof version === 'number') return bs58check.encode(encodeRaw(version, privateKey, compressed));
  return bs58check.encode(encodeRaw(version.version, version.privateKey, version.compressed));
}
var wif = {
  decode: decode$18,
  decodeRaw: decodeRaw,
  encode: encode$19,
  encodeRaw: encodeRaw
};

var secp256k1 = ecdsa.__curve;
function ECPair$1(d, Q, options) {
  if (options) {
    typeforce_1({
      compressed: types_1.maybe(types_1.Boolean),
      network: types_1.maybe(types_1.Network)
    }, options);
  }
  options = options || {};
  if (d) {
    if (d.signum() <= 0) throw new Error('Private key must be greater than 0');
    if (d.compareTo(secp256k1.n) >= 0) throw new Error('Private key must be less than the curve order');
    if (Q) throw new TypeError('Unexpected publicKey parameter');
    this.d = d;
  } else {
    typeforce_1(types_1.ECPoint, Q);
    this.__Q = Q;
  }
  this.compressed = options.compressed === undefined ? true : options.compressed;
  this.network = options.network || networks$1.bitcoin;
}
Object.defineProperty(ECPair$1.prototype, 'Q', {
  get: function () {
    if (!this.__Q && this.d) {
      this.__Q = secp256k1.G.multiply(this.d);
    }
    return this.__Q;
  }
});
ECPair$1.fromPublicKeyBuffer = function (buffer, network) {
  var Q = lib$2.Point.decodeFrom(secp256k1, buffer);
  return new ECPair$1(null, Q, {
    compressed: Q.compressed,
    network: network
  });
};
ECPair$1.fromWIF = function (string, network) {
  var decoded = wif.decode(string);
  var version = decoded.version;
  if (types_1.Array(network)) {
    network = network.filter(function (x) {
      return version === x.wif;
    }).pop();
    if (!network) throw new Error('Unknown network version');
  } else {
    network = network || networks$1.bitcoin;
    if (version !== network.wif) throw new Error('Invalid network version');
  }
  var d = lib.fromBuffer(decoded.privateKey);
  return new ECPair$1(d, null, {
    compressed: decoded.compressed,
    network: network
  });
};
ECPair$1.makeRandom = function (options) {
  options = options || {};
  var rng = options.rng || browser$5;
  var d;
  do {
    var buffer = rng(32);
    typeforce_1(types_1.Buffer256bit, buffer);
    d = lib.fromBuffer(buffer);
  } while (d.signum() <= 0 || d.compareTo(secp256k1.n) >= 0);
  return new ECPair$1(d, null, options);
};
ECPair$1.prototype.getAddress = function () {
  return address.toBase58Check(crypto.hash160(this.getPublicKeyBuffer()), this.getNetwork().pubKeyHash);
};
ECPair$1.prototype.getNetwork = function () {
  return this.network;
};
ECPair$1.prototype.getPublicKeyBuffer = function () {
  return this.Q.getEncoded(this.compressed);
};
ECPair$1.prototype.sign = function (hash) {
  if (!this.d) throw new Error('Missing private key');
  return ecdsa.sign(hash, this.d);
};
ECPair$1.prototype.toWIF = function () {
  if (!this.d) throw new Error('Missing private key');
  return wif.encode(this.network.wif, this.d.toBuffer(32), this.compressed);
};
ECPair$1.prototype.verify = function (hash, signature) {
  return ecdsa.verify(hash, signature, this.Q);
};
var ecpair = ECPair$1;

var Buffer$26 = safeBuffer.Buffer;
var curve$2 = lib$2.getCurveByName('secp256k1');
function HDNode(keyPair, chainCode) {
  typeforce_1(types_1.tuple('ECPair', types_1.Buffer256bit), arguments);
  if (!keyPair.compressed) throw new TypeError('BIP32 only allows compressed keyPairs');
  this.keyPair = keyPair;
  this.chainCode = chainCode;
  this.depth = 0;
  this.index = 0;
  this.parentFingerprint = 0x00000000;
}
HDNode.HIGHEST_BIT = 0x80000000;
HDNode.LENGTH = 78;
HDNode.MASTER_SECRET = Buffer$26.from('Bitcoin seed', 'utf8');
HDNode.fromSeedBuffer = function (seed, network) {
  typeforce_1(types_1.tuple(types_1.Buffer, types_1.maybe(types_1.Network)), arguments);
  if (seed.length < 16) throw new TypeError('Seed should be at least 128 bits');
  if (seed.length > 64) throw new TypeError('Seed should be at most 512 bits');
  var I = browser$3('sha512', HDNode.MASTER_SECRET).update(seed).digest();
  var IL = I.slice(0, 32);
  var IR = I.slice(32);
  var pIL = lib.fromBuffer(IL);
  var keyPair = new ecpair(pIL, null, {
    network: network
  });
  return new HDNode(keyPair, IR);
};
HDNode.fromSeedHex = function (hex, network) {
  return HDNode.fromSeedBuffer(Buffer$26.from(hex, 'hex'), network);
};
HDNode.fromBase58 = function (string, networks) {
  var buffer = bs58check.decode(string);
  if (buffer.length !== 78) throw new Error('Invalid buffer length');
  var version = buffer.readUInt32BE(0);
  var network;
  if (Array.isArray(networks)) {
    network = networks.filter(function (x) {
      return version === x.bip32.private || version === x.bip32.public;
    }).pop();
    if (!network) throw new Error('Unknown network version');
  } else {
    network = networks || networks$1.bitcoin;
  }
  if (version !== network.bip32.private && version !== network.bip32.public) throw new Error('Invalid network version');
  var depth = buffer[4];
  var parentFingerprint = buffer.readUInt32BE(5);
  if (depth === 0) {
    if (parentFingerprint !== 0x00000000) throw new Error('Invalid parent fingerprint');
  }
  var index = buffer.readUInt32BE(9);
  if (depth === 0 && index !== 0) throw new Error('Invalid index');
  var chainCode = buffer.slice(13, 45);
  var keyPair;
  if (version === network.bip32.private) {
    if (buffer.readUInt8(45) !== 0x00) throw new Error('Invalid private key');
    var d = lib.fromBuffer(buffer.slice(46, 78));
    keyPair = new ecpair(d, null, { network: network });
  } else {
    var Q = lib$2.Point.decodeFrom(curve$2, buffer.slice(45, 78));
    curve$2.validate(Q);
    keyPair = new ecpair(null, Q, { network: network });
  }
  var hd = new HDNode(keyPair, chainCode);
  hd.depth = depth;
  hd.index = index;
  hd.parentFingerprint = parentFingerprint;
  return hd;
};
HDNode.prototype.getAddress = function () {
  return this.keyPair.getAddress();
};
HDNode.prototype.getIdentifier = function () {
  return crypto.hash160(this.keyPair.getPublicKeyBuffer());
};
HDNode.prototype.getFingerprint = function () {
  return this.getIdentifier().slice(0, 4);
};
HDNode.prototype.getNetwork = function () {
  return this.keyPair.getNetwork();
};
HDNode.prototype.getPublicKeyBuffer = function () {
  return this.keyPair.getPublicKeyBuffer();
};
HDNode.prototype.neutered = function () {
  var neuteredKeyPair = new ecpair(null, this.keyPair.Q, {
    network: this.keyPair.network
  });
  var neutered = new HDNode(neuteredKeyPair, this.chainCode);
  neutered.depth = this.depth;
  neutered.index = this.index;
  neutered.parentFingerprint = this.parentFingerprint;
  return neutered;
};
HDNode.prototype.sign = function (hash) {
  return this.keyPair.sign(hash);
};
HDNode.prototype.verify = function (hash, signature) {
  return this.keyPair.verify(hash, signature);
};
HDNode.prototype.toBase58 = function (__isPrivate) {
  if (__isPrivate !== undefined) throw new TypeError('Unsupported argument in 2.0.0');
  var network = this.keyPair.network;
  var version = !this.isNeutered() ? network.bip32.private : network.bip32.public;
  var buffer = Buffer$26.allocUnsafe(78);
  buffer.writeUInt32BE(version, 0);
  buffer.writeUInt8(this.depth, 4);
  buffer.writeUInt32BE(this.parentFingerprint, 5);
  buffer.writeUInt32BE(this.index, 9);
  this.chainCode.copy(buffer, 13);
  if (!this.isNeutered()) {
    buffer.writeUInt8(0, 45);
    this.keyPair.d.toBuffer(32).copy(buffer, 46);
  } else {
    this.keyPair.getPublicKeyBuffer().copy(buffer, 45);
  }
  return bs58check.encode(buffer);
};
HDNode.prototype.derive = function (index) {
  typeforce_1(types_1.UInt32, index);
  var isHardened = index >= HDNode.HIGHEST_BIT;
  var data = Buffer$26.allocUnsafe(37);
  if (isHardened) {
    if (this.isNeutered()) throw new TypeError('Could not derive hardened child key');
    data[0] = 0x00;
    this.keyPair.d.toBuffer(32).copy(data, 1);
    data.writeUInt32BE(index, 33);
  } else {
    this.keyPair.getPublicKeyBuffer().copy(data, 0);
    data.writeUInt32BE(index, 33);
  }
  var I = browser$3('sha512', this.chainCode).update(data).digest();
  var IL = I.slice(0, 32);
  var IR = I.slice(32);
  var pIL = lib.fromBuffer(IL);
  if (pIL.compareTo(curve$2.n) >= 0) {
    return this.derive(index + 1);
  }
  var derivedKeyPair;
  if (!this.isNeutered()) {
    var ki = pIL.add(this.keyPair.d).mod(curve$2.n);
    if (ki.signum() === 0) {
      return this.derive(index + 1);
    }
    derivedKeyPair = new ecpair(ki, null, {
      network: this.keyPair.network
    });
  } else {
    var Ki = curve$2.G.multiply(pIL).add(this.keyPair.Q);
    if (curve$2.isInfinity(Ki)) {
      return this.derive(index + 1);
    }
    derivedKeyPair = new ecpair(null, Ki, {
      network: this.keyPair.network
    });
  }
  var hd = new HDNode(derivedKeyPair, IR);
  hd.depth = this.depth + 1;
  hd.index = index;
  hd.parentFingerprint = this.getFingerprint().readUInt32BE(0);
  return hd;
};
HDNode.prototype.deriveHardened = function (index) {
  typeforce_1(types_1.UInt31, index);
  return this.derive(index + HDNode.HIGHEST_BIT);
};
HDNode.prototype.isNeutered = function () {
  return !this.keyPair.d;
};
HDNode.prototype.derivePath = function (path) {
  typeforce_1(types_1.BIP32Path, path);
  var splitPath = path.split('/');
  if (splitPath[0] === 'm') {
    if (this.parentFingerprint) {
      throw new Error('Not a master node');
    }
    splitPath = splitPath.slice(1);
  }
  return splitPath.reduce(function (prevHd, indexStr) {
    var index;
    if (indexStr.slice(-1) === "'") {
      index = parseInt(indexStr.slice(0, -1), 10);
      return prevHd.deriveHardened(index);
    } else {
      index = parseInt(indexStr, 10);
      return prevHd.derive(index);
    }
  }, this);
};
var hdnode = HDNode;

var Buffer$27 = safeBuffer.Buffer;
var scriptTypes = templates.types;
var SIGNABLE = [templates.types.P2PKH, templates.types.P2PK, templates.types.MULTISIG];
var P2SH = SIGNABLE.concat([templates.types.P2WPKH, templates.types.P2WSH]);
function supportedType(type) {
  return SIGNABLE.indexOf(type) !== -1;
}
function supportedP2SHType(type) {
  return P2SH.indexOf(type) !== -1;
}
function extractChunks(type, chunks, script$$1) {
  var pubKeys = [];
  var signatures = [];
  switch (type) {
    case scriptTypes.P2PKH:
      pubKeys = chunks.slice(1);
      signatures = chunks.slice(0, 1);
      break;
    case scriptTypes.P2PK:
      pubKeys[0] = script$$1 ? templates.pubKey.output.decode(script$$1) : undefined;
      signatures = chunks.slice(0, 1);
      break;
    case scriptTypes.MULTISIG:
      if (script$$1) {
        var multisig = templates.multisig.output.decode(script$$1);
        pubKeys = multisig.pubKeys;
      }
      signatures = chunks.slice(1).map(function (chunk) {
        return chunk.length === 0 ? undefined : chunk;
      });
      break;
  }
  return {
    pubKeys: pubKeys,
    signatures: signatures
  };
}
function expandInput(scriptSig, witnessStack) {
  if (scriptSig.length === 0 && witnessStack.length === 0) return {};
  var prevOutScript;
  var prevOutType;
  var scriptType;
  var script$$1;
  var redeemScript;
  var witnessScript;
  var witnessScriptType;
  var redeemScriptType;
  var witness = false;
  var p2wsh = false;
  var p2sh = false;
  var witnessProgram;
  var chunks;
  var scriptSigChunks = script.decompile(scriptSig);
  var sigType = templates.classifyInput(scriptSigChunks, true);
  if (sigType === scriptTypes.P2SH) {
    p2sh = true;
    redeemScript = scriptSigChunks[scriptSigChunks.length - 1];
    redeemScriptType = templates.classifyOutput(redeemScript);
    prevOutScript = templates.scriptHash.output.encode(crypto.hash160(redeemScript));
    prevOutType = scriptTypes.P2SH;
    script$$1 = redeemScript;
  }
  var classifyWitness = templates.classifyWitness(witnessStack, true);
  if (classifyWitness === scriptTypes.P2WSH) {
    witnessScript = witnessStack[witnessStack.length - 1];
    witnessScriptType = templates.classifyOutput(witnessScript);
    p2wsh = true;
    witness = true;
    if (scriptSig.length === 0) {
      prevOutScript = templates.witnessScriptHash.output.encode(crypto.sha256(witnessScript));
      prevOutType = scriptTypes.P2WSH;
      if (redeemScript !== undefined) {
        throw new Error('Redeem script given when unnecessary');
      }
    } else {
      if (!redeemScript) {
        throw new Error('No redeemScript provided for P2WSH, but scriptSig non-empty');
      }
      witnessProgram = templates.witnessScriptHash.output.encode(crypto.sha256(witnessScript));
      if (!redeemScript.equals(witnessProgram)) {
        throw new Error('Redeem script didn\'t match witnessScript');
      }
    }
    if (!supportedType(templates.classifyOutput(witnessScript))) {
      throw new Error('unsupported witness script');
    }
    script$$1 = witnessScript;
    scriptType = witnessScriptType;
    chunks = witnessStack.slice(0, -1);
  } else if (classifyWitness === scriptTypes.P2WPKH) {
    witness = true;
    var key = witnessStack[witnessStack.length - 1];
    var keyHash = crypto.hash160(key);
    if (scriptSig.length === 0) {
      prevOutScript = templates.witnessPubKeyHash.output.encode(keyHash);
      prevOutType = scriptTypes.P2WPKH;
      if (typeof redeemScript !== 'undefined') {
        throw new Error('Redeem script given when unnecessary');
      }
    } else {
      if (!redeemScript) {
        throw new Error('No redeemScript provided for P2WPKH, but scriptSig wasn\'t empty');
      }
      witnessProgram = templates.witnessPubKeyHash.output.encode(keyHash);
      if (!redeemScript.equals(witnessProgram)) {
        throw new Error('Redeem script did not have the right witness program');
      }
    }
    scriptType = scriptTypes.P2PKH;
    chunks = witnessStack;
  } else if (redeemScript) {
    if (!supportedP2SHType(redeemScriptType)) {
      throw new Error('Bad redeemscript!');
    }
    script$$1 = redeemScript;
    scriptType = redeemScriptType;
    chunks = scriptSigChunks.slice(0, -1);
  } else {
    prevOutType = scriptType = templates.classifyInput(scriptSig);
    chunks = scriptSigChunks;
  }
  var expanded = extractChunks(scriptType, chunks, script$$1);
  var result = {
    pubKeys: expanded.pubKeys,
    signatures: expanded.signatures,
    prevOutScript: prevOutScript,
    prevOutType: prevOutType,
    signType: scriptType,
    signScript: script$$1,
    witness: Boolean(witness)
  };
  if (p2sh) {
    result.redeemScript = redeemScript;
    result.redeemScriptType = redeemScriptType;
  }
  if (p2wsh) {
    result.witnessScript = witnessScript;
    result.witnessScriptType = witnessScriptType;
  }
  return result;
}
function fixMultisigOrder(input, transaction$$1, vin) {
  if (input.redeemScriptType !== scriptTypes.MULTISIG || !input.redeemScript) return;
  if (input.pubKeys.length === input.signatures.length) return;
  var unmatched = input.signatures.concat();
  input.signatures = input.pubKeys.map(function (pubKey) {
    var keyPair = ecpair.fromPublicKeyBuffer(pubKey);
    var match;
    unmatched.some(function (signature, i) {
      if (!signature) return false;
      var parsed = ecsignature.parseScriptSignature(signature);
      var hash = transaction$$1.hashForSignature(vin, input.redeemScript, parsed.hashType);
      if (!keyPair.verify(hash, parsed.signature)) return false;
      unmatched[i] = undefined;
      match = signature;
      return true;
    });
    return match;
  });
}
function expandOutput(script$$1, scriptType, ourPubKey) {
  typeforce_1(types_1.Buffer, script$$1);
  var scriptChunks = script.decompile(script$$1);
  if (!scriptType) {
    scriptType = templates.classifyOutput(script$$1);
  }
  var pubKeys = [];
  switch (scriptType) {
    case scriptTypes.P2PKH:
      if (!ourPubKey) break;
      var pkh1 = scriptChunks[2];
      var pkh2 = crypto.hash160(ourPubKey);
      if (pkh1.equals(pkh2)) pubKeys = [ourPubKey];
      break;
    case scriptTypes.P2WPKH:
      if (!ourPubKey) break;
      var wpkh1 = scriptChunks[1];
      var wpkh2 = crypto.hash160(ourPubKey);
      if (wpkh1.equals(wpkh2)) pubKeys = [ourPubKey];
      break;
    case scriptTypes.P2PK:
      pubKeys = scriptChunks.slice(0, 1);
      break;
    case scriptTypes.MULTISIG:
      pubKeys = scriptChunks.slice(1, -2);
      break;
    default:
      return { scriptType: scriptType };
  }
  return {
    pubKeys: pubKeys,
    scriptType: scriptType,
    signatures: pubKeys.map(function () {
      return undefined;
    })
  };
}
function checkP2SHInput(input, redeemScriptHash) {
  if (input.prevOutType) {
    if (input.prevOutType !== scriptTypes.P2SH) throw new Error('PrevOutScript must be P2SH');
    var prevOutScriptScriptHash = script.decompile(input.prevOutScript)[1];
    if (!prevOutScriptScriptHash.equals(redeemScriptHash)) throw new Error('Inconsistent hash160(RedeemScript)');
  }
}
function checkP2WSHInput(input, witnessScriptHash) {
  if (input.prevOutType) {
    if (input.prevOutType !== scriptTypes.P2WSH) throw new Error('PrevOutScript must be P2WSH');
    var scriptHash = script.decompile(input.prevOutScript)[1];
    if (!scriptHash.equals(witnessScriptHash)) throw new Error('Inconsistent sha25(WitnessScript)');
  }
}
function prepareInput(input, kpPubKey, redeemScript, witnessValue, witnessScript) {
  var expanded;
  var prevOutType;
  var prevOutScript;
  var p2sh = false;
  var p2shType;
  var redeemScriptHash;
  var witness = false;
  var p2wsh = false;
  var witnessType;
  var witnessScriptHash;
  var signType;
  var signScript;
  if (redeemScript && witnessScript) {
    redeemScriptHash = crypto.hash160(redeemScript);
    witnessScriptHash = crypto.sha256(witnessScript);
    checkP2SHInput(input, redeemScriptHash);
    if (!redeemScript.equals(templates.witnessScriptHash.output.encode(witnessScriptHash))) throw new Error('Witness script inconsistent with redeem script');
    expanded = expandOutput(witnessScript, undefined, kpPubKey);
    if (!expanded.pubKeys) throw new Error('WitnessScript not supported "' + script.toASM(redeemScript) + '"');
    prevOutType = templates.types.P2SH;
    prevOutScript = templates.scriptHash.output.encode(redeemScriptHash);
    p2sh = witness = p2wsh = true;
    p2shType = templates.types.P2WSH;
    signType = witnessType = expanded.scriptType;
    signScript = witnessScript;
  } else if (redeemScript) {
    redeemScriptHash = crypto.hash160(redeemScript);
    checkP2SHInput(input, redeemScriptHash);
    expanded = expandOutput(redeemScript, undefined, kpPubKey);
    if (!expanded.pubKeys) throw new Error('RedeemScript not supported "' + script.toASM(redeemScript) + '"');
    prevOutType = templates.types.P2SH;
    prevOutScript = templates.scriptHash.output.encode(redeemScriptHash);
    p2sh = true;
    signType = p2shType = expanded.scriptType;
    signScript = redeemScript;
    witness = signType === templates.types.P2WPKH;
  } else if (witnessScript) {
    witnessScriptHash = crypto.sha256(witnessScript);
    checkP2WSHInput(input, witnessScriptHash);
    expanded = expandOutput(witnessScript, undefined, kpPubKey);
    if (!expanded.pubKeys) throw new Error('WitnessScript not supported "' + script.toASM(redeemScript) + '"');
    prevOutType = templates.types.P2WSH;
    prevOutScript = templates.witnessScriptHash.output.encode(witnessScriptHash);
    witness = p2wsh = true;
    signType = witnessType = expanded.scriptType;
    signScript = witnessScript;
  } else if (input.prevOutType) {
    if (input.prevOutType === scriptTypes.P2SH || input.prevOutType === scriptTypes.P2WSH) {
      throw new Error('PrevOutScript is ' + input.prevOutType + ', requires redeemScript');
    }
    prevOutType = input.prevOutType;
    prevOutScript = input.prevOutScript;
    expanded = expandOutput(input.prevOutScript, input.prevOutType, kpPubKey);
    if (!expanded.pubKeys) return;
    witness = input.prevOutType === scriptTypes.P2WPKH;
    signType = prevOutType;
    signScript = prevOutScript;
  } else {
    prevOutScript = templates.pubKeyHash.output.encode(crypto.hash160(kpPubKey));
    expanded = expandOutput(prevOutScript, scriptTypes.P2PKH, kpPubKey);
    prevOutType = scriptTypes.P2PKH;
    witness = false;
    signType = prevOutType;
    signScript = prevOutScript;
  }
  if (signType === scriptTypes.P2WPKH) {
    signScript = templates.pubKeyHash.output.encode(templates.witnessPubKeyHash.output.decode(signScript));
  }
  if (p2sh) {
    input.redeemScript = redeemScript;
    input.redeemScriptType = p2shType;
  }
  if (p2wsh) {
    input.witnessScript = witnessScript;
    input.witnessScriptType = witnessType;
  }
  input.pubKeys = expanded.pubKeys;
  input.signatures = expanded.signatures;
  input.signScript = signScript;
  input.signType = signType;
  input.prevOutScript = prevOutScript;
  input.prevOutType = prevOutType;
  input.witness = witness;
}
function buildStack(type, signatures, pubKeys, allowIncomplete) {
  if (type === scriptTypes.P2PKH) {
    if (signatures.length === 1 && Buffer$27.isBuffer(signatures[0]) && pubKeys.length === 1) return templates.pubKeyHash.input.encodeStack(signatures[0], pubKeys[0]);
  } else if (type === scriptTypes.P2PK) {
    if (signatures.length === 1 && Buffer$27.isBuffer(signatures[0])) return templates.pubKey.input.encodeStack(signatures[0]);
  } else if (type === scriptTypes.MULTISIG) {
    if (signatures.length > 0) {
      signatures = signatures.map(function (signature) {
        return signature || ops.OP_0;
      });
      if (!allowIncomplete) {
        signatures = signatures.filter(function (x) {
          return x !== ops.OP_0;
        });
      }
      return templates.multisig.input.encodeStack(signatures);
    }
  } else {
    throw new Error('Not yet supported');
  }
  if (!allowIncomplete) throw new Error('Not enough signatures provided');
  return [];
}
function buildInput(input, allowIncomplete) {
  var scriptType = input.prevOutType;
  var sig = [];
  var witness = [];
  if (supportedType(scriptType)) {
    sig = buildStack(scriptType, input.signatures, input.pubKeys, allowIncomplete);
  }
  var p2sh = false;
  if (scriptType === templates.types.P2SH) {
    if (!allowIncomplete && !supportedP2SHType(input.redeemScriptType)) {
      throw new Error('Impossible to sign this type');
    }
    if (supportedType(input.redeemScriptType)) {
      sig = buildStack(input.redeemScriptType, input.signatures, input.pubKeys, allowIncomplete);
    }
    if (input.redeemScriptType) {
      p2sh = true;
      scriptType = input.redeemScriptType;
    }
  }
  switch (scriptType) {
    case templates.types.P2WPKH:
      witness = buildStack(templates.types.P2PKH, input.signatures, input.pubKeys, allowIncomplete);
      break;
    case templates.types.P2WSH:
      if (!allowIncomplete && !supportedType(input.witnessScriptType)) {
        throw new Error('Impossible to sign this type');
      }
      if (supportedType(input.witnessScriptType)) {
        witness = buildStack(input.witnessScriptType, input.signatures, input.pubKeys, allowIncomplete);
        witness.push(input.witnessScript);
        scriptType = input.witnessScriptType;
      }
      break;
  }
  if (p2sh) {
    sig.push(input.redeemScript);
  }
  return {
    type: scriptType,
    script: script.compile(sig),
    witness: witness
  };
}
function TransactionBuilder(network, maximumFeeRate) {
  this.prevTxMap = {};
  this.network = network || networks$1.bitcoin;
  this.maximumFeeRate = maximumFeeRate || 2500;
  this.inputs = [];
  this.tx = new transaction();
}
TransactionBuilder.prototype.setLockTime = function (locktime) {
  typeforce_1(types_1.UInt32, locktime);
  if (this.inputs.some(function (input) {
    if (!input.signatures) return false;
    return input.signatures.some(function (s) {
      return s;
    });
  })) {
    throw new Error('No, this would invalidate signatures');
  }
  this.tx.locktime = locktime;
};
TransactionBuilder.prototype.setVersion = function (version) {
  typeforce_1(types_1.UInt32, version);
  this.tx.version = version;
};
TransactionBuilder.fromTransaction = function (transaction$$1, network) {
  var txb = new TransactionBuilder(network);
  txb.setVersion(transaction$$1.version);
  txb.setLockTime(transaction$$1.locktime);
  transaction$$1.outs.forEach(function (txOut) {
    txb.addOutput(txOut.script, txOut.value);
  });
  transaction$$1.ins.forEach(function (txIn) {
    txb.__addInputUnsafe(txIn.hash, txIn.index, {
      sequence: txIn.sequence,
      script: txIn.script,
      witness: txIn.witness
    });
  });
  txb.inputs.forEach(function (input, i) {
    fixMultisigOrder(input, transaction$$1, i);
  });
  return txb;
};
TransactionBuilder.prototype.addInput = function (txHash, vout, sequence, prevOutScript) {
  if (!this.__canModifyInputs()) {
    throw new Error('No, this would invalidate signatures');
  }
  var value;
  if (typeof txHash === 'string') {
    txHash = Buffer$27.from(txHash, 'hex').reverse();
  } else if (txHash instanceof transaction) {
    var txOut = txHash.outs[vout];
    prevOutScript = txOut.script;
    value = txOut.value;
    txHash = txHash.getHash();
  }
  return this.__addInputUnsafe(txHash, vout, {
    sequence: sequence,
    prevOutScript: prevOutScript,
    value: value
  });
};
TransactionBuilder.prototype.__addInputUnsafe = function (txHash, vout, options) {
  if (transaction.isCoinbaseHash(txHash)) {
    throw new Error('coinbase inputs not supported');
  }
  var prevTxOut = txHash.toString('hex') + ':' + vout;
  if (this.prevTxMap[prevTxOut] !== undefined) throw new Error('Duplicate TxOut: ' + prevTxOut);
  var input = {};
  if (options.script !== undefined) {
    input = expandInput(options.script, options.witness || []);
  }
  if (options.value !== undefined) {
    input.value = options.value;
  }
  if (!input.prevOutScript && options.prevOutScript) {
    var prevOutType;
    if (!input.pubKeys && !input.signatures) {
      var expanded = expandOutput(options.prevOutScript);
      if (expanded.pubKeys) {
        input.pubKeys = expanded.pubKeys;
        input.signatures = expanded.signatures;
      }
      prevOutType = expanded.scriptType;
    }
    input.prevOutScript = options.prevOutScript;
    input.prevOutType = prevOutType || templates.classifyOutput(options.prevOutScript);
  }
  var vin = this.tx.addInput(txHash, vout, options.sequence, options.scriptSig);
  this.inputs[vin] = input;
  this.prevTxMap[prevTxOut] = vin;
  return vin;
};
TransactionBuilder.prototype.addOutput = function (scriptPubKey, value) {
  if (!this.__canModifyOutputs()) {
    throw new Error('No, this would invalidate signatures');
  }
  if (typeof scriptPubKey === 'string') {
    scriptPubKey = address.toOutputScript(scriptPubKey, this.network);
  }
  return this.tx.addOutput(scriptPubKey, value);
};
TransactionBuilder.prototype.build = function () {
  return this.__build(false);
};
TransactionBuilder.prototype.buildIncomplete = function () {
  return this.__build(true);
};
TransactionBuilder.prototype.__build = function (allowIncomplete) {
  if (!allowIncomplete) {
    if (!this.tx.ins.length) throw new Error('Transaction has no inputs');
    if (!this.tx.outs.length) throw new Error('Transaction has no outputs');
  }
  var tx = this.tx.clone();
  this.inputs.forEach(function (input, i) {
    var scriptType = input.witnessScriptType || input.redeemScriptType || input.prevOutType;
    if (!scriptType && !allowIncomplete) throw new Error('Transaction is not complete');
    var result = buildInput(input, allowIncomplete);
    if (!allowIncomplete) {
      if (!supportedType(result.type) && result.type !== templates.types.P2WPKH) {
        throw new Error(result.type + ' not supported');
      }
    }
    tx.setInputScript(i, result.script);
    tx.setWitness(i, result.witness);
  });
  if (!allowIncomplete) {
    if (this.__overMaximumFees(tx.virtualSize())) {
      throw new Error('Transaction has absurd fees');
    }
  }
  return tx;
};
function canSign(input) {
  return input.prevOutScript !== undefined && input.signScript !== undefined && input.pubKeys !== undefined && input.signatures !== undefined && input.signatures.length === input.pubKeys.length && input.pubKeys.length > 0 && (input.witness === false || input.witness === true && input.value !== undefined);
}
TransactionBuilder.prototype.sign = function (vin, keyPair, redeemScript, hashType, witnessValue, witnessScript) {
  if (keyPair.network && keyPair.network !== this.network) throw new TypeError('Inconsistent network');
  if (!this.inputs[vin]) throw new Error('No input at index: ' + vin);
  hashType = hashType || transaction.SIGHASH_ALL;
  var input = this.inputs[vin];
  if (input.redeemScript !== undefined && redeemScript && !input.redeemScript.equals(redeemScript)) {
    throw new Error('Inconsistent redeemScript');
  }
  var kpPubKey = keyPair.publicKey || keyPair.getPublicKeyBuffer();
  if (!canSign(input)) {
    if (witnessValue !== undefined) {
      if (input.value !== undefined && input.value !== witnessValue) throw new Error('Input didn\'t match witnessValue');
      typeforce_1(types_1.Satoshi, witnessValue);
      input.value = witnessValue;
    }
    if (!canSign(input)) prepareInput(input, kpPubKey, redeemScript, witnessValue, witnessScript);
    if (!canSign(input)) throw Error(input.prevOutType + ' not supported');
  }
  var signatureHash;
  if (input.witness) {
    signatureHash = this.tx.hashForWitnessV0(vin, input.signScript, input.value, hashType);
  } else {
    signatureHash = this.tx.hashForSignature(vin, input.signScript, hashType);
  }
  var signed = input.pubKeys.some(function (pubKey, i) {
    if (!kpPubKey.equals(pubKey)) return false;
    if (input.signatures[i]) throw new Error('Signature already exists');
    if (kpPubKey.length !== 33 && input.signType === scriptTypes.P2WPKH) throw new Error('BIP143 rejects uncompressed public keys in P2WPKH or P2WSH');
    var signature = keyPair.sign(signatureHash);
    if (Buffer$27.isBuffer(signature)) signature = ecsignature.fromRSBuffer(signature);
    input.signatures[i] = signature.toScriptSignature(hashType);
    return true;
  });
  if (!signed) throw new Error('Key pair cannot sign for this input');
};
function signatureHashType(buffer) {
  return buffer.readUInt8(buffer.length - 1);
}
TransactionBuilder.prototype.__canModifyInputs = function () {
  return this.inputs.every(function (input) {
    if (input.signatures === undefined) return true;
    return input.signatures.every(function (signature) {
      if (!signature) return true;
      var hashType = signatureHashType(signature);
      return hashType & transaction.SIGHASH_ANYONECANPAY;
    });
  });
};
TransactionBuilder.prototype.__canModifyOutputs = function () {
  var nInputs = this.tx.ins.length;
  var nOutputs = this.tx.outs.length;
  return this.inputs.every(function (input) {
    if (input.signatures === undefined) return true;
    return input.signatures.every(function (signature) {
      if (!signature) return true;
      var hashType = signatureHashType(signature);
      var hashTypeMod = hashType & 0x1f;
      if (hashTypeMod === transaction.SIGHASH_NONE) return true;
      if (hashTypeMod === transaction.SIGHASH_SINGLE) {
        return nInputs <= nOutputs;
      }
    });
  });
};
TransactionBuilder.prototype.__overMaximumFees = function (bytes) {
  var incoming = this.inputs.reduce(function (a, x) {
    return a + (x.value >>> 0);
  }, 0);
  var outgoing = this.tx.outs.reduce(function (a, x) {
    return a + x.value;
  }, 0);
  var fee = incoming - outgoing;
  var feeRate = fee / bytes;
  return feeRate > this.maximumFeeRate;
};
var transaction_builder = TransactionBuilder;

for (var key in templates) {
  script[key] = templates[key];
}
var src = {
  bufferutils: bufferutils,
  Block: block,
  ECPair: ecpair,
  ECSignature: ecsignature,
  HDNode: hdnode,
  Transaction: transaction,
  TransactionBuilder: transaction_builder,
  address: address,
  crypto: crypto,
  networks: networks$1,
  opcodes: ops,
  script: script
};

const { ECPair } = src;
const { encode: encode$1, decode } = bs58;
const networks = {
  cryptocoin: {
    messagePrefix: `\u0019Cryptocoin Signed Message:`,
    pubKeyHash: 121,
    scriptHash: 127,
    wif: 244,
    bip32: { public: 33108450, private: 33107450 }
  },
  olivia: {
    messagePrefix: `\u0019Olivia Signed Message:`,
    pubKeyHash: 115,
    scriptHash: 126,
    wif: 245,
    bip32: { public: 33108400, private: 33107350 }
  }
};
class CryptoWallet extends store_1 {
  constructor(keys = {}, secret = null) {
    super('hex');
    this.secret = secret;
    this.private = keys.private;
    this.public = keys.public;
  }
  get _jsonWallet() {
    return JSON.stringify({
      private: this.private,
      public: this.public
    });
  }
  lock(secret) {
    return encrypt(this._jsonWallet, secret).then(cipher => this._cipher = cipher);
  }
  unlock(secret) {
    return decrypt(this._cipher, secret).then(data => JSON.parse(data));
  }
  _updateKeyPair(keyPair) {
    this.wif = keyPair.toWIF();
    this.address = keyPair.getAddress();
    return { wif: this.wif, address: this.address };
  }
  _createRandomAddress() {
    const keyPair = ECPair.makeRandom({
      network: networks['olivia'],
      rng: () => Buffer.from(browser$5(32))
    });
    return this._updateKeyPair(keyPair);
  }
  _createAddressFromHash(hash) {
    if (!hash) {
      return console.warn(`SHA256 hash required`);
    }
    const big = bigi.fromBuffer(hash);
    const keyPair = new ECPair(big);
    return this._updateKeyPair(keyPair);
  }
  new(hash) {
    if (hash) {
      return this._createAddressFromHash(hash);
    }
    return this._createRandomAddress();
  }
  import(wif) {
    this.wif = wif;
    this.address = ECPair.fromWIF(wif, networks['olivia']).getAddress();
  }
  send() {
    if (!this.private && this.wif) {
      this.private = decode(this.wif).toString('hex');
    } else if (this.private && this.public) {
    } else {
      throw new Error('Invalid wallet: you should check you address and private key');
    }
  }
}

exports.CryptoWallet = CryptoWallet;


}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"_process":4,"buffer":2}]},{},[5])(5)
});