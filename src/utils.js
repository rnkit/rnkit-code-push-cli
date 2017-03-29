import * as path from 'path'
import * as fs from 'fs'
import ApkReader from 'node-apk-parser'
import ipaMetadata from 'ipa-metadata'

const read = require('read')

export function question (query, password) {
  return new Promise((resolve, reject) => read({
    prompt: query,
    silent: password,
    replace: password ? '*' : undefined
  }, (err, result) => err ? reject(err) : resolve(result)))
}

export function translateOptions (options) {
  const ret = {}
  for (const key in options) {
    const v = options[key]
    if (typeof (v) === 'string') {
      ret[key] = v.replace(/\$\{(\w+)\}/g, (v, n) => options[n] || process.env[n] || v)
    } else {
      ret[key] = v
    }
  }
  return ret
}

// return { version: '0.27.2', major: 0, minor: 27 }
export function getRNVersion () {
  const version = JSON.parse(fs.readFileSync(path.resolve('node_modules/react-native/package.json'))).version

  // We only care about major and minor version.
  const match = /^(\d+)\.(\d+)\./.exec(version)
  return {
    version,
    major: match[1] | 0,
    minor: match[2] | 0
  }
}

export function getApkVersion (fn) {
  const reader = ApkReader.readFile(fn)
  const manifest = reader.readManifestSync()
  return Promise.resolve(manifest.versionName)
}

export function getIPAVersion (fn) {
  return new Promise((resolve, reject) => {
    ipaMetadata(fn, (err, data) => {
      err ? reject(err) : resolve(data.metadata.CFBundleShortVersionString)
    })
  })
}
