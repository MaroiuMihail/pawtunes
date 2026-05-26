import { useEffect, useMemo, useState } from "react"

import pawLogo from "./assets/logo.png"
import loginBg from "./assets/login-bg.png"
import appBg from "./assets/app-bg.png"


import nextButton from "./assets/nextbutton.png"
import backButton from "./assets/backbutton.png"
import playButton from "./assets/playbutton.png"
import pauseButton from "./assets/pausebutton.png"


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
  const [activeYoutubeVideo, setActiveYoutubeVideo] =
    useState<YouTubeVideo | null>(null)

  const [favoritePlaylistIds, setFavoritePlaylistIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(FAVORITE_PLAYLISTS_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  const [favoriteYoutubeVideos, setFavoriteYoutubeVideos] = useState<
    YouTubeVideo[]
  >(() => {
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

 const visiblePlaylists = searchQuery.trim()
  ? filteredPlaylists.slice(0, 12)
  : filteredPlaylists
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
    <main className="min-h-screen bg-[#0B0D13] px-4 py-6 text-white md:px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#9D7CFF18,transparent_38%),radial-gradient(circle_at_bottom,#6C55F510,transparent_42%)]" />

      <section className="relative mx-auto h-[calc(100vh-48px)] min-h-[680px] w-full max-w-[430px] overflow-hidden rounded-[38px] border border-white/10 bg-[#151922] shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_70px_rgba(124,110,246,0.12)] backdrop-blur-xl">

         <div
          className={`
          pointer-events-none
          absolute
          inset-0
          z-0
          blur-[1px]
          scale-105
          ${selectedPlaylist ? "opacity-18" : "opacity-80"}
          `}
          style={{
          backgroundImage: `url(${appBg})`,
          backgroundSize: selectedPlaylist ? "130%" : "cover",
          backgroundPosition: selectedPlaylist ? "left bottom" : "center",
        }}

        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#9D7CFF18,transparent_42%),radial-gradient(circle_at_bottom,#ffb64812,transparent_48%)]" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[#05070D]/12" />

        {!isLoggedIn ? (
        <div
          className="
          relative
          z-10
          flex
          h-full
          flex-col
          items-center
          justify-start
          px-8
          pt-24
          text-center
          "
          style={{
            backgroundImage: `url(${loginBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >

          <div className="pointer-events-none absolute inset-0 z-0 bg-[#05070dcc]/55" />

          <div className="relative z-10 mb-6 flex items-center justify-center">

            <img
              src={pawLogo}
              alt="PawTunes"
              className="
              h-[225px]
              w-[225px]
              object-contain
              drop-shadow-[0_0_30px_rgba(255,182,72,0.18)]
              "
            />

          </div>

            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E7DEF8]/55">
              PawTunes
            </p>

            <h1 className="mt-4 text-4xl font-black leading-tight text-[#F3E7D7]">
              Your cozy dog music companion
            </h1>

           <p className="mt-5 max-w-[300px] text-sm leading-6 text-[#F3E7D7]/60">
            Music feels better with your cozy
            <br />
            companion by your side.
            </p>

            <button
            onClick={loginWithSpotify}
            className="
            relative
            z-20
            mt-8
            w-full
            rounded-3xl
            bg-gradient-to-r
            from-[#D69A3D]
            to-[#B97826]
            px-6
            py-5
            text-base
            font-black
            text-white
            shadow-[0_16px_34px_rgba(255,182,72,0.28)]
            transition
            hover:scale-[1.02]
            active:scale-[0.98]
            "
          >
            Connect Spotify
          </button>

          </div>
        ) : !selectedPlaylist ? (
          <div className="relative z-10 h-full overflow-y-auto p-5 pb-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="rounded-[32px] border border-[#FFB648]/15 bg-gradient-to-br from-[#2a173d] via-[#1a112a] to-[#10081d] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.32)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E7DEF8]/50">
                    PawTunes
                  </p>

                  <h1 className="mt-3 text-[28px] font-black leading-tight text-[#F3E7D7]">
                  {greeting.title}
                  </h1>

                  <p className="mt-2 text-sm text-[#F3E7D7]/55">
                    {greeting.subtitle}
                  </p>
                  </div>

                <div className="
                flex
                h-[74px]
                w-[74px]
                shrink-0
                items-center
                justify-center
                overflow-hidden
                rounded-[22px]
                border
                border-[#9D7CFF]/10
                bg-white/5
                shadow-[0_0_24px_rgba(157,124,255,0.10)]
                "
                >
                
                {activeTab === "youtube" && activeYoutubeVideo ? (
                <img
                  src={activeYoutubeVideo.thumbnail}
                  alt={activeYoutubeVideo.title}
                  className="h-full w-full object-cover"
                />
              ) : activeTab === "spotify" && selectedTrack?.album?.images?.[0]?.url ? (
                <img
                  src={selectedTrack.album.images[0].url}
                  alt={selectedTrack?.name || "PawTunes"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={pawLogo}
                  alt="PawTunes"
                  className="h-[82px] w-[82px] object-contain opacity-80"
                />
              )}
              </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-[24px] border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setActiveTab("spotify")}
                className={`rounded-[20px] py-3 text-sm font-black transition ${
                  activeTab === "spotify"
                    ? "bg-[#9D7CFF]/14 text-[#F3E7D7] shadow-[0_8px_20px_rgba(157,124,255,0.14)]"
                    : "text-[#F3E7D7]/45"
                }`}
              >
                Spotify
              </button>

              <button
                onClick={async () => {
                if (isPlaying) {
                  await pausePlayback()
                  setIsPlaying(false)
                }
                setActiveTab("youtube")
              }}
                className={`rounded-[20px] py-3 text-sm font-black transition ${
                  activeTab === "youtube"
                    ? "bg-[#9D7CFF]/14 text-[#F3E7D7] shadow-[0_8px_20px_rgba(157,124,255,0.18)]"
                    : "text-[#F3E7D7]/45"
                }`}
              >
                YouTube
              </button>
            </div>

            {activeTab === "spotify" ? (
              <>
                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔍</span>

                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search Spotify playlists..."
                      className="w-full bg-transparent text-sm text-[#E7DEF8] outline-none placeholder:text-[#E7DEF8]/35"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#E7DEF8]/65">
                      Favorites
                    </h2>

                    <span className="text-xs text-[#F3E7D7]/40">
                      {favoritePlaylists.length}/6
                    </span>
                  </div>

                  {favoritePlaylists.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {favoritePlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handlePlaylistClick(playlist)}
                          className="
                          relative
                          min-h-[58px]
                          rounded-[22px]
                          border
                          border-[#9D7CFF]/15
                          bg-gradient-to-br
                          from-[#251433]
                          to-[#110817]
                          px-4 py-2
                          text-left
                          shadow-[0_12px_24px_rgba(0,0,0,0.26)]
                          transition
                          hover:-translate-y-1
                          active:scale-95
                          "
                          >
                          <p className="line-clamp-1 text-[15px] font-black text-[#F3E7D7]">
                            {playlist.name}
                          </p>

                          <button
                            onClick={(event) =>
                              toggleFavoritePlaylist(event, playlist.id)
                            }
                            className="absolute right-3 top-3 text-xs text-[#F3E7D7]/45"
                          >
                            ✕
                          </button>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-[#FFB648]/15 bg-white/5 p-5 text-center">
                      <p className="text-3xl">🐾</p>

                      <p className="mt-2 text-sm font-black text-[#F3E7D7]">
                        No favorites yet
                      </p>

                      <p className="mt-1 text-xs text-[#F3E7D7]/40">
                        Save up to 6 playlists for quick access.
                      </p>

                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#E7DEF8]/65">
                      Playlists
                    </h2>

                    
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
                            className="relative min-h-[64px] rounded-[26px] border border-[#9D7CFF]/18 bg-gradient-to-br from-[#1E2430] to-[#151922] p-3 text-left shadow-[0_12px_26px_rgba(0,0,0,0.24)] transition hover:-translate-y-1 active:scale-95"
                          >
                            <div className="flex items-center gap-2 pr-7">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#9D7CFF]/12 text-base">
                              🎧
                            </div>

                            <p className="truncate text-sm font-black text-[#F3E7D7]">
                              {playlist.name}
                            </p>
                          </div>

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
                    <div className="rounded-[28px] border border-dashed border-[#FFB648]/15 bg-white/5 p-6 text-center">
                      <p className="text-3xl">🔍</p>
                      <p className="mt-2 text-sm font-black text-[#F3E7D7]">
                        No playlists found
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
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
                      className="w-full bg-transparent text-sm text-[#E7DEF8] outline-none placeholder:text-[#E7DEF8]/35"
                    />

                    <button
                      onClick={handleYouTubeSearch}
                      className="rounded-2xl bg-[#9D7CFF]/14 px-3 py-2 text-xs font-black text-[#F3E7D7]"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {activeYoutubeVideo && (
                  <div className="mt-5 rounded-[26px] border border-[#9D7CFF]/15 bg-black/30 p-3 shadow-[0_14px_30px_rgba(0,0,0,0.3)]">
                    <div className="aspect-video overflow-hidden rounded-[20px] bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${activeYoutubeVideo.id}?autoplay=1`}
                        title={activeYoutubeVideo.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black text-[#F3E7D7]">
                          {activeYoutubeVideo.title}
                        </p>

                        <p className="mt-1 truncate text-xs text-[#F3E7D7]/45">
                          {activeYoutubeVideo.channelTitle}
                        </p>
                      </div>

                      <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => toggleFavoriteYoutubeVideo(activeYoutubeVideo)}
                      className="rounded-xl bg-[#9D7CFF]/14 px-3 py-1.5 text-center text-xs font-black text-[#F3E7D7]"
                    >
                      {isFavoriteYoutubeVideo(activeYoutubeVideo.id) ? "Saved" : "Save"}
                    </button>

                    <a
                      href={activeYoutubeVideo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-white/10 px-3 py-1.5 text-center text-xs font-black text-[#E7DEF8]/70"
                    >
                      Open
                    </a>

                    <button
                      onClick={() => setActiveYoutubeVideo(null)}
                      className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-black text-[#E7DEF8]/60"
                    >
                      Close
                    </button>
                  </div>
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#E7DEF8]/65">
                      Saved Videos
                    </h2>

                    <span className="text-xs text-[#F3E7D7]/40">
                      {favoriteYoutubeVideos.length}/8
                    </span>
                  </div>

                  {favoriteYoutubeVideos.length > 0 ? (
                    <div className="space-y-3">
                      {favoriteYoutubeVideos.slice(0, 3).map((video) => (
                        <button
                          key={video.id}
                          onClick={async () => {
                          if (isPlaying) {
                            await pausePlayback()
                            setIsPlaying(false)
                          }
                          setActiveYoutubeVideo(video)
                        }}
                          className="flex w-full gap-3 rounded-[22px] border border-white/10 bg-white/5 p-3 text-left"
                        >
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="h-14 w-20 rounded-2xl object-cover"
                          />

                          <div className="min-w-0">
                            <p className="line-clamp-1 text-xs font-black text-[#F3E7D7]">
                              {video.title}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#F3E7D7]/40">
                              {video.channelTitle}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-[#FFB648]/15 bg-white/5 p-5 text-center">
                      <p className="text-3xl">📺</p>
                      <p className="mt-2 text-sm font-black text-[#F3E7D7]">
                        No saved videos yet
                      </p>
                      <p className="mt-1 text-xs text-[#F3E7D7]/40">
                        Search YouTube and save cozy music videos.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#E7DEF8]/65">
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
                          className="rounded-[24px] border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex gap-3">
                            <img
                              src={video.thumbnail}
                              alt={video.title}
                              className="h-16 w-24 rounded-2xl object-cover"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-xs font-black text-[#F3E7D7]">
                                {video.title}
                              </p>

                              <p className="mt-1 truncate text-xs text-[#F3E7D7]/40">
                                {video.channelTitle}
                              </p>

                              <div className="mt-3 flex gap-2">
                                <button
                                 onClick={async () => {
                                if (isPlaying) {
                                  await pausePlayback()
                                  setIsPlaying(false)
                                }
                                setActiveYoutubeVideo(video)
                              }}
                                  className="rounded-xl bg-[#9D7CFF]/14 px-3 py-2 text-[11px] font-black text-[#F3E7D7]"
                                >
                                  Play
                                </button>

                                <button
                                  onClick={() =>
                                    toggleFavoriteYoutubeVideo(video)
                                  }
                                  className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-[#F3E7D7]"
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
                    <div className="rounded-[28px] border border-dashed border-[#FFB648]/15 bg-white/5 p-6 text-center">
                      <p className="text-3xl">🎵</p>
                      <p className="mt-2 text-sm font-black text-[#F3E7D7]">
                        Search YouTube music above
                      </p>
                      <p className="mt-1 text-xs text-[#F3E7D7]/40">
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
            <div className="border-b border-white/10 bg-gradient-to-b from-[#251634]/70 to-[#141821]/35 px-5 pt-4 pb-3 backdrop-blur-md">
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="mb-4 text-sm font-black text-[#F3E7D7]/55"
              >
                ← Back
              </button>

              <h1 className="text-2xl font-black leading-tight text-[#F3E7D7]">
                {selectedPlaylist.name}
              </h1>

              <p className="mt-2 text-sm text-[#F3E7D7]/45">
              {isLoadingTracks ? "Loading tracks..." : `${tracks.length} tracks`}
            </p>

            <div className="mt-3 h-[1px] bg-gradient-to-r from-[#9D7CFF]/25 via-[#9D7CFF]/8 to-transparent" />

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handlePlayPlaylist}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-[#8E72FF] to-[#6C55F5] px-4 py-3 text-sm font-black shadow-[0_12px_24px_rgba(124,110,246,0.18)] active:scale-95"
                >
                  {activePlaylistId === selectedPlaylist.id && isPlaying
                    ? "Pause"
                    : "Play"}
                </button>

                <button
                  onClick={handleShuffleToggle}
                  className={`flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black transition active:scale-95 ${
                  isShuffleOn
                    ? "border-[#9D7CFF]/70 bg-gradient-to-r from-[#8E72FF]/35 to-[#6C55F5]/25 text-white shadow-[0_0_24px_rgba(157,124,255,0.35)]"
                    : "border-[#9D7CFF]/20 bg-white/10 text-[#E7DEF8]/75 hover:bg-white/15"
                }`}
                >
                  <span className="mr-1">⤨</span>
                  <span>Shuffle</span>

                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                        className="flex w-full items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 p-3 text-left shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition hover:bg-white/10 active:scale-[0.98]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#9D7CFF]/10 text-sm font-black text-[#E7DEF8]/50">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#F3E7D7]">
                            {track.name}
                          </p>

                          <p className="truncate text-xs text-[#F3E7D7]/45">
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
                <div className="rounded-[28px] border border-dashed border-[#9D7CFF]/15 bg-white/5 p-8 text-center">
                  <p className="text-4xl">🐶</p>
                  <p className="mt-3 text-sm font-black text-[#F3E7D7]">
                    No tracks available
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTrack && activeTab === "spotify" && (
          <div className="absolute bottom-3 left-3 right-3 z-20 rounded-[22px] border border-[#9D7CFF]/15 bg-[#121721ee] p-2 shadow-[0_10px_24px_rgba(0,0,0,0.35),0_0_20px_rgba(255,130,235,0.12)] backdrop-blur-xl">
            <p className="text-[10px] text-[#F3E7D7]/40">
              Now playing
            </p>

            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xs font-black text-[#E7DEF8]">
                  {selectedTrack.name}
                </h2>

                <p className="truncate text-xs text-[#F3E7D7]/55">
                  {selectedTrack.artists
                    ?.map((artist: any) => artist.name)
                    .join(", ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handlePrev}
                  className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-[#9D7CFF]/15 bg-white/10 text-lg active:scale-95"
                >
                  {pawTarget === "prev" && (
                    <span className="pointer-events-none absolute text-xl animate-[pawTap_0.45s_ease-out_forwards]">
                      🐾
                    </span>
                  )}
                  <img
                  src={backButton}
                  alt="Previous"
                  className="h-8 w-8 object-contain"
                />
                </button>

                <button
                  onClick={async () => {
                    triggerPaw("play")
                    await handlePlayPause()
                  }}
                  className="
                  relative
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  bg-[#20152E]
                  border
                  border-[#9D7CFF]/25
                  text-[#E7DEF8]
                  text-xl
                  font-black
                  shadow-[0_0_18px_rgba(157,124,255,0.30)]
                  active:scale-95
                  "
                >
                  {pawTarget === "play" && (
                    <span className="pointer-events-none absolute text-2xl animate-[pawTap_0.45s_ease-out_forwards]">
                      🐾
                    </span>
                  )}
                  <img
                  src={isPlaying ? pauseButton : playButton}
                  alt={isPlaying ? "Pause" : "Play"}
                  className="h-10 w-10 object-contain"
                />
                </button>

                <button
                  onClick={handleNext}
                  className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-[#9D7CFF]/15 bg-white/10 text-lg active:scale-95"
                >
                  {pawTarget === "next" && (
                    <span className="pointer-events-none absolute text-xl animate-[pawTap_0.45s_ease-out_forwards]">
                      🐾
                    </span>
                  )}
                  <img
                  src={nextButton}
                  alt="Next"
                  className="h-8 w-8 object-contain"
                />
                </button>
              </div>
            </div>

            <div className="mt-1">
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
                className="h-[2px] w-full accent-[#7C6EF6]"
              />

              <div className="mt-0 flex justify-between text-[10px] text-[#F3E7D7]/40">
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
