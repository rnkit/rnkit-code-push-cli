import Table from 'cli-table3'
import colors from 'colors'
import moment from 'moment'
import validator from 'validator'
import fs from 'fs'
import inquirer from 'inquirer'
import _ from 'lodash'

const {
  get,
  post,
  uploadFile
} = require('./api')
import { question } from './utils'
import { checkPlatform, getSelectedApp } from './app'
import { choosePackage } from './package'
import inquire from './inquire'

async function showVersion (appId, offset) {
  console.log(`request page ${offset}`)
  const { data } = await get(`/version/list?app_key=${appId}&page=${offset}`)
  console.log(`Offset ${offset}`)
  const table = new Table({
    head: ['name', 'release_type', 'is_mandatory', 'is_silent', 'meta_info', 'created_at']
  })
  for (const k in data) {
    table.push(
      [`${data[k].name}`, `${data[k].release_type}`, `${data[k].is_mandatory}`, `${data[k].is_silent}`, `${data[k].meta_info}`, `${data[k].created_at}`],
    )
  }
  console.log(`\nTotal ${data.length} packages.`)
  console.log(colors.green(table.toString()))
  return data
}

export async function listVersions (appId) {
  let offset = 0
  while (true) {
    await showVersion(appId, offset)
    const cmd = await question('page Up/page Down/Begin/Quit(U/D/B/Q)')
    switch (cmd.toLowerCase()) {
      case 'u': offset = Math.max(0, offset - 1); break
      case 'd': offset += 1; break
      case 'b': offset = 0; break
      case 'q': return
    }
  }
}

async function getVersionOptions () {
  const options = {}
  const { name } = await inquirer.prompt([{
    type: 'input',
    name: 'name',
    default: moment().format('YYYYMMDDHHmmss'),
    message: 'Please Input Version Name :'
  }])
  options.name = name

  const release_type_result = await inquire.list('rawlist', 'Please Choose Release Type :', [
    'Development',
    'FullReleased',
    'GrayReleased',
    'ConditionsReleased'
  ])
  options.release_type = _.parseInt(release_type_result.index) + 1

  // 灰度下发
  if (release_type_result.index === 2) {
    const gray_type_result = await inquire.list('rawlist', 'Please Choose Gray Type :', ['Percent', 'Count'])
    options.gray_type = _.parseInt(gray_type_result.index)
    if (gray_type_result.index === 0) {
      const gray_percent_result = await inquire.list('list', 'The percentage :', ['10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%'])
      options.gray_percent = _.parseInt(gray_percent_result.index) + 1
    } else if (gray_type_result.index === 1) {
      const { gray_count } = await inquirer.prompt([{
        type: 'input',
        name: 'gray_count',
        default: 100,
        message: 'Please Input Gray Count Num : (eg: 100)',
        validate (input) {
          const done = this.async()
          if (validator.isNumeric(input)) {
            done(null, true)
          } else {
            console.log(colors.red('You need to provide a number'))
          }
        }
      }])
      options.gray_count = _.parseInt(gray_count)
    }
  // 条件下发
  } else if (release_type_result.index === 3) {
    const { condition } = await inquirer.prompt([{
      type: 'input',
      name: 'condition',
      message: 'Please Input Release Condition : (eg: ios>=9)'
    }])
    options.condition = condition
  }

  const { is_mandatory } = await inquirer.prompt([{
    type: 'confirm',
    name: 'is_mandatory',
    message: 'This Version Is Mandatory?',
    default: false
  }])
  options.is_mandatory = is_mandatory ? 1 : 0

  if (!is_mandatory) {
    const { is_silent } = await inquirer.prompt([{
      type: 'confirm',
      name: 'is_silent',
      message: 'This Version Is Silent?',
      default: false
    }])
    options.is_silent = is_silent ? 1 : 0
  }

  const { description } = await inquirer.prompt([{
    type: 'input',
    name: 'description',
    message: 'This Version Release Description: '
  }])
  description ? options.description = description : null

  const { meta_info } = await inquirer.prompt([{
    type: 'input',
    name: 'meta_info',
    message: 'This Version Release meta_info: ',
    validate (input) {
      const done = this.async()
      if (!input) {
        done(null, true)
        return
      }
      if (!validator.isJSON(input)) {
        console.log(colors.red('You need to provide a JSON'))
      } else {
        done(null, true)
      }
    }
  }])
  meta_info ? options.meta_info = meta_info : null

  const { release_time } = await inquirer.prompt([{
    type: 'input',
    name: 'release_time',
    message: 'This Version Release Time? (eg: xxxx-xx-xx xx:xx:xx)',
    validate (input) {
      const done = this.async()
      if (!input) {
        done(null, true)
        return
      }
      if (validator.isDate(input) && moment(input).isAfter(moment().format('YYYY-MM-DD HH:mm:ss'))) {
        done(null, true)
      } else {
        console.log(colors.red('You need to provide a date, eg: xxxx-xx-xx xx:xx:xx'))
      }
    }
  }])
  release_time ? options.release_time = release_time : null

  return options
}

export async function publish (args) {
  const { platform, ppkFile, app_key_path } = args
  await checkPlatform(platform)

  if (!ppkFile) {
    throw new Error('Usage: rnkit-code-push publish <ppkFile> --platform ios|android')
  }
  fs.statSync(ppkFile)

  const options = await getVersionOptions()

  const app_info = await getSelectedApp(platform, app_key_path)

  const { hash, name } = await uploadFile(ppkFile)

  const { key } = await post('/version/create', Object.assign(options, {
    file_name: name,
    hash,
    app_key: app_info.appKey
  }))
  console.log(colors.green('Version published'))

  const { is_bind_package } = await inquirer.prompt([{
    type: 'confirm',
    name: 'is_bind_package',
    message: 'Would you like to bind packages to this version?',
    default: false
  }])
  if (is_bind_package) {
    const packages = await choosePackage(app_info.appKey)
    await post('/package/add_version', {
      version_key: key,
      package_key: packages
    })
    console.log(colors.green('Bind Packages Is Success!'))
  } else {
    process.exit(1)
  }
}
