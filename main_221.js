// ============================
// YouTube IFrame API
// ============================
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

// ==========================================
// 1. 全域變數與單一狀態管理 (State Management)
// ==========================================
let player = null;
window.videoPlayer = null;

const STORAGE_KEY = 'youtube_player_state';

// 🟢 預設狀態物件 (新增 playlistIndex)
let playerState = {
    viewMode: 'video',
    playTime: 0,
    mediaType: 'video',
    mediaId: '9xp1XWmJ_Wo', // 預設影片
    playlistIndex: 0,       // 🟢 新增：記憶播放清單播到第幾首
    isMuted: false,
    playbackSpeed: 1
};

// 單一讀取函式：網頁載入時執行一次
function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            playerState = { ...playerState, ...JSON.parse(saved) };
        } catch (e) {
            console.error('讀取存檔失敗', e);
        }
    }
}
loadState(); 

// 單一儲存函式
function saveState(updates) {
    if (updates) playerState = { ...playerState, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playerState));
}

// 根據讀取的狀態設定媒體變數
let videoId = playerState.mediaType === 'video' ? playerState.mediaId : '';
let playList = playerState.mediaType === 'playlist' ? playerState.mediaId : null;

const videoCache = {};
let timeUpdateTimer = null; 

// ==========================================
// 2. DOM 元素取得
// ==========================================
const viewModeBtn = document.getElementById('viewModeBtn');
const playerCover = document.getElementById('playerCover');
const coverTitle = document.getElementById('coverTitle');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const playerWrapper = document.getElementById('player-wrapper'); 
const progressBarContainer = document.getElementById('progressBarContainer');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const videoTitleEl = document.getElementById('videoTitle');

const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const muteBtn = document.getElementById('muteBtn');
const playBtn = document.getElementById('playBtn');
const playDefaultBtn = document.getElementById('playDefaultBtn');
const videoUrlInput = document.getElementById('videoUrl');
const speedSelect = document.getElementById('speedSelect');
const playlistList = document.getElementById('playlistList');
const playlistText = document.getElementById('playlist');

if (playerWrapper) playerWrapper.style.position = 'relative';

// ==========================================
// 3. 初始化儲存狀態 (UI 部分)
// ==========================================
function initSavedUIState() {
    // 1. 檢視模式
    if (viewModeBtn && playerCover) {
        viewModeBtn.setAttribute('data-mode', playerState.viewMode);
        if (playerState.viewMode === 'cover') {
            viewModeBtn.innerHTML = '<i class="bi bi-film"></i>';
            playerCover.style.display = 'block';
            playerCover.style.pointerEvents = 'auto';
        } else {
            viewModeBtn.innerHTML = '<i class="bi bi-image"></i>';
            playerCover.style.display = 'none';
            playerCover.style.pointerEvents = 'none';
        }
    }

    // 2. 播放速度選單
    if (speedSelect) speedSelect.value = playerState.playbackSpeed;

    // 3. 🟢 將儲存的網址填回輸入框，讓重載時有明確的視覺反饋
    if (videoUrlInput) {
        if (playerState.mediaType === 'playlist') {
            videoUrlInput.value = 'https://www.youtube.com/playlist?list=' + playerState.mediaId;
        } else if (playerState.mediaType === 'video' && playerState.mediaId !== '9xp1XWmJ_Wo') {
            videoUrlInput.value = 'https://www.youtube.com/watch?v=' + playerState.mediaId;
        }
    }
}
initSavedUIState();

// ==========================================
// 4. YouTube Iframe API 核心初始化
// ==========================================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        width: '100%',
        height: '100%',
        // 🟢 這裡刻意留空，交給 loadCurrentMedia 去精準控制載入參數
        playerVars: {
            autoplay: 1,
            mute: playerState.isMuted ? 1 : 0, // 🟢 直接在底層套用靜音設定
            playsinline: 1,
            controls: 0,
            rel: 0,
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });
    window.videoPlayer = player;
}

function onPlayerReady() {
    player.setPlaybackRate(parseFloat(playerState.playbackSpeed));
    updateMuteIcon(playerState.isMuted);

    // 🟢 傳入 true 代表這是「重載網頁時的初始載入」
    loadCurrentMedia(true);
}

// 🟢 修正載入邏輯：原生支援指定秒數與歌單索引
async function loadCurrentMedia(isInitLoad = false) {
    if (!player) return;

    // 如果是初始重載，就取出存好的進度；否則歸零
    const startSec = isInitLoad ? playerState.playTime : 0;
    const listIdx = isInitLoad ? playerState.playlistIndex : 0;

    if (playList) {
        // 使用官方物件寫法，完美跳到上次的那首與那秒
        player.loadPlaylist({ 
            listType: 'playlist', 
            list: playList,
            index: listIdx,
            startSeconds: startSec
        });
    } else if (videoId) {
        try {
            const videoinfo = await fetchVideoInfo(videoId);
            updateCoverImage(videoinfo.thumbnail, '正在播放：' + videoinfo.title);
        } catch (error) {
            updateCoverImage('', '正在播放...');
        }
        // 使用官方物件寫法
        player.loadVideoById({
            videoId: videoId,
            startSeconds: startSec
        });
    }
}

function onPlayerStateChange(event) {
    const currentMode = viewModeBtn ? viewModeBtn.getAttribute('data-mode') : 'video';

    if (event.data === YT.PlayerState.PLAYING) {
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
        startTimeUpdate();
        if (currentMode === 'video' && playerCover) playerCover.style.opacity = '0';
    } else {
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        stopTimeUpdate();
        if (event.data === YT.PlayerState.BUFFERING && playerCover) {
            playerCover.style.opacity = '1'; 
        }
    }

    const list = player.getPlaylist();
    if (list && list.length > 0) {
        renderPlaylist();
    } else {
        if (playlistList) playlistList.innerHTML = '<div class="p-3 text-muted text-center">單一影片播放中，無播放清單</div>';
        if (playlistText) playlistText.textContent = '';
    }

    updateVideoData();
}

// ==========================================
// 5. 進度條、時間更新與 LocalStorage 追蹤
// ==========================================
function startTimeUpdate() {
    if (timeUpdateTimer) clearInterval(timeUpdateTimer);

    timeUpdateTimer = setInterval(() => {
        if (!player || typeof player.getCurrentTime !== 'function') return;

        const c = player.getCurrentTime();
        const d = player.getDuration();
        
        // 🟢 即時抓取目前播放清單播到第幾首
        const idx = (typeof player.getPlaylistIndex === 'function') ? player.getPlaylistIndex() : 0;

        if (!isNaN(c) && !isNaN(d)) {
            if (currentTimeEl) currentTimeEl.textContent = `${format(c)} / ${format(d)}`;
            
            if (d > 0) {
                const percentage = (c / d) * 100;
                if (progressBar) progressBar.style.width = `${percentage}%`;
                
                // ⭐ 持續儲存：時間與歌單索引
                saveState({ playTime: c, playlistIndex: idx }); 
            }
        }
        updateMuteIcon(player.isMuted());
    }, 250);
}

function stopTimeUpdate() {
    clearInterval(timeUpdateTimer);
    timeUpdateTimer = null;
    if (player && typeof player.getCurrentTime === 'function') {
        const idx = (typeof player.getPlaylistIndex === 'function') ? player.getPlaylistIndex() : 0;
        saveState({ playTime: player.getCurrentTime(), playlistIndex: idx });
    }
}

function format(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

if (progressBarContainer) {
    progressBarContainer.addEventListener('click', (e) => {
        if (player && typeof player.getDuration === 'function') {
            const duration = player.getDuration();
            if (duration > 0) {
                const rect = progressBarContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
                const seekTime = duration * percentage;
                
                player.seekTo(seekTime, true);
                if (progressBar) progressBar.style.width = `${percentage * 100}%`;
                saveState({ playTime: seekTime });
            }
        }
    });
}

// ==========================================
// 6. 資料獲取與 UI 渲染
// ==========================================
async function fetchVideoInfo(id) {
    if (videoCache[id]) return videoCache[id];
    try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
        const data = await res.json();
        const info = { title: data.title, thumbnail: data.thumbnail_url, author: data.author_name };
        videoCache[id] = info;
        return info;
    } catch (e) {
        return { title: id, thumbnail: '', author: '' };
    }
}

function parseYoutubeUrl(url) {
    const result = { videoId: null, playlistId: null };
    if (!url) return result;
    try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('list')) result.playlistId = urlObj.searchParams.get('list');
        if (urlObj.searchParams.has('v')) result.videoId = urlObj.searchParams.get('v');
        else if (urlObj.hostname === 'youtu.be') result.videoId = urlObj.pathname.substring(1);
        else if (urlObj.pathname.startsWith('/embed/')) result.videoId = urlObj.pathname.split('/')[2];
    } catch (e) {
        if (url.length === 11) result.videoId = url;
        else if (url.length > 11) result.playlistId = url;
    }
    return result;
}

async function renderPlaylist() {
    if (!player || !playlistList) return;
    const list = player.getPlaylist();
    if (!list) return;

    const currentIndex = player.getPlaylistIndex();
    const infos = await Promise.all(list.map(id => fetchVideoInfo(id)));
    let html = '';

    infos.forEach((info, i) => {
        const active = i === currentIndex;
        html += `
            <div class="item ${active ? 'active' : ''}" data-index="${i}"
                 style="display:flex; gap:10px; padding:8px; cursor:pointer; align-items:center; background:${active ? '#ffe0e0' : '#fff'}; border-bottom:1px solid #eee;">
                <div class="user-select-none fw-bold">${i + 1}</div>
                <img src="${info.thumbnail}" class="user-select-none" style="width:120px;height:68px;object-fit:cover;border-radius:6px;" />
                <div>
                    <div style="font-size:14px;font-weight:bold;">${info.title}</div>
                    <div style="font-size:12px;color:#666;">${info.author}</div>
                </div>
            </div>
        `;
        if (active) updateCoverImage(info.thumbnail, '正在播放：' + info.title);
    });

    playlistList.innerHTML = html;
    playlistList.style.display = 'flex';
    playlistList.style.flexDirection = 'column';
    if (playlistText) playlistText.textContent = `(${currentIndex + 1} / ${list.length})`;

    setTimeout(() => {
        const activeItem = playlistList.querySelector('.item.active');
        if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
}

function updateVideoData() {
    const data = player.getVideoData();
    if (!data || !videoTitleEl) return;
    saveState({ mediaId: data.video_id });
    videoTitleEl.textContent = data.title || '';
}

function updateCoverImage(imgUrl, titleText) {
    if (!playerCover) return;
    playerCover.style.backgroundImage = imgUrl ? `url('${imgUrl}')` : 'none';
    if (titleText && coverTitle) coverTitle.textContent = titleText;
    playerCover.style.opacity = '1';
}

function updateMuteIcon(isMuted) {
    if (!muteBtn) return;
    muteBtn.innerHTML = isMuted ? '<i class="bi bi-volume-mute-fill"></i>' : '<i class="bi bi-volume-up-fill"></i>';
}

// ==========================================
// 7. 各類按鈕與事件監聽
// ==========================================

if (viewModeBtn && playerCover) {
    viewModeBtn.addEventListener('click', () => {
        const currentMode = viewModeBtn.getAttribute('data-mode');
        const newMode = currentMode === 'video' ? 'cover' : 'video';
        
        viewModeBtn.setAttribute('data-mode', newMode);
        viewModeBtn.innerHTML = newMode === 'cover' ? '<i class="bi bi-film"></i>' : '<i class="bi bi-image"></i>';
        playerCover.style.display = newMode === 'cover' ? 'block' : 'none';
        playerCover.style.pointerEvents = newMode === 'cover' ? 'auto' : 'none';
        
        saveState({ viewMode: newMode });
    });
}

if (muteBtn) muteBtn.addEventListener('click', () => {
    if (!player) return;
    const isMuted = player.isMuted();
    if (isMuted) player.unMute(); else player.mute();
    updateMuteIcon(!isMuted);
    saveState({ isMuted: !isMuted });
});

if (speedSelect) speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    if (player) player.setPlaybackRate(speed);
    saveState({ playbackSpeed: speed });
});

if (playBtn && videoUrlInput) {
    playBtn.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        if (!url) return alert('請先輸入 YouTube 影片或清單網址！');

        const target = parseYoutubeUrl(url);
        
        if (target.playlistId) {
            playList = target.playlistId;
            videoId = target.videoId || null; 
            // 🟢 更換新網址時，時間與歌單索引都強制歸零
            saveState({ mediaType: 'playlist', mediaId: playList, playTime: 0, playlistIndex: 0 });
            loadCurrentMedia(false);
        } else if (target.videoId) {
            playList = null; 
            videoId = target.videoId;
            saveState({ mediaType: 'video', mediaId: videoId, playTime: 0, playlistIndex: 0 });
            loadCurrentMedia(false);
        } else {
            alert('無法解析此網址，請確認是否為正確的 YouTube 連結。');
        }
    });

    videoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') playBtn.click();
    });
}

if (playDefaultBtn && videoUrlInput) {
    playDefaultBtn.addEventListener('click', () => {
        videoUrlInput.value = '';
        videoId = 'XrEI3eZmfWY';
        playList = 'PL7cc4XHWYMmSTybEzMhSvctDkizFSGE4r';
        saveState({ mediaType: 'video', mediaId: videoId, playTime: 0, playlistIndex: 0 });
        loadCurrentMedia(false);
    });
}

// 🟢 使用者手動點擊清單項目時，儲存新的索引並把時間歸零
if (playlistList) {
    playlistList.addEventListener('click', (e) => {
        const item = e.target.closest('.item');
        if (item && player && typeof player.playVideoAt === 'function') {
            const index = parseInt(item.getAttribute('data-index'), 10);
            saveState({ playlistIndex: index, playTime: 0 });
            player.playVideoAt(index);
        }
    });
}

if (fullscreenBtn && playerWrapper) {
    fullscreenBtn.addEventListener('click', () => {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        if (!isFullscreen) {
            if (playerWrapper.requestFullscreen) playerWrapper.requestFullscreen();
            else if (playerWrapper.webkitRequestFullscreen) playerWrapper.webkitRequestFullscreen();
            else if (playerWrapper.msRequestFullscreen) playerWrapper.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
    });
}

function onFullscreenChange() {
    if (!fullscreenBtn) return;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    const icon = fullscreenBtn.querySelector('i');
    if (icon) icon.className = isFullscreen ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

if (playPauseBtn) playPauseBtn.addEventListener('click', () => {
    if (!player) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
});

if (nextBtn) nextBtn.addEventListener('click', () => {
    if (player && player.getPlaylist()) player.nextVideo();
});

if (prevBtn) prevBtn.addEventListener('click', () => {
    if (player && player.getPlaylist()) player.previousVideo();
});