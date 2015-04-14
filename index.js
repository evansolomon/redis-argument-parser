var commands = require('./redis-commands')

module.exports.RedisCommand = RedisCommand

function RedisCommand(name) {
  this.name = name
  var command = commands[name.toUpperCase()]
  if (! command) {
    console.error('Unknown Redis command: ' + name)
    command = {}
  }

  this.signatures = (command.arguments || []).map(function (props) {
    return new ArgumentSignature(props)
  })
}

RedisCommand.prototype.parseInputs = function (inputs) {
  var results = []
  var iterations = 0
  var inputIndex = 0
  var minSignatureIndex = 0
  var foundNumKeysArgument = false
  var cachedNumKeys = null
  var numKeysRemaining = null
  var next

  while (results.length < inputs.length && iterations < inputs.length) {
    // Sanity check
    iterations++

    // Parse out the next chunk of arguments
    next = this.findNextChunk(inputs.slice(inputIndex), minSignatureIndex, cachedNumKeys)

    // Sometimes we need to jump ahead multiple (or 0) chunks
    minSignatureIndex += next.signatureChunksUsed

    // Keep track of state in a specified number of key arguments
    if (!! next.numKeysToCome) {
      foundNumKeysArgument = true
      cachedNumKeys = next.numKeysToCome
      numKeysRemaining = next.numKeysToCome
    } else if (numKeysRemaining) {
      numKeysRemaining--

      // We know this is the end of a chunk of keys, so push our signature chunk counter ahead 1
      if (numKeysRemaining === 0) {
        minSignatureIndex++
        numKeysRemaining = null
      }
    } else if (next.isVariadic) {
      numKeysRemaining = cachedNumKeys
    }

    // Sometimes multiple inputs are a part of a single chunk
    inputIndex += next.types.length

    next.types.forEach(function (type) {
      results.push(type)
    })
  }

  return results
}

RedisCommand.prototype.findNextChunk = function (remainingInputs, minSignatureIndex, variadicCount) {
  var lastSignatureChunkDefinitelyFinished = false
  var numKeysToCome = null
  var signatureChunksUsed
  var types
  var isVariadic

  var i = minSignatureIndex
  var remainingSignatures = this.signatures.slice(minSignatureIndex)
  var remainingRequiredArgs = remainingSignatures.filter(function (signature) {
    return ! signature.desc.optional
  })

  // Required args after multiple args
  var remainingRequiredArgsCount = remainingRequiredArgs.reduce(function (memo, arg) {
    memo += arg.desc.count
    return memo
  }, 0)
  if (remainingRequiredArgsCount > remainingInputs.length) {
    i = i + remainingRequiredArgsCount - remainingInputs.length
  }

  for (; i < this.signatures.length; i++) {
    if (! this.signatures[i].test(remainingInputs, variadicCount)) continue

    // If this one is optional, see if we should actually match a later command argument
    if (this.signatures[i].desc.optional && ! this.signatures[i].desc.command) {
      var commandArgChunk
      for (var ci = i; ci < this.signatures.length; ci++) {
        if (! this.signatures[ci].desc.command) continue

        if (! this.signatures[ci].test(remainingInputs, variadicCount)) continue

        minSignatureIndex = ci
        return this.findNextChunk(remainingInputs, minSignatureIndex, variadicCount)
      }
    }

    types = this.signatures[i].desc.type

    if (this.signatures[i].desc.command) {
      types = [ArgumentSignature.extraTypes.KEYWORD].concat(types)
    }

    signatureChunksUsed = i - minSignatureIndex

    // Last chunk is definitely finished unless it's a multiple argument
    if (! this.signatures[i].desc.multiple) {
      signatureChunksUsed++
    }

    // Some call signatures specifically state how many keys will be used
    if (this.signatures[i].props.name === 'numkeys' && this.signatures[i].props.type === 'integer') {
      numKeysToCome = parseInt(remainingInputs[0], 10)
    }

    isVariadic = !! this.signatures[i].props.variadic

    break
  }


  return {
    signatureChunksUsed: signatureChunksUsed,
    types: Array.isArray(types) ? types : [types],
    numKeysToCome: numKeysToCome,
    isVariadic: isVariadic
  }
}



function ArgumentSignature(props) {
  this.props = props
  this.desc = {
    count: Array.isArray(this.props.type) ? this.props.type.length : 1,
    optional: !! this.props.optional,
    command: !! this.props.command,
    multiple: !! this.props.multiple,
    enum: !! this.props.enum,
    variadic: !! this.props.variadic,
    type: [].concat(this.props.type)
  }

  // Add 1 for command keyword
  if (this.desc.command) {
    this.desc.count++
  }
}

ArgumentSignature.extraTypes = {
  KEYWORD: 'keyword'
}

ArgumentSignature.prototype.test = function (inputs, variadicCount) {
  // Figure out variadic argument count at runtime
  if (this.desc.variadic) {
    this.desc.count = variadicCount
    for (var i = 1; i < variadicCount; i++) {
      this.desc.type.push(this.desc.type[0])
    }
  }

  // This argument is required so by definition this input has to be it
  if (! this.desc.optional) return inputs.length >= this.desc.count

  if (this.desc.command && this.desc.enum) {
    // Slice 1 off of inputs to allow for command keyword
    return this.isCommand(inputs) && this.isEnum(inputs.slice(1))
  }

  if (this.desc.command) {
    return this.isCommand(inputs)
  }

  if (this.desc.enum) {
    return this.isEnum(inputs)
  }

  // At this point anything is a match as long as it has enough inputs
  return inputs.length >= this.desc.count
}

ArgumentSignature.prototype.isCommand = function (inputs) {
  // The first part of a command-style input must match the command's keyword
  // Require one more input than the spec to allow for the command's keyword
  return inputs[0].toString().toUpperCase() === this.props.command && inputs.length >= this.desc.count
}

ArgumentSignature.prototype.isEnum = function (inputs) {
  // Enum's only have one value and must have a valid input
  return this.props.enum.map(function (e) {
    return e.toUpperCase()
  }).indexOf(inputs[0].toString().toUpperCase()) > -1
}
