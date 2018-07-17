const {
  post,
  get,
  replaceToken,
  saveToken,
  closeToken
} = require('./api')
const crypto = require('crypto')
import colors from 'colors'
import Table from 'cli-table3'

function md5 (str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

export async function login (loginName, password) {
  const { token, user } = await post('/auth/login', {
    loginName,
    password: md5(password)
  })
  replaceToken({ token })
  await saveToken()
  console.log(colors.blue(`Hi, ${user.name}.`))
}

export async function me () {
  const me = await get('/auth/me')

  const table = new Table({
    colWidths: [12, 30]
  })
  for (const k in me) {
    table.push(
      [`${k}`, `${me[k]}`],
    )
  }
  console.log(colors.green(table.toString()))
}

export async function logout () {
  await post('/auth/logout')
  closeToken()
  console.log('Logged out.')
}
