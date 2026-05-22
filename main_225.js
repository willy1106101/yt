// ============================
// YouTube IFrame API
// ============================
// const tag = document.createElement('script');
// tag.src = 'https://www.youtube.com/iframe_api';
// document.head.appendChild(tag);

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// ==========================================
// 1. 全域變數與單一狀態管理 (State Management)
// ==========================================
let player = null;
window.videoPlayer = null;

const STORAGE_KEY = 'youtube_player_state';

// 🟢 修正：將影片ID與清單ID拆開獨立儲存，避免互相覆蓋
let playerState = {
    viewMode: 'video',
    playTime: 0,
    mediaType: 'video',      
    videoId: '9xp1XWmJ_Wo',  // 獨立儲存影片ID
    playlistId: null,        // 獨立儲存清單ID
    playlistIndex: 0,        
    isMuted: false,
    playbackSpeed: 1
};

// 單一讀取函式
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

// 🟢 初始化變數改為讀取獨立的 ID
let videoId = playerState.videoId;
let playList = playerState.playlistId;

const videoCache = {};
let timeUpdateTimer = null; 

// ==========================================
// 2. DOM 元素取得
// ==========================================
const viewModeBtn = document.getElementById('viewModeBtn');
const playerCover = document.getElementById('playerCover');
const coverTitle = document.getElementById('coverTitle');
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

// ====== 新增：時分秒跳轉 DOM ======
const seekHour = document.getElementById('seekHour');
const seekMinute = document.getElementById('seekMinute');
const seekSecond = document.getElementById('seekSecond');

if (playerWrapper) playerWrapper.style.position = 'relative';

// ==========================================
// 3. 初始化儲存狀態 (UI 部分)
// ==========================================
function initSavedUIState() {
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

    if (speedSelect) speedSelect.value = playerState.playbackSpeed;

    // 🟢 根據獨立的 ID 來還原網址
    if (videoUrlInput) {
        if (playerState.mediaType === 'playlist' && playerState.playlistId) {
            videoUrlInput.value = 'https://www.youtube.com/playlist?list=' + playerState.playlistId;
        } else if (playerState.mediaType === 'video' && playerState.videoId !== '9xp1XWmJ_Wo') {
            videoUrlInput.value = 'https://www.youtube.com/watch?v=' + playerState.videoId;
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
        playerVars: {
            autoplay: 1,
            mute: playerState.isMuted ? 1 : 0,
            playsinline: 1,
            controls: 0,
            rel: 0,
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
    window.videoPlayer = player;
}

function onPlayerReady() {
    player.setPlaybackRate(parseFloat(playerState.playbackSpeed));
    if (playerState.isMuted) {
        player.mute();
    } else {
        player.unMute();
    }
    updateMuteIcon(playerState.isMuted);
    loadCurrentMedia(true);
}
function onPlayerError(event) {
    console.error("播放發生錯誤，錯誤代碼：", event.data);
}

async function loadCurrentMedia(isInitLoad = false) {
    if (!player) return;

    const startSec = isInitLoad ? playerState.playTime : 0;
    const listIdx = isInitLoad ? playerState.playlistIndex : 0;

    // 🟢 依據 mediaType 判斷該載入清單還是影片
    if (playerState.mediaType === 'playlist' && playList) {
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
        if (currentMode === 'video' && playerCover) playerCover.style.opacity = '1';
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
        
        let idx = playerState.playlistIndex;
        if (typeof player.getPlaylistIndex === 'function') {
            const currentIdx = player.getPlaylistIndex();
            if (currentIdx !== -1) idx = currentIdx;
        }

        if (!isNaN(c) && !isNaN(d)) {
            if (currentTimeEl) currentTimeEl.textContent = `${format(c)} / ${format(d)}`;
            
            if (d > 0) {
                const percentage = (c / d) * 100;
                if (progressBar) progressBar.style.width = `${percentage}%`;
                
                saveState({ playTime: c, playlistIndex: idx }); 
            }
            
            // 🟢 新增：同步時分秒輸入框
            // 計算當前的時、分、秒
            const currentHour = Math.floor(c / 3600);
            const currentMinute = Math.floor((c % 3600) / 60);
            const currentSecond = Math.floor(c % 60);

            // 判斷該欄位是否正在被使用者選取 (focus)，如果沒有才更新數字
            if (seekHour && document.activeElement !== seekHour) {
                seekHour.value = currentHour;
            }
            if (seekMinute && document.activeElement !== seekMinute) {
                seekMinute.value = currentMinute;
            }
            if (seekSecond && document.activeElement !== seekSecond) {
                seekSecond.value = currentSecond;
            }
        }
    }, 250);
}

function stopTimeUpdate() {
    clearInterval(timeUpdateTimer);
    timeUpdateTimer = null;
    if (player && typeof player.getCurrentTime === 'function') {
        let idx = playerState.playlistIndex;
        if (typeof player.getPlaylistIndex === 'function') {
            const currentIdx = player.getPlaylistIndex();
            if (currentIdx !== -1) idx = currentIdx;
        }
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
    if (currentIndex === -1) return; 

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
    
    // 🟢 這裡只更新 videoId，就算在清單模式下，也不會洗掉 playlistId！
    saveState({ videoId: data.video_id });
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
    // 🟢 加入 typeof 防呆，確保 API 已經準備好
    if (!player || typeof player.isMuted !== 'function') return;
    
    const isCurrentlyMuted = player.isMuted();
    const targetMuteState = !isCurrentlyMuted; // 決定要切換過去的狀態
    
    if (targetMuteState) {
        player.mute();
    } else {
        player.unMute();
    }
    
    // 🟢 立即強制更新 UI 與存檔，不管 YouTube API 回應了沒
    updateMuteIcon(targetMuteState);
    saveState({ isMuted: targetMuteState });
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
        
        // 🟢 點擊播放時，明確地將影片 ID 與清單 ID 分別存入
        if (target.playlistId) {
            playList = target.playlistId;
            videoId = target.videoId || null; 
            saveState({ mediaType: 'playlist', playlistId: playList, videoId: videoId, playTime: 0, playlistIndex: 0 });
            loadCurrentMedia(false);
        } else if (target.videoId) {
            playList = null; 
            videoId = target.videoId;
            saveState({ mediaType: 'video', playlistId: null, videoId: videoId, playTime: 0, playlistIndex: 0 });
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
        saveState({ mediaType: 'playlist', videoId: videoId, playlistId: playList, playTime: 0, playlistIndex: 0 });
        loadCurrentMedia(false);
    });
}

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


// ====== 更新：時分秒直接監聽跳轉 ======
function jumpToInputTime(e) { 
    if (!player || typeof player.seekTo !== 'function') return;

    const h = parseInt(seekHour.value) || 0;
    const m = parseInt(seekMinute.value) || 0;
    const s = parseInt(seekSecond.value) || 0;

    const totalSeconds = (h * 3600) + (m * 60) + s;
    const duration = player.getDuration();
    
    if (duration > 0 && totalSeconds > duration) {
        console.warn('設定的時間超過影片總長度');
        return; 
    }

    // 執行跳轉與存檔
    player.seekTo(totalSeconds, true);
    saveState({ playTime: totalSeconds });

    // 🟢 新增：手動更新時間文字與進度條（解決暫停時畫面沒更新的問題）
    if (currentTimeEl && !isNaN(duration) && duration > 0) {
        currentTimeEl.textContent = `${format(totalSeconds)} / ${format(duration)}`;
        if (progressBar) {
            progressBar.style.width = `${(totalSeconds / duration) * 100}%`;
        }
    }

    // 手機版體驗優化：執行跳轉後，主動讓輸入框失去焦點，強制收起手機小鍵盤
    if (e && e.target && typeof e.target.blur === 'function') {
        e.target.blur();
    }
}

// 2. 直接監聽三個輸入框的 change 事件 (包含按上下箭頭調整)
[seekHour, seekMinute, seekSecond].forEach(inputEl => {
    if (inputEl) {
        inputEl.addEventListener('change', jumpToInputTime);
        
        // 保留 Enter 鍵也能觸發的習慣
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') jumpToInputTime();
        });
    }
});