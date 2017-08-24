/**
 * Created by tdzl2003 on 2/13/16.
 */

import { question } from './utils'
import * as fs from 'fs-promise'
const {
  get
} = require('./api')

const validPlatforms = {
  ios: 1,
  android: 1
}

export function checkPlatform (platform) {
  if (!validPlatforms[platform]) {
    throw new Error(`Invalid platform '${platform}'`)
  }
  return platform
}

export async function getSelectedApp(platform, app_key_path) {
  checkPlatform(platform)

  if (!app_key_path) app_key_path = 'rnkit-code-push.json';

  if (!await fs.exists(app_key_path)) {
    throw new Error(`App not selected. run 'rnkit-code-push bindApp ${platform}' first!`)
  }
  const updateInfo = JSON.parse(await fs.readFile(app_key_path, 'utf8'))

  if (!updateInfo[platform]) {
    throw new Error(`App not selected. run 'rnkit-code-push bindApp ${platform}' first!`)
  }
  return updateInfo[platform]
}

export async function listApp (platform = '') {
  const { data } = await get(`/app/list?page_size=20&platform=${platform}`)
  return data
}

export async function chooseApp (platform) {
  const list = await listApp(platform)

  while (true) {
    const id = await question('Enter appId:')
    const app = list.find(v => v.id === (id | 0))
    if (app) {
      return app
    }
  }
}

export async function selectApp(appName, appKey, platform, app_key_path) {
  let updateInfo = {}
  if (!app_key_path) app_key_path = 'rnkit-code-push.json';
  if (await fs.exists(app_key_path)) {
    try {
      updateInfo = JSON.parse(await fs.readFile(app_key_path, 'utf8'))
    } catch (e) {
      console.error('Failed to parse file `' + app_key_path + '`. Try to remove it manually.')
      throw e
    }
  }
  updateInfo[platform] = {
    appName,
    appKey
  }
  await fs.writeFile(app_key_path, JSON.stringify(updateInfo, null, 4), 'utf8')
}
