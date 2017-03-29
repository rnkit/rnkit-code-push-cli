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

export async function getSelectedApp (platform) {
  checkPlatform(platform)

  if (!await fs.exists('rnkit-code-push.json')) {
    throw new Error(`App not selected. run 'rnkit-code-push bindApp ${platform}' first!`)
  }
  const updateInfo = JSON.parse(await fs.readFile('rnkit-code-push.json', 'utf8'))

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

export async function selectApp (appName, appKey, platform) {
  let updateInfo = {}
  if (await fs.exists('rnkit-code-push.json')) {
    try {
      updateInfo = JSON.parse(await fs.readFile('rnkit-code-push.json', 'utf8'))
    } catch (e) {
      console.error('Failed to parse file `rnkit-code-push.json`. Try to remove it manually.')
      throw e
    }
  }
  updateInfo[platform] = {
    appName,
    appKey
  }
  await fs.writeFile('rnkit-code-push.json', JSON.stringify(updateInfo, null, 4), 'utf8')
}
