import colors from 'colors'
import inquire from './inquire'
const {
  get,
  post,
  uploadFile
} = require('./api')
import { getSelectedApp } from './app'
import { getIPAVersion, getApkVersion } from './utils'

export async function listPackage (app_key) {
  const { data } = await get(`/package/list?app_key=${app_key}`)
  // console.log(data);
  return data
}

export async function choosePackage (appId) {
  const list = await listPackage(appId)
  const packages = list.map((pack, index) => `AppVerion: ${colors.blue(pack.app_version)} > PackageName: ${colors.blue(pack.name)}`)
  const bind_packages_result = await inquire.list('checkbox', 'Please Choose Bind Packages :', packages)
  const package_keys = []
  bind_packages_result.index.forEach((index) => {
    package_keys.push(list[index].key)
  })
  return package_keys.join(',')
}

export async function uploadIpa(filePath, app_key_path) {
  if (!filePath) {
    throw new Error('Usage: rnkit-code-push uploadIpa <ipaFile>')
  }
  const app_version = await getIPAVersion(filePath)
  const { appKey } = await getSelectedApp('ios', app_key_path)

  const { hash, name } = await uploadFile(filePath)

  await post('/package/then_add', {
    app_key: appKey,
    hash,
    file_name: name,
    app_version: app_version,
    name: app_version
  })
  console.log('Ipa uploaded')
}

export async function uploadApk(filePath, app_key_path) {
  if (!filePath) {
    throw new Error('Usage: rnkit-code-push uploadApk <ipaFile>')
  }
  const app_version = await getApkVersion(filePath)
  const { appKey } = await getSelectedApp('android', app_key_path)

  const { hash, name } = await uploadFile(filePath)

  await post('/package/then_add', {
    app_key: appKey,
    hash,
    file_name: name,
    app_version: app_version,
    name: app_version
  })
  console.log('Ipa uploaded')
}

export async function deployment(platform, app_key_path) {
  const { appKey } = await getSelectedApp(platform, app_key_path)

  const { data } = await get(`/version/list?app_key=${appKey}`)
  const version_result = await inquire.list('rawlist', 'Please Choose Version :', data.map(obj => obj.name))

  const packages = await choosePackage(appKey)

  await post('/package/add_version', {
    version_key: data[version_result.index].key,
    package_key: packages
  })
  console.log(colors.green('Bind Packages Is Success!'))
}
