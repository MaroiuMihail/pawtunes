export type YouTubeVideo = {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  url: string
}

export async function searchYouTubeVideos(query: string): Promise<YouTubeVideo[]> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY

  if (!apiKey) {
    throw new Error("Missing VITE_YOUTUBE_API_KEY")
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
      query
    )}&key=${apiKey}`
  )

  if (!response.ok) {
    throw new Error("Failed to fetch YouTube videos")
  }

  const data = await response.json()

  return data.items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }))
}