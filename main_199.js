// ============================
// 載入 YouTube IFrame API
// ============================
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

// ============================
// 全域變數
// ============================
let player = null;
window.videoPlayer = null;

let timeUpdateTimer = null;

const defaultVideoId = 'XrEI3eZmfWY';
const defaultPlaylist = 'PL7cc4XHWYMmSTybEzMhSvctDkizFSGE4r';

// 讀取網址參數
const pageUrl = new URL(window.location.href);
let videoId = pageUrl.searchParams.get('v') || defaultVideoId;
let playList = pageUrl.searchParams.get('list') || null;

// ============================
// YouTube API 載入完成
// ============================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: videoId,
        playerVars: {
            autoplay: 1,       // 自動播放
            mute: 1,           // 靜音，確保瀏覽器允許 autoplay
            playsinline: 1,
            controls: 1,
            fs: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });

    window.videoPlayer = player;
}

// ============================
// Player Ready
// ============================
function onPlayerReady() {
    // 靜音後大多數瀏覽器可自動播放
    player.mute();

    if (playList) {
        loadPlaylist();
    } else {
        playVideo(videoId);
    }
    if (
        player.getPlayerState &&
        player.getPlayerState() !== YT.PlayerState.PLAYING
    ) {
        player.playVideo();
    }
}

// ============================
// Player 狀態變更
// ============================
function onPlayerStateChange(event) {
    switch (event.data) {
        case YT.PlayerState.PLAYING:
            startTimeUpdate();
            try {
                player.setPlaybackQuality('hd1080');
            } catch (e) {}
            break;

        case YT.PlayerState.PAUSED:
        case YT.PlayerState.ENDED:
            stopTimeUpdate();
            break;
    }

    // 播放清單播完後重新播放預設清單
    if (
        event.data === YT.PlayerState.ENDED &&
        playList &&
        isEndOfPlaylist()
    ) {
        playDefaultVideo();
    }

    getVideoData();

    if (playList) {
        getPlaylist();
    } else {
        $('#playlist').text('');
    }
}

// ============================
// 計時器
// ============================
function startTimeUpdate() {
    if (timeUpdateTimer) return;

    timeUpdateTimer = setInterval(() => {
        getCurrentTime();
    }, 1000);
}

function stopTimeUpdate() {
    if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer);
        timeUpdateTimer = null;
    }
}

// ============================
// 時間格式化
// ============================
function formatTime(seconds = 0) {
    seconds = Math.floor(seconds);

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================
// 播放清單
// ============================
function loadPlaylist() {
    if (!player || !playList) return;

    player.loadPlaylist({
        listType: 'playlist',
        list: playList
    });
}

function getPlaylist() {
    if (!player || !playList) return;

    const playlist = player.getPlaylist();
    if (!playlist) return;

    const index = player.getPlaylistIndex() + 1;
    const length = playlist.length;
    const playlistId = player.getPlaylistId();

    $('#playlist').text(
        `playlistIndex: (${index}/${length}) | playlistId: ${playlistId}`
    );
}

function isEndOfPlaylist() {
    if (!player || !playList) return false;

    const playlist = player.getPlaylist();
    if (!playlist || playlist.length === 0) return false;

    return player.getPlaylistIndex() >= playlist.length - 1;
}

// ============================
// 播放控制
// ============================
function playVideo(id) {
    if (!player || !id) return;

    videoId = id;

    player.loadVideoById(id);

    // 通知外部頁面
    window.postMessage({ action: 'yload-fis' }, '*');
    window.parent.postMessage({ action: 'yload-fis' }, '*');
}

function playVideoId(id) {
    if (!player || !id) return;

    player.cueVideoById(id);
    if (
        player.getPlayerState &&
        player.getPlayerState() !== YT.PlayerState.PLAYING
    ) {
        player.playVideo();
    }
}

function pauseVideo() {
    if (player) player.pauseVideo();
}

function stopVideo() {
    if (player) player.stopVideo();
}

function nextVideo() {
    if (player) player.nextVideo();
}

function previousVideo() {
    if (player) player.previousVideo();
}

function togglePlayPause() {
    if (!player) return;

    const state = player.getPlayerState();

    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

// ============================
// 取得播放資訊
// ============================
function getCurrentTime() {
    if (!player) return;

    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    const data = {
        c: currentTime,
        d: duration
    };

    window.postMessage({ action: 'ydetail', data }, '*');
    window.parent.postMessage({ action: 'ydetail', data }, '*');

    $('#currentTime').text(
        `${formatTime(currentTime)} / ${formatTime(duration)}`
    );
}

function getVideoData() {
    if (!player) return;

    const data = player.getVideoData();
    if (!data) return;

    $('#videoTitle').text(data.title || '');

    window.postMessage({ action: 'yload-fis' }, '*');
    window.parent.postMessage({ action: 'yload-fis' }, '*');
}

function getUrl() {
    if (!player) return '';

    const data = player.getVideoData();
    if (!data || !data.video_id) return '';

    return `https://www.youtube.com/watch?v=${data.video_id}`;
}

// ============================
// 播放預設影片與清單
// ============================
function playDefaultVideo() {
    playList = defaultPlaylist;
    videoId = defaultVideoId;

    // 先載入播放清單，YouTube 會自動播放第一支影片
    loadPlaylist();
}

// ============================
// 解析 YouTube URL
// ============================
function extractVideoId(input) {
    try {
        const url = new URL(input);

        const v = url.searchParams.get('v');
        if (v) return v;

        if (url.hostname.includes('youtu.be')) {
            return url.pathname.replace('/', '');
        }
    } catch (e) {
        // 非網址，直接視為 video id
    }

    return input.trim();
}

// ============================
// 按鈕事件
// ============================
$('#playBtn').on('click', function () {
    const value = $('#videoUrl').val();

    if (!value || value.trim() === '') {
        alert('請輸入影片 ID 或 URL');
        return;
    }

    const id = extractVideoId(value);
    playList = null; // 切換為單影片模式
    playVideo(id);
});

$('#playDefaultBtn').on('click', function () {
    playDefaultVideo();
});

$('#playPauseBtn').on('click', function () {
    togglePlayPause();
});

$('#nextBtn').on('click', function () {
    nextVideo();
});

$('#prevBtn').on('click', function () {
    previousVideo();
});

// ============================
// 接收 postMessage
// ============================
window.addEventListener('message', function (event) {
    const data = event.data;

    if (!data || !data.action) return;

    switch (data.action) {
        case 'playVideo':
            togglePlayPause();
            break;

        case 'nextVideo':
            nextVideo();
            break;

        case 'previousVideo':
            previousVideo();
            break;
    }
});