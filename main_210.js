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
// Init Player
// ============================
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
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

    if (playList) {
        player.loadPlaylist({
            listType: 'playlist',
            list: playList
        });
    }

    player.playVideo();
}

// ============================
// State change
// ============================
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        startTimeUpdate();
    } else {
        stopTimeUpdate();
    }

    if (playList) {
        renderPlaylist();
    }

    updateVideoData();
}

// ============================
// Playlist render
// ============================
async function renderPlaylist() {
    if (!player || !playList) return;

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
                <div>${i+1}</div>
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
    $('#playIndex').html(`${currentIndex+1} / ${list.length}`);
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

        $('#currentTime').text(
            `${format(c)} / ${format(d)}`
        );
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

    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
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
// controls
// ============================
$('#playPauseBtn').on('click', () => {
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
});

$('#nextBtn').on('click', () => player.nextVideo());
$('#prevBtn').on('click', () => player.previousVideo());