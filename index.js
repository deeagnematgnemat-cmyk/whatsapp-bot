const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const DEVELOPER_NUMBER = '962795106901';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('arem_new_session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(DEVELOPER_NUMBER);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n========================================`);
                console.log(`   رمز الاقتران الخاص بك: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.log('خطأ في طلب رمز الاقتران:', err);
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ تم اتصال البوت بنجاح وجاهز للعمل!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const text = body.trim().toLowerCase();

            if (text === '.بوت') {
                await sock.sendMessage(from, { text: '🤖 أهلاً بك! البوت يعمل بكفاءة وسرعة عالية 🟢' }, { quoted: msg });
            } 
            else if (text === '.اوامر' || text === '.الاوامر') {
                const menu = `📌 *قائمة الأوامر البسيطة:*
> 🔹 \`.بوت\` - لفحص حالة البوت
> 🔹 \`.اوامر\` - لعرض القائمة`;
                await sock.sendMessage(from, { text: menu }, { quoted: msg });
            }
        } catch (e) {
            console.log('خطأ في معالجة الرسالة:', e);
        }
    });
}

startBot();
