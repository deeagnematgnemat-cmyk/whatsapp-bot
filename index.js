const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const DEVELOPER_NUMBER = '962795106901';
const DEVELOPER_MAIN_NUM = '962796163926';
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';

let extraDevelopers = [];
let userWarnings = {};
let mutedUsers = {};
let groupSettings = {};

const badWords = [
    'منيك', 'شرموط', 'قحبه', 'قحبة', 'كس', 'عرض', 'عرص', 'منيوك', 'منيوكة', 
    'عرصه', 'متناك', 'شرموطه', 'قحاب', 'عاهر', 'عاهره', 'ديوث', 'خول', 'قحط', 
    'منيكة', 'عرصات', 'ابن القحبة', 'ابن الكلب'
];

function isDeveloper(senderJid) {
    if (!senderJid) return false;
    const cleanNum = senderJid.replace(/[^0-9]/g, '');
    return cleanNum === DEVELOPER_MAIN_NUM || cleanNum.endsWith(DEVELOPER_MAIN_NUM) || extraDevelopers.includes(cleanNum);
}

function getGroupSetting(groupId) {
    if (!groupSettings[groupId]) {
        groupSettings[groupId] = {
            antiLink: true,
            antiBadWords: true,
            antiContact: true,
            welcome: true,
            goodbye: true,
            botMode: 'public'
        };
    }
    return groupSettings[groupId];
}

function getTargetUser(msg) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    return mentioned || quoted || null;
}

async function getBotProfilePic(sock) {
    try {
        const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (DEVELOPER_NUMBER + '@s.whatsapp.net');
        return await sock.profilePictureUrl(botJid, 'image');
    } catch (e) {
        return 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';
    }
}

async function getDeveloperProfilePic(sock) {
    try {
        const devJid = DEVELOPER_MAIN_NUM + '@s.whatsapp.net';
        return await sock.profilePictureUrl(devJid, 'image');
    } catch (e) {
        return 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';
    }
}

async function getUserProfilePic(sock, senderJid) {
    try {
        return await sock.profilePictureUrl(senderJid, 'image');
    } catch (e) {
        return 'https://i.postimg.cc/q7SjJpYy/eren-pfp.jpg';
    }
}

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
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ تم اتصال البوت بنجاح وجاهز للعمل!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg || !msg.message) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const isFromMe = msg.key.fromMe;
            const sender = isFromMe ? (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (DEVELOPER_MAIN_NUM + '@s.whatsapp.net')) : (msg.key.participant || msg.key.remoteJid);
            const cleanSenderNum = sender.replace(/[^0-9]/g, '');

            let isSenderDev = isDeveloper(sender);
            let isSenderAdmin = isFromMe || isSenderDev;

            if (isGroup && !isFromMe && !isSenderDev) {
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const participants = groupMetadata.participants;
                    isSenderAdmin = participants.some(p => p.id.replace(/[^0-9]/g, '') === cleanSenderNum && (p.admin === 'admin' || p.admin === 'superadmin'));
                } catch (e) {}
            }

            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
            let trimmedBody = body.trim();
            let lowerBody = trimmedBody.toLowerCase();

            // --- نظام الحماية التلقائي ---
            if (isGroup && !isSenderAdmin && !isSenderDev) {
                const settings = getGroupSetting(from);
                const mType = Object.keys(msg.message || {});
                let violationDetected = false;
                let violationType = '';

                if (settings.antiContact && (mType.includes('contactMessage') || mType.includes('contactsArrayMessage'))) {
                    violationDetected = true;
                    violationType = 'جهات الاتصال';
                } else if (settings.antiLink && (lowerBody.includes('http://') || lowerBody.includes('https://'))) {
                    violationDetected = true;
                    violationType = 'الروابط';
                } else if (settings.antiBadWords && badWords.some(w => lowerBody.includes(w))) {
                    violationDetected = true;
                    violationType = 'السبام والشتائم';
                }

                if (violationDetected) {
                    try {
                        await sock.sendMessage(from, { delete: msg.key });
                        await sock.groupSettingUpdate(from, 'announcement');
                        if (!userWarnings[sender]) userWarnings[sender] = 0;
                        userWarnings[sender]++;

                        if (userWarnings[sender] >= 3) {
                            await sock.sendMessage(from, { text: `🚨 @${sender.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات (${violationType})!`, mentions: [sender] });
                            await sock.groupParticipantsUpdate(from, [sender], 'remove');
                            userWarnings[sender] = 0;
                        } else {
                            await sock.sendMessage(from, { text: `⚠️ تنبيه ومخالفة (${violationType})!\n👤 @${sender.split('@')[0]}\n📌 الإنذار الحالي: [${userWarnings[sender]}/3]\n🔒 تم إغلاق الشات تلقائياً بسبب المخالفة.`, mentions: [sender] });
                        }
                        return;
                    } catch (e) {}
                }
            }

            if (!trimmedBody.startsWith('.')) return;

            let cmd = trimmedBody.substring(1).toLowerCase().trim().replace(/[أإآا]/g, 'ا');
            let cmdBase = cmd.split(' ')[0];

            // --- أوامر الإدارة ---
            if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'صفر', 'عدد_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط'].includes(cmdBase) || cmd.startsWith('تغيير_الاسم') || cmd.startsWith('تغيير_الوصف') || cmd === 'تفعيل ادمن' || cmd === 'توقيف ادمن' || cmd === 'تفعيل ترحيب' || cmd === 'توقيف ترحيب' || cmd === 'تفعيل توديع' || cmd === 'توقيف توديع' || cmd === 'رابط_الجروب' || cmd === 'الرابط') {
                if (!isSenderAdmin && !isSenderDev) {
                    return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' });
                }
            }

            if (cmdBase === 'قفل' || cmd === 'غلق') {
                await sock.groupSettingUpdate(from, 'announcement');
                return sock.sendMessage(from, { text: '🔒 تم قفل المجموعة!' });
            }
            if (cmdBase === 'فتح') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                return sock.sendMessage(from, { text: '🔓 تم فتح المجموعة!' });
            }
            if (cmdBase === 'حذف' || cmdBase === 'مسح') {
                const q = msg.message.extendedTextMessage?.contextInfo;
                if (!q) return sock.sendMessage(from, { text: '📌 رد على الرسالة المراد حذفها.' });
                try {
                    await sock.sendMessage(from, { delete: { remoteJid: from, id: q.stanzaId, participant: q.participant } });
                } catch (e) {}
                return;
            }
            if (cmdBase === 'الكل' || cmdBase === 'منشن') {
                const meta = await sock.groupMetadata(from);
                let mentions = [];
                let text = `📢 *نداء إداري لجميع الأعضاء:*\n\n`;
                for (let mem of meta.participants) {
                    text += `@${mem.id.split('@')[0]} \n`;
                    mentions.push(mem.id);
                }
                return sock.sendMessage(from, { text, mentions });
            }
            if (cmdBase === 'رفع' || cmdBase === 'ترقية') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.رفع @عضو`' });
                await sock.groupParticipantsUpdate(from, [targetUser], 'promote');
                return sock.sendMessage(from, { text: `👑 تم رفع @${targetUser.split('@')[0]} مشرفاً!`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.تنزيل @عضو`' });
                await sock.groupParticipantsUpdate(from, [targetUser], 'demote');
                return sock.sendMessage(from, { text: `📉 تم تنزيل @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'طرد') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.طرد @عضو`' });
                await sock.groupParticipantsUpdate(from, [targetUser], 'remove');
                return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'اضف_انذار') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.اضف_انذار @عضو`' });
                userWarnings[targetUser] = (userWarnings[targetUser] || 0) + 1;
                if (userWarnings[targetUser] >= 3) {
                    await sock.groupParticipantsUpdate(from, [targetUser], 'remove');
                    userWarnings[targetUser] = 0;
                    return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]} لتجاوزه الإنذارات!`, mentions: [targetUser] }, { quoted: msg });
                }
                return sock.sendMessage(from, { text: `⚠️ تم إضافة إنذار (${userWarnings[targetUser]}/3).`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'ازل_انذار') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل_انذار @عضو`' });
                if (userWarnings[targetUser] > 0) userWarnings[targetUser]--;
                return sock.sendMessage(from, { text: `✅ تم إزالة إنذار عن العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'صفر') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.صفر @عضو`' });
                userWarnings[targetUser] = 0;
                return sock.sendMessage(from, { text: `✅ تم تصفير إنذارات العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'عدد_الانذارات') {
                const targetUser = getTargetUser(msg) || sender;
                return sock.sendMessage(from, { text: `📊 عدد الإنذارات: *${userWarnings[targetUser] || 0} / 3*`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'كتم') {
                const parts = trimmedBody.split(' ');
                const mins = parseInt(parts[1]);
                const targetUser = getTargetUser(msg);
                if (isNaN(mins) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.كتم <دقائق> @عضو`' });
                if (!mutedUsers[from]) mutedUsers[from] = {};
                mutedUsers[from][targetUser] = Date.now() + (mins * 60 * 1000);
                return sock.sendMessage(from, { text: `🔇 تم كتم العضو @${targetUser.split('@')[0]} لمدة ${mins} دقيقة بنجاح.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.الغاء_كتم @عضو`' });
                if (mutedUsers[from]) delete mutedUsers[from][targetUser];
                return sock.sendMessage(from, { text: `🔊 تم فك الكتم عن العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }

            if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {
                try {
                    const code = await sock.groupInviteCode(from);
                    return sock.sendMessage(from, { text: `🔗 *رابط دعوة المجموعة:* \nhttps://chat.whatsapp.com/${code}` });
                } catch (e) {
                    return sock.sendMessage(from, { text: '❌ فشل جلب الرابط تأكد أن البوت مشرف.' });
                }
            }

            // --- أوامر قسم المطور ---
            if (cmdBase === 'اضافة_مطور') {
                if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' });
                extraDevelopers.push(targetUser.replace(/[^0-9]/g, ''));
                return sock.sendMessage(from, { text: `✅ تمت الإضافة كمطور بنجاح.` }, { quoted: msg });
            }
            if (cmdBase === 'حذف_مطور') {
                if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين فقط!' });
                const targetUser = getTargetUser(msg);
                if (targetUser) extraDevelopers = extraDevelopers.filter(d => d !== targetUser.replace(/[^0-9]/g, ''));
                return sock.sendMessage(from, { text: `❌ تم إزالة المطور بنجاح.` }, { quoted: msg });
            }
            if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {
                if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });
                await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });
                process.exit(0);
            }

            // --- أمر .بوت (مع صورة بروفايل البوت) ---
            if (cmdBase === 'بوت') {
                const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                const botWelcomeText = `🍷 *أَهْـلاً بِـكَ فِي عَالَمِ ${DEVELOPER_NAME}* 🍷

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}
> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢
> ┃ ⌯👨🏻‍💻︙الــمـطـور → ${DEVELOPER_MAIN_NUM}
> ┃ 
> ┃ ♟️ *"الهيبةُ ليستْ بصَخبِ الـحُضور،*
> ┃ *بل بالتأثيرِ الصَّامِتِ الذي يترُكُ أثراً لا يُـنْسَى."*
> ┃ 
> ┃ ⌯🚀︙الـتـوقـيـت → ${time}

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*

⚙️ *لِـعَـرْضِ كَـافَّـةِ أَقْـسَـامِ الأَوَامِـرِ:*
اكتب الأمر: 👇
📌 *.الاوامر*  أو  *.اقسام*

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*`;

                const botPp = await getBotProfilePic(sock);
                try {
                    await sock.sendMessage(from, { image: { url: botPp }, caption: botWelcomeText, mentions: [sender] });
                } catch (e) {
                    await sock.sendMessage(from, { text: botWelcomeText, mentions: [sender] });
                }
                return;
            }

            // --- أمر .اوامر أو .اقسام (مع صورة بروفايل المطور) ---
            if (cmdBase === 'اوامر' || cmdBase === 'الاوامر' || cmdBase === 'اقسام') {
                const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ (${DEVELOPER_NAME}):*
> 🛡️ \`.1\` ↞ الحماية
> ♟️ \`.10\` ↞ المطور
> ⚡ \`.11\` ↞ الادارة

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
💡 *اكتب رقم القسم للوصول السريع!*`;

                const devPp = await getDeveloperProfilePic(sock);
                try {
                    await sock.sendMessage(from, { image: { url: devPp }, caption: menuText, mentions: [sender] });
                } catch (e) {
                    await sock.sendMessage(from, { text: menuText });
                }
                return;
            }

            // --- قسم الحماية (الرقم 1) مع صورة بروفايل من طلب الأمر ---
            if (cmdBase === '1') {
                const settings = getGroupSetting(from);
                const userPp = await getUserProfilePic(sock, sender);
                const text1 = `🛡️ *الحماية (لهذه المجموعة):*

🔗 *1. حماية الروابط:* [${settings.antiLink ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_رابط\` | إيقاف: \`.سماح_رابط\`

🤬 *2. حماية الشتائم وقذف المحصنات:* [${settings.antiBadWords ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_سب\` | إيقاف: \`.سماح_سب\`

📇 *3. حماية جهات الاتصال:* [${settings.antiContact ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_جهات\` | إيقاف: \`.سماح_جهات\`

⚙️ *لتصفير إنذارات أي عضو:* \`.صفر @العضو\``;

                try {
                    await sock.sendMessage(from, { image: { url: userPp }, caption: text1, mentions: [sender] });
                } catch (e) {
                    await sock.sendMessage(from, { text: text1 });
                }
                return;
            }

            // --- قسم المطور (الرقم 10) مع صورة بروفايل المطور ---
            if (cmdBase === '10' || cmd === 'المطور' || cmd === 'مطور') {
                const devMenuText = `♟️ *قِـسْـمُ الـمُـطَـوِّرِ:*
> 👤 *اسم المطور:* 𝐄𝐫𝐞ن
> 📱 *رقم المطور:* \`${DEVELOPER_MAIN_NUM}\`

> 👑 \`.اضافة_مطور @منشن\` ↞ إضافة مطور جديد
> ❌ \`.حذف_مطور @منشن\` ↞ إزالة مطور
> 🔒 \`.خاص\` أو \`.وضع_خاص\` ↞ جعل البوت خاصاً للمطور والمشرفين
> 🔓 \`.عام\` أو \`.وضع_عام\` ↞ جعل البوت عاماً للجميع
> 🔄 \`.ريستارت\` ↞ إعادة تشغيل البوت.`;

                const devPp = await getDeveloperProfilePic(sock);
                try {
                    await sock.sendMessage(from, { image: { url: devPp }, caption: devMenuText, mentions: [sender] });
                } catch (e) {
                    await sock.sendMessage(from, { text: devMenuText });
                }
                return;
            }

            // --- قسم الإدارة (الرقم 11) مع صورة بروفايل من طلب الأمر ---
            if (cmdBase === '11' || cmd === 'الادارة' || cmd === 'الاداره') {
                const adminMenuText = `⚡ *قِـسْـمُ الإِدَارَةِ وَالتَّحَكُّمِ:*

> 🔒 \`.قفل\` أو \`.غلق\` ↞ قفل الجروب (المشرفين فقط)
> 🔓 \`.فتح\` ↞ فتح الجروب للأعضاء
> 🗑️ \`.حذف\` ↞ حذف رسالة محددة (بالرد عليها)
> 📢 \`.الكل\` أو \`.منشن\` ↞ منشن جماعي لكل الأعضاء
> 👑 \`.رفع @عضو\` ↞ ترقية عضو إلى مشرف
> 📉 \`.تنزيل @عضو\` ↞ إزالة الإشراف عن عضو
> 🚨 \`.طرد @عضو\` ↞ طرد العضو من المجموعة
> ⚠️ \`.اضف_انذار @عضو\` ↞ إضافة إنذار إداري للعضو
> 📉 \`.ازل_انذار @عضو\` ↞ إزالة إنذار عن العضو
> 📊 \`.عدد_الانذارات @عضو\` ↞ عرض عدد الإنذارات الحالية
> 🔇 \`.كتم <دقائق> @عضو\` ↞ كتم العضو مؤقتاً
> 🔊 \`.الغاء_كتم @عضو\` ↞ فك الكتم عن العضو
> 🏷️ \`.تغيير_الاسم <الاسم>\` ↞ تغيير عنوان الجروب
> 📝 \`.تغيير_الوصف <الوصف>\` ↞ تغيير وصف الجروب
> 🔗 \`.الرابط\` ↞ إحضار رابط دعوة المجموعة
> 🔄 \`.صفر @عضو\` ↞ تصفير إنذارات العضو`;

                const userPp = await getUserProfilePic(sock, sender);
                try {
                    await sock.sendMessage(from, { image: { url: userPp }, caption: adminMenuText, mentions: [sender] });
                } catch (e) {
                    await sock.sendMessage(from, { text: adminMenuText });
                }
                return;
            }

        } catch (err) {
            console.log("خطأ في معالجة الرسالة:", err);
        }
    });
}

startBot();
