var path = require('path')
var fs = require('fs')
var yaml = require('js-yaml')
var parser = require('../')

var commands = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'commands.yaml')))

Object.keys(commands).forEach(function (key) {
  var args = key.split(' ')
  // multi word commands
  var command = args.shift().replace('-', ' ')
  var expect = commands[key]

  exports[key] = function (test) {
    test.expect(1)

    var commandParser = new parser.RedisCommand(command)
    test.deepEqual(commandParser.parseInputs(args), expect)

    test.done()
  }

  exports['↑ ' + key] = function (test) {
    test.expect(1)

    var commandParser = new parser.RedisCommand(command.toUpperCase())
    test.deepEqual(commandParser.parseInputs(args), expect)

    test.done()
  }
})

exports.unknownCommand = function (test) {
  test.expect(1)
  var commandParser = new parser.RedisCommand('FAKE')
  test.deepEqual(commandParser.parseInputs(['foo', 'bar']), [undefined, undefined])
  test.done()
}
