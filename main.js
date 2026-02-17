var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player, videoId = null, playList = null;
const defaultVideoId = "XrEI3eZmfWY";
const defaultPlaylist = "PL7cc4XHWYMmSTybEzMhSvctDkizFSGE4r";
const baseUrl = new URL(location.href);
const video_id = baseUrl.searchParams.get("v");
playList = baseUrl.searchParams.get("list");
if (video_id) {
    videoId = video_id;
} else {
    videoId = defaultVideoId;
}
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        videoId: videoId,
        playerVars: {
            "playsinline": 1,
            "autoplay": 1,
            "controls": 1,
            "fs": 1,
            "iv_load_policy": 3,
            "modestbranding": 1,
            "rel": 0,
            "showinfo": 0,
            "autohide": 0,
            "enablejsapi": 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}
$('#playBtn').click(function () {
    const v = $('#videoUrl').val();
    if (v && v.trim() !== '') {
        // 判斷是否為URL，若是URL則從中提取影片ID
        const urlPattern = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/;
        const match = v.match(urlPattern);
        if (match) {
            const url = new URL(v);
            const videoIdFromUrl = url.searchParams.get("v");
            const videoId = videoIdFromUrl || match[1];
            playVideo(videoId);
        } else {
            playVideo(v);
        }
    }else{
        alert('請輸入影片ID或URL');
    }
});

$("#playDefaultBtn").click(function () {
    playDefaultVideo();
});

window.videoPlayer = player;
function onPlayerReady(event) {
    loadPlaylist();
    playVideo(videoId);
}
const timeUpdateInterval = () => { setInterval(() => { getCurrentTime(); }, 1000); };
const clearTimeUpdateInterval = () => { clearInterval(timeUpdateInterval); };
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        timeUpdateInterval();
        player.setPlaybackQuality('hd1080');
    }
    if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.ENDED) {
        clearTimeUpdateInterval();
    }
    getVideoData();
    if (playList) {
        getPlaylist();
    }else{
        $('#playlist').text('');
    }
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function loadPlaylist() {
    if (playList) {
        player.loadPlaylist({
            listType: "playlist",
            list: `${playList}`
        });
    }
}
function pauseVideo() {
    player.pauseVideo();
}
function stopVideo() {
    player.stopVideo();
}

function playVideo(v) {
    playVideoId(v);
}
function nextVideo() {
    player.nextVideo();
}
function previousVideo() {
    player.previousVideo();
}

function playVideoId(v) {
    player.cueVideoById(v);
    player.playVideo();
}

function getPlaylist() {
    const playlistIndex = player.getPlaylistIndex();
    const playlistId = player.getPlaylistId();
    $('#playlist').text(`playlistIndex: ${playlistIndex} | playlistId: ${playlistId}`);
}

function getCurrentTime() {
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();
    $('#currentTime').text(`${formatTime(currentTime)} / ${formatTime(duration)}`);
}

function getVideoData() {
    const videoData = player.getVideoData();
    $('#videoTitle').text(videoData.title);
}

function getUrl() {
    const videoData = player.getVideoData();
    return `https://www.youtube.com/watch?v=${videoData.video_id}`;
}

function playDefaultVideo() {
    playVideo(defaultVideoId);
    player.loadPlaylist({
        listType: "playlist",
        list: `${defaultPlaylist}`
    });
    playList = defaultPlaylist;
}