const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI

const scopes = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-top-read",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
]

const generateRandomString = (length: number) => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const values = crypto.getRandomValues(new Uint8Array(length))

  return values.reduce((acc, x) => acc + possible[x % possible.length], "")
}

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)

  return window.crypto.subtle.digest("SHA-256", data)
}

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

const getSpotifyToken = () => {
  const token = localStorage.getItem("spotify_access_token")

  if (!token) {
    throw new Error("Missing Spotify access token")
  }

  return token
}

export const loginWithSpotify = async () => {
  const codeVerifier = generateRandomString(64)
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64encode(hashed)

  localStorage.setItem("spotify_code_verifier", codeVerifier)
  sessionStorage.setItem("spotify_code_verifier", codeVerifier)

  const authUrl = new URL("https://accounts.spotify.com/authorize")

  authUrl.searchParams.append("client_id", clientId)
  authUrl.searchParams.append("response_type", "code")
  authUrl.searchParams.append("redirect_uri", redirectUri)
  authUrl.searchParams.append("scope", scopes.join(" "))
  authUrl.searchParams.append("code_challenge_method", "S256")
  authUrl.searchParams.append("code_challenge", codeChallenge)

  window.location.href = authUrl.toString()
}

export const getAccessToken = async (code: string) => {
  const codeVerifier =
  localStorage.getItem("spotify_code_verifier") ||
  sessionStorage.getItem("spotify_code_verifier")

if (!codeVerifier) {
  localStorage.removeItem("spotify_access_token")
  window.history.replaceState({}, document.title, "/")
  window.location.reload()
  return
}

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    throw new Error("Could not get Spotify access token")
  }

  return response.json()
}

export const getUserPlaylists = async () => {
  const token = getSpotifyToken()

  let allPlaylists: any[] = []
  let url =
    "https://api.spotify.com/v1/me/playlists?limit=50"

  while (url) {

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {

if (response.status === 401) {

  localStorage.clear()
  sessionStorage.clear()

  window.location.replace("/")

  return {
    items: [],
  }
}

      throw new Error(
        "Could not fetch playlists"
      )
    }

    const data =
      await response.json()

    allPlaylists = [
      ...allPlaylists,
      ...data.items,
    ]

    url = data.next
  }

  return {
    items: allPlaylists,
  }
}

export const getPlaylistTracks = async (playlistId: string) => {
  const token = getSpotifyToken()

  let allTracks: any[] = []
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`

  while (url) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    console.log("SPOTIFY RESPONSE:", data)

    if (!response.ok) {
      throw new Error("Could not fetch playlist tracks")
    }

    allTracks = [...allTracks, ...(data.items || [])]
    url = data.next
  }

  console.log("ALL TRACKS FINAL:", allTracks.length)

  return allTracks
}

export const transferPlaybackToDevice = async (deviceId: string) => {
  const token = getSpotifyToken()

  await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  })
}

export const playTrack = async (
  trackUri: string,
  deviceId: string
) => {
  const token = getSpotifyToken()

  await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [trackUri],
      }),
    }
  )
}

export const pausePlayback = async () => {
  const token = getSpotifyToken()

  await fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const resumePlayback = async () => {
  const token = getSpotifyToken()

  await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const nextTrack = async () => {
  const token = getSpotifyToken()

  await fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const previousTrack = async () => {
  const token = getSpotifyToken()

  await fetch("https://api.spotify.com/v1/me/player/previous", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export const playTrackInPlaylist = async (
  playlistUri: string,
  trackUri: string,
  deviceId: string
) => {
  const token = getSpotifyToken()

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        context_uri: playlistUri,
        offset: {
          uri: trackUri,
        },
        position_ms: 0,
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.error("PLAYBACK ERROR:", error)
  }
}

export async function playPlaylist(playlistUri: string, deviceId: string) {
  const token = localStorage.getItem("spotify_access_token")

  return fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        context_uri: playlistUri,
      }),
    }
  )
}

export async function setShuffle(state: boolean, deviceId: string) {
  const token = localStorage.getItem("spotify_access_token")

  return fetch(
    `https://api.spotify.com/v1/me/player/shuffle?state=${state}&device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
}