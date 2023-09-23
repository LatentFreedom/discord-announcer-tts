# Discord Announcer TTS Bot
Play audio welcome announcement for users joining a voice chat

## Set .env discord token
```
DISCORD_TOKEN=YOUR_DISCORD_TOKEN_FROM_DEVELOPER_PORTAL
GOOGLE_APPLICATION_CREDENTIALS='serviceaccount.json'
DISCORD_VC_ID=ID_OF_DISCORD_VC_CHANNEL
```

## Set serviceaccount.json
Download and save the google api credentials as *serviceaccount.json*

https://console.cloud.google.com/projectselector2/apis/credentials?supportedpurview=project

## Install npm packages
```
npm i
```

## Run the app
```
node index.js
```