import path from 'path'
import colors from 'colors'
import validator from 'validator'
import Table from 'cli-table2'
import open from 'open'
const _ = require('lodash')
import inquirer from 'inquirer'

import {
  loadToken
} from './api'
import {
  login,
  logout,
  me
} from './user'
import {
  listApp,
  selectApp,
  checkPlatform,
  getSelectedApp
} from './app'
import {
  uploadIpa,
  listPackage,
  uploadApk,
  deployment
} from './package'
import {
  listVersions,
  publish
} from './versions'
import {
  bundleApp
} from './bundle'
const program = require('./_commander')
const NOOP = function () {}

const PACKAGE_JSON_PATH = function () {
  return path.resolve(
    process.cwd(),
    'package.json',
  )
}

// 获取并检查 react-native 项目依赖
let rn_version
try {
  const package_info = require(PACKAGE_JSON_PATH())
  rn_version = package_info.dependencies['react-native']
  if (!rn_version) {
    throw new Error('not found react-native dependencies')
  }
} catch (e) {
  console.log(colors.green('rnkit-code-push: ') + colors.red('没找到React-Native配置信息, 请切换至RN项目目录运行此命令!'))
  console.error(colors.red(e))
  process.exit(1)
}

const cmd = () => {
  program
    .version(require('../package.json').version, '-v, --version')
  process.argv = _.map(process.argv, arg => (arg === '-V') ? '-v' : arg)

  const lastArg = _.last(process.argv)
  if (lastArg === 'app' || lastArg === 'bundle' || lastArg === 'publish') {
    process.argv.push('-h')
  }

  program
    .command('login')
    .description('Authenticate with the rnkit-code-push server in order to begin managing your apps')
    .action(() => {
      inquirer.prompt([{
        type: 'input',
        message: 'Enter your email',
        name: 'email',
        validate: (value) => {
          const pass = validator.isEmail(value)
          if (pass) {
            return true
          }
          return 'Please enter a valid email'
        }
      },
      {
        type: 'password',
        message: 'Enter your password',
        name: 'password',
        validate: (value) => {
          const pass = value.length >= 6
          if (pass) {
            return true
          }
          return 'Please enter a valid password (6-20)'
        }
      }
      ]).then(async(answers) => {
        const {
          email,
          password
        } = answers
        try {
          await login(email, password)
        } catch (error) {
          console.log(error.message)
        }
      })
    })

  program
    .command('register')
    .description('Register a new rnkit-code-push account')
    .action(async() => {
      open('https://update.rnkit.io')
      process.exit(-1)
    })

  program
    .command('logout')
    .description('Log out of the current session')
    .action(async() => {
      try {
        await logout()
      } catch (error) {
        console.log(error)
      }
    })

  program
    .command('whoami')
    .description('Display the account info for the current login session')
    .action(async() => {
      try {
        await me()
      } catch (error) {
        console.log(error)
      }
    })

  program
    .command('app')
    .option('list', 'Lists the apps associated with your account')
    .option('ls', 'Lists the apps associated with your account')
    .description('View and manage your rnkit-code-push apps')
    .action(async(arg) => {
      if (arg === 'list' || arg === 'ls') {
        try {
          const data = await listApp()
          const table = new Table({
            head: ['AppName', 'Platform', 'AppIdentifier', 'AppKey', 'CreatedAt']
          })
          for (const k in data) {
            const platform = data[k].platform === 1 ? 'ios' : 'android'
            table.push(
              [`${data[k].name}`, `${platform}`, `${data[k].app_identifier}`, `${data[k].key}`, `${data[k].created_at}`],
            )
          }
          console.log(`\nTotal ${data.length} apps`)
          console.log(colors.green(table.toString()))
        } catch (error) {
          console.log(error)
        }
      }
    })
    .parse(process.argv)

  program
    .command('bindApp <platform>')
    .description('The binding is applied to the current project with platform')
    .action(async(platform) => {
      try {
        const result = checkPlatform(platform)
        const data = await listApp(result === 'ios' ? 1 : 2)
        if (!data.length) {
          console.log(`You Don't An App For ${platform} platform`)
          process.exit(-1)
        }
        const list = []
        for (const k in data) {
          list.push({
            name: data[k].name
          })
        }
        inquirer.prompt([{
          type: 'rawlist',
          name: 'app',
          message: 'Please Choose App :',
          choices: list
        } ]).then(async(answers) => {
          try {
            const obj = data.find(v => v.name === answers.app)
            await selectApp(obj.name, obj.key, platform)
            console.log(`You choose: ${obj.name}`)
          } catch (error) {
            console.log(colors.red(error.message))
          }
        })
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })
    .parse(process.argv)

  program
    .command('uploadIpa <ipaFilePath>')
    .description('upload ios ipa file to rnkit code push server')
    .action(async(ipaFilePath) => {
      try {
        await uploadIpa(ipaFilePath)
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('uploadApk <apkFilePath>')
    .description('upload android apk file to rnkit code push server')
    .action(async(apkFilePath) => {
      try {
        await uploadApk(apkFilePath)
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('packages <platform>')
    .description('View the packages for a running app')
    .action(async(platform) => {
      try {
        await checkPlatform(platform)
        const app_info = await getSelectedApp(platform)
        const data = await listPackage(app_info.appKey)
        const table = new Table({
          head: ['name', 'app_version', 'platform', 'key', 'bind_version', 'created_at']
        })
        for (const k in data) {
          const version = data[k].version.map((obj, index) => obj.name)
          const platform = data[k].platform === 1 ? 'ios' : 'android'
          table.push(
            [`${data[k].name}`, `${data[k].app_version}`, `${platform}`, `${data[k].key}`, `${version}`, `${data[k].created_at}`],
          )
        }
        console.log(`\nTotal ${data.length} packages.`)
        console.log(colors.green(table.toString()))
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('versions <platform>')
    .description('View the versions for a running app')
    .action(async(platform) => {
      try {
        await checkPlatform(platform)
        const app_info = await getSelectedApp(platform)
        await listVersions(app_info.appKey)
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('publish')
    .description('publish version to rnkit-code-push')
    .option('-p --platform <platform>', 'platform ios|android')
    .option('-f --ppkFile <ppkFile>', 'ppkFile Path')
    .on('--help', () => {
      console.log(colors.bold('  Examples:'))
      console.log('')
      console.log(colors.magenta('  $rnkit-code-push --platform ios --ppkFile /data/my-app/build/output/android.xxxxx.ppk'))
      console.log('')
    })
    .action(async(args) => {
      try {
        await publish(args)
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('deployment')
    .description('deployment version to packages')
    .option('-p --platform <platform>', 'platform ios|android')
    .action(async(args) => {
      try {
        await deployment(args.platform)
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('bundle')
    .description('builds the javascript bundle for offline use')
    .option('--dev <dev>', 'If false, warnings are disabled and the bundle is minified')
    .option('--platform <platform>', 'Either "ios" or "android"')
    .option('--entryFile <entryFile>', 'Path to the root JS file, either absolute or relative to JS root')
    .option('--output <output>', 'File name where to store the resulting bundle, ex. /tmp/groups.bundle')
    .option('--intermediaDir <intermediaDir>', 'tmp file out dir')
    .option('--verbose <verbose>', 'Enables logging')
    .action(async(args) => {
      try {
        await bundleApp(args)
      } catch (error) {
        console.log(colors.red(error.message))
      }
    })

  program
    .command('web')
    .description('open rnkit-code-push website')
    .action(() => {
      open('https://update.rnkit.io')
      process.exit(-1)
    })

  program.unknownOption = NOOP
  program.parse(process.argv)
  const NO_COMMAND_SPECIFIED = program.args.length === 0
  if (NO_COMMAND_SPECIFIED) {
    program.usageMinusWildcard()
  }
}

loadToken()
  .then(() => {
    cmd()
  })
  .catch((err) => {
    if (err.status === 401) {
      console.log('Not loggined.\nRun `rnkit-code-push login` at your project directory to login.')
      return
    }
    console.error(err.message)
    process.exit(-1)
  })
