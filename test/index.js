var path = require('path')
var fs = require('fs')
var yaml = require('js-yaml')
var parser = require('../')

var commands = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'commands.yaml')))

Object.keys(commands).forEach(function (key) {
  exports[key] = function (test) {
    test.expect(1)

    var args = key.split(' ')
    // multi word commands
    var command = args.shift().replace('-', ' ')
    var expect = commands[key]

    var commandParser = new parser.RedisCommand(command, args)
    test.deepEqual(commandParser.parseInputs(args), expect)

    test.done()
  }
})
