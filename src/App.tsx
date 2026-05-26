import { useEffect, useMemo, useState } from "react"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"

import {
  getAccessToken,
  getPlaylistTracks,
  getUserPlaylists,
  loginWithSpotify,
  nextTrack,
  pausePlayback,
  previousTrack,
  resumePlayback,
  transferPlaybackToDevice,
  playTrackInPlaylist,
  setShuffle,
} from "./services/spotify"

import { searchYouTubeVideos, type YouTubeVideo } from "./services/youtube"

declare global {
  interface Window {
    Spotify: any
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

const FAVORITE_PLAYLISTS_STORAGE_KEY = "pawtunesFavoritePlaylistIds"
const FAVORITE_YOUTUBE_STORAGE_KEY = "pawtunesFavoriteYoutubeVideos"

type AppTab = "spotify" | "youtube"

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [playlists, setPlaylists] = useState<any[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [selectedTrack, setSelectedTrack] = useState<any>(null)
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)

  const [deviceId, setDeviceId] = useState("")
  const [player, setPlayer] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isShuffleOn, setIsShuffleOn] = useState(false)
  const [activePlaylistId, setActivePlaylistId] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<AppTab>("spotify")
  const [pawTarget, setPawTarget] = useState("")

  const [youtubeQuery, setYoutubeQuery] = useState("")
  const [youtubeResults, setYoutubeResults] = useState<YouTubeVideo[]>([])
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false)
  const [youtubeError, setYoutubeError] = useState("")

  const [favoritePlaylistIds, setFavoritePlaylistIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(FAVORITE_PLAYLISTS_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  const [favoriteYoutubeVideos, setFavoriteYoutubeVideos] = useState<YouTubeVideo[]>(() => {
    const saved = localStorage.getItem(FAVORITE_YOUTUBE_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem(
      FAVORITE_PLAYLISTS_STORAGE_KEY,
      JSON.stringify(favoritePlaylistIds)
    )
  }, [favoritePlaylistIds])

  useEffect(() => {
    localStorage.setItem(
      FAVORITE_YOUTUBE_STORAGE_KEY,
      JSON.stringify(favoriteYoutubeVideos)
    )
  }, [favoriteYoutubeVideos])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const savedToken = localStorage.getItem("spotify_access_token")

    if (savedToken) {
      setIsLoggedIn(true)
      getUserPlaylists().then((data) => setPlaylists(data.items || []))
      return
    }

    if (!code) return

    getAccessToken(code)
      .then(async (data) => {
        if (!data?.access_token) return

        localStorage.setItem("spotify_access_token", data.access_token)

        const playlistData = await getUserPlaylists()
        setPlaylists(playlistData.items || [])
        setIsLoggedIn(true)

        window.history.replaceState({}, document.title, "/")
      })
      .catch((error) => {
        console.error("Spotify callback failed:", error)

        localStorage.removeItem("spotify_access_token")
        localStorage.removeItem("spotify_code_verifier")
        sessionStorage.removeItem("spotify_code_verifier")

        window.history.replaceState({}, document.title, "/")
      })
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return

    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    )

    if (!existingScript) {
      const script = document.createElement("script")
      script.src = "https://sdk.scdn.co/spotify-player.js"
      script.async = true
      document.body.appendChild(script)
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const token = localStorage.getItem("spotify_access_token")
      if (!token) return

      const spotifyPlayer = new window.Spotify.Player({
        name: "PawTunes",
        getOAuthToken: (cb: any) => cb(token),
      })

      spotifyPlayer.addListener("ready", async ({ device_id }: any) => {
        setDeviceId(device_id)
        await transferPlaybackToDevice(device_id)
      })

      spotifyPlayer.addListener("player_state_changed", (state: any) => {
        if (!state) return

        setPosition(state.position)
        setDuration(state.duration)
        setIsPlaying(!state.paused)

        if (state.track_window?.current_track) {
          setSelectedTrack(state.track_window.current_track)
        }
      })

      spotifyPlayer.connect()
      setPlayer(spotifyPlayer)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!player) return

    const interval = setInterval(async () => {
      const state = await player.getCurrentState()
      if (!state) return

      setPosition(state.position)
      setDuration(state.duration)
      setIsPlaying(!state.paused)

      if (state.track_window?.current_track) {
        setSelectedTrack(state.track_window.current_track)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [player])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()

    if (hour >= 5 && hour < 12) {
      return {
        title: "Good morning",
        subtitle: "Start your day with cozy music.",
        icon: "☀️",
      }
    }

    if (hour >= 12 && hour < 18) {
      return {
        title: "Good afternoon",
        subtitle: "Your cozy music corner is ready.",
        icon: "☕",
      }
    }

    if (hour >= 18 && hour < 23) {
      return {
        title: "Good evening",
        subtitle: "Time for relaxing tunes.",
        icon: "🌙",
      }
    }

    return {
      title: "Good night",
      subtitle: "Late-night listening mode is on.",
      icon: "🌌",
    }
  }, [])

  const favoritePlaylists = playlists
    .filter((playlist) => favoritePlaylistIds.includes(playlist.id))
    .slice(0, 6)

  const filteredPlaylists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return playlists

    return playlists.filter((playlist) =>
      playlist.name?.toLowerCase().includes(query)
    )
  }, [searchQuery, playlists])

  const visiblePlaylists = filteredPlaylists
    .filter((playlist) => !favoritePlaylistIds.includes(playlist.id))
    .slice(0, 12)

  const refreshStateAfterSkip = async () => {
    if (!player) return

    await new Promise((resolve) => setTimeout(resolve, 500))

    const state = await player.getCurrentState()
    if (!state) return

    setPosition(state.position)
    setDuration(state.duration)
    setIsPlaying(!state.paused)

    if (state.track_window?.current_track) {
      setSelectedTrack(state.track_window.current_track)
    }
  }

  const handlePlaylistClick = async (playlist: any) => {
    setSelectedPlaylist(playlist)
    setTracks([])
    setIsLoadingTracks(true)

    try {
      const data = await getPlaylistTracks(playlist.id)
      setTracks(data || [])
    } finally {
      setIsLoadingTracks(false)
    }
  }

  const toggleFavoritePlaylist = (
    event: React.MouseEvent,
    playlistId: string
  ) => {
    event.stopPropagation()

    setFavoritePlaylistIds((previous) => {
      if (previous.includes(playlistId)) {
        return previous.filter((id) => id !== playlistId)
      }

      if (previous.length >= 6) return previous

      return [...previous, playlistId]
    })
  }

  const handlePlayPlaylist = async () => {
    if (!selectedPlaylist?.uri || !deviceId) return

    const isSamePlaylist = activePlaylistId === selectedPlaylist.id

    if (isSamePlaylist && isPlaying) {
      await pausePlayback()
      setIsPlaying(false)
      return
    }

    if (isSamePlaylist && selectedTrack) {
      await resumePlayback()
      setIsPlaying(true)
      return
    }

    const playableTracks = tracks
      .map((item) => item.item || item.track || item)
      .filter((track) => track?.uri)

    if (playableTracks.length === 0) return

    const trackToPlay = isShuffleOn
      ? playableTracks[Math.floor(Math.random() * playableTracks.length)]
      : playableTracks[0]

    setSelectedTrack(trackToPlay)
    setActivePlaylistId(selectedPlaylist.id)

    await transferPlaybackToDevice(deviceId)
    await playTrackInPlaylist(selectedPlaylist.uri, trackToPlay.uri, deviceId)

    setIsPlaying(true)
    await refreshStateAfterSkip()
  }

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pausePlayback()
      setIsPlaying(false)
    } else {
      await resumePlayback()
      setIsPlaying(true)
    }
  }

  const handleShuffleToggle = async () => {
    if (!deviceId) return

    const nextShuffleState = !isShuffleOn

    await setShuffle(nextShuffleState, deviceId)
    setIsShuffleOn(nextShuffleState)
  }

  const handleNext = async () => {
    triggerPaw("next")
    await nextTrack()
    await refreshStateAfterSkip()
  }

  const handlePrev = async () => {
    triggerPaw("prev")

    if (player && position > 3000) {
      await player.seek(0)
      setPosition(0)
      return
    }

    await previousTrack()
    await refreshStateAfterSkip()
  }

  const triggerPaw = (target: string) => {
    setPawTarget("")

    setTimeout(() => {
      setPawTarget(target)
    }, 10)

    setTimeout(() => {
      setPawTarget("")
    }, 450)
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")
    return `${minutes}:${seconds}`
  }

  const logout = () => {
    localStorage.removeItem("spotify_access_token")
    localStorage.removeItem("spotify_code_verifier")
    sessionStorage.removeItem("spotify_code_verifier")
    window.location.reload()
  }

  const handleYouTubeSearch = async () => {
    if (!youtubeQuery.trim()) return

    setIsLoadingYoutube(true)
    setYoutubeError("")

    try {
      const results = await searchYouTubeVideos(youtubeQuery)
      setYoutubeResults(results)
    } catch (error) {
      console.error(error)
      setYoutubeError("Could not load YouTube results.")
    } finally {
      setIsLoadingYoutube(false)
    }
  }

  const toggleFavoriteYoutubeVideo = (video: YouTubeVideo) => {
    setFavoriteYoutubeVideos((previous) => {
      const exists = previous.some((item) => item.id === video.id)

      if (exists) {
        return previous.filter((item) => item.id !== video.id)
      }

      return [video, ...previous].slice(0, 8)
    })
  }

  const isFavoriteYoutubeVideo = (videoId: string) => {
    return favoriteYoutubeVideos.some((video) => video.id === videoId)
  }

  return (
    <main className="min-h-screen bg-[#070311] px-4 py-6 text-white md:px-6">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,#ff7bdc33,transparent_38%),radial-gradient(circle_at_bottom,#7c3cff2e,transparent_42%)]" />

      <section className="relative mx-auto h-[calc(100vh-48px)] min-h-[680px] w-full max-w-[430px] overflow-hidden rounded-[38px] border border-white/10 bg-[#12091f] shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_80px_rgba(255,90,220,0.16)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#ff7bdc24,transparent_42%),radial-gradient(circle_at_bottom,#8f3bff24,transparent_48%)]" />
        <div className="pointer-events-none absolute inset-0 bg-black/10" />

        {!isLoggedIn ? (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="mb-6 overflow-hidden rounded-[34px] border border-pink-200/15 bg-white/10 p-2 shadow-[0_0_44px_rgba(255,100,220,0.16)]">
              <DotLottieReact
                src="/dog-lottie.json"
                autoplay
                loop
                style={{
                  height: "168px",
                  width: "168px",
                }}
              />
            </div>

            <p className="text-xs font-black uppercase tracking-[0.35em] text-pink-200/55">
              PawTunes
            </p>

            <h1 className="mt-4 text-4xl font-black leading-tight text-pink-50">
              Your cozy dog music companion
            </h1>

            <p className="mt-4 max-w-xs text-sm leading-6 text-pink-100/60">
              A polished mobile-first music companion built with Spotify,
              YouTube, Lottie, React and TypeScript.
            </p>

            <button
              onClick={loginWithSpotify}
              className="mt-8 w-full rounded-3xl bg-gradient-to-r from-[#ff5ebf] to-[#8f3bff] px-6 py-4 text-sm font-black text-white shadow-[0_16px_34px_rgba(255,90,190,0.28)] transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Connect Spotify
            </button>

            <p className="mt-4 text-xs text-pink-100/35">
              Spotify API • YouTube API • PWA • Tailwind
            </p>
          </div>
        ) : !selectedPlaylist ? (
          <div className="relative z-10 h-full overflow-y-auto p-5 pb-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="rounded-[32px] border border-pink-200/15 bg-gradient-to-br from-[#2a173d] via-[#1a112a] to-[#10081d] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-pink-200/50">
                    PawTunes
                  </p>

                  <h1 className="mt-3 text-[28px] font-black leading-tight text-pink-50">
                    {greeting.title} {greeting.icon}
                  </h1>

                  <p className="mt-2 text-sm text-pink-100/55">
                    {greeting.subtitle}
                  </p>
                </div>

                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-pink-200/10 bg-white/10 shadow-[0_0_40px_rgba(255,90,220,0.15)]">
                  <DotLottieReact
                    src="/dog-lottie.json"
                    autoplay
                    loop
                    style={{
                      height: "104px",
                      width: "104px",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-[24px] border border-pink-200/10 bg-white/5 p-1">
              <button
                onClick={() => setActiveTab("spotify")}
                className={`rounded-[20px] py-3 text-sm font-black transition ${
                  activeTab === "spotify"
                    ? "bg-pink-400/20 text-pink-50 shadow-[0_8px_20px_rgba(255,90,190,0.12)]"
                    : "text-pink-100/45"
                }`}
              >
                Spotify
              </button>

              <button
                onClick={() => setActiveTab("youtube")}
                className={`rounded-[20px] py-3 text-sm font-black transition ${
                  activeTab === "youtube"
                    ? "bg-pink-400/20 text-pink-50 shadow-[0_8px_20px_rgba(255,90,190,0.12)]"
                    : "text-pink-100/45"
                }`}
              >
                YouTube
              </button>
            </div>

            {activeTab === "spotify" ? (
              <>
                <div className="mt-5 rounded-[22px] border border-pink-200/10 bg-white/5 p-4 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔍</span>

                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search Spotify playlists..."
                      className="w-full bg-transparent text-sm text-pink-100 outline-none placeholder:text-pink-100/35"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-pink-200/65">
                      Favorites
                    </h2>

                    <span className="text-xs text-pink-100/40">
                      {favoritePlaylists.length}/6
                    </span>
                  </div>

                  {favoritePlaylists.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {favoritePlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handlePlaylistClick(playlist)}
                          className="relative rounded-[24px] border border-pink-200/15 bg-gradient-to-br from-[#43215a] to-[#16091f] p-4 text-left shadow-[0_12px_24px_rgba(0,0,0,0.26)] transition hover:-translate-y-1 active:scale-95"
                        >
                          <p className="truncate text-sm font-black text-pink-50">
                            {playlist.name}
                          </p>

                          <p className="mt-1 text-xs text-pink-100/40">
                            Saved playlist
                          </p>

                          <button
                            onClick={(event) =>
                              toggleFavoritePlaylist(event, playlist.id)
                            }
                            className="absolute right-3 top-3 text-xs text-pink-100/45"
                          >
                            ✕
                          </button>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-pink-200/15 bg-white/5 p-5 text-center">
                      <p className="text-3xl">🐾</p>
                      <p className="mt-2 text-sm font-black text-pink-50">
                        No favorites yet
                      </p>
                      <p className="mt-1 text-xs text-pink-100/40">
                        Save up to 6 playlists for quick access.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-pink-200/65">
                      Playlists
                    </h2>

                    <button
                      onClick={logout}
                      className="text-xs font-bold text-pink-100/40"
                    >
                      Logout
                    </button>
                  </div>

                  {visiblePlaylists.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {visiblePlaylists.map((playlist) => {
                        const isFavorite = favoritePlaylistIds.includes(
                          playlist.id
                        )

                        return (
                          <button
                            key={playlist.id}
                            onClick={() => handlePlaylistClick(playlist)}
                            className="relative min-h-[128px] rounded-[26px] border border-pink-200/12 bg-gradient-to-br from-white/10 to-white/5 p-4 text-left shadow-[0_12px_26px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 active:scale-95"
                          >
                            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-400/15 text-2xl">
                              🎧
                            </div>

                            <p className="line-clamp-2 text-sm font-black text-pink-50">
                              {playlist.name}
                            </p>

                            <button
                              onClick={(event) =>
                                toggleFavoritePlaylist(event, playlist.id)
                              }
                              className="absolute bottom-3 right-3 text-lg"
                            >
                              {isFavorite ? "🐾" : "🤍"}
                            </button>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-pink-200/15 bg-white/5 p-6 text-center">
                      <p className="text-3xl">🔍</p>
                      <p className="mt-2 text-sm font-black text-pink-50">
                        No playlists found
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 rounded-[22px] border border-pink-200/10 bg-white/5 p-4 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">▶️</span>

                    <input
                      value={youtubeQuery}
                      onChange={(event) => setYoutubeQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleYouTubeSearch()
                        }
                      }}
                      placeholder="Search YouTube music..."
                      className="w-full bg-transparent text-sm text-pink-100 outline-none placeholder:text-pink-100/35"
                    />

                    <button
                      onClick={handleYouTubeSearch}
                      className="rounded-2xl bg-pink-400/20 px-3 py-2 text-xs font-black text-pink-50"
                    >
                      Go
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-pink-200/65">
                      Saved Videos
                    </h2>

                    <span className="text-xs text-pink-100/40">
                      {favoriteYoutubeVideos.length}/8
                    </span>
                  </div>

                  {favoriteYoutubeVideos.length > 0 ? (
                    <div className="space-y-3">
                      {favoriteYoutubeVideos.slice(0, 3).map((video) => (
                        <a
                          key={video.id}
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex gap-3 rounded-[22px] border border-pink-200/10 bg-white/5 p-3"
                        >
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="h-14 w-20 rounded-2xl object-cover"
                          />

                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs font-black text-pink-50">
                              {video.title}
                            </p>

                            <p className="mt-1 truncate text-xs text-pink-100/40">
                              {video.channelTitle}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-pink-200/15 bg-white/5 p-5 text-center">
                      <p className="text-3xl">📺</p>
                      <p className="mt-2 text-sm font-black text-pink-50">
                        No saved videos yet
                      </p>
                      <p className="mt-1 text-xs text-pink-100/40">
                        Search YouTube and save cozy music videos.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-pink-200/65">
                    YouTube Results
                  </h2>

                  {isLoadingYoutube ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((item) => (
                        <div
                          key={item}
                          className="h-24 animate-pulse rounded-[24px] bg-white/10"
                        />
                      ))}
                    </div>
                  ) : youtubeError ? (
                    <div className="rounded-[28px] border border-red-300/20 bg-red-500/10 p-5 text-center text-sm text-red-100">
                      {youtubeError}
                    </div>
                  ) : youtubeResults.length > 0 ? (
                    <div className="space-y-3">
                      {youtubeResults.map((video) => (
                        <div
                          key={video.id}
                          className="rounded-[24px] border border-pink-200/10 bg-white/5 p-3"
                        >
                          <div className="flex gap-3">
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="h-16 w-24 rounded-2xl object-cover"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-xs font-black text-pink-50">
                                {video.title}
                              </p>

                              <p className="mt-1 truncate text-xs text-pink-100/40">
                                {video.channelTitle}
                              </p>

                              <div className="mt-3 flex gap-2">
                                <a
                                  href={video.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-xl bg-pink-400/20 px-3 py-2 text-[11px] font-black text-pink-50"
                                >
                                  Open
                                </a>

                                <button
                                  onClick={() =>
                                    toggleFavoriteYoutubeVideo(video)
                                  }
                                  className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-pink-50"
                                >
                                  {isFavoriteYoutubeVideo(video.id)
                                    ? "Saved"
                                    : "Save"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-pink-200/15 bg-white/5 p-6 text-center">
                      <p className="text-3xl">🎵</p>
                      <p className="mt-2 text-sm font-black text-pink-50">
                        Search for music videos
                      </p>
                      <p className="mt-1 text-xs text-pink-100/40">
                        YouTube results will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="relative z-10 flex h-full flex-col overflow-hidden">
            <div className="border-b border-pink-200/10 bg-black/20 p-5 backdrop-blur-md">
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="mb-4 text-sm font-black text-pink-100/55"
              >
                ← Back
              </button>

              <h1 className="text-2xl font-black leading-tight text-pink-50">
                {selectedPlaylist.name}
              </h1>

              <p className="mt-2 text-sm text-pink-100/45">
                {isLoadingTracks
                  ? "Loading cozy tracks..."
                  : `${tracks.length} tracks ready`}
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handlePlayPlaylist}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-[#ff5ebf] to-[#8f3bff] px-4 py-3 text-sm font-black shadow-[0_12px_24px_rgba(255,90,190,0.2)] active:scale-95"
                >
                  {activePlaylistId === selectedPlaylist.id && isPlaying
                    ? "Pause"
                    : "Play"}
                </button>

                <button
                  onClick={handleShuffleToggle}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black active:scale-95 ${
                    isShuffleOn
                      ? "border-pink-200/40 bg-pink-400/20 text-pink-50"
                      : "border-pink-200/15 bg-white/10 text-pink-100/60"
                  }`}
                >
                  Shuffle
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pb-36 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {isLoadingTracks ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-[22px] bg-white/10"
                    />
                  ))}
                </div>
              ) : tracks.length > 0 ? (
                <div className="space-y-3">
                  {tracks.map((item, index) => {
                    const track = item.item || item.track || item
                    if (!track) return null

                    return (
                      <button
                        key={`${track.id}-${index}`}
                        onClick={async () => {
                          if (!deviceId || !selectedPlaylist?.uri) return

                          setSelectedTrack(track)
                          setActivePlaylistId(selectedPlaylist.id)

                          await transferPlaybackToDevice(deviceId)
                          await playTrackInPlaylist(
                            selectedPlaylist.uri,
                            track.uri,
                            deviceId
                          )

                          setIsPlaying(true)
                          await refreshStateAfterSkip()
                        }}
                        className="flex w-full items-center gap-3 rounded-[22px] border border-pink-200/10 bg-white/7 p-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition hover:bg-white/10 active:scale-[0.98]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-400/10 text-sm font-black text-pink-100/50">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-pink-50">
                            {track.name}
                          </p>

                          <p className="truncate text-xs text-pink-100/45">
                            {track.artists
                              ?.map((artist: any) => artist.name)
                              .join(", ")}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-[28px] border border-dashed border-pink-200/15 bg-white/5 p-8 text-center">
                  <p className="text-4xl">🐶</p>
                  <p className="mt-3 text-sm font-black text-pink-50">
                    No tracks found
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTrack && (
          <div className="absolute bottom-4 left-4 right-4 z-20 rounded-[28px] border border-pink-200/20 bg-[#20102dee] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.38),0_0_26px_rgba(255,130,235,0.16)] backdrop-blur-xl">
            <p className="text-[10px] text-pink-100/40">
              Now playing with PawTunes
            </p>

            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-pink-100">
                  {selectedTrack.name}
                </h2>

                <p className="truncate text-xs text-pink-100/55">
                  {selectedTrack.artists
                    ?.map((artist: any) => artist.name)
                    .join(", ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-200/15 bg-white/10 text-lg active:scale-95"
                >
                  {pawTarget === "prev" && (
                    <span className="pointer-events-none absolute text-xl animate-[pawTap_0.45s_ease-out_forwards]">
                      🐾
                    </span>
                  )}
                  ⏮
                </button>

                <button
                  onClick={async () => {
                    triggerPaw("play")
                    await handlePlayPause()
                  }}
                  className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-[#ff5ebf] to-[#e941a7] text-xl font-black active:scale-95"
                >
                  {pawTarget === "play" && (
                    <span className="pointer-events-none absolute text-2xl animate-[pawTap_0.45s_ease-out_forwards]">
                      🐾
                    </span>
                  )}
                  {isPlaying ? "Ⅱ" : "▶"}
                </button>

                <button
                  onClick={handleNext}
                  className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-200/15 bg-white/10 text-lg active:scale-95"
                >
                  {pawTarget === "next" && (
                    <span className="pointer-events-none absolute text-xl animate-[pawTap_0.45s_ease-out_forwards]">
                      🐾
                    </span>
                  )}
                  ⏭
                </button>
              </div>
            </div>

            <div className="mt-3">
              <input
                type="range"
                min="0"
                max={duration || 1}
                value={Math.min(position, duration || 0)}
                onChange={async (event) => {
                  const ms = Number(event.target.value)
                  setPosition(ms)
                  if (player) await player.seek(ms)
                }}
                className="w-full accent-pink-400"
              />

              <div className="mt-1 flex justify-between text-[10px] text-pink-100/40">
                <span>{formatTime(position)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App