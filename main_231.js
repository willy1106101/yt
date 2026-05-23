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
    playbackSpeed: 1,
    volume: 100
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

const centerPlayBtn = document.getElementById('centerPlayBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const muteBtn = document.getElementById('muteBtn');
const volumeSlider = document.getElementById('volumeSlider');
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
    if (volumeSlider) volumeSlider.value = playerState.volume;

    // 🟢 根據獨立的 ID 來還原網址
    if (videoUrlInput) {
        if (playerState.mediaType === 'playlist' && playerState.playlistId) {
            videoUrlInput.value = playerState.playlistId;
        } else if (playerState.mediaType === 'video' && playerState.videoId !== '9xp1XWmJ_Wo') {
            videoUrlInput.value = playerState.videoId;
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
            controls: 1,
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
    if (typeof player.setVolume === 'function') {
        player.setVolume(playerState.volume);
    }
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
        // 檢查 playList 是不是一個 JavaScript 陣列 (Array)
        if (Array.isArray(playList)) {
            player.loadPlaylist({
                playlist: playList,  // 這裡不設定 listType，直接把陣列傳給 playlist 屬性
                index: listIdx,
                startSeconds: startSec
            });
        } else {
            // 如果是一般的 YouTube 官方清單 ID 字串 (例如 "PLrAXtm...")
            player.loadPlaylist({
                listType: 'playlist',
                list: playList,
                index: listIdx,
                startSeconds: startSec
            });
        }
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
        // 🟢 新增：當影片開始播放時，幫封面加上 playing 樣式，並更新中央圖示
        if (playerCover) playerCover.classList.add('playing');
        if (window.updateCenterBtnIcon) window.updateCenterBtnIcon(true);
    } else {
        if (playPauseBtn) playPauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        stopTimeUpdate();
        if (event.data === YT.PlayerState.BUFFERING && playerCover) {
            playerCover.style.opacity = '1';
        }
        // 🟢 新增：當影片暫停、結束時，移除 playing 樣式，並恢復播放圖示
        if (playerCover) playerCover.classList.remove('playing');
        if (window.updateCenterBtnIcon) window.updateCenterBtnIcon(false);
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

            // 🟢 同步時分秒輸入框
            const currentHour = Math.floor(c / 3600);
            const currentMinute = Math.floor((c % 3600) / 60);
            const currentSecond = Math.floor(c % 60);

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

        // 🟢 新增：即時同步音量滑桿與靜音圖示 (防止使用者用原生控制項調整)
        if (typeof player.getVolume === 'function' && typeof player.isMuted === 'function') {
            const currentVolume = player.getVolume();
            const currentMuted = player.isMuted();

            // 1. 同步音量滑桿 (只有在使用者沒有在拖曳/聚焦滑桿時才更新，避免卡頓)
            if (volumeSlider && document.activeElement !== volumeSlider) {
                volumeSlider.value = currentVolume;
            }

            // 2. 根據當前真實狀態更新靜音圖示與狀態儲存
            // 如果真實狀態跟目前記憶狀態不同，才觸發更新
            if (currentMuted !== playerState.isMuted || currentVolume !== playerState.volume) {
                updateMuteIcon(currentMuted || currentVolume === 0);
                saveState({
                    volume: currentVolume,
                    isMuted: currentMuted
                });
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

    url = url.trim();

    // 1. 檢查是否為網址 (包含 http 或 youtube 關鍵字)
    if (url.includes('http') || url.includes('youtube.com') || url.includes('youtu.be')) {
        try {
            const urlObj = new URL(url);
            if (urlObj.searchParams.has('list')) result.playlistId = urlObj.searchParams.get('list');
            if (urlObj.searchParams.has('v')) result.videoId = urlObj.searchParams.get('v');
            else if (urlObj.hostname === 'youtu.be') result.videoId = urlObj.pathname.substring(1);
            else if (urlObj.pathname.startsWith('/embed/')) result.videoId = urlObj.pathname.split('/')[2];
        } catch (e) {
            console.error('網址解析失敗', e);
        }
        return result;
    }

    // 2. 如果不是網址，檢查是否為符合 JSON 陣列格式，例如 ["ID1", "ID2"] 或 ['ID1', 'ID2']
    if (url.startsWith('[') && url.endsWith(']')) {
        try {
            // 把單引號替換成雙引號以符合標準 JSON 格式
            const cleanJson = url.replace(/'/g, '"');
            const parsedArray = JSON.parse(cleanJson);
            if (Array.isArray(parsedArray) && parsedArray.length > 0) {
                result.playlistId = parsedArray; // 🟢 直接把整個陣列塞進 playlistId 傳回去
                return result;
            }
        } catch (e) {
            console.warn('嘗試解析 JSON 陣列失敗，將轉用分隔符號解析');
        }
    }

    // 3. 處理用「逗號」、「空格」或「換行」分隔的純 ID 列表 (例如: dQw4w9WgXcQ, 9xp1XWmJ_Wo)
    // 如果字串裡面有逗號或空格，代表它是複數 ID
    if (url.includes(',') || url.includes(' ') || url.includes('\n')) {
        // 利用正則表達式把 逗號、空格、換行 切開，並過濾掉空欄位
        const idList = url.split(/[\s,\n]+/).filter(id => id.trim().length === 11);
        if (idList.length > 0) {
            result.playlistId = idList; // 🟢 一樣當作自訂陣列傳回
            return result;
        }
    }

    // 4. 最後防線：如果只有 11 碼，那就是單一影片 ID
    if (url.length === 11) {
        result.videoId = url;
    } else if (url.length > 11) {
        // 如果超過 11 碼且不是網址，盲猜它是官方的 Playlist ID (例如 PLrAXtm...)
        result.playlistId = url;
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
    if (playlistText) {
        playlistText.textContent = `ID: ${list[currentIndex]} (第 ${currentIndex + 1} 首 ，共 ${list.length} 首)`;
    }

    setTimeout(() => {
        const activeItem = playlistList.querySelector('.item.active');
        if (activeItem) {
            if (typeof activeItem.scrollIntoViewIfNeeded === 'function') {
                // 🟢 這是最完美的解法：只在看不見時才滾動，且絕不連動整個螢幕
                activeItem.scrollIntoViewIfNeeded(false); // false 代表滾動到容器的最近邊緣，類似 nearest
            } else {
                // 防呆備用：萬一極舊瀏覽器不支援，才走舊方法，但把 block 改成 center 或 nearest
                activeItem.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            }
        }
    }, 50);
}

function updateVideoData() {
    const data = player.getVideoData();
    if (!data || !videoTitleEl) return;

    // 🟢 這裡只更新 videoId，就算在清單模式下，也不會洗掉 playlistId！
    saveState({ videoId: data.video_id });
    videoTitleEl.innerHTML = `<a href="https://www.youtube.com/watch?v=${data.video_id}" class="text-decoration-none text-dark" title="${data.title}">${data.title}</a>` || '';
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

if (playerCover && centerPlayBtn) {
    centerPlayBtn.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest("#progressBarContainer") || e.target.closest('input') || e.target.closest('.item')) {
            return;
        }

        if (!player || typeof player.getPlayerState !== 'function') return;
        const currentState = player.getPlayerState();

        if (currentState === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });

    // 簡化此函式：只管換圖，不管透明度（透明度交給 CSS 控制）
    function updateCenterBtnIcon(isPlaying) {
        if (isPlaying) {
            centerPlayBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
        } else {
            centerPlayBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        }
    }

    window.updateCenterBtnIcon = updateCenterBtnIcon;
}

if (muteBtn) muteBtn.addEventListener('click', () => {
    if (!player || typeof player.isMuted !== 'function') return;

    const isCurrentlyMuted = player.isMuted();
    const targetMuteState = !isCurrentlyMuted;

    if (targetMuteState) {
        player.mute();
    } else {
        player.unMute();
        // 🟢 如果解除靜音時，滑桿數值是 0，主動幫它恢復到 30 的音量，不然會聽不見
        if (volumeSlider && parseInt(volumeSlider.value, 10) === 0) {
            volumeSlider.value = 30;
            player.setVolume(30);
            saveState({ volume: 30 });
        }
    }

    updateMuteIcon(targetMuteState);
    saveState({ isMuted: targetMuteState });
});

if (volumeSlider) {
    // 監聽 input 事件，滑鼠拖曳的過程中會即時改變音量
    volumeSlider.addEventListener('input', (e) => {
        const volumeValue = parseInt(e.target.value, 10);

        if (player && typeof player.setVolume === 'function') {
            player.setVolume(volumeValue);

            // 💡 體驗優化：如果使用者把音量拉大於 0，且原本是靜音狀態，就主動解除靜音
            if (volumeValue > 0 && player.isMuted()) {
                player.unMute();
                updateMuteIcon(false);
                saveState({ isMuted: false });
            }
            // 如果拉到 0，就自動切換成靜音圖示
            else if (volumeValue === 0) {
                updateMuteIcon(true);
            } else {
                updateMuteIcon(false);
            }
        }

        // 儲存當前音量到 LocalStorage
        saveState({ volume: volumeValue });
    });
}

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

$(document).ready(function () {
    $('#pasteBtn').click(async function () {
        // 檢查瀏覽器是否支援剪貼簿 API
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const text = await navigator.clipboard.readText();
                $('#videoUrl').val(text);
            } catch (err) {
                console.error('手機讀取剪貼簿失敗: ', err);
                alert('貼上失敗，請檢查是否已拒絕權限，或請直接長按輸入框手動貼上。');
            }
        } else {
            alert('您的瀏覽器不支援一鍵貼上，請長按輸入框並選擇「貼上」。');
        }
    });
});