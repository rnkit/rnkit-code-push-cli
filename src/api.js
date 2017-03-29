const fetch = require('isomorphic-fetch')
let host = process.env.RNKIT_CODE_PUSH_HOST || 'https://update.rnkit.io/api/v1'
const fs = require('fs-promise')
import * as fsOrigin from 'fs'
import request from 'request'
import ProgressBar from 'progress'
import colors from 'colors'
import querystring from 'querystring'

let Token
let savedToken

export async function loadToken () {
  if (await fs.exists('.update')) {
    try {
      replaceToken(JSON.parse(await fs.readFile('.update', 'utf8')))
      savedToken = Token
    } catch (e) {
      console.error('Failed to parse file `.update`. Try to remove it manually.')
      throw e
    }
  }
}

export function getToken () {
  return Token
}

export function replaceToken (newToken) {
  Token = newToken
}

export async function saveToken () {
  if (Token !== savedToken) {
    const current = Token
    const data = JSON.stringify(current, null, 4)
    await fs.writeFile('.update', data, 'utf8')
    savedToken = current
  }
}

export async function closeToken () {
  if (await fs.exists('.update')) {
    await fs.unlink('.update')
    savedToken = undefined
  }
  Token = undefined
  host = process.env.RNKIT_CODE_PUSH_HOST || 'https://update.rnkit.io/v1/api/'
}

async function query (url, options) {
  const resp = await fetch(url, options)
  const json = await resp.json()
  if (json.errno === 401) {
    console.log(colors.red('Not loggined.'))
    console.log('Run `rnkit-code-push login` at your project directory to login.')
    process.exit(1)
  } else if (json.errno !== 0) {
    throw new Error(colors.red(`errno:${json.errno}  msg:${JSON.stringify(json.errmsg)}`))
  }
  return json.data
}

function queryWithoutBody (method) {
  return function (api) {
    return query(host + api, {
      method,
      headers: {
        'X-Authorization': Token ? Token.token : ''
      }
    })
  }
}

function queryWithBody (method) {
  return function (api, body) {
    return query(host + api, {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': Token ? Token.token : ''
      },
      body: querystring.stringify(body)
    })
  }
}

exports.get = queryWithoutBody('GET')
exports.post = queryWithBody('POST')
exports.put = queryWithBody('PUT')
exports.doDelete = queryWithBody('DELETE')

async function uploadFile (fn) {
  const { token, up_host } = await exports.post('/file/token', {})
  const realUrl = up_host
  const formData = {
    token,
    accept: 'application/json'
  }

  const fileSize = (await fs.stat(fn)).size

  const bar = new ProgressBar('  Uploading [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    total: fileSize
  })

  const info = await new Promise((resolve, reject) => {
    formData.file = fsOrigin.createReadStream(fn)

    formData.file.on('data', (data) => {
      bar.tick(data.length)
    })
    request.post(realUrl, {
      formData
    }, (err, resp, body) => {
      if (err) {
        return reject(err)
      }
      if (resp.statusCode > 299) {
        return reject(Object.assign(new Error(body), { status: resp.statusCode }))
      }
      resolve(JSON.parse(body))
    })
  })
  return info
}

exports.uploadFile = uploadFile
