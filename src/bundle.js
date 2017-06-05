import * as path from 'path'
import { mkdir as mkdirRecurisve } from 'mkdir-recursive'
import rmdirRecursive from 'rimraf'
import inquirer from 'inquirer'
import colors from 'colors'
var child_process = require('child_process')
import {
  getRNVersion,
  getRNPackage
} from './utils'
import * as fs from 'fs'
import { ZipFile } from 'yazl'
import { checkPlatform } from './app'
import { publish } from './versions'

function mkdir (dir) {
  return new Promise((resolve, reject) => {
    mkdirRecurisve(dir, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

function rmdir (dir) {
  return new Promise((resolve, reject) => {
    rmdirRecursive(dir, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

async function pack (dir, output) {
  await mkdir(path.dirname(output))
  await new Promise((resolve, reject) => {
    const zipfile = new ZipFile()

    function addDirectory (root, rel) {
      if (rel) {
        zipfile.addEmptyDirectory(rel)
      }
      const childs = fs.readdirSync(root)
      for (const name of childs) {
        if (name === '.' || name === '..') {
          continue
        }
        const fullPath = path.join(root, name)
        const stat = fs.statSync(fullPath)
        if (stat.isFile()) {
          // console.log('adding: ' + rel+name);
          zipfile.addFile(fullPath, rel + name)
        } else if (stat.isDirectory()) {
          // console.log('adding: ' + rel+name+'/');
          addDirectory(fullPath, `${rel + name}/`)
        }
      }
    }

    addDirectory(dir, '')

    zipfile.outputStream.on('error', err => reject(err))
    zipfile.outputStream.pipe(fs.createWriteStream(output))
      .on('close', () => {
        resolve()
      })
    zipfile.end()
  })
  console.log(`Bundled saved to: ${output}`)
}

export async function bundleApp (options) {
  const platform = checkPlatform(options.platform)

  let {
    dev, entryFile, output, intermediaDir
  } = options

  if (platform === 'ios' && !entryFile) {
    entryFile = 'index.ios.js'
  } else if (platform === 'android' && !entryFile) {
    entryFile = 'index.android.js'
  }

  if (!intermediaDir) {
    intermediaDir = `build/intermedia/${platform}`
  }

  if (!output) {
    const time = Date.now()
    output = `build/output/${platform}.${time}.ppk`
  }

  const realIntermedia = path.resolve(intermediaDir)

  const realOutput = output

  const { version } = getRNVersion()

  const rnpkgInfo = getRNPackage()
  const pkgrnVersion = rnpkgInfo['dependencies']['react-native']

  if (version !== pkgrnVersion) {
    console.log(colors.red(`node_modules/react-native/package.json version: ${version}\nis not eq\npackage rn version: ${pkgrnVersion}`))
  }

  console.log(colors.green('Bundling with React Native version: ', version))
  await rmdir(realIntermedia)
  await mkdir(realIntermedia)

  let reactNativeBundleArgs = []

  Array.prototype.push.apply(reactNativeBundleArgs, [
    path.join('node_modules', 'react-native', 'local-cli', 'cli.js'), 'bundle',
    '--platform', platform,
    '--entry-file', entryFile,
    '--assets-dest', intermediaDir,
    '--bundle-output', path.join(intermediaDir, 'index.bundlejs'),
    '--dev', dev === true
  ])

  var reactNativeBundleProcess = child_process.spawn('node', reactNativeBundleArgs)
  console.log(`node ${reactNativeBundleArgs.join(' ')}`)

  async function reactNativeBundle () {
    return new Promise((resolve, reject) => {
      reactNativeBundleProcess.stdout.on('data', (data) => {
        console.log(data.toString().trim())
      })

      reactNativeBundleProcess.stderr.on('data', (data) => {
        console.error(data.toString().trim())
      })

      reactNativeBundleProcess.on('close', (exitCode) => {
        if (exitCode) {
          console.log(colors.red(`"react-native bundle" command exited with code ${exitCode}.`))
          reject(new Error(`"react-native bundle" command exited with code ${exitCode}.`))
        }
        resolve(null)
      })
    })
  }
  await reactNativeBundle()

  console.log(colors.green('Packing'))
  await pack(realIntermedia, realOutput)

  const { isPublish } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isPublish',
      message: 'Would you like to publish it?',
      default: false
    }
  ])

  if (isPublish) {
    console.log(colors.green('Publish'))
    await publish({ platform, ppkFile: realOutput })
  }
}
