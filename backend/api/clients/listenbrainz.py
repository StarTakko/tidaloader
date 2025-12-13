
import httpx
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
import logging

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class ListenBrainzTrack:
    title: str
    artist: str
    mbid: Optional[str] = None
    album: Optional[str] = None

class ListenBrainzClient:
    """Client for ListenBrainz API"""
    
    BASE_URL = "https://api.listenbrainz.org/1"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def get_user_playlists(self, username: str) -> List[Dict[str, Any]]:
        """Fetch playlists for a user"""
        url = f"{self.BASE_URL}/user/{username}/playlists"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()
            return data.get("playlists", [])
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.warning(f"User {username} not found or has no playlists")
                return []
            logger.error(f"Error fetching playlists for {username}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error fetching playlists for {username}: {e}")
            raise

    async def get_playlist(self, playlist_id: str) -> Dict[str, Any]:
        """Fetch a specific playlist by ID"""
        url = f"{self.BASE_URL}/playlist/{playlist_id}"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching playlist {playlist_id}: {e}")
            raise

    async def get_weekly_jams(self, username: str) -> List[ListenBrainzTrack]:
        """
        Fetch the 'Weekly Jams' playlist for a user.
        Returns a list of ListenBrainzTrack objects.
        """
        logger.info(f"Fetching Weekly Jams for {username}")
        
        # 1. List user playlists
        playlists = await self.get_user_playlists(username)
        
        # 2. Find 'Weekly Jams'
        # The name might be "Weekly Jams" or similar. We'll search case-insensitive.
        weekly_jams_playlist = None
        for pl in playlists:
            title = pl.get("playlist", {}).get("title", "")
            if "weekly jams" in title.lower():
                weekly_jams_playlist = pl.get("playlist")
                break
        
        if not weekly_jams_playlist:
            # Fallback: Check for other periodic jams like "Weekly Exploration"
            for pl in playlists:
                title = pl.get("playlist", {}).get("title", "")
                if "weekly exploration" in title.lower():
                    weekly_jams_playlist = pl.get("playlist")
                    break
        
        if not weekly_jams_playlist:
            logger.warning(f"No Weekly Jams playlist found for {username}")
            return []

        # 3. The playlist object from the list endpoint might already contain tracks? 
        # Usually JSPF includes 'track' list.
        # Let's inspect the structure we got. If it's a summary, we might need to fetch details.
        # But /user/{username}/playlists usually returns the full JSPF or a list of summaries.
        # Based on docs, it returns a list of JSPF playlists.
        
        tracks_data = weekly_jams_playlist.get("track", [])
        
        lb_tracks = []
        for t in tracks_data:
            title = t.get("title", "Unknown Title")
            artist = t.get("creator", "Unknown Artist")
            album = t.get("album")
            
            # Extract MBID from identifiers if available
            # Expected format: "identifiers": {"mbid": "..."} or list
            mbid = None
            identifiers = t.get("identifier", [])
            # identifiers can be a list of strings or dict? JSPF standard says list of strings usually.
            # But ListenBrainz might use custom extensions.
            # Let's check 'extension' field.
            extension = t.get("extension", {})
            # musicbrainz_track_id might be there
            if "musicbrainz_track_id" in extension:
                mbid = extension["musicbrainz_track_id"]
            
            # Also check simple identifiers if they are key-value
            if not mbid and isinstance(identifiers, dict):
                 mbid = identifiers.get("musicbrainz_track_id")

            lb_tracks.append(ListenBrainzTrack(
                title=title,
                artist=artist,
                mbid=mbid,
                album=album
            ))
            
        logger.info(f"Found {len(lb_tracks)} tracks in Weekly Jams for {username}")
        return lb_tracks

