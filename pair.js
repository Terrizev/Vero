const { terriid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { Storage } = require("megajs");

const {
    default: Terri,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

function randomMegaId(length = 6, numberLength = 4) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const number = Math.floor(Math.random() * Math.pow(10, numberLength));
    return `${result}${number}`;
}

async function uploadCredsToMega(credsPath) {
    try {
        const storage = await new Storage({
            email: 'kibuukauthuman123@gmail.com',
            password: 'wr-vcR6z5V!9Q5g'
        }).ready;
        console.log('Mega storage initialized.');
        if (!fs.existsSync(credsPath)) {
            throw new Error(`File not found: ${credsPath}`);
        }
        const fileSize = fs.statSync(credsPath).size;
        const uploadResult = await storage.upload({
            name: `${randomMegaId()}.json`,
            size: fileSize
        }, fs.createReadStream(credsPath)).complete;
        console.log('Session successfully uploaded to Mega.');
        const fileNode = storage.files[uploadResult.nodeId];
        const megaUrl = await fileNode.link();
        console.log(`Session Url: ${megaUrl}`);
        return megaUrl;
    } catch (error) {
        console.error('Error uploading to Mega:', error);
        throw error;
    }
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = terriid();
    let num = req.query.number;

    async function Veronica_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let Veronica = Terri({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            if (!Veronica.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Veronica.requestPairingCode(num);
                console.log(`Your Code: ${code}`);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            Veronica.ev.on('creds.update', saveCreds);

            Veronica.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(50000);
                    const filePath = __dirname + `/temp/${id}/creds.json`;
                    if (!fs.existsSync(filePath)) {
                        console.error("File not found:", filePath);
                        return;
                    }

                    const megaUrl = await uploadCredsToMega(filePath);
                    const sid = megaUrl.includes("https://mega.nz/file/")
                        ? 'Veronica~' + megaUrl.split("https://mega.nz/file/")[1]
                        : 'Error: Invalid URL';

                    console.log(`Session ID: ${sid}`);

                    // First send just the session ID quickly
                    const sidMsg = await Veronica.sendMessage(
                        Veronica.user.id,
                        { text: sid },
                        {
                            disappearingMessagesInChat: true,
                            ephemeralExpiration: 86400
                        }
                    );

                    // Then send the detailed message
                    await Veronica.sendMessage(
                        Veronica.user.id,
                        {
                            text: `✅ SESSION GENERATED SUCCESSFULLY!\n\n` +
                                  `📱 Device: iOS Safari\n` +
                                  `🆔 Session ID: ${sid}\n` +
                                  `⏰ Generated: ${new Date().toLocaleString()}\n\n` +
                                  `⚠️ Keep this ID safe! Do not share it with anyone.\n` +
                                  `🔗 To restore session, use the command: /restore ${sid}`,
                            contextInfo: {
                                mentionedJid: [Veronica.user.id],
                                forwardingScore: 999,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363397100406773@newsletter',
                                    newsletterName: 'VERONICA-AI SESSION UPDATE',
                                    serverMessageId: 143
                                }
                            }
                        },
                        {
                            quoted: sidMsg,
                            disappearingMessagesInChat: true,
                            ephemeralExpiration: 86400
                        }
                    );

                    await delay(100);
                    await Veronica.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (
                    connection === "close" &&
                    lastDisconnect &&
                    lastDisconnect.error &&
                    lastDisconnect.error.output.statusCode != 401
                ) {
                    await delay(10000);
                    Veronica_PAIR_CODE();
                }
            });
        } catch (err) {
            console.error("Service Error:", err);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ 
                    code: "Service Temporarily Unavailable",
                    error: err.message 
                });
            }
        }
    }

    return await Veronica_PAIR_CODE();
});

module.exports = router;
