import { Client, GatewayIntentBits } from 'discord.js'
import { createAudioPlayer , createAudioResource, joinVoiceChannel } from '@discordjs/voice'
import { config } from 'dotenv'
import textToSpeech  from '@google-cloud/text-to-speech'

import util from 'util'
import fs from 'fs/promises'

config({ path: './.env' })

const client = new Client({
  intents : [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
})

client.on('ready', async () => {
    console.log('Announcer Running...')

    // UPDATE presence every 5 minutes (300000 milliseconds)
    setInterval(() => {
      setPresence(client, `on ${getRandomPresence()}`,'PLAYING','idle')
    }, 300000);
})

client.on('voiceStateUpdate', async (oldState, newState) => {

  // CHECK if user state is new
  if (oldState.channelId != newState.channelId) {

    // CHECK if the new state is the desired voice chat channel
    if (newState.channelId != process.env.DISCORD_VC_ID) {
      return;
    }

    const user = newState.member.user;

    // CHECK if bot joined and do not play anything
    if (user.bot) {
      return;
    }

    // CHECK if user is VIP
    const text = `Welcome ${user.tag}`;
    let soundFileName = `${text.replace(' ','-')}.mp3`;
    if (!(await fileExists(`./sounds/${soundFileName}`))) {
      console.log(`fetching ${soundFileName} from google`);
      soundFileName = await fetchAudio(text);
    }

    // Join voice channel and play audio
    setPresence(client, 'intro audio', 'PLAYING','online');
    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    // CONFIGURE audio to be played
    const resource = createAudioResource(`./sounds/${soundFileName}`, { inlineVolume: true });
    resource.volume.setVolume(0.2);
    player.play(resource);

    // Disconnect after 5 seconds
    setTimeout(() => {
      connection.disconnect();
      setPresence(client, `on ${getRandomPresence()}`, 'PLAYING','idle');
    }, 5000);

  }

});

const fetchAudio = async (text) => {
   // Generate TTS audio URL
   const googleClient = new textToSpeech.TextToSpeechClient();
   const fileName = `${text.replace(' ','-')}.mp3`;

   // Construct the request
   const request = {
     input: {text: text},
     // Select the language and SSML voice gender (optional)
     voice: {languageCode: 'en-US', ssmlGender: 'NEUTRAL'},
     // select the type of audio encoding
     audioConfig: {audioEncoding: 'MP3'},
   };

   // Performs the text-to-speech request
   const [response] = await googleClient.synthesizeSpeech(request);
   // Write the binary audio content to a local file
   const writeFile = util.promisify(fs.writeFile);
   writeFile(`./sounds/${fileName}`, response.audioContent, 'binary');
   return fileName;
}

async function fileExists(path) {
  try {
    await fs.access(path, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

const setPresence = async (client, name, type, status) => {
	const types = {
		'PLAYING':0,
		'STREAMING':1,
		'LISTENING':2,
		'WATCHING':3,
		'CUSTOM':4,
		'COMPETING':5
	}
	client.user.setPresence({
      activities: [{
		  name: name,
		  type: types[type]
	  }],
	  status: status
  })
}

const getRandomPresence = () => {
  const websitesToBrowse = [
    'x.com'
  ];
  return websitesToBrowse[Math.floor(Math.random() * websitesToBrowse.length)];
}

client.on('error', console.error);

client.login(process.env.DISCORD_TOKEN)
