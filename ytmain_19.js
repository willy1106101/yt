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

// 讀取網址參數
const pageUrl = new URL(window.location.href);
let videoId = pageUrl.searchParams.get('v') || defaultVideoId;

// ============================
// YouTube API 載入完成
// ============================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: videoId,
        playerVars: {
            autoplay: 1,       // 自動播放
            mute: 0,           // 靜音，確保瀏覽器允許 autoplay
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

    if (videoId) {
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

    getVideoData();
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
}

function getVideoData() {
    if (!player) return;

    const data = player.getVideoData();
    if (!data) return;

    document.title = data.title || '';

    window.postMessage({ action: 'yload-fis' }, '*');
    window.parent.postMessage({ action: 'yload-fis' }, '*');
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