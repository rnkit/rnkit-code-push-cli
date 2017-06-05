import inquirer from 'inquirer'
const _ = require('lodash')

async function list (type, message, rawData) {
  const { value } = await inquirer.prompt([
    {
      type,
      name: 'value',
      message,
      choices: rawData
    }
  ])

  if (_.isArray(value)) {
    const indexs = []
    for (const val of value) {
      indexs.push(
        rawData.indexOf(val),
      )
    }
    return {
      index: indexs, // .join(','),
      value
    }
  }

  return {
    index: rawData.indexOf(value),
    value
  }
}

export default { list }
