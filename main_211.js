// ============================
// YouTube IFrame API
// ============================
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

// ============================
// Player state
// ============================
let player = null;
window.videoPlayer = null;

let timeUpdateTimer = null;

let videoId = 'XrEI3eZmfWY';
let playList = 'PL7cc4XHWYMmSTybEzMhSvctDkizFSGE4r';
// ============================
// oEmbed cache
// ============================
const videoCache = {};

// ============================
// oEmbed
// ============================
async function fetchVideoInfo(videoId) {
    if (videoCache[videoId]) return videoCache[videoId];

    try {
        const res = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );

        const data = await res.json();

        const info = {
            title: data.title,
            thumbnail: data.thumbnail_url,
            author: data.author_name
        };

        videoCache[videoId] = info;
        return info;

    } catch (e) {
        return {
            title: videoId,
            thumbnail: '',
            author: ''
        };
    }
}

// ============================
// 工具：從網址解析 YouTube ID 或 Playlist ID
// ============================
function parseYoutubeUrl(url) {
    const result = { videoId: null, playlistId: null };
    if (!url) return result;

    try {
        const urlObj = new URL(url);

        // 檢查是不是 Playlist
        if (urlObj.searchParams.has('list')) {
            result.playlistId = urlObj.searchParams.get('list');
        }

        // 檢查是不是 standard 網址 (youtube.com/watch?v=...)
        if (urlObj.searchParams.has('v')) {
            result.videoId = urlObj.searchParams.get('v');
        }
        // 檢查是不是短網址 (youtu.be/...)
        else if (urlObj.hostname === 'youtu.be') {
            result.videoId = urlObj.pathname.substring(1);
        }
        // 檢查是不是 embed 網址 (youtube.com/embed/...)
        else if (urlObj.pathname.startsWith('/embed/')) {
            result.videoId = urlObj.pathname.split('/')[2];
        }
    } catch (e) {
        // 如果不是標準網址，嘗試當作純文字 ID 處理
        if (url.length === 11) result.videoId = url;
        else if (url.length > 11) result.playlistId = url;
    }

    return result;
}

// ============================
// Init Player
// ============================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        width: '100%',  // 配合 CSS RWD
        height: '100%', // 配合 CSS RWD
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            controls: 1,
            rel: 0
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange
        }
    });

    window.videoPlayer = player;
}

// ============================
// Ready
// ============================
function onPlayerReady() {
    player.mute();
    loadCurrentMedia();
}

// 加載目前的影片或清單
function loadCurrentMedia() {
    if (!player) return;

    if (playList) {
        player.loadPlaylist({
            listType: 'playlist',
            list: playList
        });
    } else if (videoId) {
        player.loadVideoById(videoId);
    }
    player.playVideo();
}

// ============================
// State change
// ============================
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        startTimeUpdate();
        // 當開始播放時，切換圖示為「暫停」
        $('#playPauseBtn').html('<i class="bi bi-pause-fill"></i>');
    } else {
        stopTimeUpdate();
        // 停止或暫停時，切換圖示為「播放」
        $('#playPauseBtn').html('<i class="bi bi-play-fill"></i>');
    }

    // 只有在真的有播放清單時才撈清單資訊
    const list = player.getPlaylist();
    if (list && list.length > 0) {
        renderPlaylist();
    } else {
        // 如果是單一影片，清空清單區域
        $('#playlistList').html('<div class="p-3 text-muted text-center">單一影片播放中，無播放清單</div>');
        $('#playlist').text('');
    }

    updateVideoData();
}

// ============================
// Playlist render
// ============================
async function renderPlaylist() {
    if (!player) return;

    const list = player.getPlaylist();
    if (!list) return;

    const currentIndex = player.getPlaylistIndex();

    const infos = await Promise.all(
        list.map(id => fetchVideoInfo(id))
    );

    let html = '';

    infos.forEach((info, i) => {
        const id = list[i];
        const active = i === currentIndex;

        html += `
            <div class="item"
                 data-index="${i}"
                 style="
                    display:flex;
                    gap:10px;
                    padding:8px;
                    cursor:pointer;
                    align-items:center;
                    background:${active ? '#ffe0e0' : '#fff'};
                    border-bottom:1px solid #eee;
                 ">
                <div>${i + 1}</div>
                <img src="${info.thumbnail}"
                    style="width:120px;height:68px;object-fit:cover;border-radius:6px;" />
                <div>
                    <div style="font-size:14px;font-weight:bold;">
                        ${info.title}
                    </div>
                    <div style="font-size:12px;color:#666;">
                        ${info.author}
                    </div>
                </div>
            </div>
        `;
    });

    $('#playlistList').html(html);
    $('#playlist').text(`(${currentIndex + 1} / ${list.length})`);
}

// ============================
// click playlist item
// ============================
$(document).on('click', '.item', function () {
    const index = $(this).data('index');
    player.playVideoAt(index);
});

// ============================
// time update
// ============================
function startTimeUpdate() {
    if (timeUpdateTimer) return;

    timeUpdateTimer = setInterval(() => {
        const c = player.getCurrentTime();
        const d = player.getDuration();

        if (!isNaN(c) && !isNaN(d)) {
            $('#currentTime').text(
                `${format(c)} / ${format(d)}`
            );
        }
    }, 1000);
}

function stopTimeUpdate() {
    clearInterval(timeUpdateTimer);
    timeUpdateTimer = null;
}

// ============================
// format time
// ============================
function format(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================
// video info
// ============================
function updateVideoData() {
    const data = player.getVideoData();
    if (!data) return;

    $('#videoTitle').text(data.title || '');
}

// ============================
// 控制列按鈕事件 (Controls)
// ============================
$('#playPauseBtn').on('click', () => {
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
});

$('#nextBtn').on('click', () => {
    const list = player.getPlaylist();
    if (list) player.nextVideo();
});

$('#prevBtn').on('click', () => {
    const list = player.getPlaylist();
    if (list) player.previousVideo();
});


// ============================
// ⭐ 新增：輸入框與主功能按鈕事件
// ============================

// 1. 點擊「播放」按鈕
$('#playBtn').on('click', () => {
    const url = $('#videoUrl').val().trim();
    if (!url) {
        alert('請先輸入 YouTube 影片或清單網址！');
        return;
    }

    const target = parseYoutubeUrl(url);

    if (target.playlistId) {
        // 如果有清單 ID，優先播放清單
        playList = target.playlistId;
        videoId = target.videoId || null; // 有內含單片 ID 就記錄
        loadCurrentMedia();
    } else if (target.videoId) {
        // 如果純粹是單一影片
        playList = null;
        videoId = target.videoId;
        loadCurrentMedia();
    } else {
        alert('無法解析此網址，請確認是否為正確的 YouTube 連結。');
    }
});

// 支援按下 Enter 直接播放
$('#videoUrl').on('keypress', (e) => {
    if (e.which === 13) {
        $('#playBtn').click();
    }
});

// 2. 點擊「預設影片」按鈕
$('#playDefaultBtn').on('click', () => {
    $('#videoUrl').val(''); // 清空輸入框
    loadCurrentMedia();
});