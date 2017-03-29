/**
 * Module dependencies
 */

const _ = require('lodash')
const program = require('commander')
import asciify from 'asciify'
import colors from 'colors'

program.Command.prototype.usageMinusWildcard = program.usageMinusWildcard = function () {
  program.commands = _.reject(program.commands, {
    _name: '*'
  })
  program.help()
}

program.Command.prototype.versionInformation = program.versionInformation = function () {
  program.emit('version')
}

if (!process.argv.slice(2).length) {
  (async () => {
    let str = colors.bold(await outLogo()) + colors.blue(`  version: ${require('../package.json').version}\n`)
    program.outputHelp(() => str)
  })()
}

async function outLogo () {
  return new Promise((resolve, reject) => {
    asciify('RNKit Code Push', { font: 'ivrit' }, (err, res) => {
      if (err) {
        reject(err)
      }
      resolve(res)
    })
  })
}

module.exports = program
