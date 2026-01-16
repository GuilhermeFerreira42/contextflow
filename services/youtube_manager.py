
# contextflow/services/youtube_manager.py

import yt_dlp
import re
import os
import random
import time
import requests
import logging
from typing import Optional, Dict, Any, Tuple, List
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger("contextflow.youtube")

class YouTubeManager:
    """
    Gerencia interações com o YouTube: Extração de metadados, thumbnails e download de transcrições.
    Isolado de frameworks web (Flask) para uso desktop.
    """
    def __init__(self):
        self.headers = self._get_realistic_headers()

    def _get_realistic_headers(self) -> Dict[str, str]:
        user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
             'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0'
        ]
        return {
            'User-Agent': random.choice(user_agents),
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

    def validate_url(self, url: str) -> bool:
        youtube_regex = (
            r'(https?://)?(www\.)?'
            '(youtube|youtu|youtube-nocookie)\.(com|be)/'
            '(watch\?v=|embed/|v/|playlist\?list=|.+\?v=)?([^&=%\?]{11}|[a-zA-Z0-9_-]+)'
        )
        return bool(re.match(youtube_regex, url))

    def extract_video_id(self, url: str) -> Optional[str]:
        patterns = [
            r'(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=))([^"&?\/\s]{11})',
            r'(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)([^"&?\/\s]{11})'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match: return match.group(1)
        return None

    def get_video_metadata(self, url: str) -> Dict[str, Any]:
        """Obtém metadados básicos sem baixar o vídeo."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'id': info.get('id'),
                    'title': info.get('title', 'Unknown'),
                    'url': url,
                    'duration': info.get('duration', 0),
                    'upload_date': info.get('upload_date', ''),
                    'thumbnail': info.get('thumbnail', ''),
                    'uploader': info.get('uploader', ''),
                    'status': 'fetched'
                }
        except Exception as e:
            logger.error(f"Metadata extraction failed for {url}: {e}")
            video_id = self.extract_video_id(url)
            return {'id': video_id, 'url': url, 'title': 'Metadata Error', 'status': 'error'}

    def get_transcript(self, video_id: str) -> Tuple[Optional[str], str]:
        """
        Tenta obter transcrição na seguinte ordem:
        1. API (Manual - PT)
        2. API (Manual - EN)
        3. yt-dlp (Auto - PT)
        4. yt-dlp (Auto - EN)
        """
        
        # 1. API - Tentativa Manual
        try:
            # Tenta pegar lista de transcrições disponíveis
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            # Tenta encontrar manual created em PT
            try:
                t = transcript_list.find_manually_created_transcript(['pt', 'pt-BR'])
                return self._clean_text(" ".join([i['text'] for i in t.fetch()])), "api_manual_pt"
            except:
                pass

            # Tenta manual EN e traduz? Não, por enquanto só pega original
            try:
                 t = transcript_list.find_manually_created_transcript(['en'])
                 return self._clean_text(" ".join([i['text'] for i in t.fetch()])), "api_manual_en"
            except:
                pass
                
            # Fallback para generated se não achou manual (via API)
            try:
                t = transcript_list.find_generated_transcript(['pt', 'pt-BR'])
                return self._clean_text(" ".join([i['text'] for i in t.fetch()])), "api_auto_pt"
            except:
                pass
                
        except Exception as e:
            logger.warning(f"YouTubeTranscriptApi initial check failed: {e}")

        # 2. Fallback via yt-dlp (Heavy methods)
        # Tenta Auto PT
        res, method = self._download_subtitles_fallback(video_id, langs=['pt', 'pt-BR'])
        if res: return res, f"ytdlp_{method}"
        
        # Tenta Auto EN
        res, method = self._download_subtitles_fallback(video_id, langs=['en'])
        if res: return res, f"ytdlp_{method}"

        return None, "failed"

    def _download_subtitles_fallback(self, video_id: str, langs: List[str] = None) -> Tuple[Optional[str], str]:
        if langs is None: langs = ["pt", "pt-BR", "en"]
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': langs,
            'subformat': 'json3',
            'quiet': True
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                # Check standard subtitles first
                subs = info.get('subtitles', {}) 
                # Then auto captions
                auto_subs = info.get('automatic_captions', {})
                
                target_url = None
                
                # Helper to find url in dict
                def find_url(source, lang_list):
                    for lang in lang_list:
                         if lang in source:
                            for fmt in source[lang]:
                                if fmt.get('ext') in ['json3', 'srv3', 'vtt', 'ttml']:
                                    return fmt['url']
                    return None

                target_url = find_url(subs, langs)
                if not target_url:
                    target_url = find_url(auto_subs, langs)
                
                if target_url:
                    resp = requests.get(target_url, headers=self.headers)
                    if resp.status_code == 200:
                        return self._clean_downloaded_subs(resp.text), "fallback_ytdlp"
        except Exception as e:
            logger.error(f"Fallback download failed for {video_id} with langs {langs}: {e}")
        return None, "failed"

    def _clean_text(self, text: str) -> str:
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _clean_downloaded_subs(self, raw_content: str) -> str:
        """Limpa legendas que podem vir em XML, JSON3 ou VTT."""
        import traceback
        
        # Log para debug extremo se falhar
        # logger.debug(f"Cleaning content (preview): {raw_content[:200]}")
        
        # 1. Tentar JSON3 (Google Format)
        try:
            import json
            possible_json = json.loads(raw_content)
            
            if possible_json and 'events' in possible_json:
                segs = []
                for event in possible_json['events']:
                    if 'segs' in event:
                        for s in event['segs']:
                            if 'utf8' in s and s['utf8'].strip():
                                segs.append(s['utf8'].strip())
                return self._clean_text(" ".join(segs))
        except Exception as e:
            # logger.warning(f"JSON3 cleanup failed: {e}")
            pass

        # 2. Fallback (VTT/XML/Raw)
        try:
            text = re.sub(r'<[^>]+>', '', raw_content) # Remove XML tags
            text = re.sub(r'WEBVTT', '', text)
            # Remove timestamps VTT: 00:00:00.000 -> ...
            text = re.sub(r'\d{1,2}:\d{1,2}:\d{1,2}[\.,]\d{3}.*', '', text) 
            
            # Se tiver cara de JSON mas falhou o load, tenta limpar chaves
            if '{' in text and '}' in text:
                 text = re.sub(r'[{:"},]', ' ', text)
                 text = re.sub(r'wireMagic|pens|wsWinStyles|wpWinPositions|events|tStartMs|dDurationMs|utf8|acAsrConf', '', text)
            
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            clean_lines = [l for l in lines if not re.match(r'^\d+$', l) and '-->' not in l]
            
            return self._clean_text(" ".join(clean_lines))
        except Exception as e:
            logger.error(f"Fallback cleanup failed: {traceback.format_exc()}")
            return ""

    def get_playlist_info(self, url: str) -> Dict[str, Any]:
        """Retorna info da playlist e vídeos."""
        ydl_opts = {
            'extract_flat': 'in_playlist',
            'quiet': True,
            'no_warnings': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if 'entries' in info:
                    return {
                        'id': info.get('id'),
                        'title': info.get('title', 'Playlist'),
                        'videos': [
                            {'id': e['id'], 'title': e.get('title'), 'url': e.get('url')} 
                            for e in info['entries'] if e.get('id')
                        ]
                    }
        except Exception as e:
            logger.error(f"Playlist info extraction failed: {e}")
        return {}

    def download_thumbnail(self, url: str, save_path: str) -> bool:
        """Baixa e salva thumbnail."""
        try:
            # Garantir que diretório existe
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            
            resp = requests.get(url, headers=self.headers, stream=True, timeout=10)
            if resp.status_code == 200:
                with open(save_path, 'wb') as f:
                    for chunk in resp.iter_content(1024):
                        f.write(chunk)
                return True
            else:
                logger.error(f"Thumbnail request failed: {resp.status_code}")
        except Exception as e:
            logger.error(f"Thumbnail download failed: {e}")
        return False
