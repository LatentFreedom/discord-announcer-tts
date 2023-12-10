import { Client, GatewayIntentBits } from 'discord.js'
import { createAudioPlayer , createAudioResource, joinVoiceChannel } from '@discordjs/voice'
import { config } from 'dotenv'
import textToSpeech  from '@google-cloud/text-to-speech'

import util from 'util'
import fs from 'fs/promises'

config({ path: './.env' })

const audioQueue = []
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

async function playNextAudio(connection) {
  if (audioQueue.length === 0) {
    connection.disconnect();
    setPresence(client, `on ${getRandomPresence()}`, 'PLAYING', 'idle');
    return;
  }

  const { username, soundFileName } = audioQueue[0]; // Get the next file in the queue
  setPresence(client, `audio for ${username}`, 'PLAYING', 'idle');

  const player = createAudioPlayer();
  connection.subscribe(player);

  const resource = createAudioResource(`./sounds/${soundFileName}`, { inlineVolume: true });
  resource.volume.setVolume(0.2);
  player.play(resource);

  player.on('stateChange', (oldState, newState) => {
    if (newState.status === 'idle' && oldState.status === 'playing') {
      audioQueue.shift(); // Remove the played audio from the queue
      playNextAudio(connection); // Check for the next audio in the queue
    }
  });
}

client.on('voiceStateUpdate', async (oldState, newState) => {

  // CHECK if user state is new
  if (oldState.channelId != newState.channelId) {

    const user = newState.member.user;
    // CHECK if bot joined and do not play anything
    if (user.bot) {
      return;
    }

    let text = null;
    let channelId = null;
    const username = user.tag.split('#')[0];
    
    // CHECK if the new state is the #general voice chat channel
    if (newState.channelId == process.env.DISCORD_VC_ID) {
      text = `Welcome ${username}`;
      channelId = newState.channelId;
    // CHECK if the old state is the #general voice chat channel
    } else if (oldState.channelId == process.env.DISCORD_VC_ID) {
      text = `Goodbye ${username}`;
      channelId = oldState.channelId;
    } else {
      return;
    }

    // GET channel
    const channel = newState.guild.channels.cache.get(channelId);
    // CHECK if channel has no members
    if (channel && channel.members.filter(member => !member.user.bot).size === 0) {
      return;
    }
    
    // FORMAT sound file name
    let soundFileName = `${text.replace(' ','-')}.mp3`;
    // CHECK if sound file already exists
    if (!(await fileExists(`./sounds/${soundFileName}`))) {
      // FETCH sound from google
      console.log(`fetching ${soundFileName} from google`);
      soundFileName = await fetchAudio(text);
    }

    // CHECK if user audio is already in the queue
    const audioExistsInQueue = audioQueue.some(audio => audio.username === username && audio.soundFileName === soundFileName);
    if (audioExistsInQueue) {
      return;
    }
    audioQueue.push({ username: username, soundFileName: soundFileName });

    // CHECK if the bot is already in the voice channel
    const botVoiceState = newState.guild.members.cache.get(client.user.id);
    const botIsInVoiceChannel = botVoiceState.voice.channelId === process.env.DISCORD_VC_ID;

    // CHECK if bot is already in voice channel
    if (!botIsInVoiceChannel) {
      const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: newState.guild.id,
        adapterCreator: newState.guild.voiceAdapterCreator,
      });
      // JOIN voice channel and play audio
      playNextAudio(connection);
    }

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
    voice: {languageCode: 'en-US', name: 'en-GB-Standard-A', ssmlGender: 'FEMALE'},
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
