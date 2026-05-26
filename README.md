# PawTunes 🐾🎵

PawTunes is a premium cozy music companion app built for music lovers who want a clean, elegant experience for discovering and enjoying playlists.

The app combines Spotify playback with YouTube music discovery in a single premium mobile-inspired interface focused on simplicity, atmosphere, and smooth listening.

---

## Features

### Spotify Integration

- Spotify OAuth authentication
- Spotify playlist browsing
- Playlist search
- Favorite playlists system (up to 6 quick-access playlists)
- Track playback controls
- Play / Pause
- Next / Previous track
- Shuffle mode
- Playback progress bar
- Spotify Web Playback SDK integration

### YouTube Music Discovery

- Search YouTube music videos
- Embedded video playback
- Save favorite videos (up to 8)
- Quick access saved videos
- Open videos directly on YouTube

### Premium Mobile UI

- Luxury dark aesthetic
- Cozy ambient styling
- Mobile-first design
- Dynamic backgrounds
- Smooth interactions
- Responsive experience
- Premium music app inspired visuals

---

## Tech Stack

### Frontend

- React
- TypeScript
- TailwindCSS
- Vite

### Spotify

- Spotify Web API
- Spotify Web Playback SDK
- OAuth PKCE Authentication

### YouTube

- YouTube Data API v3

### Storage

- LocalStorage
- SessionStorage

---

## Installation

Clone repository:

```bash
git clone https://github.com/YOUR_USERNAME/pawtunes.git
```

Go into project:

```bash
cd pawtunes
```

Install dependencies:

```bash
npm install
```

Create environment file:

```env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

Run development:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

---

## Spotify Setup

Spotify integration requires your own Spotify Developer application.

### 1. Open Spotify Dashboard

https://developer.spotify.com/dashboard

### 2. Create App

Press:

```text
Create App
```

Example:

```text
App Name: PawTunes
App Description: Premium cozy music companion
```

### 3. Add Redirect URI

Development:

```text
http://127.0.0.1:5173
```

Production:

```text
your-production-url
```

### 4. Save Settings

### 5. Copy Client ID

Create:

```env
VITE_SPOTIFY_CLIENT_ID=your_client_id
```

Restart app:

```bash
npm run dev
```

---

## YouTube Setup

YouTube music search requires YouTube Data API access.

### 1. Open Google Cloud Console

https://console.cloud.google.com/

### 2. Create Project

### 3. Enable API

Enable:

```text
YouTube Data API v3
```

### 4. Create API Key

Copy generated key.

Create:

```env
VITE_YOUTUBE_API_KEY=your_api_key
```

Restart app:

```bash
npm run dev
```

---

## Project Structure

```text
src/
 ├── assets/
 ├── services/
 │    ├── spotify.ts
 │    └── youtube.ts
 ├── App.tsx
 └── main.tsx
```

---

## Screens

### Login

Spotify authentication experience.

### Spotify Home

Browse playlists and favorites.

### Playlist View

Track browsing with playback controls.

### YouTube Discovery

Search and save music videos.

---

## Future Improvements

- Resume YouTube playback position
- Recently played history
- User settings page
- Cross-device sync
- Playlist organization improvements
- Paw companion animations
- Audio visualizer

---

## MVP Status

PawTunes MVP — Released

Built as a personal frontend product focused on premium UX, music experience, and modern frontend engineering.

---