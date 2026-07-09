"""Download de midia por link (Secoes 2 e 3) via yt-dlp."""
import os
import re
import subprocess
import zipfile
import yt_dlp
from ..core.config import settings

PLATFORMS = {
    "youtube": re.compile(r"(youtube\.com|youtu\.be)"),
    "instagram": re.compile(r"instagram\.com"),
    "tiktok": re.compile(r"tiktok\.com"),
    "facebook": re.compile(r"(facebook\.com|fb\.watch)"),
    "pinterest": re.compile(r"(pinterest\.[a-z.]+|pin\.it)"),
}

MEDIA_EXTS = {".mp4", ".mov", ".webm", ".mkv", ".jpg", ".jpeg", ".png", ".gif", ".webp",
              ".mp3", ".m4a", ".ogg", ".wav"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def detect_platform(url: str) -> str | None:
    for name, pat in PLATFORMS.items():
        if pat.search(url):
            return name
    return None


class DownloadError(Exception):
    pass


def _video_codec(path: str) -> str:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=codec_name", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=30,
        )
        return r.stdout.strip()
    except Exception:
        return ""


def _transcode_h264(src: str) -> str:
    dst = src + ".h264.mp4"
    subprocess.run(
        # preset mais leve e threads limitadas: reduz o pico de memoria do
        # libx264 (importante em ambientes com RAM restrita, ex: Railway trial)
        ["ffmpeg", "-y", "-i", src,
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-threads", "2",
         "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", dst],
        capture_output=True, timeout=600, check=True,
    )
    os.replace(dst, src)
    return src


def _zip_dir(out_dir: str, title: str) -> str:
    safe = re.sub(r'[^\w\-]', '_', title or "album")[:60]
    zip_path = os.path.join(out_dir, f"{safe}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(out_dir)):
            full = os.path.join(out_dir, f)
            if os.path.splitext(f)[1].lower() in MEDIA_EXTS and full != zip_path:
                zf.write(full, f)
    return zip_path


def _collect(out_dir: str, exts: set) -> list[str]:
    return [
        os.path.join(out_dir, f)
        for f in sorted(os.listdir(out_dir))
        if os.path.splitext(f)[1].lower() in exts
    ]


def make_thumbnail(src_path: str, out_dir: str) -> str | None:
    """Gera uma miniatura JPEG (max 480px) do arquivo baixado, para exibir na interface."""
    from PIL import Image
    import io

    ext = os.path.splitext(src_path)[1].lower()
    thumb_path = os.path.join(out_dir, "thumb.jpg")
    frame_path = None
    try:
        if ext == ".zip":
            with zipfile.ZipFile(src_path) as zf:
                names = sorted(n for n in zf.namelist() if os.path.splitext(n)[1].lower() in IMAGE_EXTS)
                if not names:
                    return None
                data = zf.read(names[0])
            img = Image.open(io.BytesIO(data))
        elif ext in IMAGE_EXTS:
            img = Image.open(src_path)
        elif ext in {".mp4", ".mov", ".webm", ".mkv"}:
            frame_path = thumb_path + ".frame.jpg"
            subprocess.run(
                ["ffmpeg", "-y", "-ss", "1", "-i", src_path, "-frames:v", "1", frame_path],
                capture_output=True, timeout=30, check=True,
            )
            img = Image.open(frame_path)
        else:
            return None
        img = img.convert("RGB")
        img.thumbnail((480, 480))
        img.save(thumb_path, "JPEG", quality=82)
        return thumb_path
    except Exception:
        return None
    finally:
        if frame_path and os.path.exists(frame_path):
            os.remove(frame_path)


def _base_opts(out_dir: str) -> dict:
    opts = {"outtmpl": f"{out_dir}/%(id)s.%(ext)s", "quiet": True, "noplaylist": True}
    if settings.YTDLP_COOKIES_FILE:
        opts["cookiefile"] = settings.YTDLP_COOKIES_FILE
    return opts


def _download_video(url: str, out_dir: str, selected_items: list[int] | None = None) -> dict:
    opts = _base_opts(out_dir)
    opts["format"] = "bestvideo+bestaudio/best"
    opts["merge_output_format"] = "mp4"
    if selected_items:
        # Only use playlist mode when selecting specific items from a carousel
        opts["noplaylist"] = False
        opts["playlist_items"] = ",".join(str(i) for i in selected_items)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title") or "video"
        duration = info.get("duration")
    files = _collect(out_dir, {".mp4", ".webm", ".mov", ".mkv"})
    if not files:
        raise DownloadError("Nenhum video foi baixado. Verifique o link.")
    path = files[0]
    if path.endswith(".mp4") and _video_codec(path) not in ("h264", "avc1", ""):
        _transcode_h264(path)
    return {"path": path, "title": title, "duration": duration}


def _scrape_og_image(url: str) -> str | None:
    """Extrai og:image de post publico do Instagram (usado so para preview)."""
    import httpx as _httpx, re as _re
    try:
        r = _httpx.get(url, follow_redirects=True, timeout=15, headers={
            "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        })
        if r.status_code != 200:
            return None
        m = (_re.search(r'property="og:image"\s+content="([^"]+)"', r.text) or
             _re.search(r'content="([^"]+)"\s+property="og:image"', r.text))
        if m:
            return m.group(1).replace("&amp;", "&")
    except Exception:
        pass
    return None


def _shortcode_from_url(url: str) -> str | None:
    import re as _re
    m = _re.search(r"/(?:p|reel|tv)/([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def _best_thumb_url(entry: dict) -> str | None:
    """Pega o thumbnail de maior resolucao disponivel de uma entrada do yt-dlp.

    O Instagram nao preenche width/height nos thumbnails retornados pelo
    yt-dlp; a lista vem ordenada da menor para a maior variante de CDN, e o
    ultimo item e o unico sem crop/redimensionamento (sem sufixo sWxW/pWxW no
    parametro stp=). Por isso usamos o ultimo, e nao o de maior width*height
    (que empataria em 0 e sempre pegaria o primeiro/menor).
    """
    thumbs = [t for t in (entry.get("thumbnails") or []) if t.get("url")]
    if not thumbs:
        return entry.get("thumbnail")
    sized = [t for t in thumbs if (t.get("width") or 0) and (t.get("height") or 0)]
    if sized:
        return max(sized, key=lambda t: t["width"] * t["height"])["url"]
    return thumbs[-1]["url"]


def _download_photos(url: str, out_dir: str) -> dict:
    """Baixa fotos/carrossel em resolucao original via yt-dlp + httpx."""
    import httpx as _httpx

    title = "foto"
    downloaded: list[str] = []

    # process=False evita que o yt-dlp tente resolver formatos de video para
    # cada item (o que falha com "No video formats found" em posts de foto e,
    # com ignoreerrors, descarta as entradas inteiras). Com process=False os
    # metadados brutos (incluindo thumbnails) vem preenchidos normalmente.
    opts = {"quiet": True, "noplaylist": False, "ignoreerrors": True}
    if settings.YTDLP_COOKIES_FILE:
        opts["cookiefile"] = settings.YTDLP_COOKIES_FILE
    extract_error = None
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False, process=False) or {}
        title = info.get("title") or title
    except Exception as e:
        info = {}
        extract_error = str(e)

    entries = info.get("entries") or ([info] if info else [])

    for i, entry in enumerate(entries or []):
        if not entry:
            continue
        raw_url = _best_thumb_url(entry)
        if not raw_url:
            continue
        try:
            r = _httpx.get(raw_url, follow_redirects=True, timeout=30,
                           headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code == 200 and len(r.content) > 1000:
                path = os.path.join(out_dir, f"photo_{i:03d}.jpg")
                with open(path, "wb") as f:
                    f.write(r.content)
                downloaded.append(path)
        except Exception:
            pass

    # Fallback: og:image se nao conseguiu nada via yt-dlp
    if not downloaded:
        og_url = _scrape_og_image(url)
        if og_url:
            try:
                r = _httpx.get(og_url, follow_redirects=True, timeout=30,
                               headers={"User-Agent": "Mozilla/5.0"})
                if r.status_code == 200 and len(r.content) > 1000:
                    path = os.path.join(out_dir, "photo_000.jpg")
                    with open(path, "wb") as f:
                        f.write(r.content)
                    downloaded.append(path)
            except Exception:
                pass

    if not downloaded:
        if extract_error and ("not available to everyone" in extract_error.lower()
                               or "certain audiences" in extract_error.lower()):
            raise DownloadError(
                "Este conteudo tem restricao de audiencia no Instagram (idade, sensibilidade "
                "ou publico especifico) e so pode ser visto por quem esta logado. Sem uma sessao "
                "conectada (cookies), o download nao e possivel para este link especifico."
            )
        raise DownloadError(
            "Nao foi possivel baixar as imagens. Verifique se o perfil e publico."
        )
    if len(downloaded) == 1:
        return {"path": downloaded[0], "title": title, "duration": None}
    zip_path = _zip_dir(out_dir, title)
    return {"path": zip_path, "title": title, "duration": None}


def download_media(url: str, out_dir: str, audio_only: bool = True,
                   media_type: str = "video", selected_items: list[int] | None = None) -> dict:
    """Baixa audio, video ou foto/carrossel. media_type: 'video' | 'photo'."""
    try:
        if audio_only:
            opts = _base_opts(out_dir)
            opts["format"] = "bestaudio/best"
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return {"path": ydl.prepare_filename(info),
                        "title": info.get("title"),
                        "duration": info.get("duration")}
        if media_type == "photo":
            return _download_photos(url, out_dir)
        return _download_video(url, out_dir, selected_items=selected_items)
    except DownloadError:
        raise
    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        msg_lower = msg.lower()
        if "not available to everyone" in msg_lower or "certain audiences" in msg_lower:
            raise DownloadError(
                "Este conteudo tem restricao de audiencia no Instagram (idade, sensibilidade "
                "ou publico especifico) e so pode ser visto por quem esta logado. Sem uma sessao "
                "conectada (cookies), o download nao e possivel para este link especifico."
            )
        if "private" in msg_lower or "login" in msg_lower:
            raise DownloadError("Conteudo privado ou que exige login.")
        # Instagram photo post: yt-dlp says "no video" when called as video — retry as photo
        if "no video" in msg_lower and media_type != "photo":
            try:
                return _download_photos(url, out_dir)
            except (DownloadError, Exception):
                pass
        raise DownloadError(f"Nao foi possivel baixar: {msg[:200]}")
