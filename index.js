require('dotenv').config()
const {
    readFile,
    writeFile,
    existsSync,
    readFileSync,
    unlink
} = require('fs')
const {
    Client,
    MessageMedia
} = require('whatsapp-web.js')
let {
    insertDataUsers,
    deleteDataUsers,
    getDataUsers,
    getAllDataUsers,
    DB
} = require('./helper/db')

const moment = require('moment-timezone')
const qrcode = require('qrcode-terminal')
const mqtt = require('mqtt')
const listen = mqtt.connect(process.env.MQTT_URL)
const resChat = require('./helper/message')
const adminNumber = `${process.env.ADMIN_NUMBER}@c.us`

const SESSION_FILE_PATH = './session.json'
let sessionCfg
if (existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH)
}

const client = new Client({
    puppeteer: {
        args: [
            '--headless',
            '--log-level=3', // fatal only
            '--start-maximized',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-web-security',
            '--disable-site-isolation-trials',
            '--no-experiments',
            '--ignore-gpu-blacklist',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--enable-features=NetworkService',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote'
        ]
    },
    session: sessionCfg
})
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.

client.initialize()

// ======================= Begin initialize WAbot

client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    qrcode.generate(qr, {
        small: true
    })
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Please Scan QR with app!`)
})

client.on('authenticated', (session) => {
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Authenticated Success.`)
    // console.log(session);
    sessionCfg = session
    writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err)
        }
    })
})

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] AUTHENTICATION FAILURE \n ${msg}`)
    unlink('./session.json', function (err) {
        if (err) return console.log(err)
        console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Session Deleted, Please Restart!`)
        process.exit(1)
    })
})

client.on('ready', async () => {
    DB = await DB()
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Whatsapp bot ready.`)
})

// ======================= Begin initialize mqtt broker

listen.on('connect', () => {
    listen.subscribe(process.env.MQTT_TOPIC, function (err) {
        if (!err) {
            console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Mqtt topic [${process.env.MQTT_TOPIC}] subscribed!`)
        }
    })
})

listen.on('message', (topic, message) => {
    // console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Message: ${message.toString()}`)
})
// ======================= WaBot Listen on Event

client.on('message_revoke_everyone', async (after, before) => {
    // Fired whenever a message is deleted by anyone (including you)
    // console.log(after); // message after it was deleted.
    if (before) {
        console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Revoked: ${before.body}`) // message before it was deleted.
    }
})

client.on('message_revoke_me', async (msg) => {
    // Fired whenever a message is only deleted in your own view.
    // console.log(msg.body); // message before it was deleted.
})

client.on('message_ack', (msg, ack) => {
    /*
          == ACK VALUES ==
          ACK_ERROR: -1
          ACK_PENDING: 0
          ACK_SERVER: 1
          ACK_DEVICE: 2
          ACK_READ: 3
          ACK_PLAYED: 4
      */

    if (ack == 3) {
        // The message was read
    }
})

client.on('group_join', async (notification) => {
    // User has joined or been added to the group.
    // console.log('join', notification)
    // notification.reply('User joined.')
    const contact = await notification.getContact()
    if (notification.chatId == `${client.info.me.user}@c.us`) {
        client.sendMessage(notification.id.remote, await resChat.Menu(contact))
    }
})

client.on('group_leave', (notification) => {
    // User has left or been kicked from the group.
    // console.log('leave', notification)
    if (notification.chatId == `${client.info.me.user}@c.us`) {
        notification.reply('User has left or been kicked from the group.')
    }
})

client.on('change_battery', (status) => {
    // battery changed and plugged status.
    try {
        if (status.battery <= 25 && !status.plugged) {
            client.sendMessage(adminNumber, 'Please charge your phone!')
        }
    } catch (err) {
        console.error(err)
    }
})

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason)
})

// ======================= WaBot Listen on message

client.on('message', async msg => {
    msg.body = msg.body.toLowerCase()
    msg.from.includes('@c.us') ? console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Message:`, msg.from.replace('@c.us', ''), `| ${msg.type}`, msg.body ? `| ${msg.body}` : '') : ''
    msg.from.includes('@g.us') ? console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Message:`, msg.from.replace('@g.us', ''), `| ${msg.type}`, msg.body ? `| ${msg.body}` : '') : ''

    if (msg.type == 'ciphertext' || msg.body == 'menu' || msg.body == 'info' || msg.body == 'corona' || msg.body == 'help' || msg.body == 'covid') {
        try {
            const chat = await msg.getChat()
            if (!chat.isGroup) {
                msg.reply('kirim !menu atau !help untuk melihat menu honk!.')
            }
        } catch (err) {
            console.error(err)
        }
    } else if (msg.body == 'halo' || msg.body == 'hai' || msg.body == 'hallo' || msg.body == 'woi') {
        const chat = await msg.getChat()
        if (!chat.isGroup) {
            msg.reply('hi 😃')
        }
    } else if (msg.body == '!msg') {
        var kontak = await await msg.getContact()
        const chat = await msg.getChat()
        if (chat.isGroup) {
            console.log(chat)
        } else {
            console.log(kontak)
            console.log(msg)
        }
    } else if (msg.body == '!ping' || msg.body == 'ping' || msg.body == 'p') {
        client.sendMessage(msg.from, 'pong')
    } else if (msg.body == '!honk' || msg.body == 'honk!' || msg.body == 'honk') {
        client.sendMessage(msg.from, 'Honk Honk!!')
    } else if (msg.body == '!chats') {
        const chats = await client.getChats()
        const group = chats.filter(x => x.isGroup == true)
        const personalChat = chats.filter(x => x.isGroup == false)
        const getListUsers = await getAllDataUsers(DB)
        client.sendMessage(msg.from, `The bot has...
Chats open: ${chats.length} 
Groups chats: ${group.length}
Personal chats: ${personalChat.length}
Notification User: ${getListUsers.length}`)
    } else if (msg.body == '!help' || msg.body == '!menu') {
        const contact = await msg.getContact()
        client.sendMessage(msg.from, await resChat.Menu(contact))
    } else if (msg.body === '!covid' || msg.body === '!covid19' || msg.body === '!covid-19') {
        client.sendMessage(msg.from, `
*Menu COVID-19*

!nasional  =>  Data Nasional
!global  =>  Data Global

*Provinsi*
!jabar   => Data Provinsi Jawa Barat
!jateng  => Data Provinsi Jawa Tengah
!jatim   => Data Provinsi Jawa Timur
!jakarta => Data Provinsi DKI Jakarta

*Kota*
!bandung  =>  Data Kota Bandung
!bekasi  =>  Data Kota Bekasi

*Rumah Sakit*
!wisma-atlit => Data RS Darurat Wisma Atlit

_>seluruh data yang ada adalah data terbaru._
_>kirim *!menu* untuk melihat menu utama._`)
    } else if (msg.body == '!donasi') {
        // const logoDonasi = new MessageMedia('image/png', readFileSync('./image/Donasi-1.jpg', 'base64'))
        // client.sendMessage(msg.from, logoDonasi, { caption: await resChat.Donasi() })
        // const infoRek = new MessageMedia('image/png', readFileSync('./image/Donasi-2.jpg', 'base64'))
        // // delay ini menanggulangi jika terjadi delay ketika mengirim gambar pertama
        // setTimeout(function () { client.sendMessage(msg.from, infoRek) }, 500)
    } else if (msg.body == '!sumber') {
        client.sendMessage(msg.from, await resChat.SumberData())
    } else if (msg.body == '!peta') {
        client.sendMessage(msg.from, await resChat.PetaProv(), { linkPreview: true })
    } else if (msg.body == '!data') {
        client.sendMessage(msg.from, await resChat.DataNasional())
    } else if (msg.body == '!bandung') {
        client.sendMessage(msg.from, await resChat.Bandung())
    } else if (msg.body == '!bekasi') {
        client.sendMessage(msg.from, await resChat.Bekasi())
    } else if (msg.body == '!corona' || msg.body == '!nasional') {
        client.sendMessage(msg.from, await resChat.Nasional())
    } else if (msg.body == '!global') {
        client.sendMessage(msg.from, await resChat.Global())
    } else if (msg.body == '!jabar') {
        client.sendMessage(msg.from, await resChat.Jabar())
    } else if (msg.body == '!jateng') {
        client.sendMessage(msg.from, await resChat.Jateng())
    } else if (msg.body == '!jatim') {
        client.sendMessage(msg.from, await resChat.Jatim())
    } else if (msg.body == '!jakarta') {
        client.sendMessage(msg.from, await resChat.Jakarta())
    } else if (msg.body == '!wisma-atlit') {
        client.sendMessage(msg.from, await resChat.WismaAtlit())
    } else if (msg.body == '!inkubasi') {
        client.sendMessage(msg.from, await resChat.Inkubasi())
    } else if (msg.body == '!gejala') {
        client.sendMessage(msg.from, await resChat.Gejala())
    } else if (msg.body == '!aktif') {
        const chat = await msg.getChat()
        // Cek & Input data ke MongoDB
        const dbDataUsers = await getDataUsers(DB, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
        if (msg.body && dbDataUsers.length < 1) {
            dbDataUsers.push(chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
            await insertDataUsers(DB, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
            await client.sendMessage(msg.from, `Selamat, nomor hp anda "${msg.from.split('@c.us')[0]}" berhasil diregistrasi kedalam daftar notifikasi, anda akan mendapat notifikasi ketika ada pembaruan data.`)
        } else {
            await client.sendMessage(msg.from, 'Maaf, nomor hp anda telah diregistrasi. Untuk membatalkan kirim *!mati*')
        }
    } else if (msg.body == '!mati') {
        const chat = await msg.getChat()
        const dbDataUsers = await getDataUsers(DB, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
        if (msg.body && dbDataUsers.length < 1) {
            await client.sendMessage(msg.from, 'Maaf, Nomor anda belum diregistrasi. Registrasi nomor anda dengan kirim *!aktif*')
        } else {
            await deleteDataUsers(DB, chat.isGroup ? msg.from = msg.author : msg.from = msg.from)
            await client.sendMessage(msg.from, 'Nomor anda telah dihapus dari daftar notifikasi')
        }

        // ============================================= Groups
    } else if (msg.body == '!leave') {
        if (msg.from == adminNumber) {
            const chat = await msg.getChat()
            if (chat.isGroup) {
                chat.leave()
            } else {
                msg.reply('This command can only be used in a group!')
            }
        }
        // Leave from all group
        // const chats = await client.getChats()
        // var search = chats.filter(x => x.isGroup == true)
        // var except = search.filter(x => x.id._serialized !== 'ID')
        // msg.reply(`Request diterima bot akan keluar dari ${except.length} grup.`)
        // for (var i = 0; i < except.length; i++) {
        //     console.log(`Keluar dari Grup: ${except[i].name}`)
        //     except[i].leave()
        // }
    } else if (msg.body.startsWith('!join ') && msg.from == adminNumber) {
        const inviteCode = msg.body.split(' ')[1]
        try {
            await client.acceptInvite(inviteCode)
            msg.reply('Joined the group!')
        } catch (e) {
            msg.reply('That invite code seems to be invalid.')
        }
    } else if (msg.body.startsWith('!sendto ' && msg.from == adminNumber)) {
        let number = msg.body.split(' ')[1]
        const messageIndex = msg.body.indexOf(number) + number.length
        const message = msg.body.slice(messageIndex, msg.body.length)
        if (number.includes('@g.us')) {
            const group = await client.getChatById(number)
            group.sendMessage(message)
        } else if (!number.includes('@c.us') && !number.includes('@g.us')) {
            number = number.includes('@c.us') ? number : `${number}@c.us`
            const chat = await msg.getChat()
            chat.sendSeen()
            client.sendMessage(number, message)
        }
    } else if (msg.body == '!broadcast' && msg.from == adminNumber) {
        const getListUsers = await getAllDataUsers(DB)
        getListUsers.map((item, index) => {
            const number = item.phone_number
            setTimeout(async function () {
                console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Send Broadcast to ${number}`)
                client.sendMessage(number, await resChat.Broadcast())
            }, index * 2000) // Delay 2 Sec
        })
    }
})

listen.on('message', async (topic, message) => {
    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] MQTT: ${message.toString()}`)
    const getListUsers = await getAllDataUsers(DB)
    if (message.toString() == 'New Update!') {
        readFile('./CoronaService/data.json', 'utf-8', function (err, data) {
            if (err) throw err
            const localData = JSON.parse(data)
            getListUsers.map((item, index) => {
                const number = item.phone_number
                setTimeout(function () {
                    console.log(`[ ${moment().tz('Asia/Jakarta').format('HH:mm:ss')} ] Send Corona Update to ${number}`)
                    client.sendMessage(number, `
*COVID-19 Update!!*
Negara: ${localData.Country}
Hari Ke: ${localData.Day}
Provinsi Terdampak: ${localData.ProvinsiTerdampak}

Total ODP: ${localData.TotalODP.toLocaleString()}
Total PDP: ${localData.TotalPDP.toLocaleString()}

Total Kasus: ${localData.TotalCases}
*Kasus Baru: ${localData.NewCases}*

Pasien Dirawat: ${localData.ActiveCases}
*Dirawat Baru: ${localData.NewActiveCases}*

Pasien Sembuh: ${localData.TotalRecovered}
*Sembuh Baru: ${localData.NewRecovered}*
Presentase Sembuh: ${localData.PresentaseRecovered}

Pasien Meninggal: ${localData.TotalDeaths}
*Meninggal Baru: ${localData.NewDeaths}*
Presentase Meninggal: ${localData.PresentaseDeath}
                    
Di Perbarui Pada: 
${localData.lastUpdate}
🛈 Sumber: 
_https://www.covid19.go.id_
                    `)

                    // Delay 2 Sec
                }, index * 1100)
            })
        })
    }
})
