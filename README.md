# 🎹 Cozy Keys

Play & record MIDI right from your browser. 

*Originally created for the [Supabase LW15 Hackathon](https://supabase.com/blog/lw15-hackathon) and awarded 2nd best overall project 🥈.*

## Demo

[![demo](https://cqjlgirrwebrsqqnvcsm.supabase.co/storage/v1/object/public/app-data/demo.webp)](https://www.loom.com/share/8cc623dbffa8426681dad11f9a90b753)


## Features

**Piano**
- 88 keys with grand piano samples
- 5 presets: Grand Piano, Juno Synth, Kalimba, Moog, OB-Xa Brass
- 3 visual environments with different reverb/delay
- MIDI controller support
- Touch/mouse + keyboard input

**Recording**
- Simultaneous audio (WAV/WebM) + MIDI capture
- Auto-upload to Supabase Storage
- Public/private sharing with hearts
- Synchronized playback visualization

**Cora AI Instructor**
- Voice conversation with ElevenLabs AI
- Real-time chord demonstrations
- Music theory questions and lessons
- Piano integration tools

**Tech Stack**
- React 19, TypeScript, Vite, Tailwind CSS
- Tone.js + Web Audio API
- Supabase (Auth, Database, Storage, Edge Functions)
- ElevenLabs Conversational AI

## Setup

### Prerequisites
- Node.js 18+ 
- ElevenLabs API access (for Cora AI assistant)

### 1. Clone the Repository
```bash
npm install
```

### 2. Environment variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### 3. Supabase Setup

#### Create a new Supabase project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key

#### Database Schema
See `supabase/migrations/init.sql` for the database schema.

#### Storage Bucket
Create a storage bucket called `user-data`:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `user-data`
3. Set it to public (for easy audio playback and restrict modification access to the creator user)

#### Cora endpoint setup
See `supabase/functions/cora/index.ts` for the endpoint.
Setup the following environment variables:
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`

### 4. Cora agent setup
Login to ElevenLabs [Convai CLI](https://elevenlabs.io/docs/conversational-ai/libraries/agents-cli)

Run this command to sync the agent with your ElevenLabs account:

```bash
npx convai sync --agent cora
```


### 5. Run the application

```bash
npm run dev
```

Visit `http://localhost:5173` and start playing! 🎹


## Usage

**Play Piano**
- Click keys, use computer keyboard, or connect MIDI controller
- Switch between 5 sound presets and 3 visual environments

**Record**
- Hit record button → play → stop → auto-saves to cloud
- View recordings panel for playback and sharing

**Learn with Cora**
- "Learn with Cora" → allow mic → ask questions about music theory
- Cora demonstrates chords and plays examples in real-time

**Share & Discover**
- Toggle recordings public/private, heart others' recordings
- Explore global feed filtered by country



## 🤝 Contributing

Contributions are welcome! This project showcases modern web audio capabilities and cloud architecture.


## 🙏 Acknowledgments

- **Supabase** for providing an amazing backend-as-a-service platform
- **ElevenLabs** for the Conversational AI API that powers Cora
- **Tone.js** for excellent web audio synthesis
- **shadcn/ui** for beautiful, accessible components
- **tonal** for Cora's music theory showcase
