Parse types of arguments for a Redis command.

## Usage

```js
var parser = require('redis-argument-parser')
var command = new parser.RedisCommand('mset') // or 'MSET'
var types = command.parseInputs(['k1', 1, 'k2', 2])
console.log(types)
// [ 'key', 'string', 'key', 'string' ]
```

## Todo

Handle commands with command arguments after optional arguments (e.g. `CLIENT KILL`).
