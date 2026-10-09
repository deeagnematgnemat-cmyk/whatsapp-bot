const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

process.on('uncaughtException', (err) => console.log('خطأ:', err));
process.on('unhandledRejection', (err) => console.log('خطأ معالجة:', err));

const DEVELOPER_NUMBER = '962796163926'; 
const DEVELOPER_NAME = '『✦』 𝐸𝓇𝑒𝓃 🍷 𝐵𝑜𝓉 『✦』';
let extraDevelopers = []; 
let botLogs = []; 

function logBotAction(action) {
    const time = new Date().toLocaleTimeString('ar-EG');
    botLogs.unshift(`> 🔹 *[${time}]* ↞${action}`);
    if (botLogs.length > 20) botLogs.pop();
}

let userPoints = {}, userWarnings = {};
let bankAccounts = {}; 
let activeGames = {}; 
let dailyRewards = {}; 
let mutedUsers = {}; 
let userMessagesCount = {};
let groupSettings = {}; 

let commandReactionEnabled = true;
let commandReactionEmoji = '⚡';

let devReactionEnabled = true;
let devReactionEmoji = '👑';

const badWords = [
    'منيك', 'شرموط', 'قحبه', 'قحبة', 'كس', 'عرض', 'عرص', 'منيوك', 'منيوكة', 
    'عرصه', 'متناك', 'شرموطه', 'قحاب', 'عاهر', 'عاهره', 'ديوث', 'خول', 'قحط', 
    'منيكة', 'عرصات', 'ابن القحبة', 'ابن الكلب'
];

const gamesData = {
    disassemble: [
        { word: 'ناروتو', answer: 'ن ا ر و ت و' },
        { word: 'ايرين', answer: 'ا ي ر ن' },
        { word: 'لوفي', answer: 'ل و ف ي' },
        { word: 'زورو', answer: 'ز و ر و' },
        { word: 'ساسكي', answer: 'س ا س ك ي' },
        { word: 'كاكاشي', answer: 'ك ا ك ا ش ي' }
    ],
    typing: [
        'ناروتو أوزوماكي بطل القرى المخفية وصاحب الإرادة الصلبة',
        'ايرين ييغر عملاق الهجوم الذي سعى خلف حرية شعبه حتى النهاية',
        'مونكي دي لوفي ملك القراصنة المستقبلي وصاحب قبعة القش'
    ],
    riddles: [
        { question: 'من هو الشخصية التي تمتلك قوة العمالقة المؤسس وتتعهد بتحرير شعبها؟', answer: 'ايرين' },
        { question: 'ما هو اسم الفيلق الذي يخرج خارج الأسوار استكشافاً في انمي هجوم العمالقة؟', answer: 'فيلق الاستطلاع' }
    ],
    sports: [
        { question: 'من هو اللاعب الحاصل على أكبر عدد من الكرات الذهبية؟', answer: 'ميسي' },
        { question: 'ما هو النادي الأكثر تحقيقاً لدوري أبطال أوروبا؟', answer: 'ريال مدريد' }
    ],
    smartQ: [
        { question: 'ما هو الحيوان الذي ينام وعينه مفتوحة؟', answer: 'السمكة' },
        { question: 'ما هو الشيء الذي كلما أخذت منه كبر؟', answer: 'الحفرة' }
    ],
    trueFalse: [
        { question: 'هل الشمس تشرق من الغرب؟ (صواب / خطأ)', answer: 'خطأ' },
        { question: 'هل الماء يتكون من هيدروجين وأكسجين؟ (صواب / خطأ)', answer: 'صواب' }
    ],
    cultural: [
        { question: 'ما عاصمة دولة فرنسا؟', answer: 'باريس' },
        { question: 'في أي قارة تقع مصر؟', answer: 'افريقيا' }
    ],
    geography: [
        { question: 'ما هي أكبر دولة في العالم مساحة؟', answer: 'روسيا' },
        { question: 'ما هي عاصمة اليابان؟', answer: 'طوكيو' }
    ],
    science: [
        { question: 'ما هو العنصر الكيميائي الذي يرمز له بالرمز H؟', answer: 'هيدروجين' }
    ],
    history: [
        { question: 'في أي سنة وقعت غزوة بدر الكبرى؟', answer: 'السنة الثانية للهجرة' }
    ],
    islamicQ: [
        { question: 'كم عدد سور القرآن الكريم؟', answer: '114 سورة' }
    ],
    truth: [
        { question: 'لعبة صراحة: ما هو أقوى موقف سويته وتندمت عليه؟', answer: 'صراحة' }
    ],
    challenge: [
        { question: 'تحدي: قم بإرسال ايموجي 🦅 في الشات حالاً!', answer: '🦅' }
    ],
    complete: [
        { question: 'أكمل المثل: اتق شر من أحسنت ...', answer: 'اليه' }
    ],
    arrange: [
        { question: 'رتب الحروف لتكون اسم أنمي: ت و ر ا ن و', answer: 'ناروتو' }
    ],
    guess: [
        { question: 'خمن رقم شخصية بطل أنمي من 1 إلى 3:', answer: '2' }
    ],
    letterGame: [
        { question: 'اكتب اسم شخصية تبدأ بحرف السين (س):', answer: 'ساسكي' }
    ],
    reverseGame: [
        { question: 'تفكيك عكسي لكلمة (سماء):', answer: 'يامس' }
    ],
    wouldYouRather: [
        { question: 'لو خيروك: تنضم لفيلق الاستطلاع 🐎 أو تنضم لفيلق الشرطة العسكرية 🛡️؟' }
    ],
    quotes: [
        '“إن لم تقاتل، فلن تفوز بشيء أبداً!” - إيرين ييغر',
        '“الألم أفضل معلم للبشر.” - پين'
    ]
};

const validCommands = [
    'تفاعل', 'تفاعل_مطور', 'اعطاء', 'إعطاء', 'اذاعة', 'إذاعة', 'ريستارت', 'اعادة_تشغيل', 'حذف', 'مسح', 'كتم', 'الغاء_كتم', 'فك_كتم',
    'خاص', 'عام', 'وضع_خاص', 'وضع_عام', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تفعيل', 'توقيف',
    'قفل', 'غلق', 'فتح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد',
    'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط',
    'حظر_رابط', 'سماح_رابط', 'حظر_سب', 'سماح_سب', 'حظر_جهات', 'حظر_جهات_الاتصال', 'سماح_جهات', 'سماح_جهات_الاتصال',
    'صفر', 'بوت', 'الاوامر', 'اوامر', 'منيو', 'اقسام',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
    'الترفيه', 'العاب', 'فعاليات', 'bank', 'البنك', 'النقاط',
    'متجر', 'المتجر', 'شراء', 'بنك', 'حسابي', 'مكافأة', 'هدية',
    'تحويل', 'توب_نقاط', 'الاغنياء', 'الأغنياء',
    'تفكيك', 'كتابه', 'كتابة', 'حزورة', 'لغز', 'خيروك', 'لوخيروك', 'حكمة',
    'صراحة', 'تحدي', 'اكمل', 'رتب', 'خمن', 'حرف', 'عكس', 'انسحب',
    'المطور', 'مطور', 'الادارة', 'الاداره',
    'اضافة_مطور', 'حذف_مطور', 'قائمة_المطورين', 'سجل_البوت', 'اختبار',
    'اضف_انذار', 'ازل_انذار', 'عدد_الانذارات',
    'حظر رابط', 'سماح رابط', 'حظر سب', 'سماح سب', 'حظر جهات', 'سماح جهات',
    'كرة_قدم', 'مباريات', 'نتائج', 'بطولات', 'لاعب', 'فريق', 'ترتيب', 'هداف', 'مباراة', 'إنجازات',
    'ai', 'اسأل', 'اكتب', 'لخص', 'ترجم', 'صحح', 'فكرة', 'اشرح', 'برمج', 'حل',
    'سؤال', 'سؤال_ذكاء', 'صح_او_خطأ', 'ثقافة', 'جغرافيا', 'علوم', 'تاريخ', 'سؤال_ديني', 'مسابقة', 'اختبرني',
    'قرآن', 'آية', 'سورة', 'دعاء', 'ذكر', 'حديث', 'أذكار', 'قبلة', 'استغفار', 'تذكير',
    'نكتة', 'ضحكني', 'مهرج', 'فضيحة', 'مين_الأكثر', 'ماذا_لو', 'رعب', 'قول', 'مقلب',
    'زواج', 'طلاق', 'غزل', 'ثنائي',
    'ملك_المجموعة', 'ملكة_المجموعة', 'نجم_المجموعة', 'محبوب_المجموعة', 'أذكى_عضو', 'مضحك_المجموعة', 'مشاغب_المجموعة', 'غامض_المجموعة', 'أسطورة_المجموعة', 'مميز_المجموعة',
    'رسائلي', 'رسائل_الأعضاء', 'توب_الرسائل', 'أكثر_عضو_نشاطًا', 'رسائل_أمس', 'رسائل_التاريخ', 'نشاطي', 'تصفير_إحصائياتي', 'إحصائيات_المجموعة', 'أرشيف_الرسائل',
    'تعطيل_البوتات', 'تعطيل بوتات'
];

function isValidCmd(fullCmd) {
    const base = fullCmd.split(' ')[0];
    if (validCommands.includes(fullCmd)) return true;
    if (validCommands.includes(base)) return true;
    return false;
}

function isDeveloper(senderJid, sock) {
    if (!senderJid) return false;
    const cleanNum = senderJid.replace(/[^0-9]/g, '');
    const devNum = DEVELOPER_NUMBER.replace(/[^0-9]/g, '');
    const botJidNum = sock?.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
    if (cleanNum === devNum || cleanNum.endsWith(devNum) || devNum.endsWith(cleanNum)) return true;
    if (botJidNum && (cleanNum === botJidNum || cleanNum.endsWith(botJidNum))) return true;
    return extraDevelopers.some(dev => cleanNum.includes(dev) || dev.includes(cleanNum));
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
        const devJid = DEVELOPER_NUMBER + '@s.whatsapp.net';
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

function startTimedGame(from, sock, gameType, categoryObj, timeoutSec = 30) {
    if (activeGames[from] && activeGames[from].timer) {
        clearTimeout(activeGames[from].timer);
    }
    const timer = setTimeout(async () => {
        if (activeGames[from]) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت!* لم يقم أحد بالإجابة في الوقت المحدد.` });
        }
    }, timeoutSec * 1000);

    const item = categoryObj[Math.floor(Math.random() * categoryObj.length)];
    let promptText = `🎯 *فعالية تفاعلية (معاك ${timeoutSec} ثانية):*\n\n${item.question}`;

    sock.sendMessage(from, { text: promptText }).then(sent => {
        activeGames[from] = { type: gameType, answer: item.answer, category: categoryObj, timer: timer, msgId: sent.key.id };
    });
}

function startNextSameGame(from, sock, gameType, categoryObj) {
    if (activeGames[from] && activeGames[from].timer) {
        clearTimeout(activeGames[from].timer);
    }
    const item = categoryObj[Math.floor(Math.random() * categoryObj.length)];
    let promptText = `🧩 *فعالية موسوعة الأنمي المستمرة (أجب بسرعة):*\n\n${item.word || item.question || item}`;
    if (gameType === 'typing') promptText = `✍️ *سرعة كتابة موسوعية:*\n\nاكتب التالي بدقة:\n\n👉 *${item}*`;
    if (gameType === 'disassemble') promptText = `🧩 *تفكيك شخصيات الأنمي:*\n\nفكك الكلمة:\n\n👉 *${item.word}*`;

    const timer = setTimeout(async () => {
        if (activeGames[from]) {
            delete activeGames[from];
            await sock.sendMessage(from, { text: `⏰ *انتهى الوقت!*` });
        }
    }, 30000);

    sock.sendMessage(from, { text: promptText }).then(sent => {
        activeGames[from] = { type: gameType, answer: item.answer || item, category: categoryObj, timer: timer, msgId: sent.key.id };
    });
}

function getBankAccount(senderJid) {
    if (!bankAccounts[senderJid]) {
        const randomId = Math.floor(100000 + Math.random() * 900000);
        bankAccounts[senderJid] = { bankId: `EREN-${randomId}` };
    }
    if (userPoints[senderJid] === undefined) userPoints[senderJid] = 0;
    return bankAccounts[senderJid];
}

function getGroupSetting(groupId) {
    if (!groupSettings[groupId]) {
        groupSettings[groupId] = {
            adminOnly: false,
            antiLink: true,
            antiBadWords: true,
            antiContact: true,
            welcome: true,
            goodbye: true,
            botMode: 'public',
            antiOtherBots: false
        };
    }
    return groupSettings[groupId];
}

function getTargetUser(msg) {
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
    return mentioned || quoted || null;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('arem_new_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state, 
        version, 
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '110.0.5481.100'],
        syncFullHistory: false, 
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close') {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === 'open') console.log('👑 تم الاتصال بالواتساب بنجاح 👑');
    });

    sock.ev.on('group-participants.update', async (anu) => {
        try {
            const { id, participants, action } = anu;
            const settings = getGroupSetting(id);

            if (action === 'add' && settings.welcome) {
                for (let user of participants) {
                    const userPp = await getUserProfilePic(sock, user);
                    const welcomeMsg = `👋 *أهلاً بك يا أسطورة في الجروب!* @${user.split('@')[0]}\n✨ نورتنا، نتمنى لك وقتاً ممتعاً معنا في عالم الأنمي والفعاليات.`;
                    await sock.sendMessage(id, { image: { url: userPp }, caption: welcomeMsg, mentions: [user] });
                }
            } else if (action === 'remove' && settings.goodbye) {
                for (let user of participants) {
                    const goodbyeMsg = `👋 *غادرنا العضو:* @${user.split('@')[0]}\n🖤 نتمنى له التوفيق في رحلته القادمة.`;
                    await sock.sendMessage(id, { text: goodbyeMsg, mentions: [user] });
                }
            }
        } catch (e) {}
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (!['notify', 'append'].includes(m.type)) return;
        
        const msg = m.messages[0]; 
        if (!msg || !msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const isFromMe = msg.key.fromMe;
        const sender = isFromMe ? (sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (DEVELOPER_NUMBER + '@s.whatsapp.net')) : (msg.key.participant || msg.key.remoteJid);
        const cleanSenderNum = sender.replace(/[^0-9]/g, '');

        if (isGroup) {
            const todayKey = new Date().toLocaleDateString('ar-EG');
            if (!userMessagesCount[from]) userMessagesCount[from] = {};
            if (!userMessagesCount[from][todayKey]) userMessagesCount[from][todayKey] = {};
            userMessagesCount[from][todayKey][sender] = (userMessagesCount[from][todayKey][sender] || 0) + 1;
        }
        
        let isSenderDev = isDeveloper(sender, sock);
        let isSenderAdmin = isFromMe || isSenderDev;

        if (isGroup && !isFromMe && !isSenderDev) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                const participants = groupMetadata.participants;
                isSenderAdmin = participants.some(p => p.id.replace(/[^0-9]/g, '') === cleanSenderNum && (p.admin === 'admin' || p.admin === 'superadmin'));
            } catch (e) {}
        }

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';
        let trimmedBody = body.trim();
        let lowerBody = trimmedBody.toLowerCase();

        if (isGroup && !isFromMe) {
            const groupSt = getGroupSetting(from);
            if (groupSt.antiOtherBots) {
                const botJidId = sock.user?.id ? sock.user.id.split(':')[0] : '';
                const senderIdNum = sender.split('@')[0];
                if (senderIdNum !== botJidId) {
                    const isOtherBot = (msg.key.id && (msg.key.id.startsWith('BAE5') || msg.key.id.length < 20)) ||
                                       (body.startsWith('!') || body.startsWith('#') || body.startsWith('/') || body.startsWith('.')) && !isValidCmd(body.substring(1).toLowerCase().trim().replace(/[أإآا]/g, 'ا').split(' ')[0]);
                    if (isOtherBot) {
                        try { await sock.sendMessage(from, { delete: msg.key }); return; } catch (e) {}
                    }
                }
            }
        }

        if (isGroup && mutedUsers[from] && mutedUsers[from][sender]) {
            if (mutedUsers[from][sender] > Date.now()) {
                try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                return;
            } else {
                delete mutedUsers[from][sender];
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
                        await sock.sendMessage(from, { text: `🚨 @${sender.split('@')[0]} تم طردك لتجاوزك الحد الأقصى من الإنذارات!`, mentions: [sender] });
                        await sock.groupParticipantsUpdate(from, [sender], 'remove');
                        userWarnings[sender] = 0;
                    } else {
                        await sock.sendMessage(from, { text: `⚠️ تنبيه ومخالفة (${violationType})!\n👤 @${sender.split('@')[0]}\n📌 الإنذار: [${userWarnings[sender]}/3]`, mentions: [sender] });
                    }
                    return;
                } catch (e) {}
            }
        }

        if (trimmedBody === '.انسحب' || lowerBody === 'انسحاب') {
            if (activeGames[from]) {
                clearTimeout(activeGames[from].timer);
                delete activeGames[from];
                return sock.sendMessage(from, { text: `🚪 *تم إلغاء الفعالية بنجاح!*` });
            }
        }

        if (activeGames[from]) {
            const game = activeGames[from];
            const quotedContext = msg.message.extendedTextMessage?.contextInfo;
            if (quotedContext && quotedContext.stanzaId === game.msgId) {
                if (!trimmedBody.startsWith('.')) {
                    const cleanUserAns = trimmedBody.replace(/[أإآاىئؤة]/g, 'ا').replace(/\s+/g, ' ').toLowerCase();
                    const cleanCorrectAns = game.answer.replace(/[أإآاىئؤة]/g, 'ا').replace(/\s+/g, ' ').toLowerCase();

                    if (cleanUserAns === cleanCorrectAns || cleanUserAns.includes(cleanCorrectAns)) {
                        clearTimeout(game.timer);
                        getBankAccount(sender);
                        userPoints[sender] += 10;
                        delete activeGames[from];
                        await sock.sendMessage(from, { text: `🎉 *إجابة صحيحة يا أسطورة!* @${sender.split('@')[0]}\n💰 *كسبت 10 نقاط!*`, mentions: [sender] });
                        return;
                    }
                }
            }
        }

        if (!trimmedBody.startsWith('.')) return;

        let cmd = trimmedBody.substring(1).toLowerCase().trim().replace(/[أإآا]/g, 'ا');
        let cmdBase = cmd.split(' ')[0];

        if (!isValidCmd(cmdBase) && !isValidCmd(cmd)) return;
        if (!isGroup) return sock.sendMessage(from, { text: `❌ عذراً، هذا الأمر مخصص للمجموعات فقط!` });

        // --- أوامر الإدارة ---
        if (['قفل', 'غلق', 'فتح', 'حذف', 'مسح', 'الكل', 'منشن', 'رفع', 'ترقية', 'ازل', 'تنزيل', 'طرد', 'اضف_انذار', 'ازل_انذار', 'صفر', 'عدد_الانذارات', 'كتم', 'الغاء_كتم', 'فك_كتم', 'تفعيل ادمن', 'توقيف ادمن', 'تفعيل ترحيب', 'توقيف ترحيب', 'تفعيل توديع', 'توقيف توديع', 'تغيير_الاسم', 'تغيير_الوصف', 'رابط_الجروب', 'الرابط'].includes(cmdBase)) {
            if (!isSenderAdmin && !isSenderDev) {
                return sock.sendMessage(from, { text: '❌ هذا الأمر مخصص للمشرفين والمطور فقط!' });
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
        if (cmdBase === 'بوت') {
            const botWelcomeText = `🍷 *أَهْـلاً بِـكَ فِي عَالَمِ ${DEVELOPER_NAME}* 🍷\n> ┃ ⌯🔮︙الـمُـسـتـخـدم → @${sender.split('@')[0]}\n> ┃ ⌯🎯︙حالة النظام → يعمل بكفاءة عالية 🟢`;
            const botPp = await getBotProfilePic(sock);
            try { await sock.sendMessage(from, { image: { url: botPp }, caption: botWelcomeText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: botWelcomeText, mentions: [sender] }); }
            return;
        }
        if (cmdBase === 'الاوامر' || cmd === 'اوامر' || cmd === 'منيو' || cmd === 'اقسام') {
            const menuText = `🗂️ *قَـائِـمَـةُ الأَقْـسَـامِ (${DEVELOPER_NAME}):*\n> 🛡️ \`.1\` الحماية\n> 🎉 \`.2\` الترفيه والألعاب\n> 💳 \`.3\` البنك والنقاط\n> ⚽ \`.4\` الرياضة\n> 🤖 \`.5\` الذكاء الاصطناعي\n> 🧠 \`.6\` الأسئلة\n> 🕌 \`.7\` اسلامي\n> 😂 \`.8\` الضحك\n> 👥 \`.9\` المجموعات\n> ♟️ \`.10\` المطور\n> ⚡ \`.11\` الادارة`;
            const devPp = await getDeveloperProfilePic(sock);
            try { await sock.sendMessage(from, { image: { url: devPp }, caption: menuText, mentions: [sender] }); } catch (e) { await sock.sendMessage(from, { text: menuText }); }
            return;
        }

        if (cmdBase === '2' || cmd === 'الترفيه' || cmd === 'العاب') {
            startNextSameGame(from, sock, 'disassemble', gamesData.disassemble);
            return;
        }
        if (cmdBase === 'بنك' || cmdBase === 'حسابي') {
            getBankAccount(sender);
            return sock.sendMessage(from, { text: `💳 رصيدك الحالي: *${userPoints[sender]} نقطة*`, mentions: [sender] });
        }
        if (cmdBase === 'مكافأة' || cmdBase === 'هدية') {
            const today = new Date().toLocaleDateString('ar-EG');
            if (dailyRewards[sender] === today) return sock.sendMessage(from, { text: `⚠️ لقد استلمت مكافأتك اليومية مسبقاً!` });
            dailyRewards[sender] = today;
            getBankAccount(sender);
            userPoints[sender] += 50;
            return sock.sendMessage(from, { text: `🎁 تمت إضافة 50 نقطة مكافأة لحسابك!` });
        }
        if (cmdBase === 'ريستارت' || cmdBase === 'اعادة_تشغيل') {
            if (!isSenderDev) return sock.sendMessage(from, { text: '❌ مخصص للمطورين!' });
            await sock.sendMessage(from, { text: '🔄 جاري إعادة تشغيل النظام...' });
            process.exit(0);
        }
    });
}

startBot();
