const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const DEVELOPER_NUMBER = '962795106901';
const DEVELOPER_MAIN_NUM = '962796163926';
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';

let extraDevelopers = [];
let userWarnings = {};
let mutedUsers = {};
let groupSettings = {};
let botLogs = [];

function logBotAction(action) {
    const time = new Date().toLocaleTimeString('ar-EG');
    botLogs.unshift(`> 🔹 *[${time}]* ↞${action}`);
    if (botLogs.length > 20) botLogs.pop();
}

const badWords = [
    'منيك', 'شرموط', 'قحبه', 'قحبة', 'كس', 'عرض', 'عرص', 'منيوك', 'منيوكة', 
    'عرصه', 'متناك', 'شرموطه', 'قحاب', 'عاهر', 'عاهره', 'ديوث', 'خول', 'قحط', 
    'منيكة', 'عرصات', 'ابن القحبة', 'ابن الكلب'
];

function isDeveloper(senderJid, sock) {
    if (!senderJid) return false;
    const cleanNum = senderJid.replace(/[^0-9]/g, '');
    const botNum = sock?.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
    if (cleanNum === botNum) return true;
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

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('eren_clean_session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ تم اتصال البوت بنجاح وجاهز للعمل!');

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
                }, 3000);
            }
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

            let isSenderDev = isDeveloper(sender, sock);
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

            if (isGroup) {
                const settings = getGroupSetting(from);
                if (settings.botMode === 'private' && !isSenderDev) {
                    return; 
                }
            }

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

            logBotAction(`استخدام أمر (${cmd}) من قبل العضو ${cleanSenderNum}`);

            if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'صفر', 'عدد_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط'].includes(cmdBase) || cmd.startsWith('تغيير_الاسم') || cmd.startsWith('تغيير_الوصف') || cmd === 'تفعيل ادمن' || cmd === 'توقيف ادمن' || cmd === 'تفعيل ترحيب' || cmd === 'توقيف ترحيب' || cmd === 'تفعيل توديع' || cmd === 'توقيف توديع' || cmd === 'رابط_الجروب' || cmd === 'الرابط') {
                if (!isSenderAdmin && !isSenderDev) {
                    return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط لا غير!' }, { quoted: msg });
                }
            }

            if (cmdBase === 'قفل' || cmd === 'غلق') {
                await sock.groupSettingUpdate(from, 'announcement');
                return sock.sendMessage(from, { text: '🔒 تم قفل المجموعة!' }, { quoted: msg });
            }
            if (cmdBase === 'فتح') {
                await sock.groupSettingUpdate(from, 'not_announcement');
                return sock.sendMessage(from, { text: '🔓 تم فتح المجموعة!' }, { quoted: msg });
            }
            if (cmdBase === 'حذف' || cmdBase === 'مسح') {
                const q = msg.message.extendedTextMessage?.contextInfo;
                if (!q) return sock.sendMessage(from, { text: '📌 رد على الرسالة المراد حذفها.' }, { quoted: msg });
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
                return sock.sendMessage(from, { text, mentions }, { quoted: msg });
            }
            if (cmdBase === 'رفع' || cmdBase === 'ترقية') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.رفع @عضو`' }, { quoted: msg });
                await sock.groupParticipantsUpdate(from, [targetUser], 'promote');
                return sock.sendMessage(from, { text: `👑 تم رفع @${targetUser.split('@')[0]} مشرفاً!`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'ازل' || cmdBase === 'تنزيل') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.تنزيل @عضو`' }, { quoted: msg });
                await sock.groupParticipantsUpdate(from, [targetUser], 'demote');
                return sock.sendMessage(from, { text: `📉 تم تنزيل @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'طرد') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.طرد @عضو`' }, { quoted: msg });
                await sock.groupParticipantsUpdate(from, [targetUser], 'remove');
                return sock.sendMessage(from, { text: `🚨 تم طرد @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'اضف_انذار') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.اضف_انذار @عضو`' }, { quoted: msg });
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
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.ازل_انذار @عضو`' }, { quoted: msg });
                if (userWarnings[targetUser] > 0) userWarnings[targetUser]--;
                return sock.sendMessage(from, { text: `✅ تم إزالة إنذار عن العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'صفر') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.صفر @عضو`' }, { quoted: msg });
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
                if (isNaN(mins) || !targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: `.كتم <دقائق> @عضو`' }, { quoted: msg });
                if (!mutedUsers[from]) mutedUsers[from] = {};
                mutedUsers[from][targetUser] = Date.now() + (mins * 60 * 1000);
                return sock.sendMessage(from, { text: `🔇 تم كتم العضو @${targetUser.split('@')[0]} لمدة ${mins} دقيقة بنجاح.`, mentions: [targetUser] }, { quoted: msg });
            }
            if (cmdBase === 'الغاء_كتم' || cmdBase === 'فك_كتم') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 الاستخدام: بالرد على رسالة العضو أو عمل منشن له `.الغاء_كتم @عضو`' }, { quoted: msg });
                if (mutedUsers[from]) delete mutedUsers[from][targetUser];
                return sock.sendMessage(from, { text: `🔊 تم فك الكتم عن العضو @${targetUser.split('@')[0]}.`, mentions: [targetUser] }, { quoted: msg });
            }

            if (cmd === 'رابط_الجروب' || cmd === 'الرابط') {
                try {
                    const code = await sock.groupInviteCode(from);
                    return sock.sendMessage(from, { text: `🔗 *رابط دعوة المجموعة:* \nhttps://chat.whatsapp.com/${code}` }, { quoted: msg });
                } catch (e) {
                    return sock.sendMessage(from, { text: '❌ فشل جلب الرابط تأكد أن البوت مشرف.' }, { quoted: msg });
                }
            }

            if (['اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار', 'تفاعل', 'تفاعل_مطور', 'خاص', 'وضع_خاص', 'عام', 'وضع_عام', 'اعطاء', 'إذاعة', 'اذاعة', 'ريستارت', 'اعادة_تشغيل'].includes(cmdBase)) {
                if (!isSenderDev) {
                    return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمطور الأساسي فقط!' }, { quoted: msg });
                }
            }

            if (cmdBase === 'اضافة_مطور') {
                const targetUser = getTargetUser(msg);
                if (!targetUser) return sock.sendMessage(from, { text: '📌 يرجى عمل منشن للشخص.' }, { quoted: msg });
                extraDevelopers.push(targetUser.replace(/[^0-9]/g, ''));
                return sock.sendMessage(from, { text: `✅ تمت الإضافة كمطور بنجاح.` }, { quoted: msg });
            }
            if (cmdBase === 'حذف_مطور') {
                const targetUser = getTargetUser(msg);
                if (targetUser) extraDevelopers = extraDevelopers.filter(d => d !== targetUser.replace(/[^0-9]/g, ''));
                return sock.sendMessage(from, { text: `❌ تم إزالة المطور بنجاح.` }, { quoted: msg });
            }
            if (cmdBase === 'قائمة_المطورين') {
                let listText = `📋 *قَـائِـمَـةُ الـمُـطَـوِّرِيـنَ:* \n1. الأساسي: \`${DEVELOPER_MAIN_NUM}\`\n`;
                extraDevelopers.forEach((dev, idx) => { listText += `${idx + 2}. \`${dev}\`\n`; });
                return sock.sendMessage(from, { text: listText }, { quoted: msg });
            }
            if (cmdBase === 'سجل_البوت') {
                return sock.sendMessage(from, { text: `📡 سجل العمليات:\n` + (botLogs.join('\n') || 'لا توجد سجلات بعد.') }, { quoted: msg });
            }
            if (cmdBase === 'اختبار') {
                return sock.sendMessage(from, { text: `🧪 النظام يعمل بكل إمكانياته والأقسام مفعلة 🟢` }, { quoted: msg });
            }
            if (cmdBase === 'تفاعل') {
                return sock.sendMessage(from, { text: `🟢 تم تحديث إعدادات التفاعل.` }, { quoted: msg });
            }
            if (cmdBase === 'تفاعل_مطور') {
                return sock.sendMessage(from, { text: `🟢 تم تحديث تفاعل المطور.` }, { quoted: msg });
            }
            if (cmdBase === 'خاص' || cmdBase === 'وضع_خاص') {
                getGroupSetting(from).botMode = 'private';
                return sock.sendMessage(from, { text: `🔒 تم تفعيل الوضع الخاص (البوت يستجيب للمطور ورقم البوت فقط).` }, { quoted: msg });
            }
            if (cmdBase === 'عام' || cmdBase === 'وضع_عام') {
                getGroupSetting(from).botMode = 'public';
                return sock.sendMessage(from, { text: `🔓 تم تفعيل الوضع العام للجميع.` }, { quoted: msg });
            }
            if (cmdBase === 'اعطاء') {
                return sock.sendMessage(from, { text: `✅ تمت العملية بنجاح.` }, { quoted: msg });
            }
            if (cmdBase === 'إذاعة' || cmdBase === 'اذاعة') {
                return sock.sendMessage(from, { text: `📢 تم إرسال الإذاعة بنجاح.` }, { quoted: msg });
            }
            if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {
                await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' }, { quoted: msg });
                process.exit(0);
            }

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

                await sock.sendMessage(from, { text: botWelcomeText, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (cmdBase === 'اوامر' || cmdBase === 'الاوامر' || cmdBase === 'اقسام') {
                const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ (${DEVELOPER_NAME}):*
> 🛡️ \`.1\` ↞ الحماية
> ♟️ \`.10\` ↞ المطور
> ⚡ \`.11\` ↞ الادارة

*❐═━━━═╊⊰🍷⊱╉═━━━═❐*
💡 *اكتب رقم القسم للوصول السريع!*`;

                await sock.sendMessage(from, { text: menuText, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (cmdBase === '1') {
                const settings = getGroupSetting(from);
                const text1 = `🛡️ *الحماية (لهذه المجموعة):*

🔗 *1. حماية الروابط:* [${settings.antiLink ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_رابط\` | إيقاف: \`.سماح_رابط\`

🤬 *2. حماية الشتائم وقذف المحصنات:* [${settings.antiBadWords ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_سب\` | إيقاف: \`.سماح_سب\`

📇 *3. حماية جهات الاتصال:* [${settings.antiContact ? '🟢 مفعلة' : '🔴 معطلة'}]
> ⤹ تفعيل: \`.حظر_جهات\` | إيقاف: \`.سماح_جهات\`

⚙️ *لتصفير إنذارات أي عضو:* \`.صفر @العضو\``;

                await sock.sendMessage(from, { text: text1, mentions: [sender] }, { quoted: msg });
                return;
            }

            if (cmdBase === '10' || cmd === 'المطور' || cmd === 'مطور') {
                if (!isSenderDev) {
                    return sock.sendMessage(from, { text: '❌ عذراً، هذا القسم مخصص للمطور الأساسي فقط!' }, { quoted: msg });
                }
                const devMenuText = `♟️ *قِـسْـمُ الـمُـطَـوِّرِ:*
> 👤 *اسم المطور:* 𝐄𝐫𝐞ن
> 📱 *رقم المطور:* \`${DEVELOPER_MAIN_NUM}\`

> 👑 \`.اضافة_مطور @منشن\` ↞ إضافة مطور جديد
> ❌ \`.حذف_مطور @منشن\` ↞ إزالة مطور
> 📋 \`.قائمة_المطورين\` ↞ عرض قائمة المطورين
> 📡 \`.سجل_البوت\` ↞ عرض آخر عمليات البوت
> 🧪 \`.اختبار\` ↞ اختبار وظائف البوت وفحص الاستجابة
> ❤️ \`.تفاعل\` ↞ التحكم بالتفاعل التلقائي لأوامر الأعضاء
> ❤️ \`.تفاعل_مطور\` ↞ التحكم بالتفاعل التلقائي لرسائل المطور
> 🔒 \`.خاص\` أو \`.وضع_خاص\` ↞ جعل البوت خاصاً للمطور ورقم البوت
> 🔓 \`.عام\` أو \`.وضع_عام\` ↞ جعل البوت عاماً للجميع
> 💸 \`.اعطاء <المبلغ> @منشن\` ↞ إضافة نقاط لأي عضو
> 📢 \`.إذاعة <النص>\` ↞ إرسال رسالة لجميع المجموعات
> 🔄 \`.ريستارت\` ↞ إعادة تشغيل البوت.`;

                await sock.sendMessage(from, { text: devMenuText, mentions: [sender] }, { quoted: msg });
                return;
            }

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
> 🔗 \`.الرابط\` 🔗 *رابط دعوة المجموعة*
> 🔄 \`.صفر @عضو\` ↞ تصفير إنذارات العضو`;

                await sock.sendMessage(from, { text: adminMenuText, mentions: [sender] }, { quoted: msg });
                return;
            }

        } catch (err) {
            console.log("خطأ في معالجة الرسالة:", err);
        }
    });
}

startBot();
